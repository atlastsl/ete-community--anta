#!/usr/bin/env bash
# Démarre une image d'Anta sur le VPS de staging (Story 8.4, docs/staging-vps.md).
# Installé en /opt/anta/remote-deploy.sh. Seule commande autorisée pour la clé SSH de
# la CI (authorized_keys de coffeechat) :
#   restrict,command="/opt/anta/remote-deploy.sh" ssh-ed25519 AAAA… anta-ci-deploy
# La commande demandée arrive alors dans SSH_ORIGINAL_COMMAND ; en manuel (clé admin),
# elle est passée en arguments.
#
#   deploy <image>   stdin : archive tar.gz avec compose.yaml, compose.staging.yaml et,
#                    pour une image GHCR, ghcr-user + ghcr-token (jeton du job, lecture seule)
#   status           image courante, image précédente, état des conteneurs
#
# <image> : ghcr.io/atlastsl/ete-community--anta:<sha> (CI) ou anta:<sha> (déjà chargée,
# scripts/vps/deploy-staging.sh). Si le démarrage ou /health échoue, l'image précédente
# est relancée et le script sort en erreur.
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/opt/anta}"
GHCR_REPO=ghcr.io/atlastsl/ete-community--anta
IMAGE_RE="^(${GHCR_REPO//./\\.}|anta):[0-9a-f]{7,40}$"
COMPOSE=(docker compose --env-file .env --env-file image.env -f compose.yaml -f compose.staging.yaml)

if [[ $# -gt 0 ]]; then
  argv=("$@")
else
  read -r -a argv <<<"${SSH_ORIGINAL_COMMAND:-}"
fi
cmd="${argv[0]:-}"

cd "$REMOTE_DIR"
test -f .env || {
  echo "✗ $REMOTE_DIR/.env absent (voir docs/staging-vps.md)" >&2
  exit 1
}

current_image() { sed -n 's/^ANTA_IMAGE=//p' image.env 2>/dev/null || true; }

start() {
  echo "ANTA_IMAGE=$1" >image.env
  "${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 &&
    curl -fsS --retry 5 --retry-delay 2 --retry-all-errors "http://127.0.0.1:${APP_PORT:-3333}/health" &&
    echo
}

case "$cmd" in
  status)
    echo "courante  : $(current_image)"
    echo "précédente: $(sed -n 's/^ANTA_IMAGE=//p' image.env.previous 2>/dev/null || true)"
    "${COMPOSE[@]}" ps
    ;;

  deploy)
    image="${argv[1]:-}"
    [[ ${#argv[@]} -eq 2 && "$image" =~ $IMAGE_RE ]] || {
      echo "✗ usage : deploy <$GHCR_REPO:<sha> | anta:<sha>>" >&2
      exit 2
    }

    # Un seul déploiement à la fois (CI et manuel).
    exec 9>.deploy.lock
    flock -w 600 9 || {
      echo "✗ un autre déploiement est en cours" >&2
      exit 1
    }

    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    tar -xzf - -C "$tmp" --no-same-owner
    for f in compose.yaml compose.staging.yaml; do
      test -f "$tmp/$f" || {
        echo "✗ $f absent de l'archive" >&2
        exit 2
      }
    done

    if [[ "$image" == "$GHCR_REPO":* ]]; then
      test -s "$tmp/ghcr-token" || {
        echo "✗ ghcr-token absent de l'archive" >&2
        exit 2
      }
      # Identifiants GHCR dans le dossier temporaire, supprimés avec lui.
      export DOCKER_CONFIG="$tmp/docker"
      docker login ghcr.io -u "$(cat "$tmp/ghcr-user" 2>/dev/null || echo anta-ci)" \
        --password-stdin <"$tmp/ghcr-token" >/dev/null
      docker pull -q "$image"
      docker logout ghcr.io >/dev/null
      unset DOCKER_CONFIG
    else
      docker image inspect "$image" >/dev/null || {
        echo "✗ $image absente du VPS" >&2
        exit 1
      }
    fi

    previous="$(current_image)"
    mkdir "$tmp/previous"
    cp compose.yaml compose.staging.yaml "$tmp/previous/" 2>/dev/null || true
    install -m 644 "$tmp/compose.yaml" "$tmp/compose.staging.yaml" .

    echo "→ Démarrage de $image (précédente : ${previous:-aucune})"
    if ! start "$image"; then
      echo "✗ $image ne démarre pas" >&2
      "${COMPOSE[@]}" logs --tail 50 app >&2 || true
      if [[ -n "$previous" && "$previous" != "$image" ]]; then
        echo "→ Retour à $previous" >&2
        cp "$tmp/previous/"* . 2>/dev/null || true
        start "$previous" >&2 || echo "✗ $previous ne démarre pas non plus" >&2
      fi
      exit 1
    fi

    if [[ -n "$previous" && "$previous" != "$image" ]]; then
      echo "ANTA_IMAGE=$previous" >image.env.previous
    fi
    keep="$(sed -n 's/^ANTA_IMAGE=//p' image.env.previous 2>/dev/null || true)"

    # Ménage : on garde l'image courante et la précédente (rollback local).
    docker images "$GHCR_REPO" --format '{{.Repository}}:{{.Tag}}' |
      while read -r old; do
        [[ "$old" == "$image" || "$old" == "$keep" ]] || docker rmi "$old" >/dev/null 2>&1 || true
      done

    echo "✓ $image en ligne"
    ;;

  *)
    echo "✗ commande refusée : deploy <image> | status" >&2
    exit 2
    ;;
esac
