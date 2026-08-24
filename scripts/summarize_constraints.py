import json, collections

d2 = json.load(open('forensics2_production.json'))
d3 = json.load(open('forensics_production.json'))

print('==================== CONSTRAINTS (forensics2 / forensics) ====================')
# forensics2 has readable constraint_def
for c in d2['constraints']:
    print(f"{c['table_name']}  [{c['constraint_type']}]  {c['constraint_name']}:  {c['constraint_def']}")

print('\n==================== INDEXES (production) ====================')
for i in d3['indexes']:
    print(f"{i['indexname']}  ON public.{i['tablename']} ::  {i['indexdef']}")

print('\n==================== FUNCTIONS (production) ====================')
for f in d3['functions']:
    print(f"\n--- {f.get('name')} ---")
    for k in ['otype','oid','security','volatility','language','owner','prokind','prosecdef','provolatile']:
        if k in f:
            print(f"  {k} = {f[k]}")