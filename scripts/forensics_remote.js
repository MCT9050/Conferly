/**
 * READ-ONLY production forensics script.
 * Uses the Supabase Management API SQL endpoint (HTTPS) to query LIVE production.
 * NO writes performed - all queries are SELECTs from pg_catalog/information_schema.
 */
const https = require('https');
const fs = require('fs');

const PROJECT_ID = 'neymqmyzmsberwlowlpw';
const SERVICE_ROLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leW1xbXl6bXNiZXJ3bG93bHB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzYwNjc5NywiZXhwIjoyMDkzMTgyNzk3fQ.fgZqlU_nffgyofT_eQ8cpOYjDmjuApAMUvAQvabA1SM';
const OUTPUT = 'forensics_production.json';

function runSQL(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_ID}/sql`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ _raw: data, _parse_error: e.message });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

async function sql(query) {
  const res = await runSQL(query);
  if (res.error) {
    console.error('SQL ERROR:', res.error);
    return [];
  }
  return res.result || res.data || res;
}

async function main() {
  console.log('Starting production forensics via Supabase Management API...');
  const results = {};

  // Test connection
  const test = await runSQL('SELECT version() AS v');
  if (test.error) {
    console.error('CONNECTION FAILED:', JSON.stringify(test));
    fs.writeFileSync(OUTPUT, JSON.stringify({ error: test }, null, 2));
    process.exit(1);
  }
  results.server_info = { version: test.result[0].v };
  console.log('Connected to:', test.result[0].v);

  // === A. SCHEMAS ===
  results.schemas = await sql(`SELECT nspname AS schema_name FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY nspname`);
  console.log('Schemas:', results.schemas.length);

  // === B. TABLES ===
  results.tables = await sql(`SELECT c.relnamespace::regnamespace::text AS schemaname, c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner, c.reltuples::bigint AS row_estimate, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced, obj_description(c.oid) AS comment FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname IN ('public','auth','storage','realtime','supabase_realtime','supabase_functions') ORDER BY n.nspname, c.relname`);
  console.log('Tables:', results.tables.length);

  // === C. COLUMNS ===
  results.columns = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, a.attnum AS ordinal_position, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type, format_type(a.atttypid, NULL) AS udt_name, a.atttypmod AS type_modifier, NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS default_value, CASE WHEN a.attidentity <> '' THEN a.attidentity ELSE NULL END AS identity, CASE WHEN a.attgenerated <> '' THEN a.attgenerated ELSE NULL END AS generated, coll.collname AS collate, pgd.description AS comment FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum LEFT JOIN pg_collation col ON col.collnull IS NOT NULL AND col.oid = a.attcollation LEFT JOIN pg_description pgd ON pgd.objoid = a.attrelid AND pgd.objsubid = a.attnum WHERE a.attnum > 0 AND NOT a.attisdropped AND n.nspname IN ('public','auth','storage') AND c.relkind IN ('r','v','p') ORDER BY n.nspname, c.relname, a.attnum`);
  console.log('Columns:', results.columns.length);

  // === D. CONSTRAINTS ===
  results.constraints = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, con.conname AS constraint_name, con.contype AS constraint_type, pg_get_constraintdef(con.con.oid) AS constraint_definition, con.condeferrable AS deferrable, con.condeferred AS initially_deferred FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND con.contype IN ('p','f','u','c','x') ORDER BY n.nspname, c.relname, con.contype, con.conname`);
  console.log('Constraints:', results.constraints.length);

  // === FK DETAILS ===
  results.foreign_keys = await sql(`SELECT n.nspname AS source_schema, c.relname AS source_table, af.attname AS source_column, n2.nspname AS target_schema, c2.relname AS target_table, af2.attname AS target_column, con.conname AS constraint_name, pg_get_constraintdef(con.con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_class c2 ON c2.oid = con.confrelid JOIN pg_namespace n2 ON n2.oid = c2.relnamespace JOIN pg_attribute af ON af.attrelid = con.conrelid AND af.attnum = con.conkey[ordinals.ordinal] JOIN pg_attribute af2 ON af2.attrelid = con.confrelid AND af2.attnum = con.confkey[ordinals.ordinal] CROSS JOIN generate_subscripts(con.conkey, 1) AS ordinals(ordinal) WHERE con.contype = 'f' AND n.nspname IN ('public','auth','storage') ORDER BY n.nspname, c.relname, con.conname, af.attnum`);
  console.log('Foreign keys:', results.foreign_keys.length);

  // === E. INDEXES ===
  results.indexes = await sql(`SELECT schemaname, tablename AS table_name, indexname AS index_name, indexdef AS index_definition FROM pg_indexes WHERE schemaname IN ('public','auth','storage') ORDER BY schemaname, tablename, indexname`);
  console.log('Indexes:', results.indexes.length);

  // === INDEX DETAILS ===
  results.index_details = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, ic.relname AS index_name, i.indisunique AS is_unique, i.indisprimary AS is_primary, i.indpred IS NOT NULL AS has_predicate, i.indexprs IS NOT NULL AS has_expression, am.amname AS access_method, pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_am am ON am.oid = ic.relam WHERE n.nspname IN ('public','auth','storage') ORDER BY n.nspname, c.relname, ic.relname`);

  // === F. POLICIES ===
  results.policies = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, pol.polname AS policy_name, pol.polcmd AS command, pol.polpermissive AS permissive, pg_get_userbyid(pol.polrolesid) AS roles, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr, pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('public','auth','storage') ORDER BY n.nspname, c.relname, pol.polname`);
  console.log('Policies:', results.policies.length);

  // === G. GRANTS ===
  results.grants = await sql(`SELECT rtg.schemaname, rtg.table_name, rtg.grantee, rtg.privilege_type, rtg.is_grantable FROM information_schema.role_table_grants rtg WHERE rtg.schemaname IN ('public') AND rtg.grantee IN ('anon','authenticated','service_role','public','postgres') ORDER BY rtg.schemaname, rtg.table_name, rtg.grantee, rtg.privilege_type`);
  console.log('Table grants:', results.grants.length);

  // === COLUMN-LEVEL GRANTS ===
  results.column_grants = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, a.attname AS column_name, cp.grantee, cp.privilege_type, cp.is_grantable FROM information_schema.column_privileges cp JOIN pg_class c ON c.relname = cp.table_name JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = cp.column_name WHERE n.nspname IN ('public') AND cp.grantee IN ('anon','authenticated','service_role','public','postgres') ORDER BY n.nspname, c.relname, a.attname, cp.grantee, cp.privilege_type`);
  console.log('Column grants:', results.column_grants.length);

  // === H. FUNCTIONS ===
  const funcs = await sql(`SELECT n.nspname AS schema, p.proname AS function_name, pg_get_function_arguments(p.oid) AS arguments, pg_get_function_result(p.oid) AS return_type, CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security, CASE WHEN p.provolatile = 's' THEN 'strict' WHEN p.provolatile = 'v' THEN 'volatile' WHEN p.provolatile = 'i' THEN 'immutable' ELSE p.provolatile END AS volatility, l.lanname AS language, pg_get_userbyid(p.proowner) AS owner, pg_get_functiondef(p.oid) AS full_definition, p.pronargs AS arg_count FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname IN ('public','auth') AND n.nspname NOT LIKE 'pg_%' ORDER BY n.nspname, p.proname`);
  results.functions = funcs;
  console.log('Functions:', funcs.length);

  // === FUNCTION GRANTS ===
  results.function_grants = await sql(`SELECT n.nspname AS schema, p.proname AS function_name, pg_get_userbyid(acl.grantee) AS grantee_name, acl.privs AS privileges FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace LEFT JOIN aclexplode(p.proacl) AS acl(grantee, privs, is_grantable) ON true WHERE n.nspname IN ('public','auth') AND n.nspname NOT LIKE 'pg_%' ORDER BY n.nspname, p.proname, acl.grantee`);
  console.log('Function grants:', results.function_grants.length);

  // === I. MIGRATION HISTORY ===
  results.migrations = await sql(`SELECT version, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version`);
  console.log('Migrations:', results.migrations.length);

  // === J. EXTENSIONS ===
  results.extensions = await sql(`SELECT extname, extversion, n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY extname`);
  console.log('Extensions:', results.extensions.length);

  // === K. TABLE COMMENTS ===
  results.table_comments = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, d.description AS comment FROM pg_description d JOIN pg_class c ON c.oid = d.objoid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE d.objsubid = 0 AND n.nspname IN ('public','auth','storage') ORDER BY n.nspname, c.relname`);

  // === L. COLUMN COMMENTS ===
  results.column_comments = await sql(`SELECT n.nspname AS schemaname, c.relname AS table_name, a.attname AS column_name, d.description AS comment FROM pg_description d JOIN pg_class c ON c.oid = d.objoid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid WHERE n.nspname IN ('public','auth','storage') ORDER BY n.nspname, c.relname, a.attname`);

  // === M. DEFAULT PRIVILEGES ===
  results.default_privileges = await sql(`SELECT n.nspname AS schema, pg_get_userbyid(d.defaclrole) AS grantee, d.defaclobjtype AS object_type, aclexplode(d.defaclacl) AS acl_info FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname IN ('public') ORDER BY n.nspname, d.defaclrole`);

  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
  console.log('\\nResults saved to', OUTPUT);
  console.log('=== SUMMARY ===');
  console.log('Tables:', results.tables.length);
  console.log('Columns:', results.columns.length);
  console.log('Constraints:', results.constraints.length);
  console.log('FKs:', results.foreign_keys.length);
  console.log('Indexes:', results.indexes.length);
  console.log('Policies:', results.policies.length);
  console.log('Functions:', results.functions.length);
  console.log('Migrations:', results.migrations.length);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
