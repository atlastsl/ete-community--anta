# Story 1.1 : Initialisation du projet AdonisJS + Inertia + React

Status: review

## Story

En tant que développeur,
Je veux un projet AdonisJS 6 initialisé avec Inertia.js, React, TypeScript et Vite configurés,
Afin que l'équipe puisse démarrer le développement sur une base cohérente et typée.

## Acceptance Criteria

**AC1** — Structure de répertoires conforme à l'architecture

- **Given** aucun projet n'existe dans le répertoire cible
- **When** la commande `npm init adonisjs@latest anta -- --kit=inertia --adapter=react --install` est exécutée
- **Then** les répertoires `app/`, `inertia/`, `config/`, `database/`, `start/`, `tests/` existent
- **And** `tsconfig.json` est présent avec le mode strict activé (`"strict": true`)

**AC2** — Double entry point Vite (public + admin)

- **Given** le projet est initialisé
- **When** `vite.config.ts` est configuré
- **Then** `inertia/app/app.tsx` (site public) et `inertia/app/admin.tsx` (panel admin) existent comme entry points distincts

**AC3** — Serveur de développement opérationnel

- **Given** le projet est configuré
- **When** `node ace serve --watch` est exécuté
- **Then** le serveur démarre sans erreur sur le port configuré
- **And** le HMR Vite est fonctionnel (modification d'un fichier `.tsx` se reflète sans reload complet)

**AC4** — Outillage qualité + documentation d'environnement

- **Given** le projet est initialisé
- **When** ESLint et Prettier sont configurés
- **Then** `npm run lint` s'exécute sans erreur sur le code de base
- **And** `npm run format` s'exécute sans erreur
- **And** `.env.example` documente toutes les variables d'environnement requises par l'ensemble du projet

## Tasks / Subtasks

- [x] **Tâche 1 — Initialisation du projet** (AC1)
  - [x] 1.1 Exécuter `npm init adonisjs@latest anta-temp -- --kit=react` (adapté : `--kit=react` remplace `--kit=inertia --adapter=react`, `--install` supprimé car non supporté dans create-adonisjs@3.3.1)
  - [x] 1.2 Vérifier la présence des répertoires : `app/`, `inertia/`, `config/`, `database/`, `start/`, `tests/`
  - [x] 1.3 Vérifier que `tsconfig.json` existe et contient `"strict": true` (ajouté manuellement — absent du kit de base)

- [x] **Tâche 2 — Configuration double entry point Vite** (AC2)
  - [x] 2.1 Créer `inertia/admin.tsx` (adapté : le kit utilise `inertia/app.tsx` et non `inertia/app/app.tsx`)
  - [x] 2.2 Configurer `vite.config.ts` avec les deux entry points (`app.tsx` + `admin.tsx`)
  - [x] 2.3 Vérifier qu'aucun conflit de bundling — `vite build` produit les deux bundles séparés

- [x] **Tâche 3 — Structure de répertoires additionnelle** (Architecture)
  - [x] 3.1 Créer `app/controllers/public/` et `app/controllers/admin/` (`.gitkeep`)
  - [x] 3.2 Créer `app/middleware/auth/` (`.gitkeep`)
  - [x] 3.3 Créer `app/services/`, `app/validators/`, `app/enums/` (`.gitkeep`) — `app/models/` existait déjà
  - [x] 3.4 Créer `inertia/pages/public/` et `inertia/pages/admin/` (`.gitkeep`)
  - [x] 3.5 Créer `inertia/components/public/`, `inertia/components/admin/`, `inertia/components/shared/` (`.gitkeep`)
  - [x] 3.6 `inertia/layouts/` existait déjà (généré par le kit)
  - [x] 3.7 Créer `inertia/locales/{public,admin}/{fr,en}.json` (objets JSON vides `{}`)
  - [x] 3.8 Créer `start/routes/public.ts` et `start/routes/admin.ts` (avec commentaire placeholder)

- [x] **Tâche 4 — Configuration ESLint + Prettier** (AC4)
  - [x] 4.1 `eslint.config.js` et `.prettierignore` existent (générés par le kit — flat config, pas `.eslintrc.json`)
  - [x] 4.2 `npm run lint` passe sans erreur
  - [x] 4.3 `npm run format` passe sans erreur

- [x] **Tâche 5 — Fichier `.env.example`** (AC4)
  - [x] 5.1 `.env.example` complété avec DB, R2, email, TOTP, super admin
  - [x] 5.2 `.env` dans `.gitignore`, `.env.example` n'y est pas

- [x] **Tâche 6 — Vérification serveur de développement** (AC3)
  - [x] 6.1 `.env` généré par l'init avec `APP_KEY` valide
  - [x] 6.2 `node ace serve` et `npm run dev` (HMR) démarrent sans erreur
  - [x] 6.3 HMR confirmé fonctionnel via `npm run dev` (mode `--hmr`)

- [x] **Tâche 7 — Tests de vérification de structure** (Architecture)
  - [x] 7.1 Smoke test écrit dans `tests/functional/smoke.spec.ts` — vérifie GET / → 200
  - [x] 7.2 `node ace test` passe (1 test, 0 échec) — ajout de `@japa/api-client` nécessaire
        /

## Dev Notes

### Commande d'initialisation EXACTE

```bash
npm init adonisjs@latest anta -- --kit=inertia --adapter=react --install
```

⚠️ **NE PAS dévier de cette commande.** L'architecture prescrit exactement ce kit. `--adapter=react` (pas `vue` ni `svelte`). `--install` installe automatiquement les dépendances npm.

### Configuration Vite — Double Entry Point

Le kit AdonisJS + Inertia génère un `vite.config.ts` avec un entry point unique. Il faut l'étendre pour un second entry point admin :

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    adonisjs({
      entrypoints: ['inertia/app/app.tsx', 'inertia/app/admin.tsx'],
      reload: ['resources/views/**/*.edge'],
    }),
    react(),
  ],
})
```

⚠️ La clé est `entrypoints` (tableau) dans le plugin `@adonisjs/vite` — vérifier la syntaxe exacte dans la doc officielle AdonisJS Vite plugin car l'API peut varier selon la version installée.

### Fichier `inertia/admin.tsx`

Adapté depuis `inertia/app.tsx` — résout uniquement `pages/admin/**` :

```typescript
// inertia/admin.tsx
import './css/app.css'
import { ReactElement } from 'react'
import { client } from './client'
import { Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

const appName = import.meta.env.VITE_APP_NAME || 'Anta Admin'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    return resolvePageComponent(
      `./pages/admin/${name}.tsx`,
      import.meta.glob('./pages/admin/**/*.tsx')
    )
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <TuyauProvider client={client}>
        <App {...props} />
      </TuyauProvider>
    )
  },
  progress: {
    color: '#15803d', // green-700 — couleur primaire Anta (UX spec)
  },
})
```

**Notes de correction (charte graphique Anta) :**

- `progress.color` → `#15803d` (green-700) — correspond à la couleur primaire issue du logo Anta
- `{ eager: true }` supprimé — non supporté par le linter AdonisJS flat config
- `await import('react-dom/client')` supprimé — import statique en haut du fichier (convention AdonisJS)
- `createElement` supprimé — JSX utilisé directement via TuyauProvider

L'entry point public résout `pages/**`, l'entry point admin résout `pages/admin/**` — **aucun chevauchement**.

### TypeScript Strict Mode

Le kit génère un `tsconfig.json`. Vérifier que `"strict": true` est présent sous `compilerOptions`. Si absent, l'ajouter :

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### Structure de Fichiers à Créer (au-delà du kit)

Le kit AdonisJS génère la structure de base, mais les sous-répertoires de l'architecture doivent être créés manuellement :

```
app/controllers/public/     # Contrôleurs site public
app/controllers/admin/      # Contrôleurs panel admin
app/middleware/auth/         # Guards AdminMiddleware, SuperAdminMiddleware, TwoFactorMiddleware
app/services/                # ProductionService, SearchService, FileStorageService, etc.
app/validators/              # VineJS validators
app/enums/                   # ProductionStatus, LicenseStatus, AdminRole

inertia/pages/public/        # Pages React site public
inertia/pages/admin/         # Pages React panel admin
inertia/components/public/   # Composants site public
inertia/components/admin/    # Composants panel admin
inertia/components/shared/   # Composants partagés (Pagination)
inertia/layouts/             # PublicLayout, AdminLayout

inertia/locales/public/fr.json
inertia/locales/public/en.json
inertia/locales/admin/fr.json
inertia/locales/admin/en.json

start/routes/public.ts       # Routes site public
start/routes/admin.ts        # Routes panel admin
```

**Les fichiers `.gitkeep` sont acceptables pour les répertoires vides à ce stade.**

### `.env.example` — Variables Requises (Tout le Projet)

```env
# Application
TZ=UTC
PORT=3333
HOST=localhost
LOG_LEVEL=info
APP_KEY=                          # node ace generate:key
APP_NAME=Anta
APP_URL=http://localhost:3333
NODE_ENV=development

# Base de données (PostgreSQL)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_DATABASE=anta

# Sessions
SESSION_DRIVER=cookie
SESSION_AGE=2h                    # Expiration 2h d'inactivité (NFR)

# Cloudflare R2 (Epic 1, Story 1.3)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=anta-productions
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=                    # URL publique du bucket (si configuré)

# Email — Resend (principal) / Mailgun (backup)
MAIL_DRIVER=resend
RESEND_API_KEY=
MAILGUN_API_KEY=
MAIL_FROM_ADDRESS=noreply@anta.community
MAIL_FROM_NAME=Anta

# 2FA TOTP (Epic 2)
TOTP_APP_NAME=Anta

# Super Admin initial (Epic 1, Story 1.5)
SUPER_ADMIN_EMAIL=admin@anta.community
SUPER_ADMIN_PASSWORD=             # Sera hashé via bcrypt au seeding
```

### Conventions Obligatoires (Architecture)

Ces règles s'appliquent dès la première ligne de code :

| Élément                   | Convention               | Exemple                      |
| ------------------------- | ------------------------ | ---------------------------- |
| Tables PostgreSQL         | `snake_case` pluriel     | `admin_users`, `productions` |
| Colonnes PostgreSQL       | `snake_case`             | `created_by_id`, `is_active` |
| Fichiers contrôleurs      | `PascalCase` + suffixe   | `ProductionsController.ts`   |
| Fichiers composants React | `PascalCase.tsx`         | `ProductionCard.tsx`         |
| Fonctions TypeScript      | `camelCase`              | `getRecentProductions()`     |
| États booléens            | préfixe `is` obligatoire | `isLoading`, `isSubmitting`  |

### Anti-Patterns à Éviter dès le Setup

- ❌ Un seul entry point Vite pour public et admin → ✅ deux entry points séparés
- ❌ Pages admin dans `inertia/pages/` (racine) → ✅ `inertia/pages/admin/`
- ❌ `strict: false` ou absence de `strict` dans `tsconfig.json`
- ❌ `.env` commité dans git → ✅ uniquement `.env.example`
- ❌ Strings en dur dans les composants React → ✅ `react-i18next` (les fichiers locales vides sont créés ici pour Story 1.6)

### Scope de cette Story (Ce qui N'est PAS inclus)

| Hors scope Story 1.1                   | Couvert par |
| -------------------------------------- | ----------- |
| Migrations PostgreSQL et modèles Lucid | Story 1.2   |
| Configuration Cloudflare R2            | Story 1.3   |
| Configuration service email            | Story 1.4   |
| Seeder super administrateur            | Story 1.5   |
| Configuration react-i18next            | Story 1.6   |
| Design system Tailwind v4 + shadcn/ui  | Story 1.7   |
| Workflows GitHub Actions CI/CD         | Story 1.8   |

**Créer les répertoires et fichiers de locales vides pour poser la structure — mais ne pas configurer react-i18next (c'est Story 1.6).**

### Références

- [Source: architecture.md#Template Sélectionné] — Commande d'initialisation exacte
- [Source: architecture.md#Structure Cible du Dépôt] — Arborescence complète avec mapping FR → fichiers
- [Source: architecture.md#Double entry point Vite] — Pattern vite.config.ts avec deux entrypoints
- [Source: architecture.md#Internationalisation] — Localisation des fichiers `inertia/locales/`
- [Source: architecture.md#Conventions de Nommage] — Toutes les conventions TypeScript/PostgreSQL
- [Source: architecture.md#6. Infrastructure et Déploiement] — Variables d'environnement requises
- [Source: epics.md#Story 1.1] — Acceptance Criteria complets

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

- Commande d'init adaptée : `--kit=react` (AdonisJS 2026 unifie `inertia+react` sous `--kit=react`), `--adapter` et `--install` supprimés car non supportés dans create-adonisjs@3.3.1
- Projet initialisé dans `anta-temp/` puis copié dans `anta/` car le répertoire existait déjà (fichiers BMad)
- `package.json` renommé de `anta-temp` à `anta`
- Entry points Vite : `inertia/app.tsx` (public) + `inertia/admin.tsx` (admin) — le kit utilise `inertia/app.tsx` et non `inertia/app/app.tsx` comme supposé dans l'architecture
- `strict: true` ajouté manuellement dans `tsconfig.json` — absent de `@adonisjs/tsconfig/tsconfig.app.json`
- `@japa/api-client` ajouté et configuré dans `tests/bootstrap.ts` pour les tests fonctionnels HTTP (absent du kit React qui ne configure que `browserClient`)
- Kit fournit `eslint.config.js` (flat config) et non `.eslintrc.json` — Prettier intégré via eslint-plugin-prettier
- Kit inclut `@adonisjs/inertia/vite` (plugin Inertia) en plus de `@adonisjs/vite/client` — conservé
- **Correction charte graphique (2026-04-05)** : `progress.color` mis à jour `#4B5563` → `#15803d` (green-700) dans `app.tsx` et `admin.tsx` — aligne la barre de progression Inertia avec la couleur primaire du logo Anta
- **Correction appName** : fallback `'AdonisJS'` → `'Anta'` dans `app.tsx`
- **`VITE_APP_NAME=Anta`** ajouté dans `.env.example`

### Change Log

- 2026-04-05 : Story 1.1 implémentée — projet AdonisJS 6 + Inertia + React initialisé, double entry point Vite, structure complète, smoke test passant
- 2026-04-05 : Correction charte graphique — progress.color → #15803d (green-700), appName fallback → 'Anta', VITE_APP_NAME ajouté dans .env.example

### File List

- ace.js
- adonisrc.ts
- eslint.config.js
- package.json (renommé anta-temp → anta)
- package-lock.json
- tsconfig.json (ajout strict: true)
- tsconfig.inertia.json
- vite.config.ts (ajout second entrypoint admin.tsx)
- .editorconfig
- .env
- .env.example (complété avec toutes variables projet)
- .env.test
- .gitignore
- .prettierignore
- inertia/app.tsx
- inertia/admin.tsx (créé — entry point admin)
- inertia/client.ts
- inertia/ssr.tsx
- inertia/types.ts
- inertia/css/app.css
- inertia/layouts/default.tsx
- inertia/pages/home.tsx
- inertia/pages/errors/not_found.tsx
- inertia/pages/errors/server_error.tsx
- inertia/pages/auth/login.tsx
- inertia/pages/auth/signup.tsx
- inertia/pages/public/.gitkeep
- inertia/pages/admin/.gitkeep
- inertia/components/public/.gitkeep
- inertia/components/admin/.gitkeep
- inertia/components/shared/.gitkeep
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- app/controllers/public/.gitkeep
- app/controllers/admin/.gitkeep
- app/middleware/auth/.gitkeep
- app/services/.gitkeep
- app/validators/.gitkeep
- app/enums/.gitkeep
- start/routes/public.ts
- start/routes/admin.ts
- tests/bootstrap.ts (ajout apiClient plugin)
- tests/functional/smoke.spec.ts (créé)
