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

- [Guide administrateur](_docs/guide-admin.md) — utilisation du panel admin (productions, upload, publication)
- [Quick Start admin](_docs/guide-admin-quickstart.md) — version condensée (publication, upload, édition)
- [Workflow Git](_docs/git-workflow.md) — stratégie de branches et conventions
- [Staging VPS](docs/staging-vps.md) — `https://anta.peraha.com`, déploiement CI/CD et rollback
- [Docker](docs/docker.md) — image, Compose, health check
- [Dev sur VPS](docs/dev-vps.md) — Tailscale, Doppler

### Export PDF des guides

```bash
pip install -r scripts/requirements-pdf.txt
npm install   # Playwright déjà présent (Japa) — Chrome ou Edge requis pour Mermaid
npm run docs:pdf
# ou : python scripts/md_to_pdf.py
```

Génère `_docs/pdf/guide-admin.pdf` et `_docs/pdf/guide-admin-quickstart.pdf`.  
Les **diagrammes Mermaid** sont rendus en PNG et embarqués dans le PDF (`scripts/render_mermaid.mjs` + Playwright). Accès réseau requis une fois pour charger mermaid.js depuis le CDN.

Sur Windows, le moteur PDF **xhtml2pdf** est utilisé automatiquement. Sur Linux/macOS avec GTK, **weasyprint** est préféré (`--backend weasyprint`).

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
| `staging`     | Test/démo — déployée sur `https://anta.peraha.com` (VPS)      |
