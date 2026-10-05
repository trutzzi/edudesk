#!/usr/bin/env bash
# Runs on the server once CI has uploaded a release to <app dir>/releases/<tag>: loads its Docker
# images, migrates the database, then restarts the apps on the new images. If the API isn't healthy
# afterwards, it goes back to the previous images.
#
#   remote-deploy.sh <app dir> <tag>
#
# Layout on the server:
#   <app dir>/shared/backend.env    settings and passwords (see apps/backend/.env.example), never in git
#   <app dir>/docker-compose.yml    copied from the release on every deploy
#   <app dir>/.env                  IMAGE_TAG=<tag> of the running images; change it to roll back
#   <app dir>/releases/<tag>/       the uploaded images and deploy files
set -euo pipefail

APP_DIR="$1"
TAG="$2"
RELEASE_DIR="$APP_DIR/releases/$TAG"
KEEP_RELEASES=3

cd "$APP_DIR"

if [[ ! -f shared/backend.env ]]; then
  echo "Missing $APP_DIR/shared/backend.env: create it from apps/backend/.env.example before deploying." >&2
  exit 1
fi
# Without these the database can't start, or the API can't reach it; say so instead of "unhealthy"
for setting in POSTGRES_PASSWORD DATABASE_URL JWT_SECRET; do
  if ! grep -q "^$setting=." shared/backend.env; then
    echo "$setting is missing or empty in $APP_DIR/shared/backend.env" >&2
    exit 1
  fi
done
if ! grep -q '^DATABASE_URL=.*@db:5432/' shared/backend.env; then
  echo "DATABASE_URL must point at the compose database: postgres://edudesk:<POSTGRES_PASSWORD>@db:5432/edudesk" >&2
  exit 1
fi

echo "Loading the images"
gunzip -c "$RELEASE_DIR/images.tar.gz" | docker load

PREVIOUS_TAG=$(sed -n 's/^IMAGE_TAG=//p' .env 2>/dev/null || true)
cp "$RELEASE_DIR/docker-compose.yml" docker-compose.yml
export IMAGE_TAG="$TAG"

echo "Migrating the database"
docker compose up -d --wait db
docker compose run --rm --no-deps api npx --no-install node-pg-migrate up
docker compose run --rm --no-deps api node dist/scripts/holidays.js

echo "Starting $TAG"
echo "IMAGE_TAG=$TAG" > .env
docker compose up -d --remove-orphans

echo "Waiting for the API"
healthy=false
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4100/health/ready > /dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  echo "The API didn't become healthy. Its last log lines:" >&2
  docker compose logs --tail 40 api >&2 || true
  if [[ -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$TAG" ]]; then
    echo "Going back to $PREVIOUS_TAG" >&2
    echo "IMAGE_TAG=$PREVIOUS_TAG" > .env
    IMAGE_TAG="$PREVIOUS_TAG" docker compose up -d --remove-orphans
  fi
  exit 1
fi

echo "Removing old releases and images"
ls -1dt releases/*/ | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  old_tag=$(basename "$old")
  docker image rm "edudesk-api:$old_tag" "edudesk-web:$old_tag" > /dev/null 2>&1 || true
  rm -rf "$old"
done

echo "Deployed $TAG"
