#!/bin/bash
set -euo pipefail
TAG="${1:-hardest-20261028}"
PORT="${2:-18095}"
NAME="hardest-backend"
ROOT=/Users/savelij/projects/o-hack
WORKTREE=/Users/savelij/projects/o-hack-hardest

cd "$WORKTREE"
TAG="$TAG" docker buildx bake backend

ENVFILE=$(mktemp)
docker inspect hotel-agent-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -v '^PATH=' | grep -v '^$' > "$ENVFILE"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  --network hotel-agent_default \
  --env-file "$ENVFILE" \
  -p "127.0.0.1:$PORT:8000" \
  -v hotel-agent_terrain-cache:/srv/cache:rw \
  -v "$ROOT/map-catalog:/srv/map-catalog:ro" \
  -v "$ROOT/characteristics:/srv/characteristics:ro" \
  -v "$ROOT/data:/srv/data:ro" \
  -v "$ROOT/data/basemaps:/srv/basemaps:ro" \
  "hotel-agent-backend:$TAG" \
  uvicorn hotel_agent.main:create_app --factory --host 0.0.0.0 --port 8000
rm -f "$ENVFILE"

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1; then
    echo "ready http://127.0.0.1:$PORT"
    curl -s "http://127.0.0.1:$PORT/api/v1/health"; echo
    exit 0
  fi
  sleep 2
done
echo "not healthy" >&2
docker logs --tail 40 "$NAME" >&2
exit 1
