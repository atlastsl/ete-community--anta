# Anta

Bibliothèque numérique centralisée pour les productions intellectuelles des membres d'une association à ancrage académique.

## Stack technique

- **Backend** : AdonisJS 6 + TypeScript
- **Frontend** : React 19 + Inertia.js + Vite (2 entry points : public + admin)
- **Base de données** : PostgreSQL (Supabase en dev/staging, VPS en production future)
- **Stockage fichiers** : Cloudflare R2 (S3-compatible)
- **Email** : Resend (principal) + Mailgun (fallback) via `@adonisjs/mail`
- **i18n** : `react-i18next` (FR/EN)
- **UI** : Tailwind CSS v4 + shadcn/ui

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# → remplir les valeurs (DB Supabase, R2, Resend, etc.)

# Migrer la BDD
node ace migration:run

# Seeder le super admin initial
node ace db:seed --files=./database/seeders/super_admin_seeder.ts

# Lancer le serveur de dev
npm run dev
```

## Tests

```bash
node ace test --suite unit
```

## Documentation

- [Workflow Git](_docs/git-workflow.md) — stratégie de branches et conventions
- [Déploiement Render](_docs/deployment-render.md) — guide staging/démo

## Documentation BMad (planification)

- [PRD](_bmad-output/planning-artifacts/prd.md)
- [Architecture](_bmad-output/planning-artifacts/architecture.md)
- [Epics & Stories](_bmad-output/planning-artifacts/epics.md)
- [UX Design](_bmad-output/planning-artifacts/ux-design-specification.md)

## Branches

| Branche       | Rôle                                                          |
| ------------- | ------------------------------------------------------------- |
| `master`      | Production (VPS — Epic 8)                                     |
| `development` | Centralisation des features (branche par défaut)              |
| `staging`     | Test/démo — connectée à Render auto-deploy                    |
