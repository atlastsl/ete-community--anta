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
inputDocuments: ['_bmad-output/planning-artifacts/prd.md']
workflowType: 'architecture'
project_name: 'anta'
user_name: 'Aurélien'
date: '2026-04-03'
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
| Gestion des Comptes            | FR30–FR34 | Auth email/mot de passe + 2FA TOTP, gestion des rôles (admin / super admin)         |
| Métadonnées Système            | FR35      | Trois niveaux de dates par production (publique / interne / publication Anta)       |
| Référencement                  | FR36–FR37 | SSR partiel — meta tags injectés côté serveur, panel admin noindexé                 |
| Conformité                     | FR38–FR39 | Politique de confidentialité, suppression de comptes admin (RGPD)                   |

**Exigences Non-Fonctionnelles :**

- Chargement < 3s ; recherche < 1s (95e percentile) — impose une indexation efficace des métadonnées
- HTTPS, bcrypt, CSRF, sessions avec expiration, 2FA TOTP obligatoire
- Fichiers hébergés ≤ 100 Mo ; intégrité garantie
- Disponibilité 99% ; stabilité sous charge communautaire moyenne

**Échelle et Complexité :**

- Domaine principal : Full-stack web (MPA)
- Niveau de complexité : Faible
- Composants architecturaux : ~8 (API AdonisJS, site public React, panel admin React, stockage fichiers, base de données, module auth/2FA, moteur de recherche/filtres, système de statistiques)

### Contraintes et Dépendances Techniques

- Stack imposée : AdonisJS (Node.js) + React (deux apps distinctes)
- MPA — SSR partiel uniquement (meta tags côté serveur, pas de SSR complet)
- Pas de temps réel en MVP
- Support navigateurs modernes uniquement (dernières 2 versions)
- Fichiers lourds (> 100 Mo) non hébergés — liens externes uniquement

### Préoccupations Transversales

1. **Authentification et Autorisation** — 2FA TOTP, sessions, CSRF, séparation des rôles admin / super admin
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

**Phase finale (VPS — Epic 8) :** GitHub Actions avec déploiement sélectif par chemin depuis `master` :

```yaml
# Règles de déclenchement par chemin modifié
- inertia/pages/public/** ou app/controllers/public/**
  → Rebuild bundle public → Redéploiement partiel
- inertia/pages/admin/** ou app/controllers/admin/**
  → Rebuild bundle admin → Redéploiement partiel
- app/models/** ou database/migrations/**
  → Redéploiement complet backend
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
├── id, email, password_hash (bcrypt)
├── role (admin | super_admin)
├── is_active
├── totp_secret, totp_enabled
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
| 2FA TOTP             | `@adonisjs/2fa` (principal) + `otplib` + `qrcode` (fallback)      |
| Autorisation (rôles) | AdonisJS Bouncer (admin vs super_admin)                           |
| Hashage mot de passe | bcrypt (intégré AdonisJS Auth)                                    |
| Protection CSRF      | Middleware CSRF AdonisJS (activé sur toutes les routes admin)     |
| Expiration session   | 2 heures d'inactivité (configurable via variable d'environnement) |

**Flux première connexion (ordre obligatoire) :**

1. Admin créé par super admin → mot de passe provisoire + `totp_enabled = false` + `password_changed = false`
2. Première connexion (email + mot de passe provisoire) → redirection forcée page changement de mot de passe
3. Définition nouveau mot de passe → `password_changed = true`
4. Redirection forcée vers page activation 2FA
5. Affichage QR code → scan → vérification code → `totp_enabled = true`
6. Accès au dashboard
7. Connexions suivantes : email + mot de passe → puis code TOTP

**Reset mot de passe (super admin) :**

- Super admin génère un nouveau mot de passe provisoire → `password_changed = false` → email envoyé → l'admin resuit le flux étape 2-3 à sa prochaine connexion

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
| `staging`     | Test/démo — connectée à Render, mise à jour via PR `development → staging` |

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

#### Phase finale — Production (VPS) — Epic 8

| Composant         | Choix                                                           |
| ----------------- | --------------------------------------------------------------- |
| Hébergement       | VPS (type Hetzner CX21 — 2 vCPU, 4 Go RAM)                      |
| Reverse proxy     | Nginx                                                           |
| Process manager   | PM2 (avec `pm2-logrotate`)                                      |
| TLS               | Let's Encrypt (Certbot)                                         |
| CI/CD             | GitHub Actions — déploiement depuis `master`                    |
| Stockage fichiers | Cloudflare R2 (voir section 2)                                  |

La migration vers VPS est planifiée dans l'Epic 8, après validation complète sur l'environnement Render.

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
    ├── AuthController.ts          # Login + 2FA
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
│       │   └── TwoFactor.tsx
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
| 3   | Auth admin (session + bcrypt + CSRF)                                 | Étape 2     |
| 4   | 2FA TOTP (activation obligatoire 1ère connexion)                     | Étape 3     |
| 5   | Gestion R2 + upload fichiers                                         | Étape 1     |
| 6   | CRUD Productions (brouillon → publié)                                | Étapes 2, 5 |
| 7   | Site public (listing + détail + recherche tsvector)                  | Étape 6     |
| 8   | Statistiques (vues 10s + téléchargements)                            | Étape 7     |
| 9   | Panel admin stats + logs activité super admin                        | Étapes 6, 8 |
| 10  | SEO (meta tags SSR partiel) + conformité (politique confidentialité) | Étape 7     |

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
│       ├── deploy-public.yml        # [Phase VPS] Rebuild bundle public (chemin : inertia/pages/public/**)
│       ├── deploy-admin.yml         # [Phase VPS] Rebuild bundle admin (chemin : inertia/pages/admin/**)
│       └── deploy-full.yml          # [Phase VPS] Redéploiement complet (chemin : app/models/**, database/**)
│
├── app/
│   ├── controllers/
│   │   ├── public/
│   │   │   ├── HomeController.ts        # FR9 — productions récentes
│   │   │   ├── ProductionsController.ts # FR1–FR8, FR10–FR16 — search, listing, détail
│   │   │   └── StatsController.ts       # FR25–FR26 — enregistrement vues + téléchargements
│   │   └── admin/
│   │       ├── AuthController.ts         # FR30–FR31 — login + 2FA
│   │       ├── ProductionsController.ts  # FR17–FR24 — CRUD + workflow brouillon/publié
│   │       ├── FilesController.ts        # FR18 — upload R2
│   │       ├── StatsController.ts        # FR27–FR29 — stats par production, agrégées, activité admins
│   │       └── UsersController.ts        # FR32–FR34, FR39 — gestion comptes + suppression
│   │
│   ├── middleware/
│   │   ├── auth/
│   │   │   ├── AdminMiddleware.ts        # Guard admin + super_admin
│   │   │   ├── SuperAdminMiddleware.ts   # Guard super_admin uniquement
│   │   │   └── TwoFactorMiddleware.ts    # Redirect si 2FA non activé
│   │   └── SilentAuthMiddleware.ts
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
│   │   ├── ActivityLogService.ts         # Centralisation logs admin
│   │   └── TwoFactorService.ts           # Génération/validation TOTP
│   │
│   ├── validators/
│   │   ├── ProductionValidator.ts        # VineJS — création/édition production
│   │   ├── FileUploadValidator.ts        # Taille max, whitelist MIME
│   │   └── AuthValidator.ts              # Login, 2FA
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
│   │       │   └── TwoFactor.tsx         # FR31 — activation + vérification TOTP
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
| Panel admin | `/admin/`       | `AdminMiddleware` + `TwoFactorMiddleware` | FR17–FR29, FR37, FR39           |
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
| 2FA TOTP         | `app/services/TwoFactorService.ts` via `@adonisjs/2fa`     |

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
deploy-public.yml: # inertia/pages/public/**, app/controllers/public/**
  → build public bundle → rsync → pm2 reload

deploy-admin.yml: # inertia/pages/admin/**, app/controllers/admin/**
  → build admin bundle → rsync → pm2 reload

deploy-full.yml: # app/models/**, database/**, app/services/**, config/**
  → build all → rsync → migration:run → pm2 restart
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
