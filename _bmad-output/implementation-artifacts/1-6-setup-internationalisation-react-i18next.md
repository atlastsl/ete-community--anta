# Story 1.6 : Setup internationalisation (react-i18next)

Status: review

## Story

En tant que développeur,
Je veux `react-i18next` configuré avec la structure de fichiers de traduction en place,
Afin que tous les textes d'interface soient internationalisables dès le début du développement, sans refactoring ultérieur.

## Acceptance Criteria

**AC1** — Hook `useTranslation` fonctionnel sur les deux apps

- **Given** `react-i18next` est installé et configuré dans `app.tsx` (public) et `admin.tsx` (admin)
- **When** un composant des pages publiques utilise `const { t } = useTranslation()` et `t('nav.search')`
- **Then** la chaîne française est retournée si la langue active est `fr`, l'anglaise si `en`
- **And** la même mécanique fonctionne pour les composants du panel admin avec ses propres clés

**AC2** — Fichiers de traduction structurés

- **Given** la structure de fichiers `inertia/locales/` existe déjà (créée par Story 1.1)
- **When** on inspecte `inertia/locales/`
- **Then** les 4 fichiers JSON existent et sont remplis : `public/fr.json`, `public/en.json`, `admin/fr.json`, `admin/en.json`
- **And** chaque fichier contient au minimum les clés de démonstration : navigation (`nav.*`), actions (`actions.*`), language switcher (`language_switcher.*`)
- **And** `fr.json` et `en.json` ont **exactement les mêmes clés** dans chaque namespace (pas de clé orpheline)

**AC3** — Détection automatique de la langue avec ordre prioritaire

- **Given** aucune préférence n'est définie
- **When** un visiteur charge l'application
- **Then** la langue est résolue dans l'ordre : cookie `i18n_lang` → localStorage `i18n_lang` → langue navigateur → français par défaut
- **And** le choix de l'utilisateur (via `i18n.changeLanguage`) est persisté à la fois dans le cookie `i18n_lang` ET dans localStorage `i18n_lang`
- **And** le cookie `i18n_lang` est lisible côté serveur AdonisJS (path `/`, pas de flag HttpOnly, expiration 1 an)

**AC4** — Tests unitaires

- **Given** la suite de tests est exécutée
- **When** les tests i18n tournent
- **Then** les scénarios suivants passent :
  - Les 4 fichiers JSON sont parsables et non vides
  - Les clés de `public/fr.json` correspondent exactement à celles de `public/en.json` (pas d'orphelins)
  - Idem pour `admin/fr.json` ↔ `admin/en.json`
  - L'instance i18n publique initialise sans erreur
  - L'instance i18n admin initialise sans erreur

## Tasks / Subtasks

- [x] **Tâche 1 — Installer les dépendances i18n** (AC1, AC3)
  - [x] 1.1 `npm install i18next react-i18next i18next-browser-languagedetector`
  - [x] 1.2 Versions confirmées compatibles React 19 : `i18next@26.3.0`, `react-i18next@17.0.8`, `i18next-browser-languagedetector@8.2.1`

- [x] **Tâche 2 — Remplir les fichiers de traduction** (AC2)
  - [x] 2.1 `public/fr.json` rempli (nav, actions, language_switcher)
  - [x] 2.2 `public/en.json` rempli avec les mêmes clés
  - [x] 2.3 `admin/fr.json` et `admin/en.json` remplis
  - [x] 2.4 Aucune clé orpheline (vérifié par test `key parity`)

- [x] **Tâche 3 — Configuration i18n partagée** (AC1, AC3)
  - [x] 3.1 `inertia/lib/i18n/shared.ts` créé avec factory `createI18nInstance(resources)`
  - [x] 3.2 Détection : `cookie → localStorage → navigator`, cookie `i18n_lang`, `sameSite: 'lax'`, 1 an de durée
  - [x] 3.3 `fallbackLng: 'fr'`, `supportedLngs: ['fr', 'en']`, `interpolation.escapeValue: false`, `react.useSuspense: false`

- [x] **Tâche 4 — Instance i18n publique** (AC1)
  - [x] 4.1 `inertia/lib/i18n/public.ts` créé — importe les JSON publiques via alias `~/`, crée l'instance
  - [x] 4.2 `inertia/app.tsx` wrappe avec `<I18nextProvider i18n={publicI18n}>` autour de `<TuyauProvider>`

- [x] **Tâche 5 — Instance i18n admin** (AC1)
  - [x] 5.1 `inertia/lib/i18n/admin.ts` créé — symétrique à `public.ts`
  - [x] 5.2 `inertia/admin.tsx` wrappe avec `<I18nextProvider i18n={adminI18n}>`

- [x] **Tâche 6 — Tests unitaires** (AC4)
  - [x] 6.1 `tests/unit/i18n/translations.spec.ts` créé
  - [x] 6.2 Test min 3 clés top-level par fichier (4 fichiers) — 1 test
  - [x] 6.3 Test parité clés `public/fr` ↔ `public/en` — 1 test
  - [x] 6.4 Test parité clés `admin/fr` ↔ `admin/en` — 1 test (+ test valeurs non vides récursif)
  - [x] 6.5 `tests/unit/i18n/instances.spec.ts` créé
  - [x] 6.6 3 tests instance publique : init+fr, bascule en, clé manquante retourne la clé
  - [x] 6.7 2 tests instance admin : init+fr, bascule en
  - [x] 6.8 `node ace test --suite unit` — **44/44 tests passent** (9 nouveaux + 35 existants)

## Dev Notes

### État actuel de la base de code (à connaître AVANT de coder)

- **Deux entry points React** : `inertia/app.tsx` (public, pages dans `inertia/pages/`) et `inertia/admin.tsx` (admin, pages dans `inertia/pages/admin/`)
- **SSR désactivé** (`config/inertia.ts` → `ssr.enabled: false`) — pas besoin de gérer i18n côté serveur pour cette story
- **`inertia/locales/{public,admin}/{fr,en}.json` existent déjà** mais sont vides (`{}`) — à remplir
- **Pas de testing-library / jsdom** disponible — les tests i18n se limitent à du Node pur (Japa), pas de rendu React
- **Tuyau Provider** wrappe déjà l'app pour la communication API — `I18nextProvider` doit être placé AUTOUR ou À CÔTÉ (les deux marchent ; choix : autour pour que tous les composants enfants aient accès aux deux contextes)
- **Path alias `~/`** mappe sur `inertia/` (cf. `vite.config.ts`)

### Versions des dépendances (état Mai 2026)

- `react-i18next` >= 15.x requis pour React 19
- `i18next` >= 23.x
- `i18next-browser-languagedetector` >= 8.x

Si une version installée ne supporte pas React 19, basculer sur `--legacy-peer-deps` n'est PAS la bonne solution — préférer une version récente compatible.

### Pourquoi 2 instances i18next séparées (pas un seul i18next avec namespaces) ?

**Approche retenue : 2 instances indépendantes** (`createInstance()` × 2).

Raisons :
1. **Isolation des bundles** : chaque entry point (`app.tsx` / `admin.tsx`) ne charge QUE ses traductions. Pas de duplication de clés admin dans le bundle public et vice-versa.
2. **Pas de conflit de namespaces** : `t('nav.home')` côté public et `t('nav.productions')` côté admin sont 2 chemins distincts dans 2 instances distinctes, pas le même namespace par défaut avec des clés différentes.
3. **Code plus simple** : `useTranslation()` sans namespace explicite fonctionne dans chaque contexte.

Alternative non retenue : un seul i18next avec namespaces `public` et `admin`. Plus complexe pour zéro gain pratique vu la séparation déjà nette des bundles.

### Détection langue — Configuration recommandée

```typescript
import LanguageDetector from 'i18next-browser-languagedetector'

const detection = {
  order: ['cookie', 'localStorage', 'navigator'],
  lookupCookie: 'i18n_lang',
  lookupLocalStorage: 'i18n_lang',
  caches: ['cookie', 'localStorage'],
  cookieMinutes: 60 * 24 * 365, // 1 an
  cookieOptions: {
    path: '/',
    sameSite: 'lax' as const,
    // pas de HttpOnly → AdonisJS pourra lire ce cookie côté serveur pour Story 5.5 (SEO meta tags)
  },
}
```

⚠️ **Pourquoi `sameSite: 'lax'`** : permet l'envoi du cookie sur les navigations cross-site sortantes (ex. lien depuis Google), tout en bloquant les requêtes POST cross-site. Compatible avec le SSR partiel d'AdonisJS.

⚠️ **Pas de `HttpOnly`** : intentionnel — JavaScript doit pouvoir lire/écrire le cookie pour la persistence côté client via i18next.

### Configuration i18n complète (template)

```typescript
// inertia/lib/i18n/shared.ts
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import i18next, { type i18n as I18nInstance } from 'i18next'

export type I18nResources = Record<string, { translation: Record<string, unknown> }>

export function createI18nInstance(resources: I18nResources): I18nInstance {
  const instance = i18next.createInstance()

  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'fr',
      supportedLngs: ['fr', 'en'],
      defaultNS: 'translation',
      ns: ['translation'],
      interpolation: { escapeValue: false },
      detection: {
        order: ['cookie', 'localStorage', 'navigator'],
        lookupCookie: 'i18n_lang',
        lookupLocalStorage: 'i18n_lang',
        caches: ['cookie', 'localStorage'],
        cookieMinutes: 60 * 24 * 365,
        cookieOptions: { path: '/', sameSite: 'lax' },
      },
      react: {
        useSuspense: false, // resources inline = synchrone, pas besoin de Suspense
      },
    })

  return instance
}
```

```typescript
// inertia/lib/i18n/public.ts
import { createI18nInstance } from './shared'
import frPublic from '~/locales/public/fr.json'
import enPublic from '~/locales/public/en.json'

export const publicI18n = createI18nInstance({
  fr: { translation: frPublic },
  en: { translation: enPublic },
})
```

```typescript
// inertia/lib/i18n/admin.ts
import { createI18nInstance } from './shared'
import frAdmin from '~/locales/admin/fr.json'
import enAdmin from '~/locales/admin/en.json'

export const adminI18n = createI18nInstance({
  fr: { translation: frAdmin },
  en: { translation: enAdmin },
})
```

### Wrapper dans `app.tsx` et `admin.tsx`

```tsx
// inertia/app.tsx — modification du setup()
import { I18nextProvider } from 'react-i18next'
import { publicI18n } from '~/lib/i18n/public'

createInertiaApp({
  // ...config existante
  setup({ el, App, props }) {
    createRoot(el).render(
      <I18nextProvider i18n={publicI18n}>
        <TuyauProvider client={client}>
          <App {...props} />
        </TuyauProvider>
      </I18nextProvider>
    )
  },
})
```

Idem pour `admin.tsx` avec `adminI18n`.

### Import JSON dans TypeScript + Vite

⚠️ Vite supporte nativement `import frJson from './fr.json'` mais TypeScript exige une déclaration ou `resolveJsonModule: true` dans `tsconfig.json`. Vérifier dans `inertia/tsconfig.json` que cette option est activée (par défaut dans la plupart des templates Vite récents).

Si TS se plaint, ajouter dans `inertia/tsconfig.json` :
```json
{ "compilerOptions": { "resolveJsonModule": true, "esModuleInterop": true } }
```

### Clés de démonstration à insérer

**`inertia/locales/public/fr.json` :**
```json
{
  "nav": {
    "home": "Accueil",
    "search": "Rechercher",
    "privacy_policy": "Politique de confidentialité"
  },
  "actions": {
    "search": "Rechercher",
    "filter": "Filtrer",
    "clear_filters": "Effacer les filtres",
    "download": "Télécharger"
  },
  "language_switcher": {
    "fr": "Français",
    "en": "English",
    "label": "Changer de langue"
  }
}
```

**`inertia/locales/public/en.json` :**
```json
{
  "nav": {
    "home": "Home",
    "search": "Search",
    "privacy_policy": "Privacy Policy"
  },
  "actions": {
    "search": "Search",
    "filter": "Filter",
    "clear_filters": "Clear filters",
    "download": "Download"
  },
  "language_switcher": {
    "fr": "Français",
    "en": "English",
    "label": "Change language"
  }
}
```

**`inertia/locales/admin/fr.json` :**
```json
{
  "nav": {
    "productions": "Productions",
    "statistics": "Statistiques",
    "users": "Utilisateurs",
    "logout": "Se déconnecter"
  },
  "actions": {
    "save": "Enregistrer",
    "cancel": "Annuler",
    "publish": "Publier",
    "delete": "Supprimer"
  },
  "language_switcher": {
    "fr": "Français",
    "en": "English",
    "label": "Changer de langue"
  }
}
```

**`inertia/locales/admin/en.json` :**
```json
{
  "nav": {
    "productions": "Productions",
    "statistics": "Statistics",
    "users": "Users",
    "logout": "Sign out"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "publish": "Publish",
    "delete": "Delete"
  },
  "language_switcher": {
    "fr": "Français",
    "en": "English",
    "label": "Change language"
  }
}
```

⚠️ **Note** : les clés `language_switcher.fr` et `language_switcher.en` contiennent volontairement les noms des langues **dans leur propre langue** (pas dans la langue active). C'est la convention W3C (un Français doit reconnaître "English" comme l'anglais, pas "Anglais"). Donc fr.json et en.json ont les mêmes valeurs pour ces deux clés — c'est volontaire.

### Composant `<LanguageSwitcher />` — Hors scope de cette story

L'épic référence `LanguageSwitcher` via UX-DR9, qui est implémenté en **Story 5.1** (PublicLayout) et 2.1 (AdminLayout). Cette Story 1.6 fournit uniquement l'**infrastructure** i18n. La validation manuelle se fait via DevTools :

```javascript
// Dans la console du navigateur
i18next.changeLanguage('en') // bascule en anglais
i18next.t('nav.search') // doit retourner "Search"
```

Ou via une route de debug temporaire si nécessaire (à retirer avant merge).

### Tests — Stratégie sans testing-library/React

Pas de jsdom configuré dans Anta. Les tests Japa tournent côté Node pur. On teste donc :

**1. Validité structurelle des fichiers JSON** (`tests/unit/i18n/translations.spec.ts`) :

```typescript
import { test } from '@japa/runner'
import frPublic from '../../../inertia/locales/public/fr.json' assert { type: 'json' }
import enPublic from '../../../inertia/locales/public/en.json' assert { type: 'json' }
import frAdmin from '../../../inertia/locales/admin/fr.json' assert { type: 'json' }
import enAdmin from '../../../inertia/locales/admin/en.json' assert { type: 'json' }

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return collectKeys(v as Record<string, unknown>, path)
    }
    return [path]
  })
}

test.group('Translations files', () => {
  test('public fr.json et en.json ont les mêmes clés', ({ assert }) => {
    const frKeys = collectKeys(frPublic).sort()
    const enKeys = collectKeys(enPublic).sort()
    assert.deepEqual(frKeys, enKeys, 'Clés orphelines détectées entre fr et en (public)')
  })

  test('admin fr.json et en.json ont les mêmes clés', ({ assert }) => {
    const frKeys = collectKeys(frAdmin).sort()
    const enKeys = collectKeys(enAdmin).sort()
    assert.deepEqual(frKeys, enKeys, 'Clés orphelines détectées entre fr et en (admin)')
  })

  test('chaque fichier contient au moins 3 clés top-level', ({ assert }) => {
    assert.isAtLeast(Object.keys(frPublic).length, 3)
    assert.isAtLeast(Object.keys(enPublic).length, 3)
    assert.isAtLeast(Object.keys(frAdmin).length, 3)
    assert.isAtLeast(Object.keys(enAdmin).length, 3)
  })
})
```

⚠️ **Import JSON dans Japa** : la syntaxe `assert { type: 'json' }` peut nécessiter Node ≥ 22 ou un flag. Si problème, fallback :
```typescript
import { readFileSync } from 'node:fs'
const frPublic = JSON.parse(readFileSync('inertia/locales/public/fr.json', 'utf-8'))
```

**2. Instances i18n bootent sans erreur** (`tests/unit/i18n/instances.spec.ts`) :

```typescript
import { test } from '@japa/runner'
import { publicI18n } from '../../../inertia/lib/i18n/public.js'
import { adminI18n } from '../../../inertia/lib/i18n/admin.js'

test.group('i18n instances', () => {
  test('publicI18n initialise et résout une clé fr', ({ assert }) => {
    publicI18n.changeLanguage('fr')
    const value = publicI18n.t('nav.search')
    assert.isString(value)
    assert.notEqual(value, 'nav.search', 'la clé ne doit pas être retournée telle quelle')
  })

  test('publicI18n bascule en anglais', ({ assert }) => {
    publicI18n.changeLanguage('en')
    const value = publicI18n.t('nav.search')
    assert.equal(value, 'Search')
  })

  test('adminI18n initialise et résout une clé admin', ({ assert }) => {
    adminI18n.changeLanguage('fr')
    const value = adminI18n.t('nav.productions')
    assert.equal(value, 'Productions')
  })
})
```

⚠️ **`LanguageDetector` côté Node** : tentera de lire des cookies/localStorage qui n'existent pas. Pas grave — il tombera silencieusement sur `fallbackLng: 'fr'`. Le test `changeLanguage()` force la langue explicitement, contournant la détection.

⚠️ **Conflit Vite alias `~/`** : les tests Japa Node n'utilisent pas Vite. Donc les imports via `~/locales/...` ne résoudront PAS. Soit utiliser chemins relatifs (`../../../inertia/locales/...`), soit configurer un alias Node dans `tsconfig.json` du test runner. Pragmatique : chemins relatifs dans les tests.

### ESLint `i18next/no-literal-string` — OPTIONNEL et à valider en cours de dev

L'épic AC4 (originel) mentionne cette règle. Décision pour cette story : **NE PAS l'activer en dur**. Raisons :

- La règle est notoire pour son bruit (signale les `className`, valeurs `aria-*`, props numériques, etc.)
- Compatibilité avec ESLint 10 (installé en 2026) à vérifier — le plugin peut ne pas suivre
- Configurer correctement les `markupOnly`, `onlyValidateJSX`, `ignore` est un projet en soi

**Action pour cette story** : documenter la convention dans le code (commentaire au-dessus de `useTranslation` dans un composant exemple) et dans `CLAUDE.md` du projet :

> "Tout texte d'interface utilisateur DOIT passer par `useTranslation()` et `t('clé.de.traduction')`. Aucune string en dur dans les composants React."

L'utilisateur tranchera plus tard si on installe le plugin ESLint dédié.

### Anti-Patterns à Éviter

- ❌ Charger les JSON via `i18next-http-backend` (HTTP) → ✅ import direct (eager, bundlé, 1 seule requête au lieu de N)
- ❌ Mettre `useSuspense: true` avec resources inline → ✅ `false` (resources synchrones, pas de loading state)
- ❌ Un seul `i18next.init()` partagé entre app.tsx et admin.tsx → ✅ `createInstance()` × 2 (isolation, bundles propres)
- ❌ Cookie i18n avec `HttpOnly: true` → ✅ pas de HttpOnly (JS doit pouvoir l'écrire)
- ❌ Path absolu Windows dans les tests (`C:\\...`) → ✅ chemins relatifs cross-platform
- ❌ `import frJson from './fr.json'` dans les tests Japa via alias `~/` → ✅ chemin relatif `../../../inertia/locales/...`
- ❌ Créer un `<LanguageSwitcher />` dans cette story → ✅ HORS scope, viendra en Story 2.1 (admin) et 5.1 (public)
- ❌ Activer `i18next/no-literal-string` ESLint dès maintenant → ✅ documenter la convention, plugin à évaluer plus tard
- ❌ Mettre les traductions de status en dur (`'draft' | 'published'`) → ✅ ces ENUMs (Story 1.2) sont des valeurs métier, pas des strings UI. La TRADUCTION du statut affiché à l'utilisateur passera par `t('production.status.draft')` dans les composants — pas dans l'enum lui-même.
- ❌ Modifier les fichiers JSON existants vides via `Write` sans confirmer leur format JSON valide → ✅ écrire du JSON parsable d'un coup

### Project Structure Notes

**Fichiers créés par cette story :**
- `inertia/lib/i18n/shared.ts` — factory commune
- `inertia/lib/i18n/public.ts` — instance publique
- `inertia/lib/i18n/admin.ts` — instance admin
- `tests/unit/i18n/translations.spec.ts` — tests structure JSON
- `tests/unit/i18n/instances.spec.ts` — tests instances

**Fichiers modifiés :**
- `inertia/app.tsx` — ajout `<I18nextProvider i18n={publicI18n}>`
- `inertia/admin.tsx` — ajout `<I18nextProvider i18n={adminI18n}>`
- `inertia/locales/public/fr.json` — remplir (actuellement `{}`)
- `inertia/locales/public/en.json` — remplir
- `inertia/locales/admin/fr.json` — remplir
- `inertia/locales/admin/en.json` — remplir
- `package.json` — ajout 3 dépendances (`i18next`, `react-i18next`, `i18next-browser-languagedetector`)
- `inertia/tsconfig.json` — peut nécessiter `resolveJsonModule: true` si pas déjà actif

**Cohérence avec la structure existante :**
- `inertia/lib/` est un nouveau dossier — convention React standard, pas de conflit
- Tests dans `tests/unit/i18n/` — cohérent avec `tests/unit/{models,services,seeders}/`
- Pas de pollution dans `inertia/components/` (qui n'existe pas encore et sera créé en Story 1.7)

### Previous Story Intelligence

**Patterns à reproduire (Stories 1.1 → 1.5) :**
- Installation : `npm install` direct (pas `ace configure` car react-i18next n'est pas un package AdonisJS)
- Variables d'environnement : RAS pour cette story (pas de credentials)
- Tests Japa unit : pattern `test.group()` + `setup()` si BDD nécessaire (ici, non — tests purs)
- Documentation des défauts choisis dans les Dev Notes (cookie name, langue par défaut, etc.)

**Gotchas découverts précédemment et pertinents ici :**
- **`assert.throws()` Japa** attend un constructeur Error ou string/RegExp, pas un prédicat — utiliser try/catch + `assert.instanceOf()` si besoin (cf. Story 1.3, 1.4)
- **Imports `#xxx/yyy`** AdonisJS résolvent vers `./app/xxx/yyy.js` côté serveur — ne fonctionnent PAS dans `inertia/` (qui utilise alias Vite `~/`). Pour les tests Japa qui importent depuis `inertia/`, utiliser chemins relatifs.

### References

- [Source: epics.md#Story 1.6] — Acceptance Criteria de base
- [Source: architecture.md#5. Frontend et UI — Internationalisation] — Stack, langues, cookie name, ordre détection
- [Source: prd.md#FR40, FR41] — Site bilingue FR/EN, persistance choix
- [Source: vite.config.ts] — 2 entry points confirmés
- [Source: config/inertia.ts] — SSR désactivé
- [Source: inertia/app.tsx, inertia/admin.tsx] — Setup actuel à modifier
- [Source: react-i18next docs] — `createInstance()`, `I18nextProvider`, `useTranslation`, `useSuspense: false`
- [Source: i18next-browser-languagedetector docs] — Configuration `detection.order`, `lookupCookie`, `caches`

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- `i18next-browser-languagedetector` n'a PAS crashé en environnement Node lors des tests Japa. Sa détection est paresseuse — elle se déclenche uniquement si `lng` n'est pas défini et qu'on appelle `t()` avant `changeLanguage()`. Les tests appellent `await i18n.changeLanguage('fr')` juste après création → la détection est court-circuitée. Pas besoin de modifier `shared.ts` pour les tests.
- Vite a re-optimisé ses deps au premier run après l'install (notification "Re-optimizing dependencies because lockfile has changed") — premier run lent (~30s avant que les tests démarrent), runs suivants rapides.
- Le test runner reste actif après que les tests sont terminés (Vite garde son serveur ouvert pendant le HMR-watch). Pas de bug, mais nécessite `TaskStop` pour libérer le shell.

### Completion Notes List

- AC1 ✅ `useTranslation` fonctionne dans les deux apps grâce aux `<I18nextProvider>` placés autour de `<TuyauProvider>` dans `app.tsx` et `admin.tsx`
- AC2 ✅ 4 fichiers JSON remplis, parité garantie par les tests
- AC3 ✅ Détection cookie → localStorage → navigator → fr, cookie sans HttpOnly (lisible serveur), `sameSite: 'lax'`, 1 an
- AC4 ✅ 9 tests unitaires (4 structure JSON + 5 instances i18n), **44/44 au total**
- Le composant `<LanguageSwitcher />` reste hors scope (Story 2.1 et 5.1)
- ESLint `i18next/no-literal-string` non installé (volontaire, voir Dev Notes — à évaluer plus tard)

### Change Log

- 2026-05-30 : Implémentation Story 1.6 — infrastructure i18n (i18next + react-i18next + LanguageDetector), 2 instances séparées public/admin, 4 fichiers de traduction remplis, 9 tests unitaires (44/44 total)

### File List

- `inertia/lib/i18n/shared.ts` — créé (factory `createI18nInstance`)
- `inertia/lib/i18n/public.ts` — créé (instance publique)
- `inertia/lib/i18n/admin.ts` — créé (instance admin)
- `tests/unit/i18n/translations.spec.ts` — créé (3 tests structure)
- `tests/unit/i18n/instances.spec.ts` — créé (5 tests instances)
- `inertia/app.tsx` — modifié (wrap `<I18nextProvider i18n={publicI18n}>`)
- `inertia/admin.tsx` — modifié (wrap `<I18nextProvider i18n={adminI18n}>`)
- `inertia/locales/public/fr.json` — rempli (nav, actions, language_switcher)
- `inertia/locales/public/en.json` — rempli
- `inertia/locales/admin/fr.json` — rempli (nav avec productions/statistics/users/logout, actions save/cancel/publish/delete)
- `inertia/locales/admin/en.json` — rempli
- `package.json` — modifié (3 deps i18n ajoutées)
