#!/usr/bin/env bash
# Sew Ops: build the images ON THIS SERVER from an uploaded source folder, then deploy them.
# Usage: remote-build.sh <tag>      (started by scripts/deploy-from-pc.ps1)
TAG="${1:?usage: remote-build.sh <tag>}"
SRC="/opt/sewops/src/$TAG"
LOG="$SRC/build.log"
STATUS="$SRC/STATUS"
echo RUNNING > "$STATUS"
(
  set -euo pipefail
  cd "$SRC"
  echo "== building the API image =="
  docker build -f deploy/api.Dockerfile --target runtime -t "sewops-api:$TAG" .
  echo "== building the migration tools image =="
  docker build -f deploy/api.Dockerfile --target tools -t "sewops-tools:$TAG" .
  echo "== building the website image =="
  docker build -f deploy/web.Dockerfile -t "sewops-web:$TAG" .
  echo "== installing the deployment files =="
  install -m 644 deploy/docker-compose.prod.yml deploy/Caddyfile /opt/sewops/
  install -m 755 deploy/deploy.sh deploy/backup.sh deploy/bootstrap-admin.sh /opt/sewops/scripts/
  echo "== deploying =="
  SKIP_PULL=1 API_IMAGE="sewops-api:$TAG" WEB_IMAGE="sewops-web:$TAG" TOOLS_IMAGE="sewops-tools:$TAG" /opt/sewops/scripts/deploy.sh
) > "$LOG" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then
  echo OK > "$STATUS"
  ls -1dt /opt/sewops/src/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
  docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=168h" >/dev/null 2>&1 || true
else
  echo FAILED > "$STATUS"
fi
exit "$rc"