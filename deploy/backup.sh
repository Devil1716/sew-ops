#!/usr/bin/env bash
# Sew Ops: database backup on the server (verified), 14 kept locally, optional copy off the server.
set -euo pipefail
APP=/opt/sewops
cd "$APP"
set -a; . "$APP/.env"; set +a
dc() { docker compose -p sewops --env-file "$APP/.env" -f "$APP/docker-compose.prod.yml" "$@"; }

mkdir -p backups
f="backups/sewops_$(date +%F_%H-%M-%S).dump"
dc exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$f.tmp"
size=$(stat -c %s "$f.tmp")
items=$(dc exec -T db pg_restore --list < "$f.tmp" | wc -l)
if [ "$size" -lt 20000 ] || [ "$items" -lt 20 ]; then
  rm -f "$f.tmp"
  echo "Backup looks too small ($size bytes, $items items): NOT kept"; exit 1
fi
mv "$f.tmp" "$f"
ls -1t backups/sewops_*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "Backup saved: $APP/$f ($size bytes, $items objects)"

if [ -n "${BACKUP_REMOTE:-}" ] && [ -f "$APP/rclone.conf" ]; then
  if rclone --config "$APP/rclone.conf" copy "$f" "$BACKUP_REMOTE"; then
    echo "Copied off the server to $BACKUP_REMOTE"
  else
    echo "WARNING: the off-server copy FAILED"; exit 1
  fi
else
  echo "NOTE: no off-server backup is configured yet. This backup lives on the same server as the database."
fi