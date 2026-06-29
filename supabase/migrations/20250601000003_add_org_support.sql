-- db/migrations/003_add_org_support.sql
-- Add minimal organization schema for multi-tenant authorization.
-- Only apply if org-based access control is required.

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create org_members table (replaces implied org_members references)
CREATE TABLE IF NOT EXISTS org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member', -- admin, member
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 3. Add owner and org_id to meetings (if meetings should be org-scoped)
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS owner uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON public.meetings(org_id);

-- 5. Enable RLS on org tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for organizations
CREATE POLICY organizations_select_for_members
  ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = organizations.id
        AND om.user_id = (select auth.uid())
    )
  );

CREATE POLICY organizations_insert_for_auth
  ON organizations
  FOR INSERT
  WITH CHECK (created_by = (select auth.uid()));

-- 7. RLS policies for org_members
CREATE POLICY org_members_select_for_org_users
  ON org_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om2
      WHERE om2.org_id = org_members.org_id
        AND om2.user_id = (select auth.uid())
    )
  );

CREATE POLICY org_members_insert_for_org_admin
  ON org_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (select auth.uid())
        AND om.role = 'admin'
    )
  );

CREATE POLICY org_members_update_for_org_admin
  ON org_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (select auth.uid())
        AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (select auth.uid())
        AND om.role = 'admin'
    )
  );

CREATE POLICY org_members_delete_for_org_admin
  ON org_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (select auth.uid())
        AND om.role = 'admin'
    )
  );

-- 8. Update meetings RLS to support org-based access
-- (Replaces the meetings policies from 002_hardening.sql with org-aware versions)
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS meetings_select_for_participants ON public.meetings';
  EXECUTE 'DROP POLICY IF EXISTS meetings_insert_owner_only ON public.meetings';
  EXECUTE 'DROP POLICY IF EXISTS meetings_modify_owner_only ON public.meetings';
  
  EXECUTE $pol$
    CREATE POLICY meetings_select_for_org_or_participant
      ON public.meetings
      FOR SELECT
      USING (
        owner = (select auth.uid())
        OR (
          org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.org_members om
            WHERE om.org_id = public.meetings.org_id
              AND om.user_id = (select auth.uid())
          )
        )
        OR EXISTS (
          SELECT 1 FROM public.meeting_participants mp
          WHERE mp.meeting_id = public.meetings.id
            AND mp.user_id = (select auth.uid())
        )
      );

    CREATE POLICY meetings_insert_owner_or_org_member
      ON public.meetings
      FOR INSERT
      WITH CHECK (
        owner = (select auth.uid())
        OR (
          org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.org_members om
            WHERE om.org_id = public.meetings.org_id
              AND om.user_id = (select auth.uid())
          )
        )
      );

    CREATE POLICY meetings_modify_owner_or_org_admin_update
      ON public.meetings
      FOR UPDATE
      USING (
        owner = (select auth.uid())
        OR (
          org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.org_members om
            WHERE om.org_id = public.meetings.org_id
              AND om.user_id = (select auth.uid())
              AND om.role = 'admin'
          )
        )
      )
      WITH CHECK (
        owner = (select auth.uid())
        OR (
          org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.org_members om
            WHERE om.org_id = public.meetings.org_id
              AND om.user_id = (select auth.uid())
              AND om.role = 'admin'
          )
        )
      );

    CREATE POLICY meetings_modify_owner_or_org_admin_delete
      ON public.meetings
      FOR DELETE
      USING (
        owner = (select auth.uid())
        OR (
          org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.org_members om
            WHERE om.org_id = public.meetings.org_id
              AND om.user_id = (select auth.uid())
              AND om.role = 'admin'
          )
        )
      );
  $pol$;
END$$;
