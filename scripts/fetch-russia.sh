#!/usr/bin/env bash
set -euo pipefail

RAW_DIR="${RUSSIA_RAW_DIR:-data/raw}"
SNAPSHOT="${RUSSIA_SNAPSHOT:-russia-261024}"
BASE_URL="${RUSSIA_BASE_URL:-https://download.geofabrik.de}"
FILE="$SNAPSHOT.osm.pbf"

mkdir -p "$RAW_DIR"
rm -f "$RAW_DIR/$FILE.ok"

EXPECTED_SIZE="$(curl --fail --silent --show-error --head --location "$BASE_URL/$FILE" \
  | awk 'tolower($1) == "content-length:" { print $2 }' | tr -d '\r' | tail -1)"
if [ -z "$EXPECTED_SIZE" ]; then
  echo "cannot read expected size for $FILE" >&2
  exit 1
fi

CURRENT_SIZE=0
if [ -f "$RAW_DIR/$FILE" ]; then
  CURRENT_SIZE="$(wc -c < "$RAW_DIR/$FILE" | tr -d ' ')"
fi
if [ "$CURRENT_SIZE" -gt "$EXPECTED_SIZE" ]; then
  echo "$FILE exceeds the published size" >&2
  exit 1
fi
if [ "$CURRENT_SIZE" -lt "$EXPECTED_SIZE" ]; then
  curl --fail --location --retry 5 --retry-delay 5 --continue-at - \
    --output "$RAW_DIR/$FILE" "$BASE_URL/$FILE"
fi
curl --fail --location --retry 5 --retry-delay 5 \
  --output "$RAW_DIR/$FILE.md5" "$BASE_URL/$FILE.md5"

python3 - "$RAW_DIR/$FILE" "$RAW_DIR/$FILE.md5" <<'PY'
import hashlib
import sys
from pathlib import Path

target = Path(sys.argv[1])
checksum = Path(sys.argv[2])
expected = checksum.read_text().split()[0].lower()
digest = hashlib.md5()
with target.open("rb") as source:
    for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
        digest.update(chunk)
actual = digest.hexdigest()
if actual != expected:
    raise SystemExit(f"checksum mismatch for {target}: expected {expected}, got {actual}")
print(f"verified {target}: {target.stat().st_size} bytes, md5 {actual}")
PY

touch "$RAW_DIR/$FILE.ok"
