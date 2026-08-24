-- Focused forensics query #2: clean, human-readable output
-- Returns constraint summaries with resolved table names.

SELECT json_build_object(
  'constraints', (
    SELECT json_agg(j) FROM (
      SELECT json_build_object(
        'table_name', n.nspname || '.' || cl.relname,
        'constraint_name', con.conname,
        'constraint_type', con.contype,
        'constraint_def', pg_get_constraintdef(con.oid)
      ) AS j
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY cl.relname, con.conname
    ) s
  ),
  'policies', (
    SELECT json_agg(j) FROM (
      SELECT json_build_object(
        'tablename', p.tablename,
        'policy_name', p.policyname,
        'permissive', p.permissive,
        'roles', p.roles,
        'cmd', p.cmd,
        'qual', p.qual,
        'with_check', p.with_check
      ) AS j
      FROM pg_policies p
      WHERE p.schemaname = 'public'
      ORDER BY p.tablename, p.policyname
    ) s
  )
) AS forensics2;
