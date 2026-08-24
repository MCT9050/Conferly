import json
d = json.load(open('forensics_production.json'))
for i, f in enumerate(d['functions'][:10]):
    namehint = ''
    fd = f.get('func_def') or ''
    first = fd.split(chr(10))[0] if fd else ''
    print(f'[F{i}] {first}')
    for k in f:
        if k != 'func_def':
            v = f[k]
            if isinstance(v, (list, dict)):
                try:
                    v = json.dumps(v)[:120]
                except Exception:
                    v = str(v)[:120]
            print(f'    {k} = {v}')
    print()