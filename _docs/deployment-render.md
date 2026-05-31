# Déploiement Render — Anta (staging/démo)

## Prérequis

- Compte GitHub avec accès au repo `atlastsl/ete-community--anta`
- Projet Supabase actif avec credentials du connection pooler
- Compte Cloudflare R2 avec bucket créé et credentials API
- Compte Resend (et optionnellement Mailgun) avec API key

## Étape 1 — Créer le compte Render

1. Aller sur https://render.com → **Sign Up with GitHub**
2. Autoriser l'accès à l'organisation/repo `atlastsl/ete-community--anta`

## Étape 2 — Créer le service via Blueprint

1. Dashboard Render → **New** → **Blueprint**
2. Sélectionner le repo `ete-community--anta`
3. Render détecte automatiquement `render.yaml` à la racine
4. Cliquer **Apply** → Render crée le service `anta-staging`

## Étape 3 — Configurer les secrets

Dans le dashboard Render → service `anta-staging` → **Environment** :

| Variable                | Valeur                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| `APP_KEY`               | Générer via `node ace generate:key` localement                               |
| `APP_URL`               | `https://anta-staging.onrender.com` (à mettre après le 1er deploy)           |
| `DB_HOST`               | `aws-1-ca-central-1.pooler.supabase.com` (ou ta région Supabase)             |
| `DB_PORT`               | `5432`                                                                       |
| `DB_USER`               | `postgres.PROJECT_REF` (cf. dashboard Supabase)                              |
| `DB_PASSWORD`           | Le password Supabase actuel                                                  |
| `DB_DATABASE`           | `postgres`                                                                   |
| `R2_ENDPOINT`           | `https://<account-id>.r2.cloudflarestorage.com`                              |
| `R2_BUCKET`             | `anta-productions` (ou ton nom de bucket)                                    |
| `R2_ACCESS_KEY_ID`      | Credentials R2                                                               |
| `R2_SECRET_ACCESS_KEY`  | Credentials R2                                                               |
| `RESEND_API_KEY`        | API key Resend                                                               |
| `MAILGUN_API_KEY`       | API key Mailgun (ou laisser vide si Mailgun non configuré)                   |
| `SUPER_ADMIN_EMAIL`     | `admin@anta.community`                                                       |
| `SUPER_ADMIN_PASSWORD`  | Mot de passe initial — sera changé à la 1ère connexion                       |

## Étape 4 — Premier deploy

1. Render lance automatiquement le build après l'Apply Blueprint
2. Logs visibles en temps réel dans **Events** et **Logs**
3. Une fois le statut **Live** atteint : ouvrir l'URL fournie (ex. `https://anta-staging.onrender.com`)
4. Mettre à jour la variable `APP_URL` avec cette URL exacte → redéployer

## Étape 5 — Initialiser le super admin

```bash
# Dans Render Dashboard → service → Shell
node ace db:seed --files=./database/seeders/super_admin_seeder.ts
```

Le seeder est **idempotent** (cf. Story 1.5) — peut être ré-exécuté sans risque, ne crée pas de doublon.

## Étape 6 — Keep-alive (cron-job.org)

Render Free Tier endort l'app après 15 min d'inactivité (cold start ensuite 30-60s).

1. Créer un compte gratuit sur https://cron-job.org
2. **Create cronjob** :
   - Title : `Anta staging keep-alive`
   - URL : `https://anta-staging.onrender.com/`
   - Schedule : **Every 14 minutes**
   - Method : `GET`
   - Notifications : optionnel — activer "Notify on failure" pour être alerté si l'app est down
3. Activer le job et vérifier après quelques minutes qu'il s'exécute correctement

## Rollback

En cas de problème après un deploy :

1. Render Dashboard → service → **Deploys**
2. Sélectionner un deploy précédent réussi → **Rollback**
3. Le service redémarre sur la version sélectionnée en quelques secondes

⚠️ Le rollback **ne défait pas les migrations** déjà exécutées. Si une migration récente a cassé la DB, il faut écrire une migration "down" manuelle ou restaurer un dump Supabase.

## Limites Render Free Tier

| Ressource             | Limite Free                                |
| --------------------- | ------------------------------------------ |
| RAM                   | 512 MB                                     |
| CPU                   | 0.1 vCPU partagé                           |
| Bande passante        | 100 GB/mois                                |
| Build minutes         | 500/mois                                   |
| Sleep                 | Après 15 min sans trafic                   |
| Cold start            | ~30-60s                                    |

Pour Anta phase démo/test : **largement suffisant**. La migration vers VPS (Epic 8) viendra quand on dépassera ces seuils ou pour la production.
