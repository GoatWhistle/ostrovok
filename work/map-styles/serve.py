import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = Path(self.translate_path(self.path))
        match = re.fullmatch(r'bytes=(\d+)-(\d*)', self.headers.get('Range', ''))
        if not match or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        start, end = int(match[1]), min(int(match[2]) if match[2] else size-1, size-1)
        if start >= size:
            self.send_error(416)
            return None
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Length', str(end-start+1))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        self.remaining = end-start+1
        stream = path.open('rb')
        stream.seek(start)
        return stream

    def copyfile(self, source, outputfile):
        if not hasattr(self, 'remaining'):
            return super().copyfile(source, outputfile)
        while self.remaining:
            chunk = source.read(min(65536, self.remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            self.remaining -= len(chunk)

ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
