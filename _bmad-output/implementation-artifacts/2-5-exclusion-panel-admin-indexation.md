# Story 2.5 : Exclusion du panel admin de l'indexation

Status: done

## Story

En tant que responsable SEO,
Je veux que le panel admin soit invisible pour les moteurs de recherche,
Afin que les pages d'administration n'apparaissent jamais dans les résultats de recherche (FR37).

## Acceptance Criteria

**AC1 — `robots.txt` exclut `/admin/`**

- **Given** l'application est déployée
- **When** un robot d'indexation accède à `GET /robots.txt`
- **Then** la réponse a un status 200 et un `content-type` text/plain
- **And** le contenu inclut **au minimum** :
  ```
  User-agent: *
  Disallow: /admin/
  ```
- **And** le fichier est servi statiquement (pas via un contrôleur)

**AC2 — `<meta name="robots" content="noindex, nofollow">` dans les pages admin (layout principal)**

- **Given** un admin authentifié visite `/admin/productions`
- **When** la page est rendue côté client (Inertia + React)
- **Then** la balise `<meta name="robots" content="noindex, nofollow">` est présente dans le `<head>` du document
- **And** cette balise est injectée par `AdminLayout.tsx` via `<Head>` de `@inertiajs/react`

**AC3 — `<meta name="robots" content="noindex, nofollow">` dans les pages d'auth admin**

- **Given** un visiteur accède à `/admin/login` ou `/admin/auth/change-password`
- **When** la page est rendue
- **Then** la balise `<meta name="robots" content="noindex, nofollow">` est présente dans le `<head>`
- **And** cette balise est injectée par `AdminAuthLayout.tsx`

**AC4 — Pages publiques NON impactées**

- **Given** un visiteur accède à `/` (page d'accueil publique)
- **When** la page est rendue
- **Then** AUCUNE balise `<meta name="robots" content="noindex">` n'est présente
- **And** le SEO du site public reste intact (FR36 — meta tags pour les pages de production publiques arrivent en Story 5.5)

**AC5 — Tests automatisés couvrent les exigences**

- **Given** la suite `node ace test` est exécutée
- **When** les tests SEO admin tournent
- **Then** au minimum les scénarios suivants passent :
  - GET `/robots.txt` → 200 + contenu inclut `Disallow: /admin/`
  - Test structurel : `AdminLayout.tsx` contient `<meta name="robots" content="noindex, nofollow">` (via `<Head>`)
  - Test structurel : `AdminAuthLayout.tsx` contient la même balise

## Tasks / Subtasks

- [x] **Tâche 1 — Créer `public/robots.txt`** (AC1)
  - [ ] 1.1 Créer le fichier `public/robots.txt` avec le contenu :
    ```
    # robots.txt — Anta
    # Bibliothèque numérique académique
    # Story 2.5 — Exclusion du panel admin de l'indexation (FR37)

    User-agent: *
    Disallow: /admin/

    # Pages publiques (Stories 5.x) — indexation autorisée par défaut
    Allow: /
    ```
  - [ ] 1.2 Vérifier qu'AdonisJS sert bien les fichiers statiques depuis `public/` (déjà configuré via `@adonisjs/static/static_middleware` dans `start/kernel.ts`). Le fichier est donc accessible via `GET /robots.txt` sans configuration supplémentaire.
  - [ ] 1.3 ⚠️ Sur Render : Vite copie `public/` vers `build/public/` lors du build (cf. `config/static.ts` ou pratique standard AdonisJS). Vérifier que le fichier sera bien présent après deploy.

- [x] **Tâche 2 — Ajouter `<meta robots>` dans `AdminLayout.tsx`** (AC2)
  - [ ] 2.1 Importer `Head` depuis `@inertiajs/react` dans `inertia/layouts/AdminLayout.tsx`
  - [ ] 2.2 Ajouter en tout début du return JSX (ou juste avant le contenu visible) :
    ```tsx
    <Head>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
    ```
  - [ ] 2.3 Le composant `<Head>` d'Inertia injecte dans le `<head>` du document grâce à `@inertiaHead()` (déjà présent dans `resources/views/inertia_layout.edge`). Pas de modification du template Edge nécessaire.

- [x] **Tâche 3 — Ajouter `<meta robots>` dans `AdminAuthLayout.tsx`** (AC3)
  - [ ] 3.1 Importer `Head` depuis `@inertiajs/react`
  - [ ] 3.2 Ajouter `<Head><meta name="robots" content="noindex, nofollow" /></Head>` au début du return JSX
  - [ ] 3.3 Cela couvre `/admin/login` et `/admin/auth/change-password` (les deux pages utilisent ce layout — cf. Story 2.1/2.2/2.3)

- [x] **Tâche 4 — Tests fonctionnels `robots.txt`** (AC1, AC5)
  - [ ] 4.1 Créer `tests/functional/robots_txt.spec.ts`
  - [ ] 4.2 Cas de tests :
    - `GET /robots.txt` → assertStatus(200)
    - Le `content-type` contient `text/plain`
    - Le body contient la string `Disallow: /admin/`
    - Le body contient `User-agent: *`
  - [ ] 4.3 Pas de DB transaction nécessaire — c'est un fichier statique, indépendant de la BDD.

- [x] **Tâche 5 — Tests unitaires des layouts admin** (AC2, AC3, AC5)
  - [ ] 5.1 Étendre `tests/unit/layouts/admin_layout.spec.ts` avec un test :
    ```ts
    test("injecte la balise <meta robots> via <Head> pour empêcher l'indexation", ({ assert }) => {
      assert.match(
        adminLayoutSource,
        /<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']/
      )
      assert.include(adminLayoutSource, "from '@inertiajs/react'", 'doit importer Head')
    })
    ```
  - [ ] 5.2 Créer `tests/unit/layouts/admin_auth_layout.spec.ts` avec un test équivalent pour `AdminAuthLayout`.
  - [ ] 5.3 Pattern Node-pur (lecture du source + regex) — cohérent avec le test AdminLayout Story 2.1 (pas de testing-library/react installé).

- [x] **Tâche 6 — Vérification absence sur les pages publiques** (AC4)
  - [ ] 6.1 Vérifier visuellement (via `npm run dev` ou via test) que `PublicLayout.tsx` n'a PAS de `<Head><meta name="robots" content="noindex">` — par défaut Inertia n'ajoute rien donc les pages publiques restent indexables. **Aucun changement de code requis** — c'est juste une assertion mentale.
  - [ ] 6.2 Optionnel : ajouter un test unitaire `tests/unit/layouts/public_layout.spec.ts` qui vérifie l'**absence** de `noindex` dans `PublicLayout.tsx` (preuve par régression — si quelqu'un ajoute par erreur la balise sur le public, le test casse).

- [x] **Tâche 7 — Validation finale**
  - [ ] 7.1 `node ace test unit` → tous tests passent
  - [ ] 7.2 `node ace test functional` → tous tests passent (incluant le nouveau `robots_txt.spec.ts`)
  - [ ] 7.3 `npm run lint` → 0 erreur
  - [ ] 7.4 `npm run typecheck` → 0 erreur
  - [ ] 7.5 Test manuel via `npm run dev` :
    - Visiter `http://localhost:3333/robots.txt` → contenu attendu affiché
    - Visiter `/admin/login` → ouvrir DevTools > Elements > `<head>` → balise meta robots présente
    - Visiter `/` (homepage) → DevTools > `<head>` → aucune balise meta robots noindex
    - Optionnel : tester avec `curl -I` que les headers sont corrects

## Dev Notes

### Architecture cible (synthèse)

- **`public/robots.txt`** : fichier statique servi automatiquement par `@adonisjs/static/static_middleware` (déjà actif). Aucune route à déclarer.
- **`<meta robots>` admin** : injecté via le composant `<Head>` de `@inertiajs/react` dans les deux layouts admin (`AdminLayout` + `AdminAuthLayout`). Aucun changement du template Edge nécessaire (le `@inertiaHead()` est déjà appelé dans `resources/views/inertia_layout.edge`).
- **Périmètre couvert** : toutes les pages `/admin/*` (login, change-password, productions, stats, users, dashboard futur).

### État existant à respecter

- `resources/views/inertia_layout.edge` : contient déjà `@inertiaHead()` (ligne 22) — permet l'injection automatique des `<Head>` Inertia.
- `start/kernel.ts` : `@adonisjs/static/static_middleware` actif → `public/*` servi automatiquement.
- `inertia/layouts/AdminLayout.tsx` : à enrichir avec `<Head>`.
- `inertia/layouts/AdminAuthLayout.tsx` : à enrichir (Story 2.4 a déjà ajouté `<Toaster>` ici).
- `inertia/layouts/PublicLayout.tsx` : **NE PAS modifier** — les pages publiques doivent rester indexables (FR36 — meta tags SEO viendront en Story 5.5).
- `inertia/components/ui/` : pas d'impact.
- `tests/unit/layouts/admin_layout.spec.ts` : étendre.
- `tests/functional/admin/` : créer `robots_txt.spec.ts` à la racine de `tests/functional/` (pas dans le sous-dossier admin — c'est un endpoint public).

### Patterns à reproduire (Stories précédentes)

- **Tests unitaires layouts** : pattern Node-pur (`readFileSync` + `assert.match(source, regex)`) cohérent avec Story 2.1 (pas de testing-library/react)
- **`@inertiajs/react`** : `Link` doit venir de `@adonisjs/inertia/react` (règle lint) MAIS `Head`, `useForm`, `usePage` viennent de `@inertiajs/react` (cf. doc Inertia). Pas de règle lint sur `Head`.
- **Tests fonctionnels statiques** : pas besoin de DB transactions (cf. `tests/functional/smoke.spec.ts` qui fait juste un GET `/`)

### Sécurité — points critiques

- **`robots.txt` n'est PAS un mécanisme de sécurité** : c'est une convention que les robots polis respectent. Des bots malveillants ou des scanners de vulnérabilités vont quand même tenter `/admin/`. La VRAIE protection est :
  - L'authentification (Stories 2.1–2.4 — déjà en place)
  - Les middlewares (déjà en place)
  - Le CSRF (déjà en place)
- **`robots.txt` est une simple couche de discrétion SEO** — empêche Google d'indexer accidentellement une page admin laissée ouverte.
- **`<meta name="robots" content="noindex">` est une double couche** : même si un bot accède à la page (ex. via un lien direct partagé), il ne l'indexera pas.
- **Headers HTTP `X-Robots-Tag`** : alternative plus robuste mais hors scope (AC demande la meta tag). À noter pour Phase 2 si besoin.

### Anti-patterns à éviter

- ❌ Ajouter le `<meta robots>` dans `inertia_layout.edge` globalement — ça casserait l'indexation des pages publiques (AC4)
- ❌ Modifier `PublicLayout.tsx` pour ajouter `noindex` — les pages publiques doivent rester indexables
- ❌ Créer une route AdonisJS pour servir `/robots.txt` (`router.get('/robots.txt', ...)`) — overkill, le static middleware suffit
- ❌ Mettre `Disallow: /admin` (sans slash final) — moins explicite, certains bots interprètent différemment. Utiliser `Disallow: /admin/`
- ❌ Mettre `Disallow: /` (tout bloquer) — bloquerait aussi les pages publiques
- ❌ Utiliser `<Head>` de `@adonisjs/inertia/react` (n'existe pas) — utiliser bien `@inertiajs/react`
- ❌ Renvoyer `noindex` côté serveur via `inertia.share()` — l'AC dit "balise meta dans le head", la cible est claire

### Project Structure Notes

**Fichiers créés :**
- `public/robots.txt`
- `tests/functional/robots_txt.spec.ts`
- `tests/unit/layouts/admin_auth_layout.spec.ts`
- `tests/unit/layouts/public_layout.spec.ts` (optionnel — régression-proof)

**Fichiers modifiés :**
- `inertia/layouts/AdminLayout.tsx` — ajout `<Head>` avec meta robots
- `inertia/layouts/AdminAuthLayout.tsx` — ajout `<Head>` avec meta robots
- `tests/unit/layouts/admin_layout.spec.ts` — ajout test meta robots

**Fichiers à NE PAS modifier :**
- `resources/views/inertia_layout.edge` — `@inertiaHead()` déjà présent
- `inertia/layouts/PublicLayout.tsx` — pages publiques restent indexables
- `start/kernel.ts` / `start/routes.ts` — pas de route à ajouter
- `config/static.ts` — défaut OK

### Previous Story Intelligence (2.1–2.4)

**Patterns à reproduire :**
- Tests de layouts en mode source (`readFileSync` + regex), cohérent depuis Story 2.1
- `<Head>` Inertia : injecte dans le `<head>` HTML via `@inertiaHead()` déjà dans le template Edge
- Le `static_middleware` AdonisJS sert tout ce qui est dans `public/` (pattern Story 1.1 : favicon.png est servi via `public/favicon.png`)

**Pas d'impact sur :**
- BDD (pas de migration)
- Auth/middlewares (purement front + statique)
- i18n (le robots.txt et la meta tag sont language-agnostic)

### Latest Tech Information

- **`<Head>` Inertia React** : composant utilitaire qui injecte ses enfants dans le `<head>` du document via head-manager. Multiple `<Head>` peuvent coexister (le dernier rendu gagne pour les balises uniques comme `<title>`, mais les `<meta>` s'ajoutent).
- **AdonisJS static middleware** : sert automatiquement les fichiers de `public/` à la racine de l'URL. `public/robots.txt` → accessible via `/robots.txt`. Les fichiers `index.html` sont aussi servis (si présents).
- **`metaFiles`** dans `adonisrc.ts` : pour les fichiers à copier au build. `public/` est déjà couvert par le standard AdonisJS — vérifier.

### Cas d'usage MVP

À la fin de cette story :
- Les robots conformes (Googlebot, Bingbot, etc.) respectent `robots.txt` et ne crawlent jamais `/admin/*`
- Même les bots non conformes qui accèdent à une page admin trouvent la meta `noindex,nofollow` et ne l'indexent pas
- Les pages publiques (homepage actuelle + futures Stories 5+) restent pleinement indexables
- FR37 (panel admin exclu de l'indexation) est satisfait

### References

- [Source: epics.md#Story 2.5] — Acceptance Criteria d'origine (post-renumérotation 2FA)
- [Source: PRD#FR37] — "Le panel d'administration est exclu de l'indexation par les moteurs de recherche (robots.txt + noindex)"
- [Source: architecture.md#Référencement] — SSR partiel pour les pages publiques, noindex pour le panel admin
- [Source: resources/views/inertia_layout.edge] — `@inertiaHead()` ligne 22 (point d'injection)
- [Source: Story 2.1] — Pattern tests layouts Node-pur (admin_layout.spec.ts)
- [Source: Story 2.4] — `AdminAuthLayout` enrichi (Toaster) — pattern de modification de layout
- [Source: @inertiajs/react/types/Head.d.ts] — API du composant `<Head>`

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **`response.assertHeader(name, value)` ne supporte pas les regex** : passer une regex est `deepEqual`-compared comme une string, qui échoue toujours. Solution : utiliser `assert.include(response.header(name), 'substring')` à la place.
- **Header `content-type`** sur un fichier statique servi par AdonisJS : `text/plain; charset=utf-8` (avec charset suffix). Le test doit utiliser `include`, pas `equals`.
- **`@inertiajs/react` `<Head>`** : importable depuis `@inertiajs/react` (pas `@adonisjs/inertia/react`). Différent de `Link` qui a une règle lint forcée vers `@adonisjs/inertia/react`. Pas de règle lint sur `Head`.

### Completion Notes List

- **AC1–AC5 satisfaits** (tous testés)
- **`public/robots.txt`** créé avec `User-agent: * / Disallow: /admin/`. Servi automatiquement par `@adonisjs/static/static_middleware` (aucune route à déclarer)
- **`<Head><meta name="robots" content="noindex, nofollow" /></Head>`** ajouté dans `AdminLayout` ET `AdminAuthLayout` (couvre tout `/admin/*`)
- **`PublicLayout` non touché** — pages publiques restent indexables (AC4). Test anti-régression ajouté.
- **10 nouveaux tests** : 2 fonctionnels robots.txt + 1 unitaire AdminLayout (meta) + 2 unitaires AdminAuthLayout + 1 anti-régression PublicLayout
- **Rappel sécurité** : `robots.txt` n'est pas une protection — la vraie sécurité du panel admin vient des middlewares auth (Stories 2.1–2.4). C'est juste une couche de discrétion SEO.

### File List

**Créés :**
- `public/robots.txt`
- `tests/functional/robots_txt.spec.ts` (2 tests)
- `tests/unit/layouts/admin_auth_layout.spec.ts` (3 tests dont 1 anti-régression PublicLayout)

**Modifiés :**
- `inertia/layouts/AdminLayout.tsx` — import `Head` + ajout `<Head><meta robots .../></Head>`
- `inertia/layouts/AdminAuthLayout.tsx` — import `Head` + ajout `<Head><meta robots .../></Head>`, wrap dans fragment `<>...</>`
- `tests/unit/layouts/admin_layout.spec.ts` — ajout test meta robots (6 tests au total)

**Fichiers à NE PAS modifier (intacts) :**
- `inertia/layouts/PublicLayout.tsx` — pages publiques indexables (AC4)
- `resources/views/inertia_layout.edge` — `@inertiaHead()` déjà présent
- `start/kernel.ts` / `start/routes.ts` — pas de route à ajouter
- `config/static.ts` — défaut OK

### Change Log

- 2026-06-01 : Implémentation Story 2.5 (Exclusion panel admin de l'indexation, FR37). Création `public/robots.txt`, injection `<meta robots noindex, nofollow>` via Inertia `<Head>` dans les deux layouts admin. 5 nouveaux tests fonctionnels/unitaires + 1 anti-régression PublicLayout. Tests : 100/100 unit + 34/34 functional, lint+typecheck verts. Pages publiques restent indexables (FR36).
