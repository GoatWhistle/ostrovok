#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
while IFS=, read -r hotel_id supplier_id; do
  if [[ "$hotel_id" == "hotel_id" ]]; then
    continue
  fi
  docker compose exec -T backend python -m hotel_agent.cli sync-nuitee \
    --hotel-id "$hotel_id" --supplier-id "$supplier_id" < /dev/null
done < data/seed/sochi/nuitee_matches.csv
