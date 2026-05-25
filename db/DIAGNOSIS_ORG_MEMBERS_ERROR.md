# Supabase org_members Migration Diagnosis

## Error Summary
```
ERROR: 42P01: relation "public.org_members" does not exist
```

## Root Cause
A migration was attempted that referenced:
- `public.org_members` table (does not exist)
- `meetings.org_id` column (does not exist)
- Org-based RLS policies on `public.meetings`

The current schema has **no organization/tenant support**.

---

## Current Schema Analysis

### Existing Tables
| Table | Purpose | Key Columns |
|-------|---------|------------|
| `profiles` | User metadata | `id` (→ auth.users) |
| `meetings` | Meeting records | `id`, `owner` (→ auth.users), `slug`, `is_public` |
| `meeting_participants` | Meeting membership | `meeting_id`, `user_id`, `role` (attendee/presenter/host) |
| `presentations`, `slides` | Meeting content | Links via `meeting_id` |
| `recordings`, `audit_logs` | Meeting artifacts | Various |

### RLS Model
- **Meetings authorization**: Based on `owner` (single user) + `meeting_participants` membership
- **Access patterns**: 
  - Owner can create/update/delete a meeting
  - Participants can view/join the meeting
  - No multi-tenant/org scoping

---

## Solutions

### ✅ **Option A: Keep Current (Recommended for Single-User/Team Meetings)**

**Status**: Current migrations (001_init.sql + 002_hardening.sql) are correct.

**What to do**:
1. Delete any partial org-based migration files from your repository
2. Apply only:
   - `db/migrations/001_init.sql` (base schema)
   - `db/migrations/002_hardening.sql` (security hardening)
3. Verify by running:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
   ```
   Expected tables: `audit_logs`, `meetings`, `meeting_participants`, `presentations`, `profiles`, `recordings`, `slides`

**Validation**: Rerun Supabase Advisor to confirm no missing RLS policies or orphaned references.

---

### 🆕 **Option B: Add Org/Multi-Tenant Support**

If you need **organizations** with **members** and **org-scoped meetings**, apply:

```bash
# Apply base + hardening first
psql "$SUPABASE_DB_URL" -f db/migrations/001_init.sql
psql "$SUPABASE_DB_URL" -f db/migrations/002_hardening.sql

# Then apply org support
psql "$SUPABASE_DB_URL" -f db/migrations/003_add_org_support.sql
```

**New tables created**:
- `organizations`: Org records (id, name, slug, created_by)
- `org_members`: Org membership (org_id, user_id, role: admin/member)

**Updated columns**:
- `meetings.org_id`: Optional reference to an organization

**New RLS policies**:
- `organizations_select_for_members`: Org members can view
- `org_members_select/insert/update_for_org`: Org admins manage membership
- `meetings_select_for_org_or_participant`: Meetings accessible by org member OR individual participant

**Why this approach**:
- Minimal schema changes
- Backward compatible (org_id is nullable; existing user-owner model still works)
- Supports both org-scoped and user-scoped meetings

---

## Validation Steps

After applying the migration(s):

### Check RLS status:
```sql
-- Should show all tables have RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND rowsecurity=true;
```

### Check policies (Option A):
```sql
SELECT schemaname, tablename, polname, permissive
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, polname;
```

### Check new org tables (Option B only):
```sql
SELECT * FROM organizations LIMIT 1;
SELECT * FROM org_members LIMIT 1;
```

### Run Supabase Advisor:
Open Supabase Dashboard → Database → Advisor → Re-run checks to confirm no lint errors.

---

## Recommendation

**Use Option A** unless you have explicit multi-tenant requirements. The current owner + meeting_participants model is:
- Simpler to reason about
- Sufficient for single-org / team-based meetings
- Already hardened in 002_hardening.sql

**Use Option B** if:
- You need to support multiple organizations per database
- Different orgs should not see each other's meetings/data
- Org admins need to manage member access

---

## Next Steps

1. Identify which option matches your requirements
2. Delete/ignore any incomplete org-based migration files (if they exist in a branch)
3. Apply the corresponding migration(s) using Supabase CLI or direct SQL
4. Re-run Supabase Advisor to confirm all lints pass
