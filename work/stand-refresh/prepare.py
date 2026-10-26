import hashlib
import io
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

root = Path('/Users/savelij/projects/o-hack')
stand = Path('/Users/savelij/projects/o-hack-stand')
base = Path(tempfile.mkdtemp(prefix='hotel-stand-baseline-'))
archive = subprocess.check_output(['git','archive','8e229bc','backend','frontend','docs/api/openapi.yaml','.env.example'],cwd=stand)
with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
    bundle.extractall(base, filter='data')
subprocess.run(['git','apply',str(stand/'work/stand-restart/root-runtime.patch')],cwd=base,check=True)
manifest = json.loads((stand/'work/stand-restart/snapshot.json').read_text())
for name in manifest['untracked_paths']:
    path = base/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(subprocess.check_output(['git','show',f'0bb2ea1:{name}'],cwd=stand))
subprocess.run(['git','init','-q'],cwd=base,check=True)
subprocess.run(['git','add','.'],cwd=base,check=True)
paths = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=root,text=True).splitlines()
def relevant(name):
    return name.startswith(('backend/src/','backend/tests/','backend/migrations/','backend/scripts/','frontend/src/','frontend/tests/','frontend/public/')) or name in {'backend/pyproject.toml','backend/uv.lock','frontend/package.json','frontend/package-lock.json','docs/api/openapi.yaml','.env.example'}
changed=[]
for name in paths:
    if not relevant(name) or not (root/name).is_file():
        continue
    target=base/name
    data=(root/name).read_bytes()
    if target.exists() and target.read_bytes()==data:
        continue
    if target.exists():
        subprocess.run(['git','hash-object','-w','--stdin'],input=target.read_bytes(),cwd=stand,stdout=subprocess.DEVNULL,check=True)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)
    changed.append(name)
subprocess.run(['git','add','-N','.'],cwd=base,check=True)
patch=subprocess.check_output(['git','diff','--binary'],cwd=base)
(stand/'work/stand-refresh/root-delta.patch').write_bytes(patch)
(stand/'work/stand-refresh/snapshot.json').write_text(json.dumps({'baseline_dir':str(base),'changed':changed,'patch_sha256':hashlib.sha256(patch).hexdigest()},indent=2))
print(json.dumps({'changed_count':len(changed),'changed':changed},indent=2))
