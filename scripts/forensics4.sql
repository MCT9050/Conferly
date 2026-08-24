WITH rc AS (
  SELECT t.relname AS table_name, t.n_live_tup AS row_count
  FROM pg_stat_user_tables t WHERE t.schemaname = 'public'
), fk AS (
  SELECT con.conname AS constraint_name, cl.relname AS table_name,
         pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'f' AND cl.relname IN ('meetings','subscriptions')
)
SELECT json_build_object(
  'row_counts', (SELECT json_agg(row_to_json(rc)) FROM rc),
  'critical_fks', (SELECT json_agg(row_to_json(fk)) FROM fk)
) AS forensics4;
