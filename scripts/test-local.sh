#!/usr/bin/env bash
# Run the Japa suites against a throwaway local Postgres (Story 8.1).
# Same values as the CI (.github/workflows/ci.yml), never Supabase:
# do NOT run this through `doppler run`.
#
# Usage: npm run test:local [-- <suites/flags passed to `node ace test`>]
set -euo pipefail

CONTAINER=anta-test-db
PG_PORT=5433

if [ -n "${DOPPLER_PROJECT:-}" ]; then
  echo "Refusing to run under doppler run: tests must not see the Doppler (Supabase) values." >&2
  exit 1
fi

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=anta_test \
    -p 127.0.0.1:$PG_PORT:5432 postgres:16 >/dev/null
elif [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
  docker start "$CONTAINER" >/dev/null
fi

until docker exec "$CONTAINER" pg_isready -U postgres -d anta_test >/dev/null 2>&1; do sleep 1; done

export TZ=UTC NODE_ENV=test PORT=3333 HOST=localhost LOG_LEVEL=info
export APP_KEY=ci-test-app-key-32-chars-minimum-required APP_URL=http://localhost:3333
# SESSION_DRIVER=memory : le client de test (sessionApiClient) écrit la session dans
# le store memory ; une valeur exportée ici prime sur .env.test (cookie = CSRF/loginAs KO).
export APP_NAME=Anta VITE_APP_NAME=Anta SESSION_DRIVER=memory
export DB_HOST=127.0.0.1 DB_PORT=$PG_PORT DB_USER=postgres DB_PASSWORD=postgres DB_DATABASE=anta_test DB_SSL=false
export R2_ENDPOINT=https://placeholder.r2.cloudflarestorage.com R2_BUCKET=anta-test
export R2_ACCESS_KEY_ID=placeholder R2_SECRET_ACCESS_KEY=placeholder
export MAIL_MAILER=resend MAIL_FROM_NAME=Anta MAIL_FROM_ADDRESS=noreply@anta.community
export RESEND_API_KEY=placeholder MAILGUN_API_KEY=placeholder MAILGUN_DOMAIN=mg.anta.community

node ace migration:run --force
node ace test "$@"
