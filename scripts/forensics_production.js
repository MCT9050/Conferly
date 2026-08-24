/**
 * READ-ONLY production forensics script.
 * Connects to the LIVE Supabase database and dumps the complete schema inventory.
 * NO writes are performed. All queries are SELECTs against pg_catalog / information_schema.
 */
const { Client } = require('pg');
const fs = require('fs');

const OUTPUT = 'forensics_production.json';

async function main() {
  const client = new Client({
    host: '2a05:d018:10e0:3300:65e5:8abb:834b:8432',
    family: 6,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Manashela@97217',
    ssl: { rejectUnauthorized: false },
    query_timeout: 30000,
  });

  await client.connect();

  // Verify read-only session
  const roCheck = (await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only;
  await client.query("SET TRANSACTION READ ONLY");

  const results = {
    server_info: {
      version: (await client.query('SHOW server_version')).rows[0].server_version,
      current_user: (await client.query('SELECT current_user')).rows[0].current_user,
      transaction_read_only: roCheck,
    }
  };

  // === A. SCHEMAS ===
  results.schemas = (await client.query(`
    SELECT nspname AS schema_name
    FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
    ORDER BY nspname
  `)).rows;

  // === B. TABLES (public + auth + storage + infra schemas) ===
  results.tables = (await client.query(`
    SELECT c.relnamespace::regnamespace::text AS schemaname,
           c.relname AS table_name,
           pg_get_userbyid(c.relowner) AS owner,
           c.reltuples::bigint AS row_estimate,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced,
           obj_description(c.oid) AS comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN ('public', 'auth', 'storage', 'realtime', 'supabase_realtime', 'supabase_functions')
    ORDER BY n.nspname, c.relname
  `)).rows;

  // === C. COLUMNS ===
  results.columns = (await client.query(`
    SELECT n.nspname AS schemaname,
           c.relname AS table_name,
           a.attnum AS ordinal_position,
           a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS data_type,
           format_type(a.atttypid, NULL) AS udt_name,
           a.atttypmod AS type_modifier,
           NOT a.attnotnull AS nullable,
           pg_get_expr(d.adbin, d.adrelid) AS default_value,
           CASE WHEN a.attidentity <> '' THEN a.attidentity ELSE NULL END AS identity,
           CASE WHEN a.attgenerated <> '' THEN a.attgenerated ELSE NULL END AS generated,
           coll.collname AS collate,
           pgd.description AS comment
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    LEFT JOIN pg_collation col ON col.collnull IS NOT NULL AND col.oid = a.attcollation
    LEFT JOIN pg_description pgd ON pgd.objoid = a.attrelid AND pgd.objsubid = a.attnum
    WHERE a.attnum > 0
      AND NOT a.attisdropped
      AND n.nspname IN ('public', 'auth', 'storage')
      AND c.relkind IN ('r', 'v', 'p')
    ORDER BY n.nspname, c.relname, a.attnum
  `)).rows;

  // === D. CONSTRAINTS (PK, FK, UNIQUE, CHECK, EXCLUSION) ===
  results.constraints = (await client.query(`
    SELECT n.nspname AS schemaname,
           c.relname AS table_name,
           con.conname AS constraint_name,
           con.contype AS constraint_type,
           pg_get_constraintdef(con.con.oid) AS constraint_definition,
           con.condeferrable AS deferrable,
           con.condeferred AS initially_deferred
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage')
      AND con.contype IN ('p', 'f', 'u', 'c', 'x')
    ORDER BY n.nspname, c.relname, con.contype, con.conname
  `)).rows;

  // FK details (referenced columns, on delete/update)
  results.foreign_keys = (await client.query(`
    SELECT n.nspname AS source_schema,
           c.relname AS source_table,
           af.attname AS source_column,
           n2.nspname AS target_schema,
           c2.relname AS target_table,
           af2.attname AS target_column,
           con.conrelid::regclass AS source_relation,
           con.confrelid::regclass AS target_relation,
           pg_get_constraintdef(con.con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class c2 ON c2.oid = con.confrelid
    JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
    JOIN pg_attribute af ON af.attrelid = con.conrelid AND af.attnum = con.conkey[ordinals.ordinal]
    JOIN pg_attribute af2 ON af2.attrelid = con.confrelid AND af2.attnum = con.confkey[ordinals.ordinal]
    CROSS JOIN generate_subscripts(con.conkey, 1) AS ordinals(ordinal)
    WHERE con.contype = 'f'
      AND n.nspname IN ('public', 'auth', 'storage')
    ORDER BY n.nspname, c.relname, con.conname, af.attnum
  `)).rows;

  // === E. INDEXES ===
  results.indexes = (await client.query(`
    SELECT schemaname,
           tablename AS table_name,
           indexname AS index_name,
           indexdef AS index_definition
    FROM pg_indexes
    WHERE schemaname IN ('public', 'auth', 'storage')
    ORDER BY schemaname, tablename, indexname
  `)).rows;

  // Detailed index info from pg_index
  results.index_details = (await client.query(`
    SELECT n.nspname AS schemaname,
           c.relname AS table_name,
           ic.relname AS index_name,
           i.indisunique AS is_unique,
           i.indisprimary AS is_primary,
           i.indpred IS NOT NULL AS has_predicate,
           i.indexprs IS NOT NULL AS has_expression,
           am.amname AS access_method,
           pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_am am ON am.oid = ic.relam
    WHERE n.nspname IN ('public', 'auth', 'storage')
    ORDER BY n.nspname, c.relname, ic.relname
  `)).rows;

  // === F. POLICIES ===
  results.policies = (await client.query(`
    SELECT n.nspname AS schemaname,
           c.relname AS table_name,
           pol.polname AS policy_name,
           pol.polcmd AS command,
           pol.polpermissive AS permissive,
           pg_get_userbyid(pol.polrolesid) AS roles,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage')
    ORDER BY n.nspname, c.relname, pol.polname
  `)).rows;

  // === G. GRANTS / PRIVILEGES ===
  results.grants = (await client.query(`
    SELECT n.nspname AS schemaname,
           c.relname AS table_name,
           grantee,
           privilege_type,
           is_grantable
    FROM information_schema.role_table_grants
    WHERE n.nspname IN ('public')
      AND grantee IN ('anon', 'authenticated', 'service_role', 'public', 'postgres')
    ORDER BY n.nspname, c.relname, grantee, privilege_type
  `)).rows;

  // === H. FUNCTIONS / RPCs ===
  results.functions = (await client.query(`
    SELECT n.nspname AS schema,
           p.proname AS function_name,
           pg_get_function_arguments(p.oid) AS arguments,
           pg_get_function_result(p.oid) AS return_type,
           CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
           CASE WHEN p.provolatile = 's' THEN 'strict' ELSE '' END ||
           CASE WHEN p.provolatile = 'v' THEN ',volatile' ELSE '' END AS volatility,
           l.lanname AS language,
           pg_get_userbyid(p.proowner) AS owner,
           p.prosrc AS body,
           pg_get_functiondef(p.oid) AS full_definition,
           pg_get_function_arguments(p.oid) AS arg_names
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname IN ('public', 'auth')
      AND n.nspname NOT LIKE 'pg_%'
    ORDER BY n.nspname, p.proname
  `)).rows;

  // Function grants
  results.function_grants = (await client.query(`
    SELECT n.nspname AS schema,
           p.proname AS function_name,
           pg_get_userbyid(grantee) AS grantee_name,
           privs AS privileges,
           is_grantable
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN aclexplode(p.proacl) AS acl(grantee, privs, is_grantable) ON true
    WHERE n.nspname IN ('public', 'auth')
      AND n.nspname NOT LIKE 'pg_%'
      AND p.proname IN ('accept_meeting_invitation', 'process_lemon_squeezy_subscription_webhook')
    ORDER BY n.nspname, p.proname, grantee
  `)).rows;

  // === I. MIGRATION HISTORY ===
  results.migrations = (await client.query(`
    SELECT version, inserted_at
    FROM supabase_migrations.schema_migrations
    ORDER BY version
  `)).rows;

  // === J. DEFAULT PRIVILEGES ===
  results.default_privileges = (await client.query(`
    SELECT n.nspname AS schema,
           pg_get_userbyid(d.defaclrole) AS grantee,
           d.defaclobjtype AS object_type,
           aclexplode(d.defaclacl) AS acl_info
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname IN ('public')
    ORDER BY n.nspname, d.defaclrole
  `)).rows;

  // === K. EXTENSIONS ===
  results.extensions = (await client.query(`
    SELECT extname, extversion, n.nspname AS schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    ORDER BY extname
  `)).rows;

  // === L. Table comments ===
  results.table_comments = (await client.query(`
    SELECT n.nspname AS schemaname, c.relname AS table_name,
           d.description AS comment
    FROM pg_description d
    JOIN pg_class c ON c.oid = d.objoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE d.objsubid = 0
      AND n.nspname IN ('public', 'auth', 'storage')
    ORDER BY n.nspname, c.relname
  `)).rows;

  // === M. Column comments ===
  results.column_comments = (await client.query(`
    SELECT n.nspname AS schemaname, c.relname AS table_name,
           a.attname AS column_name, d.description AS comment
    FROM pg_description d
    JOIN pg_class c ON c.oid = d.objoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
    WHERE n.nspname IN ('public', 'auth', 'storage')
    ORDER BY n.nspname, c.relname, a.attname
  `)).rows;

  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
  console.log('Results saved to', OUTPUT);
  console.log('Tables found:', results.tables.length);
  console.log('Columns found:', results.columns.length);
  console.log('Constraints found:', results.constraints.length);
  console.log('Indexes found:', results.indexes.length);
  console.log('Policies found:', results.policies.length);
  console.log('Functions found:', results.functions.length);
  console.log('Migrations:', results.migrations.length);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
