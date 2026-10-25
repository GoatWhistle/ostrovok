import argparse
import functools
import http.server
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8766)
args = parser.parse_args()
viewer = ROOT / ".local/building-texture/model-viewer.min.js"
if not viewer.exists():
    viewer.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "curl", "--fail", "--location", "--silent", "--show-error",
        "https://unpkg.com/@google/model-viewer@4.4.0/dist/model-viewer.min.js",
        "-o", str(viewer),
    ], check=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler)
print(f"http://127.0.0.1:{args.port}/work/building-texture/preview.html", flush=True)
server.serve_forever()
