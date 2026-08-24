import json
d = json.load(open('forensics_production.json'))

# Print full func_def for all functions
for f in d['functions'][:10]:
    print(f"\n########## {f['proname']} ##########")
    print(f.get('func_def'))

print("\n\n==================== POLICIES BY TABLE ====================")
for pol in d['policies']:
    roles = ','.join(pol.get('roles') or [])
    print(f"[{pol['tablename']}] {pol.get('policy_name')} ({pol.get('cmd')},{pol.get('permissive')}) roles={roles}")
    if pol.get('qual'):
        print(f"  USING: {pol['qual']}")
    if pol.get('with_check'):
        print(f"  CHECK: {pol['with_check']}")