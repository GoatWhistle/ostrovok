import json
import subprocess
from pathlib import Path

stand=Path('/Users/savelij/projects/o-hack-stand')
root=Path('/Users/savelij/projects/o-hack')
base=Path(json.loads((stand/'work/stand-refresh/snapshot.json').read_text())['baseline_dir'])
subprocess.run(['git','add','.'],cwd=base,check=True)
paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=stand,text=True).splitlines()
def relevant(name):
    return name.startswith(('backend/src/','backend/tests/','backend/migrations/','backend/scripts/','frontend/src/','frontend/tests/','frontend/public/')) or name in {'backend/pyproject.toml','backend/uv.lock','frontend/package.json','frontend/package-lock.json','docs/api/openapi.yaml','.env.example'}
changes=[]
conflicts=[]
for name in paths:
    if not relevant(name) or not (stand/name).is_file():
        continue
    target=base/name
    expected=target.read_bytes() if target.exists() else None
    desired=(stand/name).read_bytes()
    if expected==desired:
        continue
    actual=(root/name).read_bytes() if (root/name).exists() else None
    if actual!=expected and actual!=desired:
        conflicts.append(name)
    changes.append((name,desired))
if conflicts:
    print(json.dumps({'concurrent_changes':conflicts},indent=2))
    raise SystemExit(1)
for name,data in changes:
    target=base/name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)
subprocess.run(['git','add','-N','.'],cwd=base,check=True)
patch=subprocess.check_output(['git','diff','--binary'],cwd=base)
path=stand/'work/stand-refresh/verified-agent-delta.patch'
path.write_bytes(patch)
subprocess.run(['git','apply','--check',str(path)],cwd=root,check=True)
subprocess.run(['git','apply',str(path)],cwd=root,check=True)
(stand/'work/stand-refresh/root-sync.json').write_text(json.dumps({'paths':[p for p,_ in changes]},indent=2))
print(json.dumps({'synced_files':len(changes)}))
