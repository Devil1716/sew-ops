#!/usr/bin/env bash
# Sew Ops: create the FIRST factory and admin on a new, empty server. Works once.
set -euo pipefail
APP=/opt/sewops
cd "$APP"
[ -f releases/current.env ] || { echo "Deploy a release first (releases/current.env is missing)."; exit 1; }
set -a; . "$APP/.env"; . "$APP/releases/current.env"; set +a

read -r -p "Factory name: " FACTORY_NAME
read -r -p "Factory code (2-20 letters, numbers or dashes, e.g. MAIN): " FACTORY_CODE
read -r -p "Timezone [Asia/Kolkata]: " FACTORY_TZ
FACTORY_TZ=${FACTORY_TZ:-Asia/Kolkata}
read -r -p "Admin full name: " ADMIN_NAME
read -r -p "Admin email (used to sign in): " ADMIN_EMAIL
read -r -s -p "Admin password (12+ characters): " ADMIN_PASSWORD; echo
read -r -s -p "Type it again: " ADMIN_PASSWORD2; echo
if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD2" ]; then echo "The two passwords do not match."; exit 1; fi
export FACTORY_NAME FACTORY_CODE FACTORY_TZ ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD

docker compose -p sewops --env-file "$APP/.env" -f "$APP/docker-compose.prod.yml" --profile tools run --rm migrate npx tsx scripts/create-admin.ts