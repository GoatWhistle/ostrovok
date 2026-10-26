import os
from pathlib import Path
from urllib.request import urlopen

ARCHIVES={
    'nature':'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip',
    'watercraft':'https://kenney.nl/media/pages/assets/watercraft-kit/a335cfed49-1713519620/kenney_watercraft-pack.zip',
    'holiday':'https://kenney.nl/media/pages/assets/holiday-kit/3976a6496a-1733923970/kenney_holiday-kit.zip',
    'suburban':'https://kenney.nl/media/pages/assets/city-kit-suburban/2c871b7af2-1745479373/kenney_city-kit-suburban_20.zip',
}
root=Path(os.environ.get('MAP_MODEL_ARCHIVES','data/raw/kenney'));root.mkdir(parents=True,exist_ok=True)
for name,url in ARCHIVES.items():
    target=root/f'{name}.zip'
    if target.exists():continue
    with urlopen(url,timeout=60) as response:body=response.read(32*1024*1024+1)
    if len(body)>32*1024*1024:raise ValueError(f'{name}: archive exceeds the download limit')
    target.write_bytes(body);print(name,len(body))
