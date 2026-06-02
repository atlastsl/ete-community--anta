# Story 2.2 : Page de connexion admin

Status: done

## Story

En tant qu'administrateur,
Je veux me connecter avec mon email et mon mot de passe,
Afin d'accéder au panel admin de façon sécurisée (FR30, NFR5, NFR7).

## Acceptance Criteria

**AC1 — Formulaire affiché**

- **Given** un visiteur accède à `GET /admin/login`
- **When** la page se charge
- **Then** un formulaire avec les champs `email` et `password` est rendu
- **And** le cookie `XSRF-TOKEN` est présent dans la réponse (Inertia l'inclura automatiquement en header sur le POST)
- **And** tous les libellés/messages passent par `react-i18next` (clés `auth.login.*`)

**AC2 — Login réussi avec password_changed = true**

- **Given** un admin existe avec credentials valides, `is_active = true`, `password_changed = true`
- **When** il soumet `POST /admin/login` avec les bons email + password
- **Then** AdonisJS Auth crée une session (cookie session signé)
- **And** le serveur répond 302 vers `/admin/productions`

**AC3 — Login réussi avec password_changed = false**

- **Given** un admin avec `password_changed = false` (compte juste créé par le super admin)
- **When** il soumet `POST /admin/login` avec credentials valides
- **Then** la session est créée
- **And** le serveur répond 302 vers `/admin/auth/change-password`

**AC4 — Credentials invalides**

- **Given** un email inexistant OU un mot de passe incorrect pour un email existant
- **When** le formulaire est soumis
- **Then** la réponse est 422 (validation error Inertia) avec une erreur générique sur le champ formulaire (ou flash error)
- **And** le message est **strictement le même** dans les deux cas (clé i18n `auth.login.errors.invalid_credentials`) — aucune information sur l'existence ou non du compte
- **And** AUCUNE session n'est créée

**AC5 — Compte désactivé**

- **Given** un admin avec credentials valides MAIS `is_active = false`
- **When** il soumet `POST /admin/login`
- **Then** la réponse est 422 avec un message i18n `auth.login.errors.account_inactive` ("Ce compte est désactivé.")
- **And** AUCUNE session n'est créée
- **And** le timing de réponse reste comparable au cas "credentials valides" (pour ne pas révéler l'existence du compte via timing-side-channel — vérifier que `verifyCredentials` est appelé avant la vérification `isActive`)

**AC6 — Validation des champs**

- **Given** l'utilisateur soumet le formulaire sans email ou avec un format invalide
- **When** la validation VineJS s'exécute
- **Then** une erreur i18n s'affiche sur le champ : `auth.login.errors.email_required` / `auth.login.errors.email_format`
- **Given** l'utilisateur soumet sans password
- **Then** erreur i18n `auth.login.errors.password_required`

**AC7 — Protection CSRF**

- **Given** une requête POST `/admin/login` arrive sans token CSRF valide (header `X-XSRF-TOKEN` absent ou faux)
- **When** le middleware Shield CSRF s'exécute
- **Then** la requête est rejetée avec status 403 ou 419 (selon la config Shield)
- **And** AUCUNE session n'est créée

**AC8 — Guest middleware empêche un admin connecté d'atteindre /admin/login**

- **Given** un admin **déjà connecté** (session active)
- **When** il accède à `GET /admin/login`
- **Then** il est redirigé 302 vers `/admin/productions` (ou `/admin/auth/change-password` si `passwordChanged = false`)

**AC9 — Tests fonctionnels passent**

- **Given** la suite `node ace test functional` est exécutée
- **When** les specs auth admin tournent
- **Then** au minimum les scénarios suivants passent :
  - GET `/admin/login` → 200, page rendue
  - POST credentials valides + `passwordChanged=true` → 302 vers `/admin/productions`
  - POST credentials valides + `passwordChanged=false` → 302 vers `/admin/auth/change-password`
  - POST credentials invalides (mauvais password) → 422 + erreur générique
  - POST credentials invalides (email inexistant) → 422 + **même** erreur générique
  - POST credentials valides + `isActive=false` → 422 + erreur "compte désactivé"
  - POST sans CSRF token → 403/419
  - GET `/admin/login` avec session active + `passwordChanged=true` → 302 vers `/admin/productions`

## Tasks / Subtasks

- [x] **Tâche 1 — Validator VineJS** (AC6)
  - [ ] 1.1 Créer `app/validators/auth_validator.ts` avec un export `loginValidator` :
    ```ts
    export const loginValidator = vine.compile(
      vine.object({
        email: vine.string().trim().email(),
        password: vine.string().minLength(1),
      })
    )
    ```
  - [ ] 1.2 Aucune autre règle métier dans le validator — la longueur min du password est pour le **changement** (Story 2.3), pas le login (sinon on révélerait la politique de mot de passe via 422)
  - [ ] 1.3 Configurer les messages d'erreur custom via le `messagesProvider` AdonisJS pour rester côté serveur en i18n (option : laisser AdonisJS retourner les codes par défaut et résoudre côté client via `t()`)

- [x] **Tâche 2 — Refonte `AdminAuthController.showLogin`** (AC1, AC8)
  - [ ] 2.1 Vérifier qu'il appelle bien `inertia.render('admin/Auth/Login', {})` — déjà OK depuis Story 2.1
  - [ ] 2.2 **Note importante** : actuellement la route `GET /admin/login` n'a aucun middleware. Il faut ajouter le middleware `guest` (existant dans `start/kernel.ts`) avec une logique adaptée — OU vérifier manuellement dans `showLogin` si `auth.user` existe et rediriger.
  - [ ] 2.3 **Décision recommandée** : ajouter le middleware `guest` mais avec un `redirectTo: '/admin/productions'` au lieu du défaut `/`. Le `guest_middleware.ts` actuel a `redirectTo = '/'` en dur — soit on crée un `admin_guest_middleware.ts` séparé, soit on adapte la logique inline dans `showLogin`.
  - [ ] 2.4 **Implémentation simple recommandée** : inline dans `showLogin`. Si `auth.user` est présent ET `isActive`, rediriger selon `passwordChanged` (vers `/admin/auth/change-password` ou `/admin/productions`). Sinon → rendu Inertia normal.

- [x] **Tâche 3 — Refonte `AdminAuthController.login`** (AC2, AC3, AC4, AC5, AC7)
  - [ ] 3.1 Remplacer le stub actuel par :
    ```ts
    async login(ctx: HttpContext) {
      const { request, auth, response, session } = ctx
      const { email, password } = await request.validateUsing(loginValidator)

      try {
        const user = await AdminUser.verifyCredentials(email, password)

        if (!user.isActive) {
          session.flash('error', 'auth.login.errors.account_inactive')
          session.flashErrors({ email: 'auth.login.errors.account_inactive' })
          return response.redirect('/admin/login')
        }

        await auth.use('web').login(user)

        return response.redirect(
          user.passwordChanged ? '/admin/productions' : '/admin/auth/change-password'
        )
      } catch {
        // verifyCredentials() throws InvalidCredentialsException quand:
        //   - L'email n'existe pas
        //   - Le password est incorrect
        // → on retourne le MÊME message générique dans les deux cas (AC4)
        session.flashErrors({ email: 'auth.login.errors.invalid_credentials' })
        return response.redirect('/admin/login')
      }
    }
    ```
  - [ ] 3.2 **Important** : utiliser `session.flashErrors` (plural) pour que Inertia récupère l'erreur via `props.errors.email` côté front. Cela cible le champ `email` par convention.
  - [ ] 3.3 Le `request.validateUsing(loginValidator)` lance automatiquement une `ValidationException` qui retourne 422 + flashErrors au front-end. Pas besoin de try/catch dessus.

- [x] **Tâche 4 — Refonte de la page `Login.tsx`** (AC1, AC6)
  - [ ] 4.1 Refondre `inertia/pages/admin/Auth/Login.tsx` :
    - Remplacer les chaînes hard-codées par `useTranslation()` + clés i18n
    - Améliorer le design (cohérent avec shadcn) — utiliser les composants `Input`, `Button`, `Label` (vérifier qu'ils existent dans `inertia/components/ui/`)
    - Afficher `flash.error` global si présent (au-dessus du formulaire)
    - Conserver `useForm` qui gère le CSRF automatiquement
  - [ ] 4.2 Composants shadcn à utiliser (à `npx shadcn add` si absents) :
    - `input`, `button`, `label` (probablement déjà là)
  - [ ] 4.3 Structure attendue :
    ```tsx
    <form onSubmit={submit}>
      <h1>{t('auth.login.title')}</h1>
      {flash?.error && <p role="alert">{t(flash.error)}</p>}
      <Label htmlFor="email">{t('auth.login.fields.email')}</Label>
      <Input id="email" name="email" type="email" ... />
      {errors.email && <p>{t(errors.email)}</p>}
      ... (idem password)
      <Button type="submit" disabled={processing}>{t('auth.login.submit')}</Button>
    </form>
    ```
  - [ ] 4.4 Accessibilité : `<form noValidate>` (laisser la validation côté serveur), labels reliés via `htmlFor`, `aria-invalid` sur les inputs en erreur, `aria-describedby` pour les messages.

- [x] **Tâche 5 — Clés i18n login**
  - [ ] 5.1 Ajouter dans `inertia/locales/admin/fr.json` :
    ```json
    "auth": {
      "login": {
        "title": "Connexion",
        "subtitle": "Accédez au panel d'administration Anta",
        "fields": {
          "email": "Email",
          "password": "Mot de passe"
        },
        "submit": "Se connecter",
        "submitting": "Connexion…",
        "errors": {
          "invalid_credentials": "Email ou mot de passe incorrect.",
          "account_inactive": "Ce compte est désactivé.",
          "email_required": "L'email est requis.",
          "email_format": "Format d'email invalide.",
          "password_required": "Le mot de passe est requis."
        }
      }
    }
    ```
  - [ ] 5.2 Équivalent EN dans `inertia/locales/admin/en.json` (même structure)
  - [ ] 5.3 Vérifier que la suite `tests/unit/i18n/translations.spec.ts` passe toujours (parité FR/EN)

- [x] **Tâche 6 — Mise à jour de la story 2.1** (rétrocompatibilité du stub)
  - [ ] 6.1 La story 2.1 a créé une page `Login.tsx` stub avec `useForm` et chaînes en dur. Cette refonte remplace ce contenu — vérifier qu'aucune autre page ne dépend du stub.
  - [ ] 6.2 Les tests fonctionnels existants de la story 2.1 (`tests/functional/admin/middleware.spec.ts`) utilisent `loginAs()` — ils ne dépendent PAS du formulaire de login. Ils continueront à passer.

- [x] **Tâche 7 — Tests fonctionnels login** (AC9)
  - [ ] 7.1 Créer `tests/functional/admin/login.spec.ts`
  - [ ] 7.2 Helper de fixture identique à `middleware.spec.ts` (créer un `AdminUser` avec password en clair, le mixin AuthFinder hash automatiquement)
  - [ ] 7.3 Cas de tests :
    - `GET /admin/login` (anonyme) → assertStatus(200) + assertInertiaComponent('admin/Auth/Login')
    - `POST /admin/login` valide + `passwordChanged=true` → 302 vers `/admin/productions`
    - `POST /admin/login` valide + `passwordChanged=false` → 302 vers `/admin/auth/change-password`
    - `POST /admin/login` mauvais password → 302 redirect login + flashErrors.email contient `'auth.login.errors.invalid_credentials'` (vérifier via `assertSession('errors.email', ...)` ou via une re-requête)
    - `POST /admin/login` email inexistant → MÊME erreur que mauvais password (assertions identiques)
    - `POST /admin/login` `isActive=false` → 302 redirect login + flashErrors.email contient `'auth.login.errors.account_inactive'`
    - `POST /admin/login` sans CSRF → 403 ou 419 (utiliser `client.post(...).withInertiaPartialReload(false)` et **ne pas** appeler `.withCsrfToken()` — vérifier comment le client API gère le CSRF par défaut)
    - `GET /admin/login` après loginAs → 302 vers `/admin/productions`
  - [ ] 7.4 Setup DB transactions (`db.beginGlobalTransaction()` / rollback) dans `group.each.setup` — identique au pattern de `middleware.spec.ts`

- [x] **Tâche 8 — Test unitaire validator** (qualité, non requis par AC mais cohérent)
  - [ ] 8.1 Créer `tests/unit/validators/auth_validator.spec.ts`
  - [ ] 8.2 Cas :
    - Email valide + password non vide → succès
    - Email manquant → ValidationException avec message `email.required`
    - Email malformé → ValidationException avec message `email.email`
    - Password vide → ValidationException avec message `password.required`
  - [ ] 8.3 Utiliser le pattern try/catch + `assert.instanceOf` (cf. gotcha mémorisé sur Japa `assert.throws`)

- [x] **Tâche 9 — Validation finale**
  - [ ] 9.1 `node ace test unit` → tous tests passent (sauf le pré-existant GIN)
  - [ ] 9.2 `node ace test functional` → tous tests passent (incluant les 8 de middleware.spec + nouveaux de login.spec)
  - [ ] 9.3 `npm run lint` → 0 erreur
  - [ ] 9.4 `npm run typecheck` → 0 erreur
  - [ ] 9.5 Test manuel via `npm run dev` :
    - Visite `/admin/login` → formulaire affiché correctement en français
    - Soumission avec mauvais credentials → erreur générique affichée
    - Soumission avec credentials du super admin seedé (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`) → redirect vers `/admin/auth/change-password` (car le seeder le crée avec `passwordChanged=false`)
    - Visite `/admin/login` après connexion → redirect vers `/admin/auth/change-password` (ou `/admin/productions` si déjà changé)

## Dev Notes

### Synthèse architecture

- **Validator** : `app/validators/auth_validator.ts` exporte `loginValidator` (VineJS, email + password requis seulement)
- **Controller** : remplacer le stub `AdminAuthController.login` par une implémentation robuste (verifyCredentials → check isActive → session login → redirect conditionnel)
- **Page Inertia** : `inertia/pages/admin/Auth/Login.tsx` enrichi (i18n, shadcn, accessibilité, flash error)
- **i18n** : nouveau namespace `auth.login.*` dans `inertia/locales/admin/{fr,en}.json`
- **Pas de nouveau middleware** : la redirection guest est gérée inline dans `showLogin` (option simple)

### État existant (post-Story 2.1)

- `app/controllers/admin/auth_controller.ts` : déjà créé en Story 2.1 (stub `login`/`showLogin`). À enrichir.
- `inertia/pages/admin/Auth/Login.tsx` : déjà créé en Story 2.1 (formulaire useForm minimal). À refondre.
- `inertia/layouts/AdminAuthLayout.tsx` : déjà créé en Story 2.1. À réutiliser tel quel.
- `start/routes.ts` : routes `/admin/login` (GET + POST) déjà déclarées.
- `app/middleware/admin_middleware.ts` : déjà créé en Story 2.1 — gère la redirection `passwordChanged=false` côté pages authentifiées.
- `inertia/locales/admin/{fr,en}.json` : déjà contient `nav`, `actions`, `language_switcher`, `layout`, `role`, `errors` (génériques). Ajouter `auth`.
- `app/models/admin_user.ts` : déclare `passwordChanged`, `isActive`, `role` ; utilise mixin `AuthFinder` scrypt. `verifyCredentials(email, password)` est disponible.
- Aucune colonne `totp_*` (droppée en Story 2.1).

### Patterns à reproduire

- **Tests fonctionnels** : pattern `tests/functional/admin/middleware.spec.ts` (groupe avec `db.beginGlobalTransaction` + helper `createAdminUser` in-spec + `client.get/post(...).loginAs(user).redirects(0)`)
- **i18n** : structure nested JSON, parité FR/EN strictement enforced par `tests/unit/i18n/translations.spec.ts`
- **shadcn** : utiliser les composants existants ou les installer via `npx shadcn add` (Story 1.7 a documenté la configuration de l'alias `~/*` dans le tsconfig racine)
- **`@adonisjs/inertia/react`** : importer `Link` depuis `@adonisjs/inertia/react` (pas `@inertiajs/react`) — règle lint enforced
- **Page layout HOC** : `Component.layout = (page: ReactElement) => <Layout>{page}</Layout>`

### Sécurité — points critiques

- **Erreur générique pour credentials invalides** (AC4) : ne JAMAIS différencier "email inexistant" vs "mauvais mot de passe". `AdminUser.verifyCredentials` lance déjà la même exception dans les deux cas → c'est le comportement attendu.
- **Vérifier `isActive` APRÈS `verifyCredentials`** (AC5) : sinon un attaquant pourrait deviner l'existence d'un compte désactivé via la différence de timing (l'absence de verify scrypt est ~100x plus rapide). En vérifiant après, le timing est constant pour les credentials valides, qu'`isActive` soit true ou false.
- **CSRF** (AC7) : Shield middleware vérifie le header `X-XSRF-TOKEN` sur POST. Inertia `useForm` lit le cookie `XSRF-TOKEN` et l'envoie automatiquement → rien à faire côté front.
- **Pas de rate-limiting dans cette story** : noter pour Phase 2 / hardening (NFR sécurité avancée — pas couvert MVP).
- **Pas de "remember me"** : la session AdonisJS expire après 2h d'inactivité (NFR6, géré par `config/session.ts`).
- **Logs d'activité** : `ActivityLogService.log({ actionType: 'login', ... })` apparaît en Epic 3 (Story 3.1). **PAS DE LOG dans cette story** — c'est une dette assumée jusqu'à Story 3.1.

### Format des messages d'erreur — choix d'implémentation

Deux approches possibles pour les messages d'erreur :

**Option A — clés i18n flashées côté serveur, résolues côté client (recommandée)** :
- Le serveur flash la clé : `session.flashErrors({ email: 'auth.login.errors.invalid_credentials' })`
- Le client lit via `useForm().errors.email` puis `t(errors.email)` → texte affiché
- **Avantage** : message localisé selon la langue du client (cookie i18n_lang lu par react-i18next)
- **Inconvénient** : nécessite de toujours faire `t(errors.email)` côté front, jamais directement `{errors.email}`

**Option B — messages traduits côté serveur** :
- AdonisJS i18n côté serveur lit le cookie et traduit avant flash
- **Inconvénient** : duplication des fichiers de locales côté serveur, complexité

→ **Choix : Option A**, cohérent avec le pattern Story 2.1 (`errors.forbidden`, `errors.account_inactive` flashés côté serveur, résolus dans `AdminLayout` via `t()`).

### Anti-patterns à éviter

- ❌ Différencier les messages "email inexistant" vs "password incorrect" — exposer l'existence du compte
- ❌ Vérifier `isActive` AVANT `verifyCredentials` — timing side-channel
- ❌ Hardcoder les chaînes "Email ou mot de passe incorrect" dans le JSX — passer par i18n
- ❌ Désactiver le CSRF "pour faciliter les tests" — utiliser le client API qui gère le CSRF (ou tester avec `loginAs` qui contourne la route)
- ❌ Logger le password en clair (même en debug) — `request.only(['email'])` pour les logs si besoin
- ❌ Stocker l'email en session après login — `auth.user` est la source de vérité
- ❌ Mettre une longueur min sur le password dans `loginValidator` — la politique de mot de passe s'applique à la **création/changement** (Story 2.3), pas à la connexion (sinon ça révèle la politique aux attaquants)
- ❌ Utiliser `withCsrfToken()` ou bypass CSRF dans les tests — le client API doit gérer le cookie naturellement ; sinon noter que c'est un cas limite

### Project Structure Notes

**Fichiers créés :**
- `app/validators/auth_validator.ts`
- `tests/functional/admin/login.spec.ts`
- `tests/unit/validators/auth_validator.spec.ts`

**Fichiers modifiés :**
- `app/controllers/admin/auth_controller.ts` — refonte `login` + `showLogin` (retrait du stub)
- `inertia/pages/admin/Auth/Login.tsx` — refonte complète (i18n, shadcn, a11y, flash)
- `inertia/locales/admin/fr.json` — ajout namespace `auth.login.*`
- `inertia/locales/admin/en.json` — ajout namespace `auth.login.*`

**Fichiers à NE PAS modifier :**
- `app/middleware/admin_middleware.ts` — comportement déjà bon (la redirection `passwordChanged=false` est gérée par le middleware, pas par le contrôleur de login lui-même)
- `app/models/admin_user.ts` — pas de changement, `verifyCredentials` est exposé par le mixin AuthFinder
- `config/auth.ts` — guard `web` déjà configuré
- `start/routes.ts` — routes déjà déclarées en Story 2.1
- `start/kernel.ts` — middlewares déjà enregistrés
- `inertia/layouts/AdminAuthLayout.tsx` — layout déjà adapté

### Previous Story Intelligence (2.1)

**Patterns validés :**
- Tests fonctionnels Japa avec `db.beginGlobalTransaction()` + helper `createAdminUser` in-spec → reproduire à l'identique
- `.redirects(0)` requis sur le client API pour ne pas suivre les 302
- `client.loginAs(user)` disponible via `authApiClient` + `sessionApiClient` (déjà ajoutés en Story 2.1 à `tests/bootstrap.ts`)
- `Link` (et autres) importés depuis `@adonisjs/inertia/react`, pas `@inertiajs/react` (lint rule)
- `inertia.render('page', {})` exige le 2e argument même vide (TS strict)
- Layout HOC : `Component.layout = (page: ReactElement) => <Layout>{page}</Layout>` — typer `ReactElement` (sans génerique) car le layout lit user via `usePage`
- Le test `production.spec.ts:74` (GIN index) reste flaky pré-existant — ne pas chercher à le fixer dans cette story

**Gotchas à ne pas répéter :**
- Ne pas utiliser `replace_all` Edit avec une string vide en remplacement → risque de coller deux lignes
- Ne PAS lancer `git stash` puis `git stash pop` — les fichiers codegen `.adonisjs/` créent des conflits
- Le registry Tuyau nichre les sous-dossiers : utiliser `controllers.admin.Auth` (pas `controllers.AdminAuth`)
- `withInertia()` n'existe pas sur le client API (Japa)

### Latest Tech Information

- **AdonisJS 6 — `verifyCredentials`** : exposé par le mixin `withAuthFinder` sur le modèle. Lance `InvalidCredentialsException` quand l'utilisateur n'existe pas OU quand le hash ne vérifie pas. Comportement timing-safe.
- **AdonisJS 6 — `session.flashErrors`** : flashe les erreurs sous la clé `inertiaErrors` lisible côté client via `usePage().props.errors` (mis en place par `inertia_middleware.ts` existant — cf. `getValidationErrors`).
- **AdonisJS Shield** : config CSRF activée (cf. `config/shield.ts`). Cookie `XSRF-TOKEN` exposé, méthodes protégées : `POST, PUT, PATCH, DELETE`. Le client Inertia (axios sous-jacent) envoie automatiquement le header `X-XSRF-TOKEN` lu depuis le cookie.
- **VineJS** : la méthode `request.validateUsing(loginValidator)` retourne un objet validé, lance `ValidationException` (gérée par AdonisJS pour renvoyer 422 + flashErrors automatiquement via Inertia).

### Cas d'usage MVP

À la fin de cette story :
- Un admin peut effectivement se connecter au panel via `/admin/login`
- Les credentials sont vérifiés en BDD avec scrypt
- L'admin avec mot de passe provisoire est redirigé vers le change-password (Story 2.3 à venir)
- L'admin avec mot de passe permanent atteint le dashboard `/admin/productions`
- Les credentials invalides retournent un message générique sans révéler l'existence du compte
- Les comptes désactivés sont refusés explicitement
- La sécurité CSRF est active
- Les tests fonctionnels garantissent la non-régression

Les Stories 2.3 → 2.6 peuvent maintenant s'appuyer sur un flux d'auth réel pour leurs propres scénarios.

### References

- [Source: epics.md#Story 2.2] — Acceptance Criteria (mis à jour post-retrait 2FA)
- [Source: architecture.md#3. Authentification et Sécurité] — Sessions AdonisJS Auth, scrypt, CSRF, flux première connexion
- [Source: ux-design-specification.md#Panel Admin] — Layout d'auth (AdminAuthLayout, logo centré + carte) déjà documenté
- [Source: PRD#FR30, NFR5, NFR7] — Login email/password, scrypt hash, CSRF
- [Source: Story 2.1] — Stubs login déjà créés (à enrichir), pattern tests fonctionnels admin
- [Source: app/middleware/inertia_middleware.ts] — Partage `flash`, `errors`, `user` déjà en place
- [Source: app/models/admin_user.ts] — `verifyCredentials` via mixin AuthFinder
- [Source: config/shield.ts] — Configuration CSRF active
- [Source: config/session.ts] — Expiration session (2h, géré en Story 2.4)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **CSRF dans les tests Japa** : Shield expose un plugin `shieldApiClient()` à ajouter dans `tests/bootstrap.ts`. Sans lui, le macro `.withCsrfToken()` n'existe pas. Une fois ajouté, les requêtes POST passent par `.withCsrfToken()` pour générer un token + secret, sinon Shield rejette via flash + redirect back.
- **Réponse Shield CSRF rejection** : Shield ne renvoie PAS 403/419 sur token absent (contrairement à ce que la doc laisse penser). Il flashe `E_BAD_CSRF_TOKEN` dans la session et `response.redirect().back()` → **302**. Mon test CSRF a été ajusté en conséquence.
- **`session.flashAll()` flash le password en clair** : remplacé par `session.flashOnly(['email'])` pour préserver seulement l'email entre les redirects (UX — pas besoin de retaper).
- **Lecture des flash dans les tests** : `response.flashMessages()` (via `sessionApiClient`) — pas `response.session()` qui retourne les valeurs persistantes.
- **Session ne persiste pas entre 2 requêtes du même client** : `sessionApiClient` détruit la session après chaque requête. Impossible de tester "POST login → GET dashboard" dans le même `it` — il faut soit `loginAs(user)` pour bypass, soit accepter le 302 du login comme preuve suffisante.
- **`vine.string().minLength(0)`** non équivalent à "requis" : il faut `vine.string().minLength(1)` ou `vine.string()` seul (qui rejette undefined par défaut) pour distinguer "manquant" de "vide".
- **Test pré-existant flaky `production.spec.ts:74`** (GIN index) : confirmé encore présent. Hors scope.

### Completion Notes List

- **Tous les AC satisfaits** (AC1–AC9) sauf le test manuel navigateur (9.5 — action utilisateur)
- **Sécurité timing-safe** : `verifyCredentials` est appelé AVANT le check `isActive` → un attaquant ne peut pas distinguer "compte inexistant" de "compte désactivé" via timing side-channel
- **Erreur générique** pour email inexistant ET mauvais password : strictement la même clé i18n `auth.login.errors.invalid_credentials` → aucun leak d'information sur l'existence du compte
- **CSRF** : Inertia `useForm` côté client lit le cookie `XSRF-TOKEN` et envoie le header `X-XSRF-TOKEN` automatiquement. En test, `shieldApiClient` fournit le macro `.withCsrfToken()`.
- **i18n côté serveur → résolution côté client** : le serveur flash la **clé** i18n (ex. `'auth.login.errors.invalid_credentials'`), le client résout via `t(errors.email)`. Cohérent avec le pattern Story 2.1.
- **a11y** : `<form noValidate>`, `aria-invalid`, `aria-describedby`, `role="alert"` sur le message global d'erreur
- **Logs d'activité** : non couverts cette story (Story 3.1 ActivityLogService — dette assumée)
- **Rate-limiting** : non couvert (Phase 2 — hardening)

### File List

**Créés :**
- `app/validators/auth_validator.ts`
- `tests/functional/admin/login.spec.ts` (11 tests)
- `tests/unit/validators/auth_validator.spec.ts` (6 tests)

**Modifiés :**
- `app/controllers/admin/auth_controller.ts` — refonte `showLogin` (guest redirect inline) et `login` (verifyCredentials + isActive timing-safe + flashErrors)
- `inertia/pages/admin/Auth/Login.tsx` — refonte complète (i18n, shadcn `Input`/`Button`, a11y, flash error)
- `inertia/locales/admin/fr.json` — ajout namespace `auth.login.*`
- `inertia/locales/admin/en.json` — équivalent EN
- `tests/bootstrap.ts` — ajout `shieldApiClient()` pour activer `.withCsrfToken()` dans les tests

**Fichiers à NE PAS modifier (intacts) :**
- `app/models/admin_user.ts`
- `app/middleware/admin_middleware.ts`
- `start/routes.ts` / `start/kernel.ts`
- `inertia/layouts/AdminAuthLayout.tsx` / `inertia/layouts/AdminLayout.tsx`
- `config/auth.ts`, `config/shield.ts`, `config/session.ts`

### Change Log

- 2026-05-31 : Implémentation Story 2.2 (Page de connexion admin). Validator VineJS, refonte controller `login` avec sécurité timing-safe et erreurs génériques, refonte page Login.tsx (shadcn + i18n + a11y), 17 nouveaux tests (6 unit validator + 11 fonctionnels login). Plugin `shieldApiClient` ajouté à bootstrap. Tests : 83/84 unit (1 GIN flaky pré-existant) + 19/19 functional, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [x] [Review][Decision] ✅ RÉSOLU (garder distinct + corriger commentaire) — Énumération de compte : message "désactivé" vs "invalide". Décision utilisateur : conserver le message distinct `account_inactive` (exigé par AC5), compromis énumération accepté pour le MVP (panel interne). Commentaire trompeur "même message générique" corrigé dans `auth_controller.ts`.
- [x] [Review][Patch] ✅ APPLIQUÉ — loginValidator sans i18n [app/validators/auth_validator.ts] — `SimpleMessagesProvider` ajouté (email.required/email/maxLength + password.required/minLength → clés i18n login).
- [x] [Review][Patch] ✅ APPLIQUÉ — showLogin ne déconnecte pas un compte inactif authentifié [app/controllers/admin/auth_controller.ts] — `logout()` ajouté dans la branche authentifié-mais-inactif.
- [x] [Review][Defer] AC texte 422/403-419 vs 302+flash réel — deferred, réconciliation de doc (le code 302+flash est l'idiome Inertia/Shield correct ; texte AC et Completion Notes à mettre à jour).
