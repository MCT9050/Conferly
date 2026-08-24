/**
 * forensics_pg.js — Direct PostgreSQL connection to production.
 * Uses credentials from the Supabase Management API CLI login-role endpoint.
 */
const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'db.neymqmyzmsberwlowlpw.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'cli_login_supabase_read_only_user',
  password: 'cztOAK0WYuQPmcoVSxUQLW888LkIl8i5',
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});

const results = {};

async function q(sql, label) {
  try {
    const res = await client.query(sql);
    results[label] = res.rows;
    console.log(`[${label}] ${res.rows.length} rows`);
    for (const row of res.rows.slice(0, 200)) console.log(`  ${JSON.stringify(row)}`);
  } catch(e) {
    console.log(`[${label}] ERROR: ${e.message}`);
    results[label] = { error: e.message };
  }
}

(async () => {
  console.log('Connecting to production database...');
  try { await client.connect(); console.log('Connected!'); }
  catch(e) { console.error('CONNECT FAILED:', e.message); process.exit(1); }

  // A. Tables
  await q(`SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`, 'tables');

  // B. Columns
  await q(`SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`, 'columns');

  // C. Constraints
  await q(`SELECT conname, conrelid::regclass::text AS table_name, contype, pg_get_constraintdef(oid) AS constraint_def FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text, conname`, 'constraints');

  // D. RLS
  await q(`SELECT tablename, rowsecurity AS rls_enabled FROM pg_tables WHERE schemaname='public' ORDER BY tablename`, 'rls');

  // E. Policies
  await q(`SELECT tablename, polname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, polname`, 'policies');

  // F. Grants
  await q(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY table_name, grantee, privilege_type`, 'grants');

  // G. Indexes
  await q(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`, 'indexes');

  // H. Functions
  await q(`SELECT proname, prorettype::regtype AS return_type, pg_get_function_arguments(oid) AS args, CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security, pg_get_functiondef(oid) AS func_def FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' ORDER BY proname`, 'functions');

  // I. Extensions
  await q(`SELECT extname, extversion FROM pg_extension ORDER BY extname`, 'extensions');

  // J. Migration history
  await q(`SELECT version, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version`, 'migrations');

  // K. Table comments
  await q(`SELECT c.relname AS table_name, d.description AS comment FROM pg_description d JOIN pg_class c ON c.oid=d.objoid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE d.objsubid=0 AND n.nspname='public' ORDER BY c.relname`, 'table_comments');

  // L. Column comments
  await q(`SELECT c.relname AS table_name, a.attname AS column_name, d.description AS comment FROM pg_description d JOIN pg_class c ON c.oid=d.objoid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.objsubid WHERE n.nspname='public' ORDER BY c.relname, a.attname`, 'column_comments');

  // M. Default privileges
  await q(`SELECT n.nspname AS schema, pg_get_userbyid(d.defaclrole) AS grantee, d.defaclobjtype AS object_type, pg_get_userbyid(acl.grantee) AS acl_grantee, acl.privs FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace LEFT JOIN aclexplode(d.defaclacl) AS acl ON true WHERE n.nspname='public'`, 'default_privileges');

  // N. FK constraints
  await q(`SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY' ORDER BY tc.table_name`, 'foreign_keys');

  // O. Row counts (approximate)
  await q(`SELECT relname AS table_name, reltuples::bigint AS row_estimate FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`, 'row_counts');

  fs.writeFileSync('forensics_production.json', JSON.stringify(results, null, 2));
  console.log('\\n=== Results saved to forensics_production.json ===');
  console.log('Tables:', results.tables?.length || 0);
  console.log('Policies:', results.policies?.length || 0);
  console.log('Functions:', results.functions?.length || 0);

  await client.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
