import json
import struct
from pathlib import Path

from mesh import building_mesh


ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "data/assets/zhemchuzhina"


def build_glb(positions, normals, uvs, indices, metadata):
    binary = bytearray()
    views, accessors = [], []

    def view(data, target=None):
        binary.extend(b"\0" * (-len(binary) % 4))
        entry = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)}
        if target:
            entry["target"] = target
        views.append(entry)
        binary.extend(data)
        return len(views) - 1

    for values, components, kind in ((positions, 3, "VEC3"), (normals, 3, "VEC3"), (uvs, 2, "VEC2")):
        flat = [x for vector in values for x in vector]
        accessor = {
            "bufferView": view(struct.pack(f"<{len(flat)}f", *flat), 34962),
            "componentType": 5126, "count": len(values), "type": kind,
        }
        if values is positions:
            accessor["min"] = [min(p[i] for p in positions) for i in range(components)]
            accessor["max"] = [max(p[i] for p in positions) for i in range(components)]
        accessors.append(accessor)
    accessors.append({
        "bufferView": view(struct.pack(f"<{len(indices)}H", *indices), 34963),
        "componentType": 5123, "count": len(indices), "type": "SCALAR",
    })
    image_view = view((ASSET / "albedo-atlas-v1.png").read_bytes())
    document = {
        "asset": {"version": "2.0", "copyright": "Footprint: OpenStreetMap contributors, ODbL 1.0"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "Zhemchuzhina w51847429", "mesh": 0, "extras": metadata}],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0,
        }]}],
        "materials": [{"name": "Synthetic facade reconstruction", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 0.92,
        }}],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9729, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": image_view, "mimeType": "image/png"}],
        "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(binary)}],
    }
    header = json.dumps(document, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    total = 12 + 8 + len(header) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total)
            + struct.pack("<II", len(header), 0x4E4F534A) + header
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def main():
    features = json.loads((ROOT / "data/seed/sochi/buildings.geojson").read_text())["features"]
    feature = next(f for f in features if f.get("id") == "w51847429")
    atlas = json.loads((ASSET / "atlas-layout.json").read_text())
    positions, normals, uvs, indices, metadata = building_mesh(feature, atlas)
    (ASSET / "building.glb").write_bytes(build_glb(positions, normals, uvs, indices, metadata))
    (ASSET / "building.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
