#!/usr/bin/env bash
# Déploie le commit courant sur le VPS de staging (Story 8.3, docs/staging-vps.md).
# Lancé depuis le VPS de dev. Construit l'image, la transfère par SSH
# (docker save | docker load), copie les fichiers Compose dans /opt/anta et
# relance l'app. La Story 8.4 remplacera le transfert par un pull depuis GHCR.
#
#   STAGING_HOST=<ip> scripts/vps/deploy-staging.sh            # commit courant
#   STAGING_HOST=<ip> ANTA_TAG=<sha> scripts/vps/deploy-staging.sh   # rollback vers une image déjà chargée
set -euo pipefail

: "${STAGING_HOST:?STAGING_HOST requis (IP ou nom du VPS de staging)}"
STAGING_USER="${STAGING_USER:-coffeechat}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="${REMOTE_DIR:-/opt/anta}"
COMPOSE="docker compose --env-file .env --env-file image.env -f compose.yaml -f compose.staging.yaml"

cd "$(dirname "$0")/../.."
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes "$STAGING_USER@$STAGING_HOST")
remote() { "${SSH[@]}" "cd $REMOTE_DIR && $*"; }

remote 'test -f .env' || {
  echo "✗ $REMOTE_DIR/.env absent sur le VPS (voir docs/staging-vps.md)" >&2
  exit 1
}

if [[ -n "${ANTA_TAG:-}" ]]; then
  IMAGE="anta:$ANTA_TAG"
  remote "docker image inspect $IMAGE >/dev/null" || {
    echo "✗ $IMAGE absente du VPS" >&2
    exit 1
  }
else
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "✗ Modifications non commitées : déployer un commit propre" >&2
    exit 1
  fi
  IMAGE="anta:$(git rev-parse --short HEAD)"
  echo "→ Build $IMAGE"
  docker build -t "$IMAGE" .
  echo "→ Transfert de l'image"
  docker save "$IMAGE" | gzip | "${SSH[@]}" 'gunzip | docker load'
  scp -q -i "$SSH_KEY" -o BatchMode=yes compose.yaml compose.staging.yaml \
    "$STAGING_USER@$STAGING_HOST:$REMOTE_DIR/"
fi

echo "→ Démarrage de $IMAGE"
remote "echo ANTA_IMAGE=$IMAGE > image.env && $COMPOSE up -d --no-build --wait --wait-timeout 180"
remote "curl -fsS http://127.0.0.1:\${APP_PORT:-3333}/health && echo"
echo "✓ $IMAGE en ligne sur $STAGING_HOST"
