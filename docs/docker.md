# Image Docker et stack Compose (staging + production, Story 8.2)

La même image tourne en staging et en production ; seuls la config Doppler
(`anta/stg`, `anta/prd`) et `DOMAIN` changent.

## Fichiers

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Multi-stage : `node ace build` avec les devDependencies, puis étage runtime avec `build/` + `npm ci --omit=dev`, utilisateur `node`. Démarre par `node ace migration:run --force && node bin/server.js`. |
| `.dockerignore` | Exclut `.env*`, `node_modules`, `build`, la doc et les artefacts BMad du contexte de build. |
| `compose.yaml` | Services `app` (aucun port publié, health check sur `GET /health`) et `caddy` (ports 80/443). Logs plafonnés (`json-file`, 10 Mo × 5). |
| `Caddyfile` | Site `{$DOMAIN}` : certificat Let's Encrypt automatique, redirection HTTP → HTTPS, limite de corps 110 Mio (comme `bodyparser`), reverse proxy vers `app:3333`. |

## Lancer sur un hôte

```bash
# Doppler injecte toutes les variables : aucun fichier .env sur disque.
doppler run --project anta --config stg -- docker compose up -d --build
doppler run --project anta --config stg -- docker compose logs -f app
```

Variables Compose (à mettre dans la config Doppler ; ce ne sont pas des variables de l'app) :

| Variable | Défaut | Rôle |
|---|---|---|
| `DOMAIN` | requis | Site servi par Caddy (`anta.peraha.com` en staging) |
| `ANTA_IMAGE` | `anta:local` | Image à exécuter (tag GHCR en Story 8.4) |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | Ports de l'hôte (à changer seulement pour un test local) |

`NODE_ENV`, `HOST`, `PORT` et `TZ` sont fixés par `compose.yaml`, quelle que soit la valeur Doppler.

## À savoir

- **Les migrations tournent à chaque démarrage** (`migration:run --force`). Sur la base partagée
  dev/staging, elles doivent rester rétrocompatibles (voir `docs/dev-vps.md`).
- **IP du client** : `config/app.ts` fait confiance aux en-têtes `X-Forwarded-*` venant du loopback
  et des réseaux privés (`trustProxy`), donc `request.ip()` est l'IP du visiteur, pas celle de Caddy.
  Le port de l'app n'est jamais publié : seul Caddy peut la joindre.
- **Certificats** : stockés dans le volume `caddy_data`. Ne pas le supprimer (limites de
  Let's Encrypt en cas de réémissions répétées).
- **Test local sans vrai domaine** : `DOMAIN=localhost HTTP_PORT=18080 HTTPS_PORT=18443` fait utiliser
  à Caddy sa CA interne (`curl -k`) ; ajouter un override Compose avec un service `postgres:16`
  jetable. Ne jamais pointer la stack de test vers Supabase.
