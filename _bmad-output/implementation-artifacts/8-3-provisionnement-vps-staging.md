# Story 8.3 : Staging Anta sur le VPS partagé (`anta.peraha.com`)

Status: in-progress

## Story

En tant que développeur,
Je veux qu'Anta tourne en Docker sur le VPS de staging et soit servi publiquement sur `https://anta.peraha.com`,
Afin de tester et faire la démo de l'application dans des conditions de production.

## Contexte (révisé le 2026-11-16, décisions d'Aurélien)

Le VPS de staging n'est **pas dédié** : c'est celui de Coffee Chat (Ubuntu 24.04, 8 Go RAM, 84 Go libres). Constat du 2026-11-16 :

- Compte SSH : **`coffeechat`** (groupes `sudo` + `docker`), clé `/home/atlas/.ssh/dev-staging/vps_key`. Pas d'accès root direct, pas d'utilisateur `deploy`.
- Docker 29.4 + Compose v5.1 déjà installés ; `ufw` actif.
- **80/443 sont tenus par le nginx conteneurisé de Coffee Chat** (`coffeechat-nginx-1`, projet Compose `/srv/coffeechat`, réseau `coffeechat_coffeechat_network`) avec un conteneur `coffeechat-certbot-1` (webroot `/var/www/certbot`, volumes `coffeechat_nginx_certs` / `coffeechat_nginx_certbot_webroot`). Vhosts dans `/srv/coffeechat/infra/nginx/conf.d/*.conf` (monté dans le conteneur) ; `client_max_body_size 10M` global.
- Pas de nginx ni de certbot sur l'hôte.

Décisions :
1. Anta tourne dans **son propre projet Compose** (`/opt/anta`), sur un port à part (`127.0.0.1:3333`, loopback uniquement), **sans Caddy**.
2. L'accès public passe par le **nginx de Coffee Chat** en reverse proxy (un vhost `anta.conf` de plus), certificat Let's Encrypt via son certbot.
3. **Pas de Doppler en staging** (Doppler sert uniquement au dev sur le VPS de dev). Les secrets du staging vivent dans `/opt/anta/.env` (`0600`, propriétaire `coffeechat`, hors dépôt).
4. DNS chez Hostinger, modifié par Aurélien (instructions fournies).

Ces décisions remplacent, pour le staging, « Caddy dans le compose » (8.2) et « Doppler partout » (architecture/epics, PR #11) : à reporter dans `epics.md` / `architecture.md` (T7).

## Acceptance Criteria

1. **Given** le VPS de staging partagé avec Coffee Chat
   **When** la stack Anta est démarrée (`docker compose -f compose.yaml -f compose.staging.yaml up -d --no-build` dans `/opt/anta`)
   **Then** l'app répond sur `http://127.0.0.1:3333/health` sur le VPS, **sans publier de port public** et sans toucher aux conteneurs Coffee Chat
2. **Given** l'enregistrement DNS `anta.peraha.com` pointe vers `<IP du VPS>`
   **When** le vhost `anta.conf` est chargé dans le nginx de Coffee Chat
   **Then** `https://anta.peraha.com` sert l'application avec un certificat Let's Encrypt valide, HTTP redirige vers HTTPS, les uploads jusqu'à 110 MiB passent
   **And** elle utilise la même base Supabase, le même bucket R2 et Mailgun, avec `APP_URL=https://anta.peraha.com`
3. **Given** Anta est arrêté ou absent
   **When** le nginx de Coffee Chat est rechargé ou redémarré
   **Then** il démarre normalement et coffeechathub.com reste servi (Anta répond 502, rien de plus)

## Tasks / Subtasks

- [x] T1 — Override Compose `compose.staging.yaml` (AC 1, 3)
  - [x] Service `caddy` désactivé (`profiles: [caddy]`), `DOMAIN` plus exigé en staging (rendre l'interpolation `:?` compatible, p. ex. défaut quand Caddy est hors profil — vérifier que `compose config` passe sans `DOMAIN`).
  - [x] `app` : `env_file: .env` ; `ports: ['127.0.0.1:${APP_PORT:-3333}:3333']` ; rejoint le réseau externe `coffeechat_coffeechat_network` avec l'alias **`anta-app`** (en plus du réseau par défaut).
  - [x] Vérifier empiriquement que les entrées `environment:` sans valeur du `compose.yaml` ne masquent pas celles de `env_file` (`docker compose config` + `docker compose exec app printenv`). Sinon, les retirer dans l'override ou passer par l'interpolation.
- [x] T2 — Vhost nginx `deploy/nginx/anta.conf` (versionné dans le dépôt Anta) (AC 2, 3)
  - [x] Bloc 80 : `/.well-known/acme-challenge/` → `root /var/www/certbot`, le reste → 301 HTTPS.
  - [x] Bloc 443 : `http2 on`, cert `/etc/letsencrypt/live/anta.peraha.com/`, `client_max_body_size 110m`, `proxy_request_buffering off` (uploads), timeouts longs pour l'upload, en-têtes `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Real-IP`.
  - [x] **Résolution paresseuse obligatoire** : `resolver 127.0.0.11 valid=30s;` + `set $anta_upstream http://anta-app:3333;` + `proxy_pass $anta_upstream;`. Un `upstream`/`proxy_pass` statique empêcherait nginx de démarrer si Anta est arrêté → coupure de Coffee Chat (AC 3).
  - [x] Version « HTTP seulement » (bloc 80 qui proxifie au lieu de rediriger) pour la phase avant certificat : fichier séparé ou section commentée, documentée.
  - [x] Vérifier `trustProxy` (8.2 : loopback + uniquelocal) : nginx joint l'app depuis le réseau bridge Docker (172.x, couvert par uniquelocal) → `request.ip()` et `X-Forwarded-Proto` corrects.
- [x] T3 — Script `scripts/vps/deploy-staging.sh` (lancé depuis le VPS de dev, en `atlas`) (AC 1)
  - [x] `set -euo pipefail` ; cible et clé SSH en variables (`STAGING_HOST`, `STAGING_USER=coffeechat`, `SSH_KEY`), aucune IP ni secret en dur.
  - [x] `docker build -t anta:<sha> .` → `docker save | gzip | ssh … 'gunzip | docker load'` → `scp compose.yaml compose.staging.yaml` vers `/opt/anta/` → `ANTA_IMAGE=anta:<sha> docker compose … up -d --no-build` → attente du healthcheck → `curl 127.0.0.1:3333/health`.
  - [x] Refuse de tourner si `/opt/anta/.env` est absent sur le VPS. Garde le tag courant dans `/opt/anta/.image` pour pouvoir relancer l'ancien (rollback = `ANTA_IMAGE=anta:<ancien> … up -d --no-build`).
  - [x] 8.4 remplacera le transfert par un `docker compose pull` depuis GHCR sans changer `/opt/anta`.
- [x] T4 — Préparation du VPS (AC 1)
  - [x] `sudo install -d -o coffeechat -g coffeechat -m 750 /opt/anta`.
  - [x] `/opt/anta/.env` (`0600`) : généré une seule fois depuis le VPS de dev en `atlas` à partir des valeurs de Doppler `anta/dev_personal`, poussé par `ssh … 'umask 077; cat > /opt/anta/.env'` (jamais écrit sur le disque du dev), avec les surcharges staging : `APP_URL=https://anta.peraha.com`, **`APP_KEY` propre au staging** (`node ace generate:key --show`), `LOG_LEVEL=info`, `SESSION_DRIVER=cookie`. Ne contient pas `ANTA_IMAGE`.
  - [x] Ne pas modifier `ufw`, `sshd`, ni les paquets du serveur (il appartient à Coffee Chat).
- [x] T5 — Branchement sur le nginx de Coffee Chat (AC 2, 3) — **avec accord d'Aurélien au moment de le faire**
  - [x] Copier `deploy/nginx/anta.conf` (version HTTP seule) dans `/srv/coffeechat/infra/nginx/conf.d/` (`sudo`, root:root 0644).
  - [x] Toujours `docker exec coffeechat-nginx-1 nginx -t` **avant** `nginx -s reload` ; en cas d'échec, retirer le fichier immédiatement.
  - [x] Vérifier que coffeechathub.com et admin.coffeechathub.com répondent toujours (`curl -sI`).
  - [x] Test avant DNS : `curl --resolve anta.peraha.com:80:<IP du VPS> http://anta.peraha.com/health`.
- [x] T6 — DNS puis certificat (AC 2)
  - [x] Après propagation (`dig +short anta.peraha.com` = `<IP du VPS>`) : `docker run --rm -v coffeechat_nginx_certs:/etc/letsencrypt -v coffeechat_nginx_certbot_webroot:/var/www/certbot certbot/certbot:v3.1.0 certonly --webroot -w /var/www/certbot -d anta.peraha.com --agree-tos -m <email> -n` (essayer d'abord `--dry-run`).
  - [x] Passer `anta.conf` en version HTTPS, `nginx -t`, reload, revérifier Coffee Chat.
  - [x] Le renouvellement est fait par la boucle du conteneur `coffeechat-certbot-1` (tous les certificats du volume). **Piège constaté** : son `--deploy-hook` envoie `kill -HUP 1` dans le conteneur certbot, pas dans nginx → nginx ne recharge pas les certificats renouvelés. Ajouter sur le VPS un cron hebdomadaire `docker exec coffeechat-nginx-1 nginx -s reload` (crontab de `coffeechat`) et le signaler à Aurélien (concerne aussi le certificat Coffee Chat).
- [x] T7 — Validation, tests, docs (AC 1–3)
  - [x] Bout en bout (automatisé, sans écriture en base) : page d'accueil, POST 20 Mo atteignant l'app (pas de 413 nginx), lecture PDF (URL R2 signée), en-têtes `X-Forwarded-*` pris en compte (cookies `Secure`, `og:url` en https).
  - [ ] Recette manuelle par Aurélien (écrit dans la base partagée / envoie un e-mail) : connexion admin, upload réel d'un fichier > 10 Mo, réinitialisation de mot de passe (e-mail Mailgun reçu).
  - [x] AC 3 : `docker compose stop app` → `nginx -t && nginx -s reload` OK, coffeechathub.com 200, anta 502 ; puis redémarrer.
  - [x] Étendre `tests/unit/infrastructure/deployment.spec.ts` : `compose.staging.yaml` (caddy hors profil, port lié à `127.0.0.1`, réseau externe, alias `anta-app`), `anta.conf` (`resolver 127.0.0.11`, `proxy_pass $…`, `client_max_body_size 110m`, acme-challenge), script (`set -euo pipefail`, `--no-build`, aucune IP ni `dp.st.`).
  - [x] `docs/staging-vps.md` : architecture (schéma), arborescence `/opt/anta`, `.env`, déploiement, rollback, logs, nginx/certificat, ce qu'il ne faut pas faire (toucher aux conteneurs Coffee Chat, `nginx -s reload` sans `nginx -t`, commandes destructives sur la base partagée).
  - [x] Reporter les décisions 1–3 dans `epics.md` (Story 8.3, 8.6 « provisionné comme en 8.3 ») et `architecture.md` (tableau dev/staging/prod : Doppler = dev seulement).

## Dev Notes

### Ce qui existe déjà (ne pas refaire)
- `Dockerfile`, `compose.yaml`, `Caddyfile`, `GET /health`, `trustProxy`, `docs/docker.md` : Story 8.2 (branche `feat/8-2-docker-caddy`, commit f799047, en review). 8.3 se branche **sur 8.2** (`feat/8-3-staging-vps`). `compose.yaml` et Caddy restent valables pour un VPS dédié (prod, 8.6).

### Schéma
```
Internet ─443─► coffeechat-nginx-1 (vhost anta.conf)
                   │ réseau coffeechat_coffeechat_network, alias anta-app
                   ▼
                anta-app-1:3333 ◄── 127.0.0.1:3333 (debug sur le VPS)
                   │
                   ├─► Supabase (Postgres partagé)
                   ├─► Cloudflare R2
                   └─► Mailgun
```

### Pièges
- **Ne jamais casser Coffee Chat** : `nginx -t` avant tout reload ; résolution paresseuse de `anta-app` ; ne pas redémarrer ni recréer les conteneurs `coffeechat-*` ; ne pas modifier `/srv/coffeechat` hors du seul fichier `conf.d/anta.conf` (il y apparaîtra comme fichier non suivi dans le clone git de Coffee Chat : à signaler, éventuellement l'ajouter à leur dépôt plus tard).
- **Port loopback seulement** : `127.0.0.1:3333`, jamais `3333` nu (Docker contourne `ufw`).
- **`up -d` sans `--no-build`** : Compose tente un build sans contexte et échoue.
- **Base partagée** : `migration:run --force` au démarrage, sur la même base que le dev et Render. Interdits : rollback/fresh/reset/wipe/seeders destructifs (`CLAUDE.local.md`). Déployer un commit dont les migrations sont déjà sur `development`.
- **Limites Let's Encrypt** : `--dry-run` d'abord ; ne pas relancer `certonly` en boucle.
- **DNS** : remplacer le CNAME `anta` (vers Render) par un A ; ne pas toucher `mg.anta` (Mailgun). Pas d'AAAA tant que nginx n'est pas vérifié en IPv6 pour ce vhost (il écoute bien `[::]:80/443`, mais inutile en 8.3).
- Deux staging en parallèle (Render + VPS) écrivent les mêmes stats : accepté jusqu'à 8.5. Dès le changement DNS, `anta.peraha.com` ne pointe plus vers Render (reste `anta-staging.onrender.com`).
- `APP_KEY` ne chiffre aucune donnée en base : une clé propre au staging est sans risque.

### Hors périmètre
- CI/CD, GHCR → Story 8.4. Fin de Render → 8.5. Prod (VPS dédié, Caddy) → 8.6. Durcissement du VPS (il appartient à Coffee Chat), sauvegardes, monitoring → hors Anta.

### Project Structure Notes
- `compose.staging.yaml` à la racine (à côté de `compose.yaml`) ; `deploy/nginx/anta.conf` ; `scripts/vps/deploy-staging.sh` ; `docs/staging-vps.md`. Rien dans `app/`.

### References
- `_bmad-output/planning-artifacts/epics.md` § Story 8.3 (branche `docs/epic-8-vps-infra`, PR #11)
- `_bmad-output/planning-artifacts/architecture.md` § Phase finale — VPS
- `_bmad-output/implementation-artifacts/8-2-conteneurisation-image-compose-caddy.md`, `docs/docker.md`, `compose.yaml`
- `docs/dev-vps.md`, `CLAUDE.local.md`

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code), 2026-11-16

### Debug Log References

- Compose (test empirique) : une entrée `environment:` sans valeur **écrase** `env_file` (`null`) ; elle est en revanche résolue depuis le `.env` du dossier projet / `--env-file`. D'où : pas d'`env_file`, `/opt/anta/.env` + `image.env` passés en `--env-file`. `DOMAIN` doit figurer dans `.env` (le `:?` de `compose.yaml` est évalué même avec Caddy hors profil).
- nginx 1.27-alpine local : `nginx -t` OK pour les deux vhosts ; sans backend → 502 (nginx démarre) ; HTTP → 301 ; backend factice : `X-Forwarded-Proto: https`, `Host` conservé ; POST 50 Mo → 200.
- `listen [::]` retiré : absent des vhosts Coffee Chat, IPv6 non garanti dans le conteneur.
- VPS : `deploy-staging.sh` → `anta:bee44b9` chargé, conteneur `healthy`, migrations « Already up to date », `/health` 200, page d'accueil 200, ~100 Mio RAM ; `coffeechat-nginx-1` joint `anta-app:3333`.
- `anta.http-only.conf` installé : `nginx -t` OK, reload ; coffeechathub.com 200 et admin 307 avant/après ; `curl --resolve anta.peraha.com:80:<IP du VPS> /health` → 200.
- AC 3 sur le VPS : `stop app` → `nginx -t` + reload OK, coffeechathub.com 200, Anta 502 ; relance → 200.
- Cron `coffeechat` : `17 4 * * 1 docker exec coffeechat-nginx-1 sh -c "nginx -t -q && nginx -s reload"`.
- HTTPS : `https://anta.peraha.com/health` et `/` 200, HTTP → 301, coffeechathub.com 200 / admin 307 après reload ; `/admin/productions` → 302 `/admin/login` ; cookies `Secure; HttpOnly; SameSite=Lax` ; POST multipart 20 Mo → 302 de l'app ; PDF via URL R2 signée → 206 `application/pdf`.
- Tests : unit 268/268 ; functional 81/171 (échecs CI connus, Story 8.4 ; aucun code applicatif modifié) ; lint + typecheck OK.

### Completion Notes List

- 2026-11-16 : DNS fait par Aurélien ; certificat Let's Encrypt obtenu (`--dry-run` puis réel, e-mail `dev@peraha.com`, émetteur YE2, expire 2027-02-14, renouvellement webroot par `coffeechat-certbot-1`) ; `anta.conf` HTTPS installé. Reste la recette manuelle (T7).
- Écart à la story : le tag déployé est conservé dans `/opt/anta/image.env` (lu par Compose) plutôt que `.image`, pour que les commandes manuelles (`ps`, `logs`, `up`) visent la bonne image.
- `.env` généré depuis Doppler `anta/dev_personal` (seule source existante des secrets), avec `APP_KEY` propre au staging ; valeurs entre apostrophes (pas d'interpolation `$`).
- `epics.md` / `architecture.md` amendés sur la branche `docs/epic-8-vps-infra` (PR #11), commit 4f37553 ; 8.6 : VPS de prod dédié, `.env`, Caddy.

### File List

- `compose.staging.yaml` (nouveau)
- `deploy/nginx/anta.conf`, `deploy/nginx/anta.http-only.conf` (nouveaux)
- `scripts/vps/deploy-staging.sh` (nouveau)
- `docs/staging-vps.md` (nouveau)
- `compose.yaml` (en-tête), `docs/docker.md` (encart staging)
- `tests/unit/infrastructure/deployment.spec.ts`
- Hors dépôt (VPS) : `/opt/anta/{.env,image.env,compose.yaml,compose.staging.yaml}`, `/srv/coffeechat/infra/nginx/conf.d/anta.conf`, crontab `coffeechat`
- Branche `docs/epic-8-vps-infra` : `_bmad-output/planning-artifacts/epics.md`, `architecture.md`
