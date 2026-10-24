#!/usr/bin/env bash
# Downloads the raw OSM extract and DEM tiles used to build data/seed/.
# Run manually and rarely: `make seed` and the test suites never reach the network.
set -euo pipefail

RAW="${RAW_DIR:-data/raw}"
GEOFABRIK="${GEOFABRIK_URL:-https://download.geofabrik.de/russia/south-fed-district-latest.osm.pbf}"
DEM_BASE="${DEM_BASE_URL:-https://copernicus-dem-30m.s3.amazonaws.com}"
DEM_TILES="${DEM_TILES:-N43_00_E039_00 N43_00_E040_00}"

mkdir -p "$RAW"

fetch() {
  local url="$1" target="$2"
  local expected
  expected="$(curl -sIL "$url" | awk 'tolower($1) == "content-length:" { print $2 }' | tr -d '\r' | tail -1)"
  if [ -f "$target" ] && [ -n "$expected" ] && [ "$(wc -c <"$target")" -eq "$expected" ]; then
    echo "have   $target ($expected bytes)"
    return
  fi
  echo "get    $target ($expected bytes)"
  curl --fail --location --retry 3 --retry-delay 5 --continue-at - --output "$target" "$url"
  echo "done   $target ($(wc -c <"$target") bytes)"
}

fetch "$GEOFABRIK" "$RAW/south-fed-district-latest.osm.pbf"
for tile in $DEM_TILES; do
  name="Copernicus_DSM_COG_10_${tile}_DEM"
  fetch "$DEM_BASE/$name/$name.tif" "$RAW/$name.tif"
done

echo
echo "raw inputs ready in $RAW:"
ls -lh "$RAW"
