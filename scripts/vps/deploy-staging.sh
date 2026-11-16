#!/usr/bin/env bash
# Déploie le commit courant sur le VPS de staging (Story 8.3, docs/staging-vps.md).
# Lancé depuis le VPS de dev, avec la clé admin. Construit l'image, la transfère par
# SSH (docker save | docker load), installe /opt/anta/remote-deploy.sh et lui confie le
# démarrage : même chemin que la CI (.github/workflows/deploy-staging.yml, Story 8.4),
# qui tire l'image depuis GHCR au lieu de la transférer.
#
#   STAGING_HOST=<ip> scripts/vps/deploy-staging.sh            # commit courant
#   STAGING_HOST=<ip> ANTA_TAG=<sha> scripts/vps/deploy-staging.sh   # rollback vers une image déjà chargée
set -euo pipefail

: "${STAGING_HOST:?STAGING_HOST requis (IP ou nom du VPS de staging)}"
STAGING_USER="${STAGING_USER:-coffeechat}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="${REMOTE_DIR:-/opt/anta}"

cd "$(dirname "$0")/../.."
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes "$STAGING_USER@$STAGING_HOST")
remote() { "${SSH[@]}" "cd $REMOTE_DIR && $*"; }

remote 'test -f .env' || {
  echo "✗ $REMOTE_DIR/.env absent sur le VPS (voir docs/staging-vps.md)" >&2
  exit 1
}

if [[ -n "${ANTA_TAG:-}" ]]; then
  IMAGE="anta:$ANTA_TAG"
else
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "✗ Modifications non commitées : déployer un commit propre" >&2
    exit 1
  fi
  SHA="$(git rev-parse --short HEAD)"
  IMAGE="anta:$SHA"
  echo "→ Build $IMAGE"
  docker build --build-arg GIT_SHA="$SHA" -t "$IMAGE" .
  echo "→ Transfert de l'image"
  docker save "$IMAGE" | gzip | "${SSH[@]}" 'gunzip | docker load'
fi

# Script de démarrage (aussi utilisé par la clé CI restreinte).
scp -q -i "$SSH_KEY" -o BatchMode=yes scripts/vps/staging-remote-deploy.sh \
  "$STAGING_USER@$STAGING_HOST:$REMOTE_DIR/remote-deploy.sh"
remote 'chmod 755 remote-deploy.sh'

tar -czf - compose.yaml compose.staging.yaml |
  "${SSH[@]}" "$REMOTE_DIR/remote-deploy.sh deploy $IMAGE"
