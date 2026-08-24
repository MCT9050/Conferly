-- Forensics #3: Column-level grants + default privileges + table ownership
SELECT json_build_object(
  'column_grants', (
    SELECT json_agg(j) FROM (
      SELECT json_build_object(
        'table_name', cg.table_name,
        'column_name', cg.column_name,
        'grantee', cg.grantee,
        'privilege_type', cg.privilege_type
      ) AS j
      FROM information_schema.role_column_grants cg
      WHERE cg.table_schema = 'public'
      ORDER BY cg.table_name, cg.grantee, cg.column_name, cg.privilege_type
    ) s
  ),
  'columns_comment', (
    SELECT json_agg(j) FROM (
      SELECT json_build_object(
        'table_name', c.relname,
        'column_name', a.attname,
        'comment', d.description
      ) AS j
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
      WHERE n.nspname = 'public' AND a.attnum > 0
      ORDER BY c.relname, a.attname
    ) s
  )
) AS forensics3;