#!/usr/bin/env bash
# Sew Ops: deploy a release on the server with a health check and automatic rollback.
# Needs API_IMAGE, WEB_IMAGE and TOOLS_IMAGE in the environment (the GitHub pipeline sets them).
set -uo pipefail
APP=/opt/sewops
cd "$APP" || exit 1
: "${API_IMAGE:?API_IMAGE is not set}" "${WEB_IMAGE:?WEB_IMAGE is not set}" "${TOOLS_IMAGE:?TOOLS_IMAGE is not set}"
[ -f .env ] || { echo "Missing $APP/.env (run server-setup.sh first)"; exit 1; }
set -a; . "$APP/.env"; set +a
dc() { docker compose -p sewops --env-file "$APP/.env" -f "$APP/docker-compose.prod.yml" "$@"; }
log() { printf '\n== %s ==\n' "$*"; }

wait_healthy() { # service, seconds
  local svc=$1 secs=$2 end id status
  end=$((SECONDS + secs))
  while [ "$SECONDS" -lt "$end" ]; do
    id=$(dc ps -q "$svc" 2>/dev/null | head -n1)
    if [ -n "$id" ]; then
      status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || echo none)
      [ "$status" = "healthy" ] && return 0
    fi
    sleep 3
  done
  return 1
}

rollback() {
  echo
  echo "!! The new version is NOT healthy."
  if [ -f releases/current.env ]; then
    echo "!! Rolling back to the last good release..."
    set -a; . releases/current.env; set +a
    dc up -d --remove-orphans --no-build
    if wait_healthy api 120 && wait_healthy web 120; then
      echo "!! Rolled back: the previous version is running again."
    else
      echo "!! The rollback is not healthy either. Check: docker compose -p sewops logs --tail 80"
    fi
  else
    echo "!! This was the first release, so there is nothing to roll back to. Recent logs:"
    dc logs --tail 60 api web || true
  fi
  exit 1
}

log "1/6 Downloading the new images"
if [ "${SKIP_PULL:-0}" = "1" ]; then
  for img in "$API_IMAGE" "$WEB_IMAGE" "$TOOLS_IMAGE"; do
    docker image inspect "$img" >/dev/null 2>&1 || { echo "Image $img is not on this server."; exit 1; }
  done
  echo "the images were built on this server: nothing to download"
elif ! { docker pull "$API_IMAGE" && docker pull "$WEB_IMAGE" && docker pull "$TOOLS_IMAGE"; }; then
  echo "Could not download the images. Nothing was changed."; exit 1
fi

log "2/6 Making sure the database is up"
dc up -d --no-build db
wait_healthy db 90 || { echo "The database is not healthy. Nothing was changed."; exit 1; }

log "3/6 Backup before the change"
if [ -f releases/current.env ]; then
  "$APP/scripts/backup.sh" || { echo "The pre-deploy backup FAILED, so nothing was changed."; exit 1; }
else
  echo "first release: nothing to back up yet"
fi

log "4/6 Updating the database structure (migrations)"
dc --profile tools run --rm migrate || { echo "The migration FAILED. The running version was not touched."; exit 1; }

log "5/6 Starting the new version"
dc up -d --remove-orphans --no-build || rollback
dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true

log "6/6 Waiting for it to be healthy"
if wait_healthy api 150 && wait_healthy web 150; then
  mkdir -p releases
  [ -f releases/current.env ] && cp releases/current.env releases/previous.env
  printf 'API_IMAGE=%s\nWEB_IMAGE=%s\nTOOLS_IMAGE=%s\n' "$API_IMAGE" "$WEB_IMAGE" "$TOOLS_IMAGE" > releases/current.env
else
  rollback
fi

if curl -fsS --max-time 10 --resolve "$SITE_ADDRESS:443:127.0.0.1" "https://$SITE_ADDRESS/health" >/dev/null 2>&1; then
  echo "Public check: https://$SITE_ADDRESS/health answers (certificate OK)."
else
  echo "Note: https://$SITE_ADDRESS/health did not answer yet. If DNS was only just set, the certificate can take a few minutes."
fi
docker image prune -f >/dev/null 2>&1 || true
echo
echo "DEPLOY OK: $API_IMAGE"