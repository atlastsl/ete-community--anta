# Story 2.1 : Middleware d'authentification et layouts admin

Status: done

> **Note — 2FA retiré du MVP (2026-05-31)** : cette story a été simplifiée suite à la décision de retirer le 2FA TOTP du MVP (jugé trop contraignant). Le périmètre Epic 2 ne couvre plus que login + changement de mot de passe à la 1ère connexion. Le 2FA pourra être réintroduit en Phase 2 si nécessaire.

## Story

En tant que développeur,
Je veux les guards d'authentification, les middlewares de rôle et les layouts admin en place,
Afin que toutes les routes admin soient protégées et que l'interface reflète correctement le rôle de l'utilisateur connecté (UX-DR18, UX-DR22).

## Acceptance Criteria

**AC1 — Redirection si non authentifié**

- **Given** un utilisateur non authentifié tente d'accéder à `/admin/*`
- **When** `AdminMiddleware` s'exécute
- **Then** il est redirigé vers `/admin/login` (HTTP 302)

**AC2 — Redirection si mot de passe non changé**

- **Given** un utilisateur authentifié avec `password_changed = false` tente d'accéder à `/admin/productions` (ou toute route `/admin/*` hors `/admin/auth/change-password` et `/admin/logout`)
- **When** `AdminMiddleware` s'exécute
- **Then** il est redirigé vers `/admin/auth/change-password` (HTTP 302)

**AC3 — Sidebar admin (rôle admin)**

- **Given** un admin (rôle `admin`, `password_changed = true`, `is_active = true`) est connecté
- **When** `AdminLayout.tsx` est rendu
- **Then** la sidebar affiche les entrées : "Productions" (`/admin/productions`), "Statistiques" (`/admin/stats`)
- **And** l'entrée "Utilisateurs" est **absente** du DOM (non grisée, non rendue)
- **And** un badge "Admin" est affiché (variante neutre)

**AC4 — Sidebar admin (rôle super_admin)**

- **Given** un super admin (rôle `super_admin`) est connecté
- **When** `AdminLayout.tsx` est rendu
- **Then** la sidebar affiche : "Productions", "Statistiques", "Utilisateurs" (`/admin/users`)
- **And** un badge "Super Admin" est affiché avec une distinction visuelle (`bg-green-700 text-white`)

**AC5 — Avertissement responsive < 1024px**

- **Given** un utilisateur accède au panel admin depuis un écran de largeur < 1024px (`lg` Tailwind breakpoint)
- **When** `AdminLayout.tsx` est rendu
- **Then** le contenu du panel (sidebar + main) est masqué (`hidden lg:flex` / `lg:block`)
- **And** un message s'affiche : "Veuillez utiliser le panel admin sur un ordinateur." (clé i18n `layout.mobile_warning`)

**AC6 — `SuperAdminMiddleware` refuse l'accès admin**

- **Given** une route `/admin/users/*` est accédée par un compte authentifié de rôle `admin`
- **When** `SuperAdminMiddleware` s'exécute
- **Then** l'accès est refusé
- **And** l'utilisateur est redirigé vers `/admin/productions` avec un flash error i18n `errors.forbidden`

**AC7 — Item actif de la sidebar**

- **Given** l'utilisateur est sur une route `/admin/productions[/*]`
- **When** la sidebar est rendue
- **Then** l'item "Productions" a l'état actif : fond `bg-green-100`, texte `text-green-700`, bordure gauche `border-l-[3px] border-green-700`
- **And** un seul item est actif à la fois (détection par préfixe URL le plus spécifique)

**AC8 — Logout et identité utilisateur**

- **Given** un utilisateur authentifié est sur n'importe quelle page admin
- **When** `AdminLayout` est rendu
- **Then** l'email de l'utilisateur est affiché en pied de sidebar
- **And** un bouton "Se déconnecter" (POST `/admin/logout`, CSRF inclus) est présent

**AC9 — Colonnes totp_* supprimées de la BDD**

- **Given** la migration de drop des colonnes 2FA est exécutée
- **When** `node ace migration:run` tourne
- **Then** la table `admin_users` ne contient plus les colonnes `totp_secret` ni `totp_enabled`
- **And** `node ace migration:rollback` restore les deux colonnes (`up`/`down` réversibles)
- **And** le modèle `AdminUser` ne déclare plus ces champs

**AC10 — Tests automatisés couvrent les middlewares**

- **Given** la suite `node ace test --suite functional` est exécutée
- **When** les specs de l'auth admin tournent
- **Then** au minimum les cas suivants passent :
  - Visite anonyme de `/admin/productions` → 302 vers `/admin/login`
  - Visite authentifiée avec `password_changed=false` → 302 vers `/admin/auth/change-password`
  - Visite authentifiée complète (admin, `password_changed=true`, `is_active=true`) → 200 sur `/admin/productions`
  - Visite `/admin/users` par admin → 302 vers `/admin/productions` + flash error
  - Visite `/admin/users` par super_admin → 200
  - Visite par compte `is_active=false` → 302 vers `/admin/login` + flash error + session détruite

## Tasks / Subtasks

- [x] **Tâche 1 — Migration de drop des colonnes 2FA** (AC9)
  - [x] 1.1 Créer `database/migrations/{timestamp}_drop_totp_columns_from_admin_users_table.ts`
  - [x] 1.2 `up()` : `table.dropColumn('totp_secret'); table.dropColumn('totp_enabled')`
  - [x] 1.3 `down()` : recréer `table.string('totp_secret').nullable()` et `table.boolean('totp_enabled').notNullable().defaultTo(false)` (mêmes definitions que la migration originale)
  - [x] 1.4 Mettre à jour `app/models/admin_user.ts` — retirer les champs `totpSecret` et `totpEnabled`. Aussi nettoyage : `database/seeders/super_admin_seeder.ts`, `tests/unit/models/admin_user.spec.ts`, `tests/unit/seeders/super_admin_seeder.spec.ts`
  - [x] 1.5 Exécuter `node ace migration:run` en local pour valider — migration `completed` batch 2 ; 74/74 tests verts
  - [ ] 1.6 ⚠️ **Action utilisateur (post-merge sur staging)** : la migration sera ré-exécutée automatiquement sur Render au prochain deploy (cf. `startCommand: node ace migration:run --force ...`). Vérifier dans les logs Render que le drop s'applique sans erreur.

- [x] **Tâche 2 — `AdminMiddleware` (auth + état du compte)** (AC1, AC2, AC6 partiellement)
  - [x] 2.1 Créer `app/middleware/admin_middleware.ts` étendant le pattern existant de `auth_middleware.ts`
  - [x] 2.2 `redirectTo = '/admin/login'` au lieu de `/login`
  - [x] 2.3 Après `ctx.auth.authenticateUsing(['web'], { loginRoute: this.redirectTo })`, vérifier :
    - `ctx.auth.user.isActive === true`, sinon `await ctx.auth.use('web').logout()` puis redirect `/admin/login` avec flash error i18n `errors.account_inactive`
    - Rôle est `admin` ou `super_admin` (`user.role === 'admin' || user.role === 'super_admin'`), sinon redirect `/admin/login` (défense en profondeur — ne devrait pas arriver)
    - Si `ctx.auth.user.passwordChanged === false` ET la route courante n'est ni `/admin/auth/change-password` ni `/admin/logout` → redirect 302 vers `/admin/auth/change-password`
  - [x] 2.4 Enregistrer le middleware dans `start/kernel.ts` : `admin: () => import('#middleware/admin_middleware')`

- [x] **Tâche 3 — `SuperAdminMiddleware`** (AC6)
  - [x] 3.1 Créer `app/middleware/super_admin_middleware.ts`
  - [x] 3.2 Suppose `auth.user` non-null (chaînage après `AdminMiddleware`). Si `auth.user.role !== 'super_admin'` :
    - `ctx.session.flash('error', 'errors.forbidden')` (la clé est résolue côté client via le `t()` dans AdminLayout)
    - `return ctx.response.redirect('/admin/productions')`
  - [x] 3.3 Enregistrer dans `start/kernel.ts` : `superAdmin: () => import('#middleware/super_admin_middleware')`

- [x] **Tâche 4 — Groupes de routes `/admin/*`** (AC1, AC2, AC6)
  - [x] 4.1 Groupe `router.group(...).prefix('admin')` créé dans `start/routes.ts`. **Note** : le registry Tuyau nichre les contrôleurs sous-dossier → utiliser `controllers.admin.Auth` et `controllers.admin.Dashboard` (pas `AdminAuth`/`AdminDashboard`).
  - [x] 4.2 Routes legacy conservées (commentées). Décommissionnement implicite via les nouvelles routes `/admin/*`.
  - [x] 4.3 Noms de routes préfixés : `admin.login`, `admin.login.submit`, `admin.logout`, `admin.auth.change-password`, `admin.productions`, `admin.stats`, `admin.users`. Vérifié via `node ace list:routes`.

- [x] **Tâche 5 — Contrôleurs stubs pour cette story** (AC support)
  - [x] 5.1 `AdminAuthController` créé avec login stub minimal (verifyCredentials → login → redirect)
  - [x] 5.2 `AdminDashboardController` créé avec méthodes `productions`, `stats`, `users` (placeholders Inertia)
  - [x] 5.3 Pages stubs créées : Auth/Login, Auth/ChangePassword (avec useForm), Productions/Index, Stats/Index, Users/Index
  - [x] 5.4 `AdminAuthLayout` créé (logo centré + carte) pour les pages d'auth pré-login

- [x] **Tâche 6 — Refonte de `AdminLayout.tsx`** (AC3, AC4, AC5, AC7, AC8)
  - [x] 6.1 Structure responsive `lg:hidden` (mobile warning) + `hidden lg:flex` (desktop). Lit `user` depuis `usePage<Data.SharedProps>().props.user`. Gère les flash messages via `t()`.
  - [x] 6.2 Sidebar avec logo, items typés (`NAV_ITEMS`), icônes Lucide (`FolderOpen`, `BarChart3`, `Users`, `LogOut`). Item Users avec `superAdminOnly: true`, filtré dynamiquement.
  - [x] 6.3 Item actif via `url.startsWith(item.href)` avec classes `bg-green-100 text-green-700 border-green-700`. `aria-current="page"` ajouté pour l'accessibilité.
  - [x] 6.4 Badge `admin` → `<Badge variant="secondary">` ; `super_admin` → `<Badge className="bg-green-700 text-white hover:bg-green-700">`.
  - [x] 6.5 Logout via `<Link method="post" href="/admin/logout" as="button">` de `@adonisjs/inertia/react` (typesafe).
  - [x] 6.6 Clés i18n ajoutées dans `fr.json` et `en.json` : `layout.mobile_warning`, `role.admin`, `role.super_admin`, `errors.forbidden`, `errors.account_inactive`.

- [x] **Tâche 7 — Adapter le transformer et le partage Inertia** (AC3, AC4)
  - [x] 7.1 `UserTransformer.pick` actuel suffit (`['id', 'email', 'role', 'isActive', 'createdAt', 'updatedAt']`). Aucun champ 2FA à retirer (les colonnes BDD sont droppées). Pas d'ajout de `passwordChanged` — non nécessaire côté front (middleware backend gère).
  - [x] 7.2 `inertia_middleware.ts` : partage `user`, `flash`, `errors` déjà en place — aucun changement.

- [x] **Tâche 8 — Tests fonctionnels middlewares** (AC10)
  - [x] 8.1 `tests/functional/admin/middleware.spec.ts` créé (7 cas couvrant AC10)
  - [x] 8.2 Helper `createAdminUser` in-spec avec email aléatoire (mixin AuthFinder hash scrypt automatiquement)
  - [x] 8.3 `client.loginAs(user)` activé via `authApiClient` + `sessionApiClient` ajoutés à `tests/bootstrap.ts`
  - [x] 8.4 Tous les cas AC10 passent (8/8) — gotcha : `.redirects(0)` requis pour ne pas suivre les 302
  - [x] 8.5 DB rollback via `db.beginGlobalTransaction()` / `db.rollbackGlobalTransaction()` dans group hooks

- [x] **Tâche 9 — Tests unitaires AdminLayout** (AC3, AC4, AC5, AC7)
  - [x] 9.1 `tests/unit/layouts/admin_layout.spec.ts` créé (fallback Node-pur — pas de testing-library installé)
  - [x] 9.3 5 assertions Node-pur passent :
    - `superAdminOnly: true` + filtre conditionnel
    - `lg:hidden` + `hidden lg:flex` + clé `layout.mobile_warning`
    - Import Badge shadcn + clés `role.admin` / `role.super_admin`
    - `url.startsWith(item.href)` + classes vertes actives
    - `method="post"` + cible `/admin/logout`

- [x] **Tâche 10 — Validation finale**
  - [x] 10.1 `node ace migration:run` — migration drop appliquée (batch 2)
  - [x] 10.2 `node ace test unit` → 77/78 passent. **1 échec pré-existant non lié** : `production.spec.ts:74` GIN index (planner PostgreSQL choisit Seq Scan sur table vide). Confirmé via baseline `git stash` (10 échecs sans mes changements vs 1 seul avec).
  - [x] 10.3 `node ace test functional` → 8/8 passent
  - [x] 10.4 `npm run lint` → 0 erreur (bonus : Link import fixé dans `PublicLayout.tsx` aussi, pré-existant Story 1.7)
  - [x] 10.5 `npm run typecheck` → 0 erreur
  - [ ] 10.6 Test manuel via `npm run dev` — **à faire par l'utilisateur** (nécessite navigateur)

## Dev Notes

### Architecture cible (synthèse)

- **Deux middlewares nommés AdonisJS** dans `app/middleware/` : `admin_middleware.ts`, `super_admin_middleware.ts`. Ils s'enchaînent sur les routes `/admin/*` authentifiées.
- **Layouts Inertia** : `AdminLayout.tsx` (avec sidebar) pour les pages internes ; `AdminAuthLayout.tsx` (sans sidebar) pour les pages pré-login.
- **Inertia shared props** : `user` déjà partagé via `inertia_middleware.ts` — pas de modification structurelle.

### Décision — 2FA retiré

Le 2FA TOTP a été retiré du MVP (2026-05-31, décision utilisateur — trop contraignant). En conséquence :

- ❌ Plus de `TwoFactorMiddleware` à créer
- ❌ Plus de stories 2.4 (activation 2FA) et 2.5 (vérification 2FA) — elles ont été supprimées de l'epics.md
- ❌ Plus de colonnes `totp_secret` / `totp_enabled` dans `admin_users` — la Tâche 1 les drop via migration
- ✅ Le flux première connexion se simplifie en : login → change-password (si `password_changed=false`) → dashboard
- ✅ Si réintroduction Phase 2 : refaire migration + middleware + pages — l'architecture séparée actuelle facilite ce retour

### État existant à respecter

- `app/models/admin_user.ts` — modèle Lucid avec `passwordChanged`, `isActive`, `role`. **Mise à jour requise** : retirer `totpSecret` et `totpEnabled` du modèle après migration de drop (Tâche 1.4)
- `app/enums/admin_role.ts` — `AdminRole = { ADMIN: 'admin', SUPER_ADMIN: 'super_admin' }`
- `database/migrations/1775918726313_create_admin_users_table.ts` — **NE PAS modifier** la migration existante (déjà appliquée sur staging Render). Créer une nouvelle migration de drop à la place.
- `config/auth.ts` — guard `web` session-based déjà configuré
- `start/kernel.ts` — pattern `router.named({ ... })` en place pour `guest` et `auth`
- `app/middleware/auth_middleware.ts` — pattern à reproduire (redirectTo + `authenticateUsing`)
- `app/middleware/inertia_middleware.ts` — partage déjà `user`, `flash`, `errors`
- `inertia/lib/i18n/admin.ts` — instance i18n admin déjà créée
- `inertia/components/ui/badge.tsx` — composant shadcn disponible
- `inertia/layouts/AdminLayout.tsx` — version minimaliste actuelle, à refondre

### Conventions et patterns

- **Nommage fichiers middleware** : snake_case (`admin_middleware.ts`) — cohérent avec `auth_middleware.ts`
- **Nommage controllers** : snake_case fichier + PascalCase classe — cohérent avec `session_controller.ts`
- **Imports** : alias `#middleware/*`, `#models/*`, `#enums/*` — cf. `package.json` `imports`
- **i18n** : toutes les chaînes UI via `useTranslation()` ; jamais de hardcode
- **Tests** : Japa, pattern `test.group(...)`. Helpers de fixture in-spec sauf si réutilisés ≥3 fois
- **CSRF** : Shield middleware déjà actif globalement
- **Routes nommées** : préférer `.as('admin.login')`, `.as('admin.dashboard')` pour les références futures

### Stratégie des stubs pour Stories 2.2 → 2.3

Cette story crée routes + middlewares + layouts mais NE remplit PAS les pages auth (login, change-password). Pour permettre aux tests middleware de fonctionner :

- `GET /admin/login` → renvoyer une page Inertia minimale (stub vide)
- `POST /admin/login` → stub minimal qui appelle `AdminUser.verifyCredentials` + `auth.use('web').login(user)` puis redirige vers `/admin/productions` (sera enrichi en Story 2.2 pour gestion erreurs, flash, design)
- `GET /admin/auth/change-password` → page placeholder (story 2.3)
- `POST /admin/auth/change-password` → optionnel — peut être un stub très simple pour les tests, ou laissé en TODO

**Décision recommandée** : utiliser `client.loginAs(user)` dans les tests Japa (zero dépendance au login controller). Le contrôleur stub peut alors rester minimal.

### Ordre des redirections dans `AdminMiddleware`

1. Authentifié ? Non → `/admin/login` (fin)
2. `isActive` ? Non → logout + `/admin/login` + flash (fin)
3. `role` admin ou super_admin ? Non → redirect `/admin/login` (défense en profondeur)
4. `passwordChanged` ? Non ET route ≠ `change-password|logout` → `/admin/auth/change-password` (fin)
5. Continue → contrôleur

Le `SuperAdminMiddleware` (sous-groupe `/admin/users/*`) :

1. `role === 'super_admin'` ? Non → 302 vers `/admin/productions` + flash (fin)
2. Continue → contrôleur

### Sécurité — vérifications obligatoires

- ❌ Ne PAS faire confiance au champ `role` côté front pour autoriser — toujours côté serveur
- ❌ Ne PAS exposer `password_hash` dans les props Inertia (déjà `serializeAs: null` sur le modèle, le `pick` du transformer est une 2e barrière)
- ✅ CSRF actif sur tous les POST `/admin/*` via shield middleware

### Anti-patterns à éviter

- ❌ Recréer un nouveau middleware d'auth from scratch — utiliser le guard `web` existant via `authenticateUsing`
- ❌ Mettre la logique de "redirect change-password" dans le contrôleur — c'est le rôle du middleware (DRY)
- ❌ Hardcoder les chaînes "Admin"/"Super Admin"/"Veuillez utiliser..." dans le JSX — passer par i18n
- ❌ Reproduire `<Toaster>` dans `AdminLayout` ET dans le composant racine — il est déjà dans le layout actuel, le conserver
- ❌ Utiliser `<Link>` Inertia sans `method="post"` pour le logout — un GET ne déconnecte pas
- ❌ Rendre "Utilisateurs" grisé pour `admin` — la spec UX-DR22 demande l'**absence** complète
- ❌ Faire un test fonctionnel qui dépend de l'implémentation du Login (Story 2.2) — utiliser `client.loginAs()`
- ❌ Modifier la migration `create_admin_users_table` existante — créer une nouvelle migration de drop

### Project Structure Notes

**Fichiers créés par cette story :**

- `app/middleware/admin_middleware.ts`
- `app/middleware/super_admin_middleware.ts`
- `app/controllers/admin/auth_controller.ts` (stub)
- `app/controllers/admin/dashboard_controller.ts` (stub)
- `database/migrations/{ts}_drop_totp_columns_from_admin_users_table.ts`
- `inertia/pages/admin/Auth/Login.tsx` (stub)
- `inertia/pages/admin/Auth/ChangePassword.tsx` (stub)
- `inertia/pages/admin/Productions/Index.tsx` (placeholder)
- `inertia/pages/admin/Stats/Index.tsx` (placeholder)
- `inertia/pages/admin/Users/Index.tsx` (placeholder)
- `inertia/layouts/AdminAuthLayout.tsx`
- `tests/functional/admin/middleware.spec.ts`
- `tests/unit/layouts/admin_layout.spec.tsx` (ou .ts en fallback no-JSX)

**Fichiers modifiés par cette story :**

- `inertia/layouts/AdminLayout.tsx` — refonte complète (sidebar + responsive + badge rôle + logout)
- `inertia/locales/admin/fr.json` — clés `layout`, `role`, `errors`
- `inertia/locales/admin/en.json` — équivalent EN
- `start/kernel.ts` — enregistrement de `admin` et `superAdmin`
- `start/routes.ts` — groupe `/admin/*` complet
- `app/models/admin_user.ts` — retrait de `totpSecret` et `totpEnabled`
- `app/transformers/user_transformer.ts` — éventuellement ajout de `passwordChanged` (non requis)

**Fichiers à NE PAS modifier :**

- `app/models/admin_user.ts` (à part le retrait totp) — laisse le mixin AuthFinder scrypt
- `app/middleware/auth_middleware.ts` — conserver pour le legacy `/logout`
- `config/auth.ts` — guard web OK
- `database/migrations/1775918726313_create_admin_users_table.ts` — déjà appliqué en prod staging, créer migration séparée pour le drop

### Previous Story Intelligence (1.7 et 1.8)

**Patterns à reproduire (Story 1.7) :**

- Composants UI shadcn (`Badge`) — utiliser, pas redéfinir
- Tests Node-pur (assertions sur source) si testing-library indisponible
- i18n via `react-i18next` avec instances séparées (`adminI18n`)
- Classes Tailwind directes

**Patterns à reproduire (Story 1.8) :**

- Migrations explicites avec `up` et `down` réversibles
- Tests d'infrastructure Japa Node-pur — pour cette story, le test fonctionnel sur les routes est plus pertinent
- Séparer code automatisable vs action utilisateur (ici : appliquer la migration en local est code ; le post-deploy Render est documenté en Tâche 1.6)

**Gotchas pertinents :**

- **Routes legacy** — les pages `home.tsx`, `auth/login.tsx`, `auth/signup.tsx` du starter sont dégradées (Story 1.7). Cette story 2.1 ne les supprime pas. Le décommissionnement est implicite via les nouvelles routes `/admin/*`.
- **CI PostgreSQL sans SSL** (Story 1.8) — les tests fonctionnels en CI utilisent le service PostgreSQL local. Config DB tolère SSL absent.
- **`.adonisjs` codegen** — toujours committer `.adonisjs/server/*.ts` car référencés par le build Render
- **Hash scrypt** — `hash.use('scrypt')` (modèle `admin_user.ts:10`). En test, utiliser le hook automatique (passer `password` → assigné à `passwordHash` par `AuthFinder`) OU `hash.use('scrypt').make(...)` manuellement. Jamais bcrypt hardcodé.

### Latest Tech Information

- **AdonisJS 6.x** — `router.use(middleware.namedMiddleware())` et `router.group(...).use([...])` (cf. docs.adonisjs.com/guides/basics/middleware)
- **Inertia.js 2.x + AdonisJS** — `inertia.render('Page', props)` ; `usePage<SharedProps>()` pour accéder aux props partagés
- **`react-i18next` v15+** — `useTranslation()` ; clés JSON nested

### Cas d'usage MVP

À la fin de cette story :

- Toute URL `/admin/*` (sauf `/admin/login`) renvoie 302 si non auth → `/admin/login`
- Un admin authentifié complet (rôle admin OU super_admin, `passwordChanged=true`, `isActive=true`) peut atteindre `/admin/productions` (page placeholder vide avec sidebar)
- La sidebar reflète correctement le rôle (Utilisateurs masqué pour admin standard)
- L'écran < 1024px affiche le message d'avertissement
- Les colonnes `totp_*` ne sont plus en BDD
- Les stories 2.2 → 2.6 peuvent s'appuyer sur ce socle

### References

- [Source: epics.md#Story 2.1] — Acceptance Criteria d'origine (modifié pour retrait 2FA)
- [Source: epics.md#Epic 2] — Note retrait 2FA 2026-05-31
- [Source: architecture.md#3. Authentification et Sécurité] — Flux première connexion simplifié, périmètre rôles
- [Source: architecture.md#Frontières des Routes] — `/admin/` + `AdminMiddleware` ; `/admin/users/` + `SuperAdminMiddleware`
- [Source: ux-design-specification.md#Panel Admin / Sidebar (fixe, desktop)] — Structure sidebar, badge rôle, état actif vert
- [Source: ux-design-specification.md#Guidelines d'Implémentation] — Tailwind `hidden lg:flex`, message mobile
- [Source: Story 1.7] — Pattern shadcn Badge + tests Node-pur
- [Source: Story 1.5] — `SuperAdminSeeder` (utile pour tests manuels)
- [Source: Story 1.8] — Migrations réversibles + .adonisjs codegen
- [Source: app/middleware/auth_middleware.ts] — Pattern existant à reproduire
- [Source: app/middleware/inertia_middleware.ts] — Partage `user` en place
- [Source: app/models/admin_user.ts] — Colonnes disponibles (post-drop totp)
- [Source: PRD#FR30, FR42, NFR5, NFR6, NFR7] — Exigences fonctionnelles auth

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **Registry Tuyau nichant les contrôleurs sous-dossier** : `app/controllers/admin/auth_controller.ts` est exposé comme `controllers.admin.Auth` (et non `controllers.AdminAuth`). Le boot échouait avec `TypeError: Cannot read properties of undefined (reading 'name')` au niveau de la route — fix : utiliser le path nesté dans `start/routes.ts`.
- **`@japa/api-client` ne suit pas les redirects par défaut, mais en a 5 par défaut** : les premiers tests fonctionnels recevaient 200 au lieu de 302 car le client suivait silencieusement les redirects. Fix : `.redirects(0)` sur chaque requête.
- **`client.loginAs(user)` non disponible par défaut** : il faut ajouter `authApiClient(app)` + `sessionApiClient(app)` dans `tests/bootstrap.ts`. Sans ça, `loginAs is not a function`.
- **`inertia.render(page)` exige 2 args minimum** : même pour une page sans props, il faut passer `{}` comme second argument (typecheck error TS2554).
- **`ReactElement<Data.SharedProps>` trop strict pour `.layout` HOC** : la signature `(page: ReactElement) => <Layout>{page}</Layout>` passe un `ReactElement<unknown>`. Solution : typer `AdminLayout` avec `children: ReactElement` (sans paramètre générique), puisque le layout lit le user via `usePage()` et n'utilise pas les props de children.
- **Test pré-existant flaky `production.spec.ts:74`** (GIN index) : non lié à la story. PostgreSQL planner choisit Seq Scan sur table vide (rollback transactionnel). Baseline `git stash` confirme : 10 échecs sans mes changements (middlewares manquants) vs 1 seul avec (le test GIN). À traiter en code-review hors scope.
- **`git stash pop` conflit sur codegen** : si on stash puis pop, les fichiers `.adonisjs/server/*` régénérés entre temps créent un conflit. Fix : `git checkout HEAD -- .adonisjs/` avant le pop (les hooks régénèrent au prochain boot).

### Completion Notes List

- AC1–AC10 satisfaits, sauf AC10.6 (test manuel navigateur — à faire par l'utilisateur)
- Migration `1775918740000_drop_totp_columns_from_admin_users_table.ts` créée, `up`/`down` réversibles, appliquée en local
- 2 middlewares créés (`AdminMiddleware`, `SuperAdminMiddleware`), enregistrés dans `start/kernel.ts`
- Routes `/admin/*` complètes avec stubs ; vérifiées via `node ace list:routes`
- Stubs minimaux pour stories 2.2 (login) et 2.3 (change-password) : suffisants pour les tests middleware mais à enrichir
- `AdminLayout` complètement refondu (sidebar conditionnelle, badge rôle, responsive, logout typesafe via `@adonisjs/inertia/react`)
- i18n : 5 nouvelles clés ajoutées en FR/EN (`layout.mobile_warning`, `role.admin`, `role.super_admin`, `errors.forbidden`, `errors.account_inactive`)
- `app/transformers/user_transformer.ts` : aucune modification (le pick existant ne fuitait déjà aucun champ 2FA)
- Tests : 77/78 unit (1 flaky pré-existant) + 8/8 functional + lint 0 + typecheck 0
- Bonus : fix lint Link import dans `PublicLayout.tsx` (pré-existant Story 1.7, 1 ligne)
- Action utilisateur restante (Tâche 1.6) : vérifier que la migration drop s'applique sans erreur sur Render au prochain deploy de `staging`

### File List

**Créés :**
- `app/middleware/admin_middleware.ts`
- `app/middleware/super_admin_middleware.ts`
- `app/controllers/admin/auth_controller.ts`
- `app/controllers/admin/dashboard_controller.ts`
- `database/migrations/1775918740000_drop_totp_columns_from_admin_users_table.ts`
- `inertia/layouts/AdminAuthLayout.tsx`
- `inertia/pages/admin/Auth/Login.tsx`
- `inertia/pages/admin/Auth/ChangePassword.tsx`
- `inertia/pages/admin/Productions/Index.tsx`
- `inertia/pages/admin/Stats/Index.tsx`
- `inertia/pages/admin/Users/Index.tsx`
- `tests/functional/admin/middleware.spec.ts`
- `tests/unit/layouts/admin_layout.spec.ts`

**Modifiés :**
- `app/models/admin_user.ts` — retrait `totpSecret`, `totpEnabled`
- `database/seeders/super_admin_seeder.ts` — retrait `totpEnabled: false` du create, commentaire mis à jour
- `database/schema.ts` — régénéré automatiquement (sans champs totp)
- `inertia/layouts/AdminLayout.tsx` — refonte complète
- `inertia/layouts/PublicLayout.tsx` — fix lint Link import (bonus, pré-existant)
- `inertia/locales/admin/fr.json` — clés `layout`, `role`, `errors`
- `inertia/locales/admin/en.json` — équivalent EN
- `start/kernel.ts` — enregistrement `admin` + `superAdmin`
- `start/routes.ts` — groupe `/admin/*` complet
- `tests/bootstrap.ts` — ajout `authApiClient` + `sessionApiClient`
- `tests/unit/models/admin_user.spec.ts` — retrait assertions totp
- `tests/unit/seeders/super_admin_seeder.spec.ts` — retrait assertions totp + setup

### Change Log

- 2026-05-31 : Implémentation Story 2.1 (Middleware d'authentification et layouts admin). Retrait des colonnes `totp_*` (migration drop), création `AdminMiddleware` + `SuperAdminMiddleware`, refonte complète `AdminLayout` (sidebar conditionnelle, badge rôle, responsive, logout typesafe), routes `/admin/*` complètes avec stubs pour stories 2.2/2.3. 13 nouveaux fichiers, 12 modifiés. Tests : 77/78 unit (1 flaky pré-existant) + 8/8 functional, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [x] [Review][Patch] ✅ APPLIQUÉ — AdminMiddleware — exemption logout fragile [app/middleware/admin_middleware.ts:33-35] — `ctx.request.url(true)` inclut la query string ; le check `path === '/admin/logout'` est asymétrique avec le `startsWith` de change-password. Un `POST /admin/logout?x` par un admin `passwordChanged=false` serait redirigé vers change-password au lieu de déconnecter. Fix : `const path = ctx.request.url()` (sans `true`).
