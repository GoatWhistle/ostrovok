#!/usr/bin/env bash
set -euo pipefail
MAP_PMTOOL="${PMTILES_BIN:-pmtiles}"
MAP_ARCHIVE="${PROTOMAPS_ARCHIVE:-https://build.protomaps.com/20261026.pmtiles}"
mkdir -p data/raw
if [[ ! -f data/raw/sochi-basemap.pmtiles ]]; then
"$MAP_PMTOOL" extract "$MAP_ARCHIVE" data/raw/sochi-basemap.pmtiles --bbox=39.55,43.35,40.0,43.75 --maxzoom=15 --download-threads=4
fi
"$MAP_PMTOOL" verify data/raw/sochi-basemap.pmtiles
"$MAP_PMTOOL" show data/raw/sochi-basemap.pmtiles --header-json > data/raw/sochi-basemap.header.json
"$MAP_PMTOOL" show data/raw/sochi-basemap.pmtiles --metadata > data/raw/sochi-basemap.metadata.json
