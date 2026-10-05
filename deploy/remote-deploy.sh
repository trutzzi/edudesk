#!/usr/bin/env bash
# Runs on the server once CI has uploaded a release to <app dir>/releases/<release>.
# Installs the API's dependencies, migrates the database, then points <app dir>/current at the
# new release and reloads both apps. A failure before the switch leaves the old release running.
#
#   remote-deploy.sh <app dir> <release>
#
# Layout on the server:
#   <app dir>/shared/backend.env   the API's settings (see apps/backend/.env.example), never in git
#   <app dir>/releases/<sha>/      one folder per deploy; the last few are kept for rollback
#   <app dir>/current              link to the live release
set -euo pipefail

APP_DIR="$1"
RELEASE="$2"
RELEASE_DIR="$APP_DIR/releases/$RELEASE"
ENV_FILE="$APP_DIR/shared/backend.env"
KEEP_RELEASES=5

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE: create it from apps/backend/.env.example before deploying." >&2
  exit 1
fi

echo "Installing the API's dependencies"
ln -sfn "$ENV_FILE" "$RELEASE_DIR/backend/.env"
cd "$RELEASE_DIR/backend"
npm ci --omit=dev --no-audit --no-fund

echo "Migrating the database"
NODE_ENV=production npx --no-install node-pg-migrate up
NODE_ENV=production node dist/scripts/holidays.js

echo "Switching to $RELEASE"
ln -sfn "$RELEASE_DIR" "$APP_DIR/current.next"
mv -Tf "$APP_DIR/current.next" "$APP_DIR/current"

APP_DIR="$APP_DIR" pm2 startOrReload "$APP_DIR/current/deploy/ecosystem.config.cjs" --update-env
pm2 save

echo "Removing old releases"
ls -1dt "$APP_DIR"/releases/*/ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "Deployed $RELEASE"
