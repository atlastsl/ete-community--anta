---
stepsCompleted:
  [
    step-01-init,
    step-02-context,
    step-03-starter,
    step-04-decisions,
    step-05-patterns,
    step-06-structure,
    step-07-validation,
    step-08-complete,
  ]
lastStep: 8
status: 'complete'
completedAt: '2026-04-03'
inputDocuments:
  [
    '_bmad-output/planning-artifacts/prd.md',
    '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/EXPERIENCE.md',
    '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/DESIGN.md',
    '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/.decision-log.md',
  ]
workflowType: 'architecture'
project_name: 'anta'
user_name: 'Aurélien'
date: '2026-04-03'
lastEdited: '2026-11-21'
editHistory:
  - date: '2026-11-15'
    changes: 'Epic 8 : infrastructure VPS (Docker, Compose, GHCR, règles base partagée), révisé par sprint-change-proposal-2026-11-15.md.'
  - date: '2026-11-16'
    changes: 'Epic 8 : staging sur le VPS de Coffee Chat (nginx partagé, Doppler en dev seulement).'
  - date: '2026-11-16'
    changes: 'Section Phase 2 — Growth : auteurs (tables, pivot, conversion FR56), classements 365 j et cache, suggestions, vignettes (sharp, ffmpeg, /media), à la une, routes, journal, tests, séquence, décisions P2-01 à P2-16.'
  - date: '2026-11-16'
    changes: 'Corrections du rapport implementation-readiness-report-2026-11-16.md : tables ordonnées réorganisées par DELETE + INSERT, recompactage FR51 et journal après commit, COALESCE de refreshDenormalizedNames, colonne authors plus écrite par le contrôleur dès la bascule, doublons de conversion, poster écrit après la ligne production_files, photoUrl du combobox, seeder de démo étendu.'
  - date: '2026-11-18'
    changes: 'Décision D37 (amende D1, Aurélien) : vignette réservée aux productions à la une (bannière seulement), gérée depuis la page « À la une » ; plus de vignette dans les cartes ni d og:image de production, plus de variante og.jpg 16:9 ; P2-17.'
  - date: '2026-11-21'
    changes: 'Revue de la Story 11.3 : rattrapage des images extraites sur copie temporaire du flux R2 au lieu de l URL signée (D-11.3-1) ; image affichée = premier fichier video/mp4 pourvu d un poster (D-11.3-2).'
---

# Architecture Decision Document

_Ce document se construit de façon collaborative, étape par étape. Les sections sont ajoutées au fil des décisions architecturales._

## Analyse du Contexte Projet

### Vue d'ensemble des Exigences

**Exigences Fonctionnelles (39 FRs) :**

| Domaine                        | FRs       | Implication architecturale                                                          |
| ------------------------------ | --------- | ----------------------------------------------------------------------------------- |
| Découverte et Recherche        | FR1–FR9   | Moteur de recherche full-text + filtres multi-critères sur les métadonnées          |
| Consultation et Téléchargement | FR10–FR16 | Lecteurs intégrés (PDF/EPUB/MP4/MP3/AAC), téléchargement direct, compteurs publics  |
| Gestion des Productions        | FR17–FR24 | CRUD complet avec workflow brouillon → publié → dépublié, validation conditionnelle |
| Statistiques et Métriques      | FR25–FR29 | Enregistrement de vues (délai 10s côté client), stats par production et agrégées    |
| Gestion des Comptes            | FR30, FR32–FR34 | Auth email/mot de passe, gestion des rôles (admin / super admin)                  |
| Métadonnées Système            | FR35      | Trois niveaux de dates par production (publique / interne / publication Anta)       |
| Référencement                  | FR36–FR37 | SSR partiel — meta tags injectés côté serveur, panel admin noindexé                 |
| Conformité                     | FR38–FR39 | Politique de confidentialité, suppression de comptes admin (RGPD)                   |

**Exigences Non-Fonctionnelles :**

- Chargement < 3s ; recherche < 1s (95e percentile) — impose une indexation efficace des métadonnées
- HTTPS, scrypt (hash mot de passe), CSRF, sessions avec expiration
- Fichiers hébergés ≤ 100 Mo ; intégrité garantie
- Disponibilité 99% ; stabilité sous charge communautaire moyenne

**Échelle et Complexité :**

- Domaine principal : Full-stack web (MPA)
- Niveau de complexité : Faible
- Composants architecturaux : ~8 (API AdonisJS, site public React, panel admin React, stockage fichiers, base de données, module auth, moteur de recherche/filtres, système de statistiques)

### Contraintes et Dépendances Techniques

- Stack imposée : AdonisJS (Node.js) + React (deux apps distinctes)
- MPA — SSR partiel uniquement (meta tags côté serveur, pas de SSR complet)
- Pas de temps réel en MVP
- Support navigateurs modernes uniquement (dernières 2 versions)
- Fichiers lourds (> 100 Mo) non hébergés — liens externes uniquement

### Préoccupations Transversales

1. **Authentification et Autorisation** — sessions, CSRF, séparation des rôles admin / super admin
2. **Stockage et Service de Fichiers** — upload admin + serving public, 5 formats, 100 Mo max
3. **Modèle de Données des Métadonnées** — 16+ champs, statuts, dates multiples — central pour la recherche, l'affichage et les formulaires admin
4. **Moteur de Recherche et Filtres** — performance < 1s sur l'ensemble des métadonnées
5. **Statistiques avec Délai Côté Client** — enregistrement de vue après 10s — logique JavaScript + endpoint API dédié
6. **SSR Partiel** — AdonisJS rend le HTML shell avec meta tags, React hydrate

## Évaluation du Template de Démarrage

### Domaine Technique Principal

Full-stack web MPA — backend AdonisJS avec frontends React intégrés via Inertia.js.

### Décisions Préalables

| Décision             | Choix           | Justification                                                              |
| -------------------- | --------------- | -------------------------------------------------------------------------- |
| Organisation dépôt   | Monorepo unique | Taille du projet, cohérence backend/frontend                               |
| Langage              | TypeScript      | Backend et frontend                                                        |
| Intégration frontend | Inertia.js      | SSR partiel natif, routing piloté par AdonisJS, pas d'API REST à maintenir |
| Bundler frontend     | Vite            | Défaut AdonisJS + Inertia, HMR rapide                                      |

### Template Sélectionné : AdonisJS 6 + Inertia.js + React

**Commande d'initialisation :**

```bash
npm init adonisjs@latest anta -- --kit=inertia --adapter=react --install
```

**Ce que le template fournit d'emblée :**

- AdonisJS 6.x avec TypeScript configuré
- Inertia.js adapter (server-side) + client React
- Vite configuré avec HMR
- Structure de dossiers AdonisJS standard
- Configuration ESLint + Prettier

### Structure Cible du Dépôt

```
anta/
├── app/
│   ├── controllers/
│   │   ├── public/          # Contrôleurs site public
│   │   └── admin/           # Contrôleurs panel admin
│   ├── middleware/
│   │   └── auth/            # Guards admin, super-admin
│   ├── models/              # Modèles Lucid ORM
│   └── validators/
├── inertia/
│   ├── pages/
│   │   ├── public/          # Pages React site public
│   │   └── admin/           # Pages React panel admin
│   ├── components/
│   │   ├── public/
│   │   └── admin/
│   └── layouts/
├── config/
├── database/
│   ├── migrations/
│   └── seeders/
├── start/
│   ├── routes/
│   │   ├── public.ts
│   │   └── admin.ts
│   └── kernel.ts
├── storage/                 # Fichiers téléversés
├── vite.config.ts           # Deux entry points : public + admin
├── package.json
└── tsconfig.json
```

### Stratégie CI/CD

**Phase initiale (Render) :** Auto-deploy depuis la branche `staging` — Render rebuild l'intégralité de l'app à chaque push. Pas de déploiement sélectif par chemin en phase dev/démo.

**Phase finale (VPS — Epic 8, révisé 2026-11-15) :** GitHub Actions construit une image Docker unique ; pas de déploiement sélectif par chemin (l'image est toujours reconstruite entièrement) :

```yaml
deploy-staging.yml: # push sur staging
  → tests (gate) → build image → push GHCR (tag = SHA) → SSH VPS staging → docker compose pull && up -d → health check
deploy-production.yml: # push sur master
  → promotion de l'image validée en staging (même tag, sans rebuild) → SSH VPS prod → docker compose up -d → health check
```

**Note :** L'initialisation du projet via cette commande constitue la première story d'implémentation (Epic 1, Story 1).

## Décisions Architecturales Fondamentales

### 1. Architecture des Données

**Base de données :** PostgreSQL via Lucid ORM (AdonisJS)

| Décision            | Choix                     | Justification                                               |
| ------------------- | ------------------------- | ----------------------------------------------------------- |
| SGBD                | PostgreSQL                | Robustesse, fonctionnalités avancées (tsvector), JSON natif |
| ORM                 | Lucid ORM                 | Intégration native AdonisJS, migrations, relations          |
| Recherche full-text | PostgreSQL tsvector       | Aucune dépendance externe, < 1s garanti à l'échelle d'Anta  |
| Stratégie d'index   | GIN sur colonnes tsvector | Performances optimales pour recherche multi-champs          |

**Modèle de données simplifié :**

```
productions
├── id (uuid)
├── title, summary, authors (jsonb array), tags (jsonb array)
├── category, domain, subdomain
├── language, publication_country
├── journal, publisher, isbn_doi_issn, institution
├── license_status (member | free_license | external_link)
├── status (draft | published | unpublished)
├── work_published_at (date — saisie admin, publique)
├── anta_published_at (timestamp — première publication, interne)
├── created_at, updated_at (générés automatiquement, internes)
├── search_vector (tsvector — mis à jour via trigger)
└── created_by_id → admin_users.id

production_files
├── id, production_id → productions.id
├── file_key (clé R2), original_name, mime_type, size_bytes
└── storage_provider

production_links
├── id, production_id → productions.id
├── url, link_type (embed | simple)
└── label

admin_users
├── id, email, password_hash (scrypt)
├── role (admin | super_admin)
├── is_active
├── password_changed
└── created_by_id → admin_users.id

stats_views
├── id, production_id → productions.id
├── recorded_at, ip_hash (anonymisé)
└── session_id

stats_downloads
├── id, production_id → productions.id
└── downloaded_at, ip_hash (anonymisé)

admin_activity_logs
├── id, admin_user_id → admin_users.id
├── action_type (login | create | update | publish | delete...)
├── resource_type, resource_id
└── created_at
```

**Trigger PostgreSQL pour tsvector :**

```sql
-- Mis à jour automatiquement sur INSERT/UPDATE de productions
to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ...)
```

---

### 2. Stockage des Fichiers

**Solution :** Cloudflare R2 (S3-compatible) via AdonisJS Drive

| Critère           | Choix                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Provider          | Cloudflare R2                                                          |
| Driver AdonisJS   | `@adonisjs/drive` + adaptateur S3                                      |
| Raison principale | Zéro frais d'egress (critique pour une bibliothèque de téléchargement) |
| Stockage          | $0.015/Go/mois — négligeable à l'échelle d'Anta                        |

**Configuration Drive :**

```typescript
// config/drive.ts
{
  default: 'r2',
  disks: {
    r2: {
      driver: 's3',
      endpoint: env.get('R2_ENDPOINT'),
      bucket: env.get('R2_BUCKET'),
      // credentials R2 via variables d'environnement
    }
  }
}
```

**Limites enforced côté serveur :** 100 Mo max par fichier, formats whitelist : pdf, epub, mp4, mp3, aac.

---

### 3. Authentification et Sécurité

| Composant            | Solution                                                          |
| -------------------- | ----------------------------------------------------------------- |
| Sessions             | AdonisJS Auth (session-based)                                     |
| Autorisation (rôles) | AdonisJS Bouncer (admin vs super_admin)                           |
| Hashage mot de passe | scrypt (défaut AdonisJS 6, zéro dépendance, plus moderne que bcrypt) |
| Protection CSRF      | Middleware CSRF AdonisJS (activé sur toutes les routes admin)     |
| Expiration session   | 2 heures d'inactivité (configurable via variable d'environnement) |

**Flux première connexion (ordre obligatoire) :**

1. Admin créé par super admin → mot de passe provisoire + `password_changed = false`
2. Première connexion (email + mot de passe provisoire) → redirection forcée page changement de mot de passe
3. Définition nouveau mot de passe → `password_changed = true`
4. Accès au dashboard
5. Connexions suivantes : email + mot de passe

**Reset mot de passe (super admin) :**

- Super admin génère un nouveau mot de passe provisoire → `password_changed = false` → email envoyé → l'admin resuit le flux étape 2-3 à sa prochaine connexion

> **Note — 2FA différé** : le 2FA TOTP a été retiré du MVP (décision 2026-05-31). Les colonnes `totp_secret`/`totp_enabled` ont été supprimées de la table `admin_users` via migration de drop. Le 2FA pourra être réintroduit en Phase 2 si nécessaire.

**Guards AdonisJS Bouncer :**

```typescript
// Bouncer policies
// Le super_admin hérite de toutes les capacités admin + gestion des comptes
Bouncer.define('admin', (user) => user.role === 'admin' || user.role === 'super_admin')
Bouncer.define('superAdmin', (user) => user.role === 'super_admin')
```

**Périmètre des rôles :**

| Capacité                                         | admin | super_admin |
| ------------------------------------------------ | ----- | ----------- |
| Gérer les productions (CRUD, publish, stats)     | ✅    | ✅          |
| Consulter stats agrégées                         | ✅    | ✅          |
| Créer / désactiver / supprimer des comptes admin | ❌    | ✅          |
| Réinitialiser mot de passe d'un admin            | ❌    | ✅          |
| Consulter logs d'activité des admins             | ❌    | ✅          |

---

### 4. Service Email

| Rôle            | Solution                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| Envoi principal | Resend                                                                            |
| Backup          | Mailgun                                                                           |
| Cas d'usage MVP | Invitation admin (mot de passe provisoire), récupération mot de passe (si ajouté) |
| Driver AdonisJS | `@adonisjs/mail` avec provider SMTP/API                                           |

---

### 5. Frontend et UI

| Couche            | Choix                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Intégration React | Inertia.js (deux entry points Vite : public + admin)                   |
| Styling           | Tailwind CSS v4                                                        |
| Composants UI     | shadcn/ui                                                              |
| Formulaires       | React Hook Form + Zod (validation côté client + côté serveur AdonisJS) |
| Icônes            | Lucide React                                                           |

**Internationalisation (i18n) :**

| Élément                | Choix                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| Bibliothèque           | `react-i18next`                                                         |
| Langues MVP            | Français (défaut) + Anglais                                             |
| Périmètre              | Interface uniquement — labels, boutons, messages d'erreur, textes fixes |
| Persistence            | Cookie (`i18n_lang`) — lisible côté serveur si besoin                   |
| Fichiers de traduction | `inertia/locales/{public,admin}/{fr,en}.json`                           |
| Détection              | Cookie → localStorage → langue navigateur → FR par défaut               |

```
inertia/locales/
├── public/
│   ├── fr.json
│   └── en.json
└── admin/
    ├── fr.json
    └── en.json
```

**Double entry point Vite :**

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [inertia({ ssr: false }), react()],
  // public/app.tsx et admin/app.tsx comme entry points distincts
})
```

**SSR Partiel (meta tags) :**
AdonisJS injecte `<title>`, `<meta name="description">`, `<meta property="og:*">` dans le HTML shell pour les pages de production publiques. React prend le relais pour le rendu du contenu.

---

### 6. Infrastructure et Déploiement

#### Phase initiale — Dev/Démo (Render)

| Composant         | Choix                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| Hébergement       | Render Free Tier (512 Mo RAM, 0.1 vCPU)                                       |
| TLS               | Automatique (Render)                                                          |
| Déploiement       | Auto-deploy depuis la branche `staging` via intégration GitHub                |
| Stockage fichiers | Cloudflare R2 (voir section 2)                                                |
| Keep-alive        | Service de monitoring externe (cron-job.org) — ping toutes les 14 min         |

**Stratégie de branches Git :**

| Branche       | Rôle                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `master`      | Production — reflète le code déployé en production (VPS, phase finale) |
| `development` | Centralisation des updates — branche cible des merges de stories     |
| `staging`     | Test/démo — connectée à Render, puis au VPS de staging (`anta.peraha.com`, Epic 8), mise à jour via PR `development → staging` |

**Workflow de développement :**

1. Chaque story démarre sur une nouvelle branche créée depuis `development`
2. Développement + tests locaux sur la branche de story
3. Merge de la branche de story vers `development`
4. Quand prêt à déployer en test : PR `development` → `staging`
5. Render auto-deploy depuis `staging`

**Séquence de démarrage (Render) :**

```bash
# Build command (Render)
npm install && node ace build
# Start command (Render)
node ace migration:run --force && node build/bin/server.js
```

#### Phase finale — VPS (Epic 8, révisé par `sprint-change-proposal-2026-11-15.md`)

|                    | Dev                                   | Staging                          | Production                        |
| ------------------ | ------------------------------------- | -------------------------------- | --------------------------------- |
| Hôte               | VPS de dev (`vmi3733843`)             | VPS partagé avec Coffee Chat     | VPS dédié                         |
| Accès              | Tailscale (`tailscale serve`, tailnet) | Public — `anta.peraha.com`       | Domaine de production (à définir) |
| Exécution          | `doppler run -- npm run dev`          | Docker Compose (`app`, `compose.staging.yaml`) | Docker Compose (`app` + `caddy`) |
| TLS                | Tailscale                             | nginx de Coffee Chat + certbot (Let's Encrypt) | Caddy (Let's Encrypt automatique) |
| Secrets            | Doppler `anta/dev`                    | `/opt/anta/.env` sur le VPS (0600) | `.env` sur le VPS (0600)        |
| Base de données    | Supabase (partagée dev/staging)       | Supabase (partagée dev/staging)  | Supabase (production)             |
| Fichiers / e-mails | R2 / Mailgun                          | R2 / Mailgun                     | R2 / Mailgun                      |
| Déploiement        | —                                     | push `staging` → GHCR → SSH      | merge `master` → promotion image  |

Révision 2026-11-16 (Story 8.3, décision d'Aurélien) : le staging partage le VPS de Coffee Chat, dont le nginx conteneurisé détient 80/443. Anta y tourne dans son propre projet Compose (`/opt/anta`, app sur `127.0.0.1:3333`, sans Caddy) et nginx le joint par le réseau Docker de Coffee Chat (alias `anta-app`, résolution paresseuse pour ne jamais empêcher nginx de démarrer). **Doppler ne sert qu'au dev** ; staging et production lisent un `.env` sur le VPS. Détails : `docs/staging-vps.md`.

Artefacts : `Dockerfile` multi-stage (Node 22, utilisateur non-root, démarrage `node ace migration:run --force && node bin/server.js`), `compose.yaml`, `Caddyfile` paramétré par domaine (limite de corps ≥ 110 Mo, parité `bodyparser`), logs Docker plafonnés.

**Règles base partagée (dev/staging) :**

- Interdits : `migration:rollback`, `migration:fresh`, `migration:reset`, `db:wipe`, seeders destructifs.
- Migrations rétrocompatibles uniquement (expand/contract : ajouter d'abord, supprimer dans une release ultérieure) — le staging exécute `migration:run --force` à chaque démarrage.
- `node ace test` uniquement contre un Postgres local jetable (`anta_test`, comme la CI), jamais contre Supabase.

Render (phase initiale) est décommissionné en Story 8.5.

---

## Patterns d'Implémentation & Règles de Cohérence

### Points de Conflit Identifiés : 6 zones critiques

---

### Conventions de Nommage

#### Base de Données (PostgreSQL + Lucid ORM)

| Élément         | Convention                     | Exemple                                                   |
| --------------- | ------------------------------ | --------------------------------------------------------- |
| Tables          | `snake_case` pluriel           | `productions`, `admin_users`, `production_files`          |
| Colonnes        | `snake_case`                   | `work_published_at`, `created_by_id`                      |
| Clés étrangères | `{table_singulier}_id`         | `production_id`, `admin_user_id`                          |
| Index           | `idx_{table}_{colonnes}`       | `idx_productions_status`, `idx_productions_search_vector` |
| Migrations      | `{timestamp}_{action}_{table}` | `1234567890_create_productions_table`                     |

#### Routes API / Inertia

| Élément          | Convention                 | Exemple                                                              |
| ---------------- | -------------------------- | -------------------------------------------------------------------- |
| Routes publiques | Pluriel, kebab-case        | `GET /productions`, `GET /productions/:slug`                         |
| Routes admin     | Préfixe `/admin/`          | `GET /admin/productions`, `POST /admin/productions`                  |
| Paramètre ID     | `:id` (UUID)               | `/admin/productions/:id`                                             |
| Actions métier   | Verbe explicite dans l'URL | `/admin/productions/:id/publish`, `/admin/productions/:id/unpublish` |

#### Code TypeScript

| Élément                   | Convention             | Exemple                                         |
| ------------------------- | ---------------------- | ----------------------------------------------- |
| Fichiers contrôleurs      | `PascalCase` + suffixe | `ProductionsController.ts`, `AuthController.ts` |
| Fichiers modèles          | `PascalCase` singulier | `Production.ts`, `AdminUser.ts`                 |
| Fichiers composants React | `PascalCase.tsx`       | `ProductionCard.tsx`, `SearchFilters.tsx`       |
| Fonctions/méthodes        | `camelCase`            | `getRecentProductions()`, `publishProduction()` |
| Variables                 | `camelCase`            | `productionId`, `isLoading`                     |
| Constantes                | `UPPER_SNAKE_CASE`     | `MAX_FILE_SIZE_MB`, `SESSION_TIMEOUT_HOURS`     |
| Types/Interfaces          | `PascalCase`           | `ProductionStatus`, `ProductionFilters`         |

---

### Structure et Organisation

#### Contrôleurs (Backend)

```
app/controllers/
├── public/
│   ├── HomeController.ts         # Page d'accueil + productions récentes
│   ├── ProductionsController.ts  # Listing + détail + search
│   └── StatsController.ts        # Enregistrement vues (10s) + téléchargements
└── admin/
    ├── AuthController.ts          # Login + changement mot de passe (1ère connexion)
    ├── ProductionsController.ts   # CRUD + workflow brouillon/publié
    ├── FilesController.ts         # Upload R2
    ├── StatsController.ts         # Stats par production + agrégées
    └── UsersController.ts         # Gestion comptes (super admin)
```

#### Composants React

```
inertia/
├── pages/
│   ├── public/
│   │   ├── Home.tsx
│   │   ├── Productions/
│   │   │   ├── Index.tsx     # Listing + recherche
│   │   │   └── Show.tsx      # Page détail
│   │   └── PrivacyPolicy.tsx
│   └── admin/
│       ├── Auth/
│       │   ├── Login.tsx
│       │   └── ChangePassword.tsx
│       ├── Productions/
│       │   ├── Index.tsx
│       │   ├── Create.tsx
│       │   ├── Edit.tsx
│       │   └── Show.tsx      # Stats par production
│       ├── Stats/
│       │   └── Index.tsx     # Vue agrégée
│       └── Users/
│           └── Index.tsx     # Gestion admins (super admin)
├── components/
│   ├── public/
│   └── admin/
└── layouts/
    ├── PublicLayout.tsx
    └── AdminLayout.tsx
```

#### Tests

```
tests/
├── unit/        # Validators, services, helpers
└── functional/  # Contrôleurs AdonisJS (Japa)
```

---

### Formats d'Échange

#### Props Inertia — Pas de Wrapper

```typescript
// ✅ Correct — props directes
return inertia.render('public/Productions/Index', {
  productions,
  filters,
  pagination: { page, total, perPage },
})

// ❌ Incorrect — wrapper inutile
return inertia.render('...', { data: { productions } })
```

#### Formats de Dates

| Contexte                  | Format                   | Exemple                      |
| ------------------------- | ------------------------ | ---------------------------- |
| JSON / props Inertia      | ISO 8601 string          | `"2024-03-15T10:30:00.000Z"` |
| Affichage UI — date seule | `dd/mm/yyyy` (locale FR) | `"15/03/2024"`               |
| Affichage UI — date+heure | `dd/mm/yyyy HH:mm`       | `"15/03/2024 10:30"`         |

#### Validation — Double Couche

```typescript
// Serveur : VineJS (AdonisJS)
const schema = vine.compile(
  vine.object({
    title: vine.string().minLength(1).maxLength(255),
    status: vine.enum(['draft', 'published', 'unpublished']),
  })
)

// Client : Zod (mêmes règles — duplication intentionnelle)
const productionSchema = z.object({
  title: z.string().min(1).max(255),
  status: z.enum(['draft', 'published', 'unpublished']),
})
```

---

### Patterns de Communication

#### Enum ProductionStatus — Source de Vérité Unique

```typescript
// app/enums/ProductionStatus.ts
export const ProductionStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const
export type ProductionStatus = (typeof ProductionStatus)[keyof typeof ProductionStatus]
```

#### Logs d'Activité Admin — Service Centralisé

```typescript
// Appel uniforme depuis tous les contrôleurs admin
await ActivityLogService.log({
  adminUserId: auth.user.id,
  actionType: 'publish', // 'create' | 'update' | 'publish' | 'unpublish' | 'delete' | 'login' | 'password_reset'
  resourceType: 'production',
  resourceId: production.id,
})
```

---

### Patterns de Processus

#### Gestion des Erreurs

```typescript
// Erreurs de validation → 422 automatique via AdonisJS VineJS
// Côté React — lecture des erreurs Inertia
const { errors } = usePage<{ errors: Record<string, string> }>().props
// {errors.title && <p className="text-red-500">{errors.title}</p>}
```

#### États de Chargement

```typescript
// Convention : préfixe "is" obligatoire
const [isLoading, setIsLoading] = useState(false) // ✅
const [isSubmitting, setIsSubmitting] = useState(false) // ✅
// ❌ loading, submitting, uploading (sans préfixe)
```

#### Upload Fichiers R2

1. Validation MIME + taille côté serveur avant upload R2
2. Stocker la clé R2 (`file_key`) dans `production_files`, jamais l'URL complète
3. URL signée générée à la volée pour téléchargement/lecture (TTL 1h)

---

### Internationalisation

- Tous les textes d'interface passent par `react-i18next` — jamais de strings en dur dans les composants
- Clés de traduction : `snake_case` hiérarchique — ex. `production.status.draft`, `nav.search`, `errors.required`
- Composant `<LanguageSwitcher />` partagé — même comportement public et admin
- Cookie : `i18n_lang` avec valeurs `fr` ou `en`

---

### Règles Obligatoires pour Tous les Agents

**Tous les agents IA DOIVENT :**

- Utiliser `snake_case` pour toutes les colonnes et tables PostgreSQL
- Utiliser `camelCase` pour toutes les variables et fonctions TypeScript
- Préfixer toutes les routes admin par `/admin/`
- Stocker les fichiers R2 comme clés (`file_key`), jamais comme URL complètes
- Passer par `ActivityLogService.log()` pour toute action admin modifiant les données
- Utiliser l'enum `ProductionStatus`, jamais les strings en dur
- Nommer les états booléens avec le préfixe `is`
- Placer les tests dans `tests/functional/` (contrôleurs) et `tests/unit/` (services)
- Passer tous les textes d'interface par `react-i18next`

**Anti-Patterns à Éviter :**

- ❌ `userId` comme colonne PostgreSQL → ✅ `user_id`
- ❌ URL R2 complète en base → ✅ clé R2 (`productions/2024/file.pdf`)
- ❌ String `'draft'` en dur dans le code → ✅ `ProductionStatus.DRAFT`
- ❌ Wrapper `{ data: ... }` dans les props Inertia → ✅ props directes
- ❌ Logs d'activité ad hoc dans chaque contrôleur → ✅ `ActivityLogService.log()`
- ❌ String en dur dans les composants React → ✅ `t('clé.de.traduction')`

---

### 7. Séquence d'Implémentation

L'ordre ci-dessous minimise les dépendances bloquantes :

| #   | Étape                                                                | Dépendances |
| --- | -------------------------------------------------------------------- | ----------- |
| 1   | Init projet AdonisJS + Inertia + React                               | —           |
| 2   | Migrations PostgreSQL (toutes les tables)                            | Étape 1     |
| 3   | Auth admin (session + scrypt + CSRF + changement mot de passe 1ère connexion) | Étape 2     |
| 4   | Gestion R2 + upload fichiers                                         | Étape 1     |
| 5   | CRUD Productions (brouillon → publié)                                | Étapes 2, 4 |
| 6   | Site public (listing + détail + recherche tsvector)                  | Étape 5     |
| 7   | Statistiques (vues 10s + téléchargements)                            | Étape 6     |
| 8   | Panel admin stats + logs activité super admin                        | Étapes 5, 7 |
| 9   | SEO (meta tags SSR partiel) + conformité (politique confidentialité) | Étape 6     |

## Structure du Projet & Frontières Architecturales

### Arborescence Complète

```
anta/
├── .env
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── ace.js                           # CLI AdonisJS
├── adonisrc.ts                      # Configuration AdonisJS
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Lint + tests sur chaque PR (development, staging)
│       ├── deploy-staging.yml       # [Phase VPS] Tests → image GHCR → déploiement VPS staging
│       └── deploy-production.yml    # [Phase VPS] Promotion de l'image validée → VPS production
│
├── Dockerfile                       # [Phase VPS] Image multi-stage (staging + production)
├── compose.yaml                     # [Phase VPS] Services app + caddy
├── Caddyfile                        # [Phase VPS] Reverse proxy + TLS automatique
│
├── app/
│   ├── controllers/
│   │   ├── public/
│   │   │   ├── HomeController.ts        # FR9 — productions récentes
│   │   │   ├── ProductionsController.ts # FR1–FR8, FR10–FR16 — search, listing, détail
│   │   │   └── StatsController.ts       # FR25–FR26 — enregistrement vues + téléchargements
│   │   └── admin/
│   │       ├── AuthController.ts         # FR30, FR42 — login + changement mot de passe 1ère connexion
│   │       ├── ProductionsController.ts  # FR17–FR24 — CRUD + workflow brouillon/publié
│   │       ├── FilesController.ts        # FR18 — upload R2
│   │       ├── StatsController.ts        # FR27–FR29 — stats par production, agrégées, activité admins
│   │       └── UsersController.ts        # FR32–FR34, FR39 — gestion comptes + suppression
│   │
│   ├── middleware/
│   │   ├── admin_middleware.ts           # Guard admin + super_admin + redirect change-password
│   │   ├── super_admin_middleware.ts     # Guard super_admin uniquement
│   │   └── silent_auth_middleware.ts
│   │
│   ├── models/
│   │   ├── Production.ts                 # FR17–FR24, FR35 — modèle principal + relations
│   │   ├── ProductionFile.ts             # FR18 — fichiers hébergés
│   │   ├── ProductionLink.ts             # FR19 — liens externes
│   │   ├── AdminUser.ts                  # FR30–FR34 — comptes admin
│   │   ├── StatsView.ts                  # FR25 — vues
│   │   ├── StatsDownload.ts              # FR26 — téléchargements
│   │   └── AdminActivityLog.ts           # FR29, NFR9 — logs activité
│   │
│   ├── services/
│   │   ├── ProductionService.ts          # Logique métier CRUD + workflow + publication
│   │   ├── SearchService.ts              # Logique full-text tsvector + filtres
│   │   ├── FileStorageService.ts         # Upload/delete/URL signée R2
│   │   ├── StatsService.ts               # Enregistrement + agrégation stats
│   │   └── ActivityLogService.ts         # Centralisation logs admin
│   │
│   ├── validators/
│   │   ├── ProductionValidator.ts        # VineJS — création/édition production
│   │   ├── FileUploadValidator.ts        # Taille max, whitelist MIME
│   │   └── AuthValidator.ts              # Login + changement mot de passe
│   │
│   └── enums/
│       ├── ProductionStatus.ts           # 'draft' | 'published' | 'unpublished'
│       ├── LicenseStatus.ts              # 'member' | 'free_license' | 'external_link'
│       └── AdminRole.ts                  # 'admin' | 'super_admin'
│
├── config/
│   ├── app.ts
│   ├── auth.ts
│   ├── database.ts
│   ├── drive.ts                          # Configuration R2 (S3 driver)
│   ├── mail.ts                           # Resend + Mailgun
│   ├── session.ts                        # Expiration 2h
│   └── shield.ts                         # CSRF + sécurité
│
├── database/
│   ├── migrations/
│   │   ├── {ts}_create_admin_users_table.ts
│   │   ├── {ts}_create_productions_table.ts
│   │   ├── {ts}_create_production_files_table.ts
│   │   ├── {ts}_create_production_links_table.ts
│   │   ├── {ts}_create_stats_views_table.ts
│   │   ├── {ts}_create_stats_downloads_table.ts
│   │   └── {ts}_create_admin_activity_logs_table.ts
│   └── seeders/
│       └── SuperAdminSeeder.ts           # FR34 — compte super admin initial
│
├── start/
│   ├── routes/
│   │   ├── public.ts                     # Routes site public (FR1–FR16, FR25–FR26, FR38)
│   │   └── admin.ts                      # Routes panel admin (FR17–FR39)
│   ├── kernel.ts                         # Middlewares globaux
│   └── env.ts                            # Validation variables d'environnement
│
├── inertia/
│   ├── app/
│   │   ├── app.tsx                       # Entry point site public
│   │   └── admin.tsx                     # Entry point panel admin
│   │
│   ├── pages/
│   │   ├── public/
│   │   │   ├── Home.tsx                  # FR9 — productions récentes
│   │   │   ├── Productions/
│   │   │   │   ├── Index.tsx             # FR1–FR8, FR16 — listing + search + filtres + compteurs
│   │   │   │   └── Show.tsx              # FR10–FR16 — détail + lecteurs + téléchargement
│   │   │   └── PrivacyPolicy.tsx         # FR38
│   │   └── admin/
│   │       ├── Auth/
│   │       │   ├── Login.tsx             # FR30
│   │       │   └── ChangePassword.tsx    # FR42 — changement mot de passe 1ère connexion
│   │       ├── Productions/
│   │       │   ├── Index.tsx             # FR22–FR24 — liste + actions
│   │       │   ├── Create.tsx            # FR17–FR21 — formulaire création
│   │       │   ├── Edit.tsx              # FR22 — formulaire édition
│   │       │   └── Show.tsx              # FR27 — stats par production
│   │       ├── Stats/
│   │       │   └── Index.tsx             # FR28 — vue agrégée bibliothèque
│   │       └── Users/
│   │           └── Index.tsx             # FR29, FR32–FR33, FR39 — gestion admins
│   │
│   ├── components/
│   │   ├── public/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchFilters.tsx
│   │   │   ├── ProductionCard.tsx
│   │   │   ├── ProductionGrid.tsx
│   │   │   ├── PdfViewer.tsx             # FR11
│   │   │   ├── VideoPlayer.tsx           # FR12
│   │   │   ├── AudioPlayer.tsx           # FR13
│   │   │   └── LanguageSwitcher.tsx      # FR40–FR41
│   │   ├── admin/
│   │   │   ├── ProductionForm.tsx        # FR17–FR21
│   │   │   ├── FileUploader.tsx          # FR18
│   │   │   ├── LinkManager.tsx           # FR19
│   │   │   ├── StatusBadge.tsx
│   │   │   └── LanguageSwitcher.tsx      # FR40–FR41
│   │   └── shared/
│   │       └── Pagination.tsx
│   │
│   ├── layouts/
│   │   ├── PublicLayout.tsx
│   │   └── AdminLayout.tsx
│   │
│   └── locales/
│       ├── public/
│       │   ├── fr.json
│       │   └── en.json
│       └── admin/
│           ├── fr.json
│           └── en.json
│
├── public/
│   └── favicon.ico
│
├── storage/                              # Fichiers temporaires locaux (dev uniquement)
│
└── tests/
    ├── unit/
    │   ├── services/
    │   │   ├── ProductionService.spec.ts
    │   │   ├── SearchService.spec.ts
    │   │   └── StatsService.spec.ts
    │   └── validators/
    │       └── ProductionValidator.spec.ts
    └── functional/
        ├── public/
        │   ├── ProductionsController.spec.ts
        │   └── StatsController.spec.ts
        └── admin/
            ├── AuthController.spec.ts
            ├── ProductionsController.spec.ts
            └── UsersController.spec.ts
```

---

### Frontières Architecturales

#### Frontières des Routes

| Périmètre   | Préfixe         | Middleware                                | FR couverts                     |
| ----------- | --------------- | ----------------------------------------- | ------------------------------- |
| Site public | `/`             | Aucun                                     | FR1–FR16, FR25–FR26, FR36, FR38 |
| Panel admin | `/admin/`       | `AdminMiddleware`                         | FR17–FR29, FR37, FR39           |
| Super admin | `/admin/users/` | `SuperAdminMiddleware`                    | FR29, FR32–FR34, FR39           |

#### Flux de Données

```
React (Inertia props) ←→ Controllers ←→ Services ←→ Models (Lucid) ←→ PostgreSQL
                                    ↓
                              FileStorageService ←→ Cloudflare R2
                                    ↓
                              ActivityLogService → admin_activity_logs
```

#### Points d'Intégration Externes

| Service          | Localisation                                               |
| ---------------- | ---------------------------------------------------------- |
| Cloudflare R2    | `app/services/FileStorageService.ts` via `@adonisjs/drive` |
| Resend / Mailgun | `config/mail.ts` via `@adonisjs/mail`                      |

#### Flux Clés

**Recherche (FR1–FR8) :**

```
SearchBar.tsx → GET /productions?q=...&filters
→ ProductionsController → SearchService → tsvector @@ to_tsquery → props Inertia
```

**Vue 10s (FR25) :**

```
Show.tsx mount → setTimeout(10s) → POST /stats/view
→ StatsController → StatsService.recordView() → INSERT stats_views
```

**Upload fichier (FR18) :**

```
FileUploader.tsx → POST /admin/files (multipart)
→ FilesController → FileUploadValidator → FileStorageService.upload()
→ R2 PUT → file_key → INSERT production_files
```

#### Workflow CI/CD

**Phase initiale (Render) :**

```yaml
ci.yml: # Déclenché sur PR vers development et staging
  → lint → tests → gate CI (aucun déploiement — Render auto-deploy depuis staging)
```

**Phase finale (VPS — Epic 8) :**

```yaml
deploy-staging.yml: # push sur staging
  → tests → build image → GHCR → SSH → docker compose pull && up -d → health check

deploy-production.yml: # push sur master
  → promotion de l'image validée en staging → SSH → docker compose up -d → health check
```

## Résultats de Validation Architecturale

### Cohérence ✅

Toutes les décisions sont compatibles et non-contradictoires :

- AdonisJS 6 + Inertia.js + React + TypeScript — kit officiel validé en production
- PostgreSQL + Lucid ORM — support natif AdonisJS
- tsvector + index GIN — natif PostgreSQL, aucune dépendance externe
- Cloudflare R2 via `@adonisjs/drive` (adaptateur S3) — API S3-compatible, supporté nativement
- `react-i18next` + Vite + deux entry points — combinaison standard documentée
- Tailwind CSS v4 + shadcn/ui — compatibles depuis 2025

### Couverture des Exigences ✅

**41 FRs — 41/41 couverts**
**15 NFRs — 15/15 couverts**

Tous les domaines fonctionnels (recherche, consultation, gestion admin, statistiques, auth, SEO, conformité, i18n) ont un support architectural explicite dans les décisions, les services et l'arborescence.

### Gaps — Résolus

| Gap                                         | Résolution                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Champs obligatoires à la publication (FR21) | **Toutes les métadonnées** sont obligatoires — PRD mis à jour avec la liste complète                |
| Bibliothèque lecteur PDF/EPUB (FR11)        | Décision reportée en Epic 3 — `PdfViewer.tsx` est le contrat, la lib est un détail d'implémentation |
| Stratégie de pagination                     | **Pagination numérotée** — `Pagination.tsx` composant partagé, props `{ page, total, perPage }`     |

### Checklist de Complétude

- [x] Contexte projet analysé (41 FRs, 15 NFRs, contraintes)
- [x] Template de démarrage sélectionné avec commande d'initialisation
- [x] Décisions architecturales fondamentales documentées (7 domaines)
- [x] Patterns d'implémentation définis (nommage, structure, formats, i18n)
- [x] Arborescence complète avec mapping FR → fichiers
- [x] Frontières architecturales et flux de données documentés
- [x] CI/CD sélectif par chemin documenté
- [x] Gaps identifiés, priorisés et résolus

### Statut Global

**🟢 PRÊT POUR L'IMPLÉMENTATION**

Confiance : **Haute**

**Première commande d'implémentation :**

```bash
npm init adonisjs@latest anta -- --kit=inertia --adapter=react --install
```


---

# Phase 2 — Growth (2026-11-16)

_Amendement de l'architecture pour la Phase 2 : PRD FR5, FR9, FR17, FR21, FR36 modifiés, FR44–FR61, NFR Accessibilité (PRD amendé le 2026-11-16 : FR46, FR50, FR53) ; UX `ux-designs/ux-anta-2026-11-16/` (EXPERIENCE.md, DESIGN.md, décisions D1–D36). Le MVP n'est pas re-spécifié : tout ce qui n'est pas cité ici reste tel qu'implémenté._

**Règle de lecture.** Pour la Phase 2, **le code fait foi** sur les conventions de nommage quand il diverge des sections MVP ci-dessus : fichiers en `snake_case` (`app/controllers/public/home_controller.ts`, `app/services/search_service.ts`, `app/models/production.ts`), pages Inertia publiques en minuscules à la racine de `inertia/pages/` (`home.tsx`, `productions.tsx`, `production.tsx`), pages admin en `inertia/pages/admin/<Section>/<Action>.tsx`, registre Tuyau `controllers.public.Home` (`#generated/controllers`). `stats_views` horodate par `recorded_at` (pas `viewed_at`), `stats_downloads` par `downloaded_at`. `productions.subdomain` est un tableau jsonb (`1775918743000_subdomain_to_jsonb_array.ts`). La dépublication repasse en `draft` (`ProductionService.unpublish`).

**Contraintes héritées (non négociables).** Base Supabase partagée dev/staging : migrations additives uniquement (expand/contract), jamais de `rollback`/`fresh`/`reset`/`db:wipe` ; le staging exécute `migration:run --force` au démarrage (`Dockerfile`). Tests sur Postgres local (`npm run test:local`). Dépôt public : aucun nom d'auteur réel, CSV de conversion ou donnée personnelle commité (`tmp/` est ignoré par git).

## P2.1 Modèle de données

### Nouvelles tables

```
authors
├── id (uuid, gen_random_uuid())
├── slug (varchar 255, UNIQUE, figé à la création — D28)
├── first_names, last_names (varchar 120, NOT NULL)
├── search_name (text, NOT NULL — "prénoms noms" normalisé : NFD sans accents, minuscules, espaces simples ; écrit par le modèle)
├── google_scholar_url (varchar 500, NULL)
├── photo_key (varchar 255, NULL — préfixe R2 `authors/<id>/<token>`, variantes dérivées)
├── consent_confirmed_at (timestamp, NULL) ; consent_confirmed_by_id → admin_users.id (SET NULL)
├── migration_key (varchar 255, NULL, UNIQUE — clé de regroupement du CSV FR56 ; NULL = fiche créée dans le panel)
├── created_by_id → admin_users.id (SET NULL, NULL pour les fiches migrées)
└── created_at, updated_at
   index : idx_authors_search_name_trgm (GIN gin_trgm_ops), idx_authors_last_names

author_affiliations
├── id (uuid) ; author_id → authors.id (CASCADE)
├── position (smallint ≥ 1 — ordre saisi ; 1 = institution principale) ; UNIQUE (author_id, position)
├── institution (varchar 255, NOT NULL) ; institution_key (varchar 255, NOT NULL — normalisée comme search_name)
└── department (varchar 255, NULL)
   index : idx_author_affiliations_institution_key

production_authors                      (pivot ordonné, FR54/FR56)
├── production_id → productions.id (CASCADE) ; author_id → authors.id (RESTRICT — garde-fou FR55)
├── position (smallint ≥ 1)
└── PK (production_id, author_id) ; UNIQUE (production_id, position) ; idx_production_authors_author_id

featured_productions                    (FR47–FR51)
├── position (smallint PK, CHECK position BETWEEN 1 AND 3)
├── production_id → productions.id (UNIQUE, CASCADE)
└── created_by_id → admin_users.id (SET NULL), created_at
```

### Colonnes ajoutées (toutes NULL, sans défaut coûteux)

| Table | Colonne | Rôle |
|---|---|---|
| `productions` | `thumbnail_key` varchar 255 | Vignette téléversée depuis la page « À la une » (D37, FR50), affichée seulement dans la bannière et conservée si la production quitte la une : préfixe R2 `thumbnails/<productionId>/<token>` |
| `production_files` | `poster_key` varchar 255 | Image extraite à t = 1 s d'une vidéo hébergée (D10) : `posters/<fileId>/<token>` ; aussi utilisable en `poster` du lecteur vidéo |
| `admin_activity_logs` | `metadata` jsonb | Détails des nouveaux événements (P2.6) ; NULL pour l'existant |

**Tables ordonnées** (`production_authors`, `author_affiliations`, `featured_productions`) : toute réorganisation des positions se fait par `DELETE` + `INSERT` dans une transaction, jamais par `UPDATE … SET position = position ± 1` : PostgreSQL vérifie une contrainte UNIQUE/PK non différable ligne à ligne et l'`UPDATE` échoue selon l'ordre physique des lignes.

**Pas de colonne `thumbnail_source`.** Vignette téléversée et image extraite sont stockées séparément : image affichée = `productions.thumbnail_key` sinon `poster_key` du premier fichier `video/mp4` **pourvu d'un poster** (ordre de création ; amendé le 2026-11-21, D-11.3-2 : cohérent avec la règle FR50 « vidéo hébergée avec `poster_key` ») ; c'est l'image de la bannière, aucune autre carte n'affiche d'image (D37). Retirer la vignette fait réapparaître l'image extraite sans retraitement, et supprimer la vidéo supprime son poster. **Pas de largeur/hauteur stockées** : toutes les variantes ont des dimensions fixes (P2.5).

**« À compléter » est dérivé, jamais stocké** : `NOT EXISTS (author_affiliations)`. **Profil public** = `consent_confirmed_at IS NOT NULL` ; **visible sur le site** = public ET au moins une production publiée liée (D11). La règle D27 (confirmation impossible sans affiliation) est appliquée au service et au validateur ; une fiche à consentement confirmé ne peut pas retomber à 0 affiliation (validateur `minLength(1)`).

### Index statistiques (classements 365 j)

Ajouter `idx_stats_views_production_id_recorded_at (production_id, recorded_at)` et `idx_stats_downloads_production_id_downloaded_at (production_id, downloaded_at)` ; ajouter `idx_stats_downloads_downloaded_at (downloaded_at)` (absent aujourd'hui, l'équivalent `idx_stats_views_recorded_at` existe). Tables petites : `CREATE INDEX` simple dans la transaction de migration (pas de `CONCURRENTLY`).

### Recherche sans accents : normalisation applicative plutôt que `unaccent`

`unaccent()` n'est pas `IMMUTABLE` : l'indexer exige une fonction enveloppe et une extension de plus sur la base partagée. On stocke donc des **clés normalisées calculées en TypeScript** (`search_name`, `institution_key`) par un helper unique `app/helpers/normalize.ts` (`normalizeKey(s)` : NFD, suppression des diacritiques `̀-ͯ`, minuscules, espaces compactés, trim — même translittération que `ProductionService.generateSlug`). Hooks Lucid `@beforeSave` sur `Author` et `AuthorAffiliation`. La requête normalise le terme de la même façon puis utilise `pg_trgm`, déjà activé (`1775918742000_enable_pg_trgm_extension.ts`) : `search_name LIKE '%' || :q || '%'` (servi par l'index GIN trigram) OU `similarity(search_name, :q) > 0.3`, tri : préfixe d'abord, puis similarité, puis `last_names`.

Le slug d'auteur réutilise la translittération de `ProductionService.generateSlug`, extraite dans `app/helpers/slug.ts` (la copie de la migration `add_slug_to_productions_table` reste figée) : `slugify("${first_names} ${last_names}")`, repli `auteur`, suffixe `-2`, `-3`… en cas de collision.

### `productions.authors` (jsonb) : expand/contract

- **Expand (Phase 2)** : la colonne est **conservée comme dénormalisation dérivée** des noms (« Prénom Nom » dans l'ordre du pivot). Le pivot `production_authors` devient la source de vérité ; seul `ProductionAuthorService.sync(productionId, authorIds)` écrit les deux, dans une transaction, puis `refreshDenormalizedNames(productionIds)` réécrit le jsonb en SQL (`COALESCE(jsonb_agg(first_names || ' ' || last_names ORDER BY position), '[]'::jsonb)` : colonne `NOT NULL`, pivot vide → `[]`). Le renommage d'un auteur rafraîchit toutes ses productions. Effet : le trigger `productions_search_vector_update` (qui indexe `authors::text`) reste **inchangé**, la recherche full-text continue de trouver les auteurs, et une image antérieure qui tourne encore (dev/staging partagés, rollback d'image du déploiement) lit toujours une colonne valide.
- **Modèle** : la propriété jsonb devient `authorNames` (`columnName: 'authors'`), lecture seule hors `ProductionAuthorService` (dès la bascule, `admin/productions_controller.ts` `store`/`update` n'affecte plus jamais cette colonne depuis la requête ; un champ `authors` reçu est ignoré) ; la relation `manyToMany` s'appelle `authors` (pivot `production_authors`, `pivotColumns: ['position']`, tri par `production_authors.position`).
- **Contract (release ultérieure, après la conversion en production)** : suppression des chemins de code « texte libre », débranchés de l'écriture dès la bascule (validateur `authors: string[]`, facettes `distinctJsonbValues('authors')`, `ChipInput` auteurs, `distinctSuggestions().authors`). **Pas de suppression de la colonne** en V1 : elle reste utile au `search_vector`. Une suppression future exigerait un trigger conscient du pivot ; hors périmètre.

### Migrations (ordre, toutes additives)

| # | Fichier | Contenu |
|---|---|---|
| 1 | `1775918745000_create_authors_table.ts` | `authors` + index |
| 2 | `1775918746000_create_author_affiliations_table.ts` | `author_affiliations` |
| 3 | `1775918747000_create_production_authors_table.ts` | pivot |
| 4 | `1775918748000_add_thumbnail_and_poster_columns.ts` | `productions.thumbnail_key`, `production_files.poster_key` |
| 5 | `1775918749000_create_featured_productions_table.ts` | une |
| 6 | `1775918750000_add_metadata_to_admin_activity_logs.ts` | `metadata jsonb` |
| 7 | `1775918751000_add_stats_window_indexes.ts` | index P2.1 |

`down()` écrits (convention Lucid) mais **jamais exécutés** sur la base partagée. Aucune migration ne transforme de données : la conversion des auteurs est une commande séparée (P2.2), déclenchée explicitement.

## P2.2 Migration des auteurs (FR56, D19)

Commandes Ace hors produit, dans un nouveau dossier `commands/` (scanné automatiquement par `adonisrc.ts`), service `app/services/author_conversion_service.ts` (testable sans CLI) :

| Commande | Effet | Écrit en base |
|---|---|---|
| `node ace authors:propose --out tmp/authors-conversion.csv` | Extrait les noms distincts de `productions.authors` (toutes statuts) sans lien dans le pivot ; regroupe ; écrit le CSV | non |
| `node ace authors:validate --file tmp/authors-conversion.csv` | Contrôle le CSV édité : chaque nom source mappé, une seule identité (prénoms/noms) par `author_key`, `existing_author_slug` existants, colonnes requises ; rapport de ce qui serait créé/rattaché | non |
| `node ace authors:apply --file … [--dry-run]` | Exécute dans **une transaction** ; idempotent | oui |
| `node ace authors:verify` | Rapport : productions dont un nom jsonb n'a pas d'auteur rattaché, positions incohérentes, fiches orphelines ; code de sortie ≠ 0 si < 100 % | non |

- **CSV** (`;`, UTF-8 BOM pour Excel) : `source_name ; occurrences ; productions ; author_key ; first_names ; last_names ; existing_author_slug ; confidence ; note`. Aurélien édite `author_key` pour fusionner, corrige prénoms/noms, ou pointe une fiche existante.
- **Proposition** : regroupement automatique sur `normalizeKey` exact (`confidence=exact`) et sur l'égalité des jetons triés (« Diallo Moussa » = « Moussa Diallo », `confidence=grouped`) ; similarité `pg_trgm` > 0,6 signalée seulement dans `note` (`confidence=fuzzy`), **jamais fusionnée automatiquement**. Découpage prénom/nom : jeton entièrement en capitales = nom ; sinon dernier mot = nom (même règle que le combobox, D36).
- **Apply** : upsert des fiches par `migration_key = author_key` (consentement NULL, sans affiliation → « À compléter », `created_by_id` NULL, slug D28) ; pour chaque production, insertion des lignes pivot dans l'ordre exact du tableau jsonb (`ON CONFLICT DO NOTHING`), les productions déjà entièrement rattachées sont ignorées ; deux noms d'une même production désignant la même fiche ne créent qu'un lien, à la position de la première occurrence, positions recompactées 1..n (`verify` les compte rattachés) ; puis `refreshDenormalizedNames`. Ré-exécutable avec un CSV complété (nouveaux noms saisis entre-temps). Rapport `tmp/authors-conversion-report-<date>.txt` (fiches créées, liens créés, productions ignorées). Pas d'entrée au journal d'activité (aucun admin acteur) : la traçabilité est `migration_key` + le rapport.
- **Exécution** : `doppler run -- node ace authors:…` en utilisateur `atlas` sur le VPS de dev (Doppler `dev` = Supabase partagée avec le staging), **uniquement après validation explicite du CSV par Aurélien**. `--dry-run` d'abord, puis `apply`, puis `verify` (critère PRD : 100 % des noms rattachés). Le CSV et le rapport contiennent des noms : jamais commités, jamais joints à une PR.
- **Production** (Story 8.6 en attente) : même séquence avec le CSV validé, au moment du déploiement de la release « bascule » (P2.9).

## P2.3 Classements (FR45–FR46, D4, D5, D7)

Service `app/services/ranking_service.ts`. Fenêtre glissante calculée par Postgres (`now() - interval '365 days'`), jointure **interne** sur les stats (exclut les éléments à 0 sur la période, D5), puis hydratation des cartes avec les **totaux** (agrégats `withAggregate` existants de `home_controller.ts`).

```sql
-- Les plus consultées (téléchargées : stats_downloads / downloaded_at)
SELECT p.id, count(*) AS window_count
FROM productions p
JOIN stats_views v ON v.production_id = p.id AND v.recorded_at >= now() - interval '365 days'
WHERE p.status = 'published'
GROUP BY p.id
ORDER BY window_count DESC, p.anta_published_at DESC NULLS LAST, p.id ASC
LIMIT 3;

-- Auteurs les plus consultés : profils publics, vues 365 j > 0
WITH pub AS (
  SELECT pa.author_id, p.id AS production_id, p.anta_published_at
  FROM production_authors pa JOIN productions p ON p.id = pa.production_id AND p.status = 'published')
SELECT a.id, count(v.id) AS window_views, max(pub.anta_published_at) AS last_published_at
FROM authors a
JOIN pub ON pub.author_id = a.id
LEFT JOIN stats_views v ON v.production_id = pub.production_id AND v.recorded_at >= now() - interval '365 days'
WHERE a.consent_confirmed_at IS NOT NULL
GROUP BY a.id
HAVING count(v.id) > 0
ORDER BY window_views DESC, last_published_at DESC, a.last_names ASC, a.first_names ASC, a.id ASC
LIMIT 3;
```

Départage auteurs (D36) : dernière production publiée sur Anta (toutes ses productions publiées, d'où le `LEFT JOIN`), puis nom de famille, puis prénom. La liste `/authors` (tri par défaut) réutilise la même expression de vues 365 j, sans `HAVING` (un auteur à 0 vue y figure, en fin de liste) ; tris alternatifs `name` (`last_names, first_names`) et `productions` (nombre de productions publiées ↓, puis nom). Listing `sort=views|downloads` : inchangé, sur les **totaux** (D7, `search_service.ts`).

**Cache : en mémoire du processus, TTL 10 min, invalidation explicite.** `RankingService` mémorise les trois classements de l'accueil (identifiants ordonnés uniquement) dans une `Map` à expiration ; la mise en avant et « Récemment publiées » ne sont **pas** mis en cache (la bannière doit refléter l'enregistrement immédiatement, parcours 5). `RankingService.invalidate()` est appelé par : publication, dépublication, suppression de production, `ProductionAuthorService.sync`, confirmation/retrait du consentement, modification et suppression d'auteur. Justification : chaque environnement exécute **un seul processus Node** (`compose.yaml`, service `app`) ; les requêtes coûtent quelques millisecondes à l'échelle d'Anta mais l'accueil en enchaîne six, et le TTFB conditionne le LCP (< 3 s) en `ssr: false`. Vue matérialisée rejetée : rafraîchissement à planifier (aucun ordonnanceur dans l'application), DDL supplémentaire sur la base partagée, sans gain mesurable. Si l'application passe un jour à plusieurs réplicas, le TTL borne l'incohérence (accepté) ; l'invalidation reste locale. Un retrait de consentement invalide immédiatement le cache : aucun profil retiré ne reste affiché (FR53).

## P2.4 Suggestions (FR61, D22)

**Endpoint JSON chargé après le rendu** : `GET /productions/:slug/suggestions` → `{ results: ProductionCard[] }` (≤ 4), 404 si la production n'est pas publiée, `Cache-Control: public, max-age=300`. Côté client, `SuggestionsGrid` lance `fetch` au montage avec un `AbortController` à **2 000 ms** ; erreur, abandon ou 0 résultat → section retirée sans message (D22) ; résultat mémorisé dans une `Map` du module par slug (aucun rechargement au retour arrière). Les props Inertia différées (`inertia.defer`) sont rejetées : pas de délai d'abandon maîtrisé, comportement au retour arrière moins prévisible, et l'endpoint est testable fonctionnellement en isolation.

Classement exact du PRD : critère le plus fort partagé (auteur > mot-clé > sous-domaine > domaine), puis nombre de critères partagés, puis date de publication sur Anta décroissante. **Interprétation retenue** : un « critère partagé » est un élément commun — chaque auteur commun, chaque tag commun, chaque sous-domaine commun, et le domaine (0 ou 1). Comparaison exacte des valeurs stockées (tags et sous-domaines déjà harmonisés par l'auto-complétion admin et la taxonomie `app/constants/production_taxonomy.ts`).

```sql
WITH cur AS (SELECT id, domain, tags, subdomain FROM productions WHERE id = :id),
cand AS (
  SELECT p.id, p.anta_published_at,
    (SELECT count(*) FROM production_authors x JOIN production_authors y ON y.author_id = x.author_id
       WHERE x.production_id = cur.id AND y.production_id = p.id)                      AS n_authors,
    (SELECT count(*) FROM jsonb_array_elements_text(p.tags) t
       WHERE t IN (SELECT jsonb_array_elements_text(cur.tags)))                         AS n_tags,
    (SELECT count(*) FROM jsonb_array_elements_text(p.subdomain) s
       WHERE s IN (SELECT jsonb_array_elements_text(cur.subdomain)))                    AS n_sub,
    (p.domain IS NOT NULL AND p.domain = cur.domain)::int                              AS n_domain
  FROM productions p, cur
  WHERE p.status = 'published' AND p.id <> cur.id)
SELECT id FROM cand
WHERE n_authors + n_tags + n_sub + n_domain > 0
ORDER BY CASE WHEN n_authors > 0 THEN 4 WHEN n_tags > 0 THEN 3 WHEN n_sub > 0 THEN 2 ELSE 1 END DESC,
         n_authors + n_tags + n_sub + n_domain DESC, anta_published_at DESC NULLS LAST, id ASC
LIMIT 4;
```

Ne pas utiliser l'opérateur jsonb `?` dans `db.rawQuery` : knex le prend pour un paramètre lié. Balayage de toutes les productions publiées : quelques centaines de lignes, < 50 ms attendus ; pas de cache. `SuggestionService` dans `app/services/suggestion_service.ts`, hydratation par le transformer de cartes (P2.6).

## P2.5 Vignettes, photos et image extraite (D9, D10, D37, FR50)

**Portée (D37, 2026-11-18)** : la vignette (ou l'image extraite d'une vidéo hébergée) n'est affichée que dans la bannière à la une. Les cartes des blocs, du listing, des profils et des suggestions restent des cartes texte, et les pages de production n'ont pas d'`og:image`.

**Traitement serveur avec `sharp`** (nouvelle dépendance de production ; binaires précompilés linux-x64 glibc, compatibles `node:24-bookworm-slim`). Service `app/services/image_service.ts` :

1. Validation : `request.file('thumbnail', { size: '5mb', extnames: ['jpg','jpeg','png','webp'] })` + décodage réel par `sharp(...).metadata()` : format ∈ {jpeg, png, webp}, sinon erreur `thumbnail.errors.invalid_type` ; `limitInputPixels` à 40 Mpx. Animation : première image seulement.
2. Normalisation : `.rotate()` (orientation EXIF) puis métadonnées supprimées (défaut sharp : retire notamment la géolocalisation des photos d'auteurs).
3. Variantes, recadrage centré (`fit: 'cover'`, identique à l'`object-cover` des cartes et à l'aperçu admin) :

| Usage | Ratio | Variantes R2 (`<préfixe>/…`) |
|---|---|---|
| Vignette de production / poster vidéo | 16:9 | `w400.webp` (400×225), `w800.webp`, `w1600.webp` |
| Photo d'auteur | 1:1 (+ 1.91:1) | `w128.webp`, `w384.webp` ; `og.jpg` 1200×630 recadré sur la zone saillante (D-10.7-2, 2026-11-21) |

4. Clé : préfixe neuf à chaque téléversement (`thumbnails/<productionId>/<token 20>`), écrit en base **après** l'envoi des variantes ; l'ancien préfixe est supprimé ensuite (best-effort, journalisé en cas d'échec — même compensation que `files_controller.ts`). Les clés sont immuables, d'où un cache navigateur d'un an.

**Image extraite à t = 1 s : `ffmpeg` côté serveur, synchrone, au téléversement de la vidéo.** Ajout dans l'étape `runtime` du `Dockerfile` (avant `USER node`) : `apt-get install -y --no-install-recommends ffmpeg` (paquet Debian maintenu ; déjà présent sur le VPS de dev ; à installer dans `ci.yml`). `VideoFrameService.extract(inputPath)` : `execFile('ffmpeg', ['-ss','1','-i',input,'-frames:v','1','-f','image2','-c:v','png', out])` (repli `-ss 0` pour une vidéo < 1 s), délai maximal 20 s, puis passage dans `ImageService` (variantes 16:9) → `production_files.poster_key`. Appelé dans `FilesController.store` **avant** `FileStorageService.upload` (qui déplace le fichier temporaire) ; les variantes sont envoyées et `poster_key` écrit **après** la création de la ligne `production_files` (son identifiant n'existe qu'alors). Échec d'extraction = journalisé, **ne fait jamais échouer le téléversement de la vidéo** ; la production exige alors une vignette pour la une. Rattrapage des vidéos déjà hébergées : `node ace thumbnails:extract-video-frames [--dry-run]` (amendé le 2026-11-21, D-11.3-1 : le flux R2 est copié dans un fichier temporaire supprimé après usage, ffmpeg ne lit que des fichiers locaux — `-protocol_whitelist file` — au lieu de l'URL signée par requêtes de plage ; coût accepté : chaque vidéo ≤ 100 Mo est lue en entier, une seule fois), exécuté une fois avec l'accord d'Aurélien (écrit en base partagée et dans R2). Extraction dans le navigateur (canvas) rejetée : dépend du codec et de l'onglet ouvert, ne couvre pas le rattrapage, exige la CORS R2.

**Diffusion : route publique `GET /media/*` adossée à R2, pas d'URL signée.** Le bucket est privé (`config/drive.ts`, `visibility: 'private'`) et les URL signées changent à chaque rendu (TTL 1 h) : elles casseraient le cache navigateur (LCP), et l'`og:image` des profils d'auteurs doit rester stable pour les robots des réseaux sociaux. `MediaController.show` sert uniquement `thumbnails/…`, `posters/…` et `authors/…` (jamais `productions/…`, les fichiers sous licence restent en URL signée) : il vérifie que la clé est la clé **courante** d'un propriétaire visible (production publiée ; auteur public) puis diffuse le flux R2 (`disk.getStream`) avec `Content-Type` et `Cache-Control: public, max-age=31536000, immutable` (photos d'auteurs : `max-age=3600`, le consentement est révocable) ; sinon 404 `no-store`. Les aperçus admin (brouillons, profils non publics) utilisent `FileStorageService.signedUrl`. Évolution possible hors V1 : domaine public R2 ou cache nginx devant `/media`.

**Front.** Les props exposent une base (`imageUrl` des seules productions de la prop `featured` : `/media/thumbnails/<id>/<token>` ou `/media/posters/<fileId>/<token>` ; `photoUrl`) ; `inertia/lib/media.ts` construit `src`/`srcSet` (`w400 400w, w800 800w, w1600 1600w`) et les `sizes` par contexte. `width`/`height` toujours renseignés (16:9) contre le décalage de mise en page ; première carte de la bannière en `loading="eager"` + `fetchpriority="high"` (élément LCP probable), le reste en `loading="lazy"`. `alt` selon D9/D36.

**Règle FR50 côté serveur** (`FeaturedService.requiresThumbnail(production)`) : une vignette est requise sauf si la production possède une vidéo hébergée avec `poster_key`. Vérifiée à l'enregistrement de la une et au retrait d'une vignette d'une production à la une (refus `thumbnail.errors.required_for_featured`).

**SEO** : `MetaTags` gagne `ogImage?: string` (URL absolue `APP_URL` + `/media/authors/…/og.jpg`, profils d'auteurs seulement) ; `resources/views/inertia_layout.edge` ajoute `og:image` et `twitter:card` (`summary_large_image` si image, sinon `summary`). les pages de production n'ont pas d'`og:image` (`twitter:card=summary`, D37) ; aucune donnée d'auteur non public dans les meta d'une production (seuls les noms affichés, déjà publics sur la page).

## P2.6 Routes, contrôleurs, pages

### Site public (`start/routes.ts`, aucun middleware)

| Route | Nom | Contrôleur | Page / réponse |
|---|---|---|---|
| `GET /` | `home` | `public/home_controller.ts` (modifié) | `home` : props `featured`, `recent`, `mostViewed`, `mostDownloaded`, `topAuthors`, `meta` ; `categories` supprimé (D8) ; 3 éléments par bloc |
| `GET /productions` | `productions` | `public/productions_controller.ts` (modifié) | filtre `author=<slug>` répétable (OR) via `whereExists` sur le pivot + `authors.slug` ; facette auteurs = `{ value: slug, label }[]` des profils publics ayant ≥ 1 production publiée (D12) |
| `GET /productions/:slug` | `production.show` | idem | auteurs `{ name, slug \| null }[]` ordonnés (slug seulement si profil public) |
| `GET /productions/:slug/suggestions` | `production.suggestions` | idem, `suggestions` | JSON (P2.4) |
| `GET /authors` | `authors.index` | `public/authors_controller.ts` | `authors` : `q`, `institution` (libellé, normalisé en `institution_key`), `domain`, `sort=views\|name\|productions`, 24/page |
| `GET /authors/:slug` | `authors.show` | idem | `author` : `sort=date\|views\|downloads\|title`, 12/page ; **404** (`errors/not_found`, statut 404, comme `ProductionsController.show`) si slug inconnu, consentement absent ou aucune production publiée (D11, D17) |
| `GET /media/*` | `media.show` | `public/media_controller.ts` | flux image (P2.5) |

Page hors limites (D36) : redirection 302 vers la dernière page en conservant les paramètres. Facette institution (D14) : `SELECT institution_key, mode() WITHIN GROUP (ORDER BY institution) AS label … GROUP BY institution_key` sur les affiliations des auteurs visibles. Les cartes de production sont sérialisées par un transformer unique `app/transformers/production_card_transformer.ts` (remplace les deux `serialize()` dupliqués de `home_controller.ts` et `productions_controller.ts`), qui précharge les auteurs ordonnés ; une carte n'expose aucune image (D37).

### Panel admin (groupe `middleware.admin()` existant : admin **et** super admin)

| Route | Nom | Contrôleur |
|---|---|---|
| `GET /admin/authors` (`q`, `institution`, `consent=pending`, `incomplete=1`, `page`) | `admin.authors` | `admin/authors_controller.ts` |
| `GET /admin/authors/create` · `POST /admin/authors` | `admin.authors.create` · `.store` | idem (multipart, photo facultative) |
| `GET /admin/authors/:id/edit` · `PUT /admin/authors/:id` · `DELETE /admin/authors/:id` | `.edit` · `.update` · `.destroy` | idem ; suppression refusée si ≥ 1 ligne pivot (FR55), FK `RESTRICT` en garde-fou |
| `POST /admin/authors/:id/confirm-consent` · `POST /admin/authors/:id/withdraw-consent` | `.confirm-consent` · `.withdraw-consent` | idem (convention `/publish`, `/unpublish`) |
| `GET /admin/authors/search?q=&exclude[]=` | `admin.authors.search` | JSON ≤ 10 : `{ id, name, primaryInstitution, isIncomplete, isPublic, photoUrl }` (`photoUrl` signée `w128` ou `null`) |
| `POST /admin/authors/quick` | `admin.authors.quick-store` | JSON 201 `{ author }` / 422 ; fenêtre « Créer un auteur » (FR54) |
| `POST · DELETE /admin/productions/:productionId/thumbnail` | `admin.productions.thumbnail.store` · `.destroy` | `admin/thumbnails_controller.ts` (redirection arrière + flash, comme `files_controller.ts`) |
| `GET /admin/featured` · `PUT /admin/featured` | `admin.featured` · `.update` | `admin/featured_controller.ts` |
| `GET /admin/featured/candidates?q=&exclude[]=` | `admin.featured.candidates` | JSON : productions **publiées** par titre (trigram existant) ou auteur, avec état de vignette |

- **Fenêtre « Créer un auteur »** : premier endpoint JSON mutant ; la fenêtre ne doit pas naviguer (saisies de la production préservées). Requête `fetch` multipart avec l'en-tête `X-XSRF-TOKEN` (lu du cookie `XSRF-TOKEN`, `enableXsrfCookie: true` dans `config/shield.ts`) et `Accept: application/json` (erreurs VineJS en 422 JSON).
- **Enregistrement de la une** (`FeaturedService.save(productionIds, adminId)`) : transaction `DELETE` + `INSERT` positions 1..n ; refus si une production n'est pas publiée ou manque d'une vignette requise.
- **Retrait automatique (FR51)** : `ProductionService.unpublish` et `.delete` appellent `FeaturedService.removeProduction(id, adminId, cause)` dans la même transaction (ces deux méthodes reçoivent `adminId` et ouvrent la transaction) : suppression et recompactage des positions suivantes (D30) par `DELETE` + `INSERT` 1..n ; journalisation `featured_auto_remove` après le commit (`ActivityLogService.log` est hors transaction et ne lève jamais). Le dialog de confirmation reçoit `isFeatured` dans les props de la liste et du formulaire admin (D21).
- **Formulaire de production** : `authorIds: string[]` ordonné remplace `authors: string[]` ; `ProductionService.getMissingForPublish` teste le nombre de lignes pivot (FR21) ; la règle client `inertia/lib/production_completion.ts` est alignée (duplication intentionnelle existante).

### Validateurs VineJS (`app/validators/admin/`)

- `author_validator.ts` : `lastNames`, `firstNames` (trim, 1–120) ; `affiliations: array({ institution 1–255, department ≤ 255 optionnel })` avec `minLength(1)` sauf fiche migrée (`migration_key` non NULL) ou consentement confirmé (alors toujours ≥ 1) ; `googleScholarUrl` URL `http(s)` optionnelle ≤ 500 ; `consent` booléen optionnel (refusé sans affiliation, D27) ; `photo` fichier optionnel (≤ 5 Mo, jpg/png/webp) ; `removePhoto` booléen.
- `production_validator.ts` : `authorIds: vine.array(vine.string().uuid()).distinct().optional()`, existence vérifiée dans `ProductionAuthorService.sync`.
- `featured_validator.ts` : `productionIds: vine.array(vine.string().uuid()).maxLength(3).distinct()`.
- Messages = clés i18n (pattern `productions.form.errors.*` existant). Schémas Zod client dupliqués (convention « Validation — Double Couche »).

### Pages et composants (noms UX)

- Public : `inertia/pages/authors.tsx`, `inertia/pages/author.tsx` ; `inertia/components/public/` : `FeaturedBanner`, `FeaturedCard`, `HomeBlock`, `AuthorCard`, `AuthorByline`, `AuthorFilters`, `AuthorProfileHeader`, `SuggestionsGrid` ; `inertia/components/shared/` : `Avatar`, `SortSelect` (à côté de `Pagination.tsx`). `errors/not_found.tsx` devient la NotFoundPage traduite (D36).
- Admin : `inertia/pages/admin/Authors/{Index,Create,Edit}.tsx`, `inertia/pages/admin/Featured/Index.tsx` ; `inertia/components/admin/` : `AuthorCombobox`, `SelectedAuthorList`, `AuthorForm`, `AuthorFormDialog`, `ThumbnailField`, `FeaturedSlot`, `ProductionPicker`, `BannerPreview`. `ChipInput` reste pour les tags. Composants shadcn manquants (combobox/popover, tooltip, skeleton) ajoutés par la CLI shadcn (méta-paquet `radix-ui`, alias `~/*`).
- **Tuyau** : toute nouvelle route est nommée (`.as(...)`) ; le registre `.adonisjs/client/registry` est régénéré par `node ace` (dev/build) ; le front utilise `urlFor` de `inertia/client.ts`, jamais d'URL en dur.
- **i18n** : `inertia/locales/public/{fr,en}.json` (`home.blocks.*`, `featured.*`, `authors.list.*`, `authors.profile.*`, `suggestions.*`, `not_found.*`) et `inertia/locales/admin/{fr,en}.json` (`authors.*`, `featured.*`, `thumbnail.*`, `activity.action.*`, `activity.resource.*`) ; libellés de `EXPERIENCE.md` → Voice and Tone ; pluriels i18next. Les meta serveur restent dans `SeoService` (pas d'i18n serveur, convention existante).

### Journal d'activité (réponse à la question ouverte 1)

`app/enums/action_type.ts` gagne : `CONSENT_CONFIRM: 'consent_confirm'`, `CONSENT_WITHDRAW: 'consent_withdraw'`, `FEATURED_UPDATE: 'featured_update'`, `FEATURED_AUTO_REMOVE: 'featured_auto_remove'`. `ActivityLogService.log` accepte `metadata?: Record<string, unknown>` (colonne `metadata`). Le filtre de `activity_logs_controller.ts` (`Object.values(ActionType)`) les expose automatiquement.

| Événement | actionType | resourceType / resourceId | metadata |
|---|---|---|---|
| Auteur créé / modifié | `create` / `update` | `author` / id | `{ name }` (update : `{ name, fields: [...] }`) |
| Auteur supprimé | `delete` | `author` / id | `{ name }` (la fiche n'existe plus) |
| Consentement confirmé / retiré | `consent_confirm` / `consent_withdraw` | `author` / id | `{ name }` |
| Vignette posée / retirée | `update` | `production` / id | `{ field: 'thumbnail', op: 'set' \| 'remove' }` |
| Une enregistrée | `featured_update` | `featured_selection` / NULL | `{ before: [ids], after: [ids] }` |
| Retrait automatique | `featured_auto_remove` | `production` / id | `{ position, cause: 'unpublish' \| 'delete' }` |

## P2.7 Permissions, SEO, plan du site

- **Permissions** : toutes les nouvelles routes admin sont dans le groupe `middleware.admin()` (admin et super admin, PRD « Périmètre super admin » : FR47–FR56 pour tout admin) ; aucune nouvelle route `superAdmin()`. Le journal reste réservé au super admin (inchangé). Les commandes de conversion et de rattrapage ne sont pas exposées dans le produit.
- **SEO profil (FR36)** : `SeoService.forAuthor(locale, author, appUrl)` : `title` « Prénom NOM — Anta », `description` « {institution principale} — {n} productions publiées sur Anta » (affiliation omise si absente), `ogType: 'profile'`, `ogUrl` `/authors/:slug`, `ogImage` = `og.jpg` de la photo si présente. `SeoService.authorsList(locale)` pour `/authors`. Tests unitaires sans base (forme minimale acceptée, comme `forProduction`).
- **Plan du site** : `GET /sitemap.xml` (accueil, `/productions`, `/authors`, productions publiées, profils visibles) **facultatif**, en dernière story de l'épique SEO/accessibilité ; ajouté à `robots.txt` si livré.
- **Données personnelles** : nouvelle section FR/EN de `/privacy-policy` (contenu, story dédiée) ; retrait des champs facultatifs sur demande = édition de la fiche ; aucune photo servie pour un profil non public (P2.5).

## P2.8 Stratégie de test

- **Exécution** : `npm run test:local [-- unit|functional|browser]` sur Postgres Docker local, jamais sous `doppler run`. CI : ajouter `ffmpeg` (apt) au job de `ci.yml`.
- **Unit** (`tests/unit/services`, `tests/unit/validators`) : `normalizeKey`, slug d'auteur (collisions, figé au renommage), regroupement et découpage de `AuthorConversionService` (cas « NOM Prénom », jetons inversés, homonymes), `SeoService.forAuthor`/`ogImage`, validateurs (affiliations conditionnelles, URL Scholar, `authorIds`), `FeaturedService.requiresThumbnail`.
- **Functional** (`tests/functional/{public,admin}`, gotchas de memory : `.withCsrfToken()`, `.redirects(0)`, `loginAs()`, `SESSION_DRIVER=memory`) : classements (exclusion des 0 sur 365 j avec des stats datées de 366 j, départages, totaux affichés), suggestions (ordre par critère puis nombre puis date, exclusion de la production courante, 404 brouillon), `/authors` (filtres, tris, page hors limites → 302), profil (404 sans consentement, sans production publiée, après retrait), filtre `author=<slug>`, CRUD auteurs + consentement + journal, suppression refusée (FR55), une (ordre, vignette requise, retrait automatique à la dépublication/suppression + recompactage), conversion `apply` idempotente (deux exécutions = même état) et `verify`. Uploads : `drive.fake('r2')` (`config/drive.ts`) ; images de test générées par `sharp` dans le test ; vidéo de test = MP4 de 2 s généré par `ffmpeg` dans le setup (pas de binaire commité).
- **Composants React** : par lecture de source, jamais par import (frontière TS6305, `tests/unit/components/*.spec.ts`) : attributs ARIA (`aria-busy`, `aria-live`, `aria-current`), `alt=""`, pas de liens imbriqués, clés i18n présentes en FR et EN (`tests/unit/i18n/translations.spec.ts`).
- **Accessibilité** : suite `browser` déjà déclarée (`adonisrc.ts`, `@japa/browser-client` dans `tests/bootstrap.ts`) + `@axe-core/playwright` (devDependency) : 0 violation A/AA sur accueil, listing, détail, liste des auteurs, profil, politique de confidentialité, en FR et EN (NFR). Audit manuel clavier/NVDA/VoiceOver hors automatisation, consigné à la recette.
- **Performance** : `EXPLAIN ANALYZE` des requêtes P2.3/P2.4 sur la base **locale** remplie (seeder démo 300 productions étendu : fiches fictives `seed-demo:` + pivot, stats datées sur 540 jours ; jamais de stats factices dans la base partagée) ; Lighthouse mobile 4G sur le staging à chaque release Phase 2 (accueil, `/authors`, profil : LCP < 3 s) ; suggestions affichées < 2 s.
- **Build** : vérifier que `package-lock.json` contient `@img/sharp-linux-x64` et `@img/sharp-libvips-linux-x64` (lockfile possiblement généré sous Windows) ; un test d'infrastructure (`tests/unit/infrastructure/deployment.spec.ts`) vérifie la présence de `ffmpeg` dans le `Dockerfile`.

## P2.9 Séquence d'implémentation recommandée (entrée des épiques)

| # | Lot | Dépend de | Note |
|---|---|---|---|
| 1 | Schéma (migrations 1–7), modèles `Author`, `AuthorAffiliation`, relation `Production.authors` (+ renommage `authorNames`), helpers `normalize`/`slug`, `metadata` du journal | — | aucun changement visible |
| 2 | Admin auteurs : liste, fiche, photo (`ImageService`, `sharp`), consentement, suppression, `search` | 1 | P2.5 photo seulement |
| 3 | Commandes de conversion `propose`/`validate`/`apply`/`verify` ; `propose` exécutée → CSV à Aurélien | 1 | lecture seule tant que non validé |
| 4 | **Bascule** : formulaire de production (combobox, `quick-store`, `ProductionAuthorService.sync`, FR21), lecture du pivot partout (cartes, détail, facette/filtre `author=<slug>`) | 2, 3 | **Porte** : `apply` + `verify` à 100 % le jour du déploiement de ce lot en staging ; `verify` relancée après déploiement |
| 5 | Site public auteurs : `/authors`, `/authors/:slug`, `AuthorByline` liée, pied de page, SEO profil, NotFoundPage | 4 | |
| 6 | Vignettes : `ThumbnailField`, `/media`, `srcset` de la bannière, ffmpeg (Dockerfile, CI, upload) + rattrapage `thumbnails:extract-video-frames` | 1 | parallélisable avec 2–5 |
| 7 | À la une : page admin, `FeaturedService`, retrait automatique + journal | 6 | |
| 8 | Refonte de l'accueil : bannière, 4 blocs, `RankingService` + cache, « Recherche avancée », tris du listing | 5, 7 | |
| 9 | Suggestions : service, endpoint, `SuggestionsGrid` | 4, 6 | |
| 10 | Conformité WCAG 2.1 AA (suite axe, attribut `lang`, corrections), politique de confidentialité, `sitemap.xml` facultatif | 5–9 | contract (P2.1) dans une release ultérieure, après la conversion en production |

## P2.10 Décisions Phase 2

| ID | Décision | Raison principale |
|---|---|---|
| P2-01 | Auteurs en tables relationnelles (`authors`, `author_affiliations`, pivot ordonné) | ordre FR54, suppression conditionnelle FR55 garantie par FK `RESTRICT` |
| P2-02 | `productions.authors` conservé comme dénormalisation dérivée (`authorNames`), jamais supprimé en V1 | `search_vector` inchangé, rétrocompatibilité avec la base partagée |
| P2-03 | « À compléter » et visibilité publique dérivés, non stockés | aucune dérive d'état |
| P2-04 | Clés normalisées en TypeScript + `pg_trgm`, sans `unaccent` | pas d'extension ni de fonction IMMUTABLE à maintenir |
| P2-05 | Conversion FR56 par commandes Ace idempotentes, CSV hors dépôt, exécution sur accord d'Aurélien | D19, base partagée, dépôt public |
| P2-06 | Classements en SQL direct + cache mémoire 10 min invalidé explicitement ; une et récentes non cachées | un processus par environnement, LCP, parcours 5 |
| P2-07 | Suggestions par endpoint JSON, abandon à 2 s, critère « partagé » = élément commun | NFR non bloquante, D22, départage discriminant |
| P2-08 | `sharp` serveur, variantes WebP fixes (+ `og.jpg` des photos d'auteurs), recadrage centré | srcset, EXIF retiré, validation réelle du format |
| P2-09 | Image extraite par `ffmpeg` (apt dans l'image), synchrone et non bloquante, stockée par fichier vidéo (`poster_key`) | robuste, rattrapage possible, retrait de vignette réversible |
| P2-10 | Images servies par `/media/*` (clés immuables, contrôle de visibilité), pas d'URL signée | cache navigateur, `og:image` des profils stable, profils retirés non servis |
| P2-11 | Une = table `featured_productions` (position PK 1–3, production UNIQUE), enregistrement transactionnel | contraintes d'unicité en base, recompactage D30 |
| P2-12 | Retrait automatique dans `ProductionService` (même transaction) + journal | FR51, D21 |
| P2-13 | Journal : 4 nouveaux types + `metadata jsonb` | question ouverte 1, auditabilité |
| P2-14 | Fenêtre « Créer un auteur » en JSON (`X-XSRF-TOKEN`) | pas de navigation, saisies préservées (FR54) |
| P2-15 | Toutes les routes Phase 2 admin ouvertes à admin et super admin | PRD périmètre super admin |
| P2-16 | Accessibilité vérifiée par la suite `browser` + axe à chaque livraison | NFR Accessibilité |
| P2-17 | Vignette réservée à la une : gérée depuis la page « À la une », affichée seulement dans la bannière, pas d'`og:image` de production (D37, 2026-11-18) | FR50 amendé, cartes texte inchangées |

### Réponses aux questions ouvertes non bloquantes (EXPERIENCE.md)

1. **Types d'action du journal** : P2.6 « Journal d'activité » (4 nouveaux types, réutilisation de `create`/`update`/`delete` avec `resourceType: 'author'`, détails dans `metadata`).
2. **Extraction vidéo à t = 1 s** : `ffmpeg` installé par apt dans l'image ; traitement synchrone au téléversement, avant le transfert R2, non bloquant en cas d'échec ; rattrapage par `node ace thumbnails:extract-video-frames` sur copie temporaire du flux R2 (P2.5, P2-09 ; D-11.3-1, 2026-11-21).
3. **Tailles et stockage des vignettes** : R2, préfixe immuable par téléversement, WebP 400/800/1600, recadrage 16:9 centré côté serveur, `srcset`/`sizes` construits par `inertia/lib/media.ts` (P2.5).
4. **Calcul des classements 365 j** : requête directe indexée (`production_id, recorded_at`), jointure interne pour exclure les 0, totaux par agrégats ; cache mémoire TTL 10 min avec invalidation explicite ; vue matérialisée rejetée (P2.3, P2-06).
5. **Recherche du combobox et dédoublonnage des institutions** : `search_name` et `institution_key` normalisés (casse et accents) en TypeScript, index GIN trigram, `LIKE` + `similarity` ; facette institution groupée par `institution_key`, libellé = graphie la plus fréquente (P2.1, P2.6).
