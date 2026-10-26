import os
import json
import struct
import zipfile
from pathlib import Path

import numpy as np
from rasterio.io import MemoryFile

ROOT=Path(__file__).parent/'shared/models'
manifest=json.loads((ROOT/'manifest.json').read_text())
for item in manifest:
    path=ROOT/item['file'];content=path.read_bytes();length=struct.unpack_from('<I',content,12)[0]
    document=json.loads(content[20:20+length])
    if not document.get('images'):continue
    payload=bytearray(content[28+length:])
    with zipfile.ZipFile(Path(os.environ.get('MAP_MODEL_ARCHIVES','data/raw/kenney'))/f"{item['pack']}.zip") as archive:
        image_path=str(Path(item['original']).parent/document['images'][0]['uri'])
        with MemoryFile(archive.read(image_path)) as memory, memory.open() as image:
            if image.count==1:
                palette=image.colormap(1);lookup=np.array([palette.get(i,(0,0,0,255))[:3] for i in range(256)],dtype=np.uint8);pixels=lookup[image.read(1)]
            else:pixels=image.read()[:3].transpose(1,2,0)
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            accessor=document['accessors'][primitive['attributes']['TEXCOORD_0']]
            view=document['bufferViews'][accessor['bufferView']]
            offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
            uvs=np.ndarray((accessor['count'],2),dtype='<f4',buffer=payload,offset=offset,strides=(view.get('byteStride',8),4)).copy()
            colors=pixels[np.minimum((uvs[:,1]*pixels.shape[0]).astype(int),pixels.shape[0]-1),np.minimum((uvs[:,0]*pixels.shape[1]).astype(int),pixels.shape[1]-1)].astype(np.float32)/255
            linear=np.where(colors<=.04045,colors/12.92,((colors+.055)/1.055)**2.4).astype('<f4')
            new_view=len(document['bufferViews']);document['bufferViews'].append({'buffer':0,'byteOffset':len(payload),'byteLength':linear.nbytes,'target':34962})
            new_accessor=len(document['accessors']);document['accessors'].append({'bufferView':new_view,'componentType':5126,'count':len(colors),'type':'VEC3'})
            primitive['attributes']['COLOR_0']=new_accessor
            payload.extend(linear.tobytes())
    for material in document['materials']:material['pbrMetallicRoughness'].pop('baseColorTexture',None)
    for key in ['images','textures','samplers','extensionsUsed','extensionsRequired']:document.pop(key,None)
    document['buffers'][0]['byteLength']=len(payload)
    header=json.dumps(document,separators=(',',':')).encode();header+=b' '*((-len(header))%4);payload+=b'\0'*((-len(payload))%4)
    encoded=struct.pack('<III',0x46546c67,2,12+8+len(header)+8+len(payload))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(payload),0x004e4942)+payload
    path.write_bytes(encoded);item['bytes']=len(encoded)
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2))
