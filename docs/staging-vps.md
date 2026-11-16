# Staging sur le VPS partagé (`anta.peraha.com`)

Story 8.3. Le staging d'Anta tourne en Docker sur le VPS de **Coffee Chat** (Hostinger, Ubuntu 24.04),
derrière le nginx conteneurisé de Coffee Chat qui détient les ports 80/443. Pas de Caddy, pas de Doppler.
Pour un VPS dédié (production), voir `docs/docker.md` (Caddy inclus).

```
Internet ─443─► coffeechat-nginx-1 ──(vhost conf.d/anta.conf)──┐
                 réseau coffeechat_coffeechat_network          │ alias anta-app
                                                               ▼
                        127.0.0.1:3333 (VPS) ◄──────── anta-app-1:3333
                                                       ├─► Supabase (base partagée)
                                                       ├─► Cloudflare R2
                                                       └─► Mailgun
```

## Sur le VPS

| Élément | Emplacement |
|---|---|
| Compte SSH | `coffeechat` (sudo, groupe `docker`), clé du VPS de dev `/home/atlas/.ssh/dev-staging/vps_key` |
| Projet Compose `anta` | `/opt/anta` (`coffeechat:coffeechat`, `750`) : `compose.yaml`, `compose.staging.yaml`, `.env`, `image.env`, `image.env.previous`, `remote-deploy.sh` |
| Secrets | `/opt/anta/.env` (`0600`, hors dépôt) : lu par Compose pour les variables sans valeur de `compose.yaml` |
| Image déployée | `/opt/anta/image.env` : `ANTA_IMAGE=<image>:<sha>` ; la précédente dans `image.env.previous` (écrits par `remote-deploy.sh`) |
| Clé CI | `~coffeechat/.ssh/authorized_keys` : `restrict,command="/opt/anta/remote-deploy.sh" … anta-ci-deploy` |
| Vhost nginx | `/srv/coffeechat/infra/nginx/conf.d/anta.conf` (copie de `deploy/nginx/anta.conf`) |
| Certificat | volume `coffeechat_nginx_certs` → `/etc/letsencrypt/live/anta.peraha.com/` |
| Cron | crontab de `coffeechat` : recharge nginx le lundi à 04:17 (certificats renouvelés) |

Commande Compose de référence (dans `/opt/anta`) :

```bash
C="docker compose --env-file .env --env-file image.env -f compose.yaml -f compose.staging.yaml"
$C ps
$C logs -f app
$C restart app
```

### `.env`

Mêmes clés que celles listées sans valeur dans `compose.yaml`, plus `DOMAIN=anta.peraha.com` (exigé par
l'interpolation de `compose.yaml` même si Caddy est désactivé). Valeurs entre **apostrophes** (Compose
n'interpole pas `$` dedans). `APP_URL=https://anta.peraha.com`, `APP_KEY` propre au staging.

Généré une fois depuis le VPS de dev (Doppler `anta/dev_personal` + surcharges staging), envoyé par
`ssh … 'umask 077; cat > /opt/anta/.env'` sans fichier intermédiaire. Pour changer une valeur : éditer
`/opt/anta/.env` sur le VPS, puis `$C up -d --no-build` (recrée le conteneur). Ne pas utiliser `env_file:` :
les entrées sans valeur de `compose.yaml` l'écraseraient (vérifié).

## Déployer

### Automatique (CI, Story 8.4)

Merge `development → staging` → `.github/workflows/deploy-staging.yml` :

```
test (ci.yml : lint, typecheck, unit, functional)
  → image : ghcr.io/atlastsl/ete-community--anta:<sha> (+ :staging), GIT_SHA=<sha>
  → deploy : ssh coffeechat@VPS "deploy <image>:<sha>"  (stdin : fichiers Compose + jeton GHCR)
  → curl https://anta.peraha.com/health  → revision == <sha>, sinon job rouge
```

La clé de la CI ne peut lancer que `/opt/anta/remote-deploy.sh` (`restrict,command=`) : ni shell, ni
`scp`. `coffeechat` a `sudo`, une clé CI non restreinte vaudrait root sur le VPS de
Coffee Chat. Le script accepte `deploy <image>` (regex : image GHCR d'Anta ou `anta:<sha>` local) et
`status`. Il tire l'image avec le jeton du job (lecture seule, expire avec le job, identifiants dans un
dossier temporaire supprimé), installe les fichiers Compose, `up -d --no-build --wait`, vérifie `/health`.
**Si l'image ne démarre pas, il relance la précédente et sort en erreur** (staging toujours servi, job
rouge). Il garde l'image courante et la précédente, supprime les autres.

Secrets de l'environnement GitHub **`staging`** (Settings → Environments) :

| Secret | Contenu |
|---|---|
| `STAGING_HOST` | IP du VPS |
| `STAGING_SSH_KEY` | clé privée `ed25519` dédiée (`anta-ci-deploy`, sans passphrase) |
| `STAGING_KNOWN_HOSTS` | sortie de `ssh-keyscan -t ed25519 <ip>` (hôte vérifié, jamais `StrictHostKeyChecking=no`) |

Variable optionnelle `STAGING_USER` (défaut `coffeechat`).

**Rollback** : Actions → *Deploy staging* → *Run workflow*, `image_tag` = SHA complet d'un commit déjà
publié sur GHCR (onglet Packages du dépôt). Pas de tests ni de build, seulement le déploiement et le health check.

**Rotation de la clé** : générer une nouvelle paire, remplacer la ligne `anta-ci-deploy` dans
`authorized_keys` (même préfixe `restrict,command=…`), mettre à jour `STAGING_SSH_KEY`.

`remote-deploy.sh` n'est pas mis à jour par la CI (la clé ne peut pas l'écrire) : après une modification de
`scripts/vps/staging-remote-deploy.sh`, le réinstaller avec un déploiement manuel (ci-dessous).

### Manuel (VPS de dev)

Sur un commit propre (le script le vérifie) :

```bash
STAGING_HOST=<ip> SSH_KEY=/home/atlas/.ssh/dev-staging/vps_key scripts/vps/deploy-staging.sh
```

Build `anta:<sha>`, `docker save | ssh docker load`, installe `/opt/anta/remote-deploy.sh`, puis lui confie
le démarrage (même chemin que la CI, retour arrière compris). `ANTA_TAG=<ancien-sha>` relance une image
`anta:<sha>` déjà chargée sur le VPS (`docker images anta`).

Au démarrage, le conteneur lance `migration:run --force` sur la **base partagée** : ne déployer que des
commits dont les migrations sont déjà sur `development`, et des migrations rétrocompatibles (le retour
arrière relance l'ancien code sur le schéma migré).

## nginx et certificat

`deploy/nginx/anta.conf` (HTTPS) et `deploy/nginx/anta.http-only.conf` (amorçage avant certificat).
Règles non négociables, couvertes par `tests/unit/infrastructure/deployment.spec.ts` :

- **Résolution paresseuse** (`resolver 127.0.0.11` + `proxy_pass $anta_upstream`) : si Anta est arrêté, nginx
  démarre quand même et Coffee Chat reste servi (Anta répond 502). Un `upstream` ou un `proxy_pass` statique
  empêcherait nginx de démarrer → **coupure de Coffee Chat**.
- `client_max_body_size 110m` (la valeur globale de Coffee Chat est 10M ; parité avec `bodyparser`).
- Toujours `nginx -t` avant de recharger :

```bash
sudo install -o root -g root -m 644 /tmp/anta.conf /srv/coffeechat/infra/nginx/conf.d/anta.conf
docker exec coffeechat-nginx-1 nginx -t && docker exec coffeechat-nginx-1 nginx -s reload
```

Obtenir le certificat (une fois, DNS déjà propagé ; `--dry-run` d'abord) :

```bash
docker run --rm -v coffeechat_nginx_certs:/etc/letsencrypt \
  -v coffeechat_nginx_certbot_webroot:/var/www/certbot certbot/certbot:v3.1.0 \
  certonly --webroot -w /var/www/certbot -d anta.peraha.com \
  --agree-tos -m <email> -n [--dry-run]
```

Le renouvellement est fait par la boucle du conteneur `coffeechat-certbot-1` (tous les certificats du volume).
Son `--deploy-hook` n'atteint pas nginx (`kill -HUP 1` dans le conteneur certbot) : le cron hebdomadaire
recharge nginx pour qu'il prenne les certificats renouvelés (Anta et Coffee Chat).

## DNS

Zone `peraha.com` chez Hostinger (hPanel) : enregistrement **A** `anta` → IP du VPS (TTL 300), à la place de
l'ancien CNAME vers Render. Ne pas toucher `mg.anta` (Mailgun). Pas d'AAAA.

## À ne pas faire

- Toucher aux conteneurs `coffeechat-*` (restart, recreate, `docker compose` dans `/srv/coffeechat`) ou à
  d'autres fichiers de `/srv/coffeechat` que `conf.d/anta.conf`.
- Recharger nginx sans `nginx -t`.
- Publier le port de l'app hors `127.0.0.1` (Docker contourne `ufw`).
- `up -d` sans `--no-build` (Compose tenterait un build sans contexte).
- Rollback, `migration:fresh`/`reset`, `db:wipe`, seeders destructifs : la base Supabase est partagée avec le dev.
- Relancer `certbot certonly` en boucle (limites Let's Encrypt).
