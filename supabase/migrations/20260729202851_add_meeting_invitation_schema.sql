-- Conferly PR B: secure invitation credentials for joining an existing meeting.
--
-- This migration intentionally stores only a SHA-256 invitation token hash. The
-- raw token is generated and returned once by trusted application-server code.
--
-- IMPORTANT: Apply this migration transactionally. The explicit table lock makes
-- the duplicate precheck and subsequent uniqueness constraint race-safe.

-- -----------------------------------------------------------------------------
-- 1. Enforce one participant membership per meeting and user.
-- -----------------------------------------------------------------------------

LOCK TABLE public.meeting_participants IN SHARE ROW EXCLUSIVE MODE;

DO $duplicate_precheck$
DECLARE
  duplicate_group_count bigint;
  duplicate_row_count bigint;
BEGIN
  SELECT count(*), coalesce(sum(duplicate_count - 1), 0)
    INTO duplicate_group_count, duplicate_row_count
  FROM (
    SELECT count(*) AS duplicate_count
    FROM public.meeting_participants
    GROUP BY meeting_id, user_id
    HAVING count(*) > 1
  ) AS duplicate_groups;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'Cannot add meeting_participants uniqueness: found %s duplicate (meeting_id, user_id) group(s) containing %s excess row(s). Resolve duplicates explicitly, then rerun the migration.',
        duplicate_group_count,
        duplicate_row_count
      );
  END IF;
END
$duplicate_precheck$;

ALTER TABLE public.meeting_participants
  ADD CONSTRAINT meeting_participants_meeting_id_user_id_key
  UNIQUE (meeting_id, user_id);

-- -----------------------------------------------------------------------------
-- 2. Store invitation metadata and token hashes (never raw tokens).
-- -----------------------------------------------------------------------------

CREATE TABLE public.meeting_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  token_hash text NOT NULL,
  role text NOT NULL DEFAULT 'attendee',
  created_by uuid NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meeting_invitations_meeting_id_fkey
    FOREIGN KEY (meeting_id)
    REFERENCES public.meetings(id)
    ON DELETE CASCADE,
  CONSTRAINT meeting_invitations_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id),
  CONSTRAINT meeting_invitations_token_hash_key
    UNIQUE (token_hash),
  CONSTRAINT meeting_invitations_token_hash_format_check
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT meeting_invitations_role_check
    CHECK (role IN ('attendee', 'presenter')),
  CONSTRAINT meeting_invitations_max_uses_check
    CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT meeting_invitations_use_count_nonnegative_check
    CHECK (use_count >= 0),
  CONSTRAINT meeting_invitations_use_count_within_max_check
    CHECK (max_uses IS NULL OR use_count <= max_uses),
  CONSTRAINT meeting_invitations_expiry_after_creation_check
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

COMMENT ON TABLE public.meeting_invitations IS
  'Meeting invitation metadata. token_hash contains a lowercase hexadecimal SHA-256 digest; raw invitation tokens must never be stored.';
COMMENT ON COLUMN public.meeting_invitations.token_hash IS
  'Lowercase hexadecimal SHA-256 digest of a crypto-secure URL-safe raw token. Never store the raw token.';
COMMENT ON COLUMN public.meeting_invitations.role IS
  'Reserved invitation role. Initial acceptance always grants attendee and never escalates an existing participant role.';

-- The token_hash unique constraint already supplies the exact-match lookup index.
CREATE INDEX meeting_invitations_meeting_id_idx
  ON public.meeting_invitations (meeting_id);

CREATE INDEX meeting_invitations_created_by_idx
  ON public.meeting_invitations (created_by);

-- Supports owner-facing active-invitation listings. Volatile expiry/use-count
-- conditions remain query filters because they are unsuitable index predicates.
CREATE INDEX meeting_invitations_active_lookup_idx
  ON public.meeting_invitations (meeting_id, expires_at, created_at DESC)
  WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- 3. RLS and column-level API privileges.
-- -----------------------------------------------------------------------------

ALTER TABLE public.meeting_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_invitations_owner_insert
  ON public.meeting_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.meetings AS meeting
      WHERE meeting.id = meeting_invitations.meeting_id
        AND meeting.owner = (SELECT auth.uid())
    )
  );

CREATE POLICY meeting_invitations_owner_select
  ON public.meeting_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meetings AS meeting
      WHERE meeting.id = meeting_invitations.meeting_id
        AND meeting.owner = (SELECT auth.uid())
    )
  );

CREATE POLICY meeting_invitations_owner_revoke
  ON public.meeting_invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meetings AS meeting
      WHERE meeting.id = meeting_invitations.meeting_id
        AND meeting.owner = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meetings AS meeting
      WHERE meeting.id = meeting_invitations.meeting_id
        AND meeting.owner = (SELECT auth.uid())
    )
    AND revoked_at IS NOT NULL
  );

-- Do not rely on RLS alone to conceal token hashes from meeting owners. Revoke
-- broad table privileges and expose only the metadata columns owners require.
REVOKE ALL ON TABLE public.meeting_invitations FROM PUBLIC;
REVOKE ALL ON TABLE public.meeting_invitations FROM anon;
REVOKE ALL ON TABLE public.meeting_invitations FROM authenticated;

GRANT SELECT (
  id,
  meeting_id,
  role,
  created_by,
  expires_at,
  revoked_at,
  max_uses,
  use_count,
  last_used_at,
  created_at
) ON public.meeting_invitations TO authenticated;

GRANT INSERT (
  meeting_id,
  token_hash,
  role,
  created_by,
  expires_at,
  max_uses
) ON public.meeting_invitations TO authenticated;

-- Column-level UPDATE prevents owners from changing identity, token, usage, or
-- validity fields through the Data API; the policy permits only revocation.
GRANT UPDATE (revoked_at)
  ON public.meeting_invitations
  TO authenticated;
