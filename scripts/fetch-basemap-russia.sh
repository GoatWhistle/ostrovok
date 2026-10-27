#!/usr/bin/env bash
set -euo pipefail
PMTOOL="${PMTILES_BIN:-pmtiles}"
ARCHIVE_URL="${PROTOMAPS_ARCHIVE:-https://build.protomaps.com/20261026.pmtiles}"
RAW_DIR="${RUSSIA_RAW_DIR:-data/raw}"
OUT_ROOT="${MAP_BASEMAPS_HOST_DIR:-data/basemaps}"
BBOX="19.6,41.1,180,82"
RAW="$RAW_DIR/russia-basemap-z14.pmtiles"
mkdir -p "$RAW_DIR" "$OUT_ROOT/russia"
if [[ ! -f "$RAW.ok" ]]; then
  if [[ ! -f "$RAW" ]] || ! "$PMTOOL" verify "$RAW"; then
    "$PMTOOL" extract "$ARCHIVE_URL" "$RAW" --bbox="$BBOX" --maxzoom=14 --download-threads=4
    "$PMTOOL" verify "$RAW"
  fi
  touch "$RAW.ok"
fi
python3 scripts/basemap_manifest.py "$RAW" "$OUT_ROOT/russia" \
  --region russia --bbox "$BBOX" --max-zoom 14 --build "${ARCHIVE_URL##*/}" \
  --assets data/seed/sochi-map/basemap
