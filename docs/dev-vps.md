# Développement sur le VPS (Story 8.1)

Anta se développe sur le VPS de dev (`vmi3733843`), ouvert depuis le PC via Tailscale. Aucun fichier `.env` : les variables viennent de Doppler.

## Prérequis (utilisateur `atlas`)

- Node 24 via nvm : `nvm use` (lit `.nvmrc`).
- Doppler CLI connecté (`doppler login`) et dépôt lié à `anta/dev` (`doppler setup --project anta --config dev`).
- Docker (pour le Postgres de test).

## Lancer l'application

```bash
doppler run -- npm run dev
```

- Le serveur écoute sur `127.0.0.1:3333` (`HOST`/`PORT` dans Doppler), donc rien n'est exposé directement.
- `tailscale serve` le publie sur le tailnet uniquement :

| URL                                         | Cible             | Rôle                    |
| ------------------------------------------- | ----------------- | ----------------------- |
| `https://vmi3733843.tail39fe0e.ts.net:9443` | `127.0.0.1:3333`  | application (`APP_URL`) |
| `https://vmi3733843.tail39fe0e.ts.net:9444` | `127.0.0.1:24678` | WebSocket HMR de Vite   |

Configuration (une seule fois, persistante) :

```bash
sudo tailscale serve --bg --https=9443 http://127.0.0.1:3333
sudo tailscale serve --bg --https=9444 http://127.0.0.1:24678
tailscale serve status   # les deux entrées doivent être « tailnet only »
```

Ne jamais utiliser `tailscale funnel` (exposition publique).

`VITE_HMR_CLIENT_PORT=9444` (Doppler) active dans `vite.config.ts` le HMR en `wss` sur ce port et autorise l'hôte de `APP_URL` (`server.allowedHosts`). Sans cette variable (dev sur un poste local), Vite garde ses valeurs par défaut.

## Base partagée avec le staging

La config `anta/dev` pointe sur la base Supabase **du staging**, et R2/Mailgun sont les vrais services (vrais fichiers, vrais e-mails).

- Interdits : `migration:rollback`, `migration:fresh`, `migration:reset`, `db:wipe`, seeders destructifs ou de démo.
- Migrations rétrocompatibles uniquement (expand/contract : ajouter d'abord, supprimer dans une release ultérieure). Le staging exécute `migration:run --force` à chaque démarrage.
- Ne lancer `migration:run` en dev que pour une migration destinée à être mergée sur `development`.

## Tests

```bash
npm run test:local                # toutes les suites
npm run test:local -- unit        # une suite
```

`scripts/test-local.sh` démarre (ou réutilise) un conteneur `anta-test-db` (`postgres:16`, base `anta_test`, `127.0.0.1:5433`), applique les migrations puis lance `node ace test` avec les mêmes valeurs que la CI. Le script refuse de tourner sous `doppler run` : les tests ne voient jamais Supabase.

Pour repartir d'une base vide : `docker rm -f anta-test-db`.
