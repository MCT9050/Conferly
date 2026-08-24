-- Comprehensive production forensics SQL
-- Single query returning all data as JSON for easy parsing

SELECT json_build_object(
  'tables', (SELECT json_agg(j) FROM (SELECT row_to_json(t) AS j FROM information_schema.tables t WHERE t.table_schema = 'public' ORDER BY t.table_name) s),
  'columns', (SELECT json_agg(j) FROM (SELECT row_to_json(c) AS j FROM information_schema.columns c WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position) s),
  'constraints', (SELECT json_agg(j) FROM (SELECT row_to_json(c) AS j FROM pg_constraint c WHERE c.connamespace = 'public'::regnamespace ORDER BY c.conrelid::regclass::text, c.conname) s),
  'rls', (SELECT json_agg(j) FROM (SELECT row_to_json(p) AS j FROM pg_tables p WHERE p.schemaname = 'public' ORDER BY p.tablename) s),
  'policies', (SELECT json_agg(j) FROM (SELECT row_to_json(p) AS j FROM pg_policies p WHERE p.schemaname = 'public' ORDER BY p.tablename, p.policyname) s),
  'grants', (SELECT json_agg(j) FROM (SELECT row_to_json(g) AS j FROM information_schema.role_table_grants g WHERE g.table_schema = 'public' ORDER BY g.table_name, g.grantee, g.privilege_type) s),
  'indexes', (SELECT json_agg(j) FROM (SELECT row_to_json(i) AS j FROM pg_indexes i WHERE i.schemaname = 'public' ORDER BY i.tablename, i.indexname) s),
  'functions', (SELECT json_agg(j) FROM (SELECT json_build_object('proname', p.proname, 'return_type', p.prorettype::regtype::text, 'args', pg_get_function_arguments(p.oid), 'security', CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END, 'volatility', p.provolatile, 'language', l.lanname, 'owner', pg_get_userbyid(p.proowner), 'func_def', pg_get_functiondef(p.oid)) AS j FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname = 'public' ORDER BY p.proname) s),
  'extensions', (SELECT json_agg(j) FROM (SELECT row_to_json(e) AS j FROM pg_extension e ORDER BY e.extname) s),
  'migrations', (SELECT json_agg(j) FROM (SELECT row_to_json(m) AS j FROM supabase_migrations.schema_migrations m ORDER BY m.version) s),
  'default_privileges', (SELECT json_agg(j) FROM (SELECT row_to_json(d) AS j FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname = 'public') s),
  'fk_details', (SELECT json_agg(j) FROM (SELECT row_to_json(fk) AS j FROM (SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY' ORDER BY tc.table_name) fk) s),
  'table_comments', (SELECT json_agg(j) FROM (SELECT row_to_json(c) AS j FROM pg_description d JOIN pg_class c ON c.oid = d.objoid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE d.objsubid = 0 AND n.nspname = 'public') s),
  'column_comments', (SELECT json_agg(j) FROM (SELECT row_to_json(c) AS j FROM pg_description d JOIN pg_class c ON c.oid = d.objoid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid WHERE n.nspname = 'public') s),
  'row_counts', (SELECT json_agg(j) FROM (SELECT row_to_json(r) AS j FROM (SELECT c.relname AS table_name, c.reltuples::bigint AS row_estimate FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname) r) s)
) AS forensics;
