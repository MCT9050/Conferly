-- -----------------------------------------------------------------------------
-- 4. Atomically accept an invitation.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_meeting_invitation(
  p_meeting_slug text,
  p_token_hash text
)
RETURNS TABLE (
  meeting_id uuid,
  slug text,
  database_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  authenticated_user_id uuid := auth.uid();
  invitation_id uuid;
  invitation_created_by uuid;
  invitation_revoked_at timestamptz;
  invitation_expires_at timestamptz;
  invitation_max_uses integer;
  invitation_use_count integer;
  resolved_meeting_id uuid;
  resolved_meeting_owner uuid;
  resolved_slug text;
  participant_role text;
  participant_was_inserted boolean := false;
BEGIN
  IF authenticated_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '28000',
      MESSAGE = 'authentication required';
  END IF;

  -- Enforce the initial SHA-256 storage contract and avoid malformed probes.
  IF p_meeting_slug IS NULL
     OR p_meeting_slug = ''
     OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'invalid invitation';
  END IF;

  -- Resolve locator and credential together. FOR UPDATE serializes all uses of
  -- one invitation, making max_uses and use_count safe under concurrent calls.
  SELECT invitation.id,
         invitation.created_by,
         invitation.revoked_at,
         invitation.expires_at,
         invitation.max_uses,
         invitation.use_count,
         meeting.id,
         meeting.owner,
         meeting.slug
    INTO invitation_id,
         invitation_created_by,
         invitation_revoked_at,
         invitation_expires_at,
         invitation_max_uses,
         invitation_use_count,
         resolved_meeting_id,
         resolved_meeting_owner,
         resolved_slug
  FROM public.meeting_invitations AS invitation
  JOIN public.meetings AS meeting
    ON meeting.id = invitation.meeting_id
  WHERE meeting.slug = p_meeting_slug
    AND invitation.token_hash = p_token_hash
  FOR UPDATE OF invitation;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'invalid invitation';
  END IF;

  -- Owners never become participant rows and never consume their own invite.
  IF resolved_meeting_owner = authenticated_user_id THEN
    RETURN QUERY
      SELECT resolved_meeting_id, resolved_slug, 'host'::text;
    RETURN;
  END IF;

  -- Idempotency is scoped by the matching slug + token_hash above. Existing
  -- membership remains authoritative even if this invitation was later revoked,
  -- expired, or exhausted; invitation state only gates new membership.
  UPDATE public.meeting_participants AS participant
  SET joined_at = coalesce(participant.joined_at, statement_timestamp())
  WHERE participant.meeting_id = resolved_meeting_id
    AND participant.user_id = authenticated_user_id
  RETURNING participant.role INTO participant_role;

  IF FOUND THEN
    RETURN QUERY
      SELECT resolved_meeting_id, resolved_slug, participant_role;
    RETURN;
  END IF;

  -- Only callers without existing membership must satisfy current invitation
  -- validity and capacity. Revoked, expired, or exhausted invitations never
  -- establish new access.
  IF invitation_revoked_at IS NOT NULL
     OR (invitation_expires_at IS NOT NULL
         AND invitation_expires_at <= statement_timestamp())
     OR (invitation_max_uses IS NOT NULL
         AND invitation_use_count >= invitation_max_uses) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'invalid invitation';
  END IF;

  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id,
    role,
    invited_by,
    joined_at
  )
  VALUES (
    resolved_meeting_id,
    authenticated_user_id,
    'attendee',
    invitation_created_by,
    statement_timestamp()
  )
  ON CONFLICT ON CONSTRAINT meeting_participants_meeting_id_user_id_key
  DO NOTHING
  RETURNING role INTO participant_role;

  participant_was_inserted := FOUND;

  IF NOT participant_was_inserted THEN
    -- Defensive fallback for a concurrent membership created outside this RPC
    -- after the idempotency check. Do not consume invitation usage.
    UPDATE public.meeting_participants AS participant
    SET joined_at = coalesce(participant.joined_at, statement_timestamp())
    WHERE participant.meeting_id = resolved_meeting_id
      AND participant.user_id = authenticated_user_id
    RETURNING participant.role INTO participant_role;

    RETURN QUERY
      SELECT resolved_meeting_id, resolved_slug, participant_role;
    RETURN;
  END IF;

  UPDATE public.meeting_invitations AS invitation
  SET use_count = invitation.use_count + 1,
      last_used_at = statement_timestamp()
  WHERE invitation.id = invitation_id;

  RETURN QUERY
    SELECT resolved_meeting_id, resolved_slug, participant_role;
END
$function$;

COMMENT ON FUNCTION public.accept_meeting_invitation(text, text) IS
  'Validates a meeting slug plus SHA-256 token hash for auth.uid(), atomically creates attendee membership, and returns only meeting_id, slug, and database_role.';

-- PostgreSQL grants function execution to PUBLIC by default; remove it before
-- granting only the authenticated API role. The caller must use the recipient's
-- JWT so auth.uid() is authoritative; no caller-supplied user id is accepted.
REVOKE ALL ON FUNCTION public.accept_meeting_invitation(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_meeting_invitation(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.accept_meeting_invitation(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_meeting_invitation(text, text) TO authenticated;
