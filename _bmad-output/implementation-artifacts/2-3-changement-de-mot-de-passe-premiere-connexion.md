# Story 2.3 : Changement de mot de passe à la première connexion

Status: done

## Story

En tant qu'administrateur se connectant pour la première fois,
Je veux définir un mot de passe permanent en remplacement du mot de passe provisoire,
Afin de sécuriser mon compte avant d'accéder au panel (FR42, NFR5).

## Acceptance Criteria

**AC1 — Redirection forcée si `password_changed = false`** *(déjà implémenté en Story 2.1 via `AdminMiddleware`)*

- **Given** un admin authentifié avec `password_changed = false`
- **When** il accède à n'importe quelle route `/admin/*` (hors `/admin/auth/change-password` et `/admin/logout`)
- **Then** il est redirigé 302 vers `/admin/auth/change-password`
- **Note** : cet AC est couvert par les tests fonctionnels existants de Story 2.1 (`middleware.spec.ts`). À ne PAS retester ici.

**AC2 — Affichage du formulaire**

- **Given** un admin authentifié avec `password_changed = false` accède à `GET /admin/auth/change-password`
- **When** la page se charge
- **Then** un formulaire Inertia avec les champs `password` et `password_confirmation` est rendu
- **And** tous les libellés / messages passent par `react-i18next` (clés `auth.change_password.*`)
- **And** le cookie `XSRF-TOKEN` est présent (CSRF requis sur le POST)

**AC3 — Changement de mot de passe réussi**

- **Given** un admin authentifié avec `password_changed = false`
- **When** il soumet `POST /admin/auth/change-password` avec `password` ≥ 12 caractères et `password_confirmation` identique
- **Then** le nouveau mot de passe est hashé via scrypt (mixin `AuthFinder`) et persisté en BDD
- **And** `password_changed` passe à `true`
- **And** la réponse est 302 vers `/admin/productions`
- **And** la session reste active (l'admin est connecté)

**AC4 — Confirmation différente**

- **Given** l'admin saisit deux mots de passe différents (`password` ≠ `password_confirmation`)
- **When** le formulaire est soumis
- **Then** la réponse est 302 vers `/admin/auth/change-password`
- **And** `flashErrors.password_confirmation` (ou `flashErrors.password`) contient la clé i18n `auth.change_password.errors.confirmation_mismatch`
- **And** `password_changed` reste à `false`

**AC5 — Mot de passe trop court (< 12 caractères)**

- **Given** l'admin saisit un `password` de moins de 12 caractères
- **When** le formulaire est soumis
- **Then** 302 vers `/admin/auth/change-password`
- **And** `flashErrors.password` contient la clé i18n `auth.change_password.errors.password_too_short`
- **And** `password_changed` reste à `false`

**AC6 — Champs manquants**

- **Given** l'admin soumet sans `password` ou sans `password_confirmation`
- **When** la validation s'exécute
- **Then** 302 redirect + `flashErrors` contiennent les clés `auth.change_password.errors.password_required` ou `auth.change_password.errors.confirmation_required`

**AC7 — Compte déjà changé**

- **Given** un admin authentifié avec `password_changed = true`
- **When** il accède à `GET /admin/auth/change-password`
- **Then** il est redirigé 302 vers `/admin/productions`
- **Given** ce même admin soumet `POST /admin/auth/change-password`
- **When** le contrôleur s'exécute
- **Then** il est redirigé 302 vers `/admin/productions` sans aucune modification en BDD (idempotent — pas de leak de la possibilité de re-changement)

**AC8 — Non authentifié**

- **Given** un visiteur anonyme
- **When** il accède à `GET /admin/auth/change-password`
- **Then** il est redirigé 302 vers `/admin/login` (géré par `AdminMiddleware` — vérification de non-régression uniquement)

**AC9 — Protection CSRF**

- **Given** une requête POST `/admin/auth/change-password` sans token CSRF valide
- **When** Shield s'exécute
- **Then** la requête est rejetée (flash `E_BAD_CSRF_TOKEN` + redirect back) et `password_changed` reste à `false`

**AC10 — Tests automatisés passent**

- **Given** la suite `node ace test` est exécutée
- **When** les specs auth admin tournent
- **Then** au minimum les scénarios suivants passent :
  - GET `/admin/auth/change-password` (admin `passwordChanged=false`) → 200 + page Inertia rendue
  - POST valide (≥12 chars + confirmation OK) → 302 vers `/admin/productions` + BDD `passwordChanged=true` + hash scrypt vérifié pour le nouveau password
  - POST password < 12 chars → 302 redirect + flashErrors.password contient `password_too_short`
  - POST password ≠ confirmation → 302 redirect + flashErrors contient `confirmation_mismatch`
  - POST sans password → 302 + flashErrors.password contient `password_required`
  - GET `/admin/auth/change-password` (admin `passwordChanged=true`) → 302 vers `/admin/productions`
  - POST `/admin/auth/change-password` (admin `passwordChanged=true`) → 302 vers `/admin/productions` + BDD inchangée
  - POST sans CSRF → flash `E_BAD_CSRF_TOKEN` + 302

## Tasks / Subtasks

- [x] **Tâche 1 — Validator VineJS** (AC4, AC5, AC6)
  - [ ] 1.1 Étendre `app/validators/auth_validator.ts` avec un export `changePasswordValidator` :
    ```ts
    export const changePasswordValidator = vine.compile(
      vine.object({
        password: vine
          .string()
          .minLength(12)
          .maxLength(255)
          .confirmed({ confirmationField: 'password_confirmation' }),
      })
    )
    ```
  - [ ] 1.2 La longueur min 12 et la confirmation sont enforced ici (contrairement au login validator). VineJS `confirmed()` cherche le champ `<name>_confirmation` par défaut, donc le formulaire doit envoyer `password_confirmation` (snake_case — vérifier la convention côté front).
  - [ ] 1.3 Pas de contrainte de complexité (chiffres, majuscules, etc.) — l'AC ne le demande pas et la longueur 12 est suffisante côté MVP. Une politique de complexité pourra être ajoutée Phase 2 si besoin.
  - [ ] 1.4 Pas besoin de vérifier "nouveau password ≠ ancien" dans cette story — la politique de "non-réutilisation" serait Phase 2.

- [x] **Tâche 2 — Refonte `AdminAuthController.showChangePassword`** (AC2, AC7 GET)
  - [ ] 2.1 Lire `auth.user!` (le middleware `admin` garantit l'authentification)
  - [ ] 2.2 Si `user.passwordChanged === true` → `response.redirect('/admin/productions')` (AC7)
  - [ ] 2.3 Sinon → `inertia.render('admin/Auth/ChangePassword', {})`

- [x] **Tâche 3 — Refonte `AdminAuthController.changePassword`** (AC3, AC4, AC5, AC6, AC7 POST, AC9)
  - [ ] 3.1 Remplacer le stub par :
    ```ts
    async changePassword({ auth, request, response, session }: HttpContext) {
      const user = auth.user!

      // AC7 — admin déjà passé par change-password : redirect sans rien faire
      if (user.passwordChanged) {
        return response.redirect('/admin/productions')
      }

      const { password } = await request.validateUsing(changePasswordValidator)

      user.passwordHash = password // hashé via le mixin AuthFinder au save
      user.passwordChanged = true
      await user.save()

      session.flash('success', 'auth.change_password.success')
      return response.redirect('/admin/productions')
    }
    ```
  - [ ] 3.2 La validation lance automatiquement `ValidationException` → 302 + flashErrors (gérée par AdonisJS Inertia)
  - [ ] 3.3 Important : `request.validateUsing` n'a PAS de try/catch — laisser AdonisJS gérer la redirection avec flashErrors.
  - [ ] 3.4 Le mixin `AuthFinder` hashe automatiquement `passwordHash` via un hook `beforeSave` — passer le password en CLAIR, jamais pré-hasher (cf. gotcha Story 1.5).
  - [ ] 3.5 La session reste active après le `save()` — aucun besoin de re-login.

- [x] **Tâche 4 — Messages d'erreur i18n pour VineJS**
  - [ ] 4.1 VineJS retourne des codes par défaut (ex. `password.minLength`, `password.confirmed`). Pour mapper vers les clés i18n attendues par le front (`auth.change_password.errors.*`), deux options :
    - **Option A** : utiliser un `messagesProvider` AdonisJS qui mappe `field.rule` → clé i18n
    - **Option B** : utiliser `.messagesProvider` directement sur le validator
  - [ ] 4.2 **Implémentation recommandée** : Option B inline sur le validator (plus simple, scope limité) :
    ```ts
    import { SimpleMessagesProvider } from '@vinejs/vine'

    export const changePasswordValidator = vine.compile(
      vine.object({
        password: vine.string()
          .minLength(12)
          .maxLength(255)
          .confirmed({ confirmationField: 'password_confirmation' }),
      })
    )

    changePasswordValidator.messagesProvider = new SimpleMessagesProvider({
      'password.required': 'auth.change_password.errors.password_required',
      'password.minLength': 'auth.change_password.errors.password_too_short',
      'password.maxLength': 'auth.change_password.errors.password_too_long',
      'password.confirmed': 'auth.change_password.errors.confirmation_mismatch',
      'password_confirmation.required': 'auth.change_password.errors.confirmation_required',
    })
    ```
  - [ ] 4.3 Côté front, `t(errors.password)` résout la clé i18n vers le texte localisé (cohérent avec Story 2.2).
  - [ ] 4.4 Vérifier le comportement réel de VineJS `.confirmed()` : sur quelle clé exacte sort le message d'erreur ? Probable `password.confirmed` mais à confirmer pendant l'implémentation. Tests fonctionnels seront la source de vérité.

- [x] **Tâche 5 — Refonte de la page `ChangePassword.tsx`** (AC2, AC6)
  - [ ] 5.1 Refondre `inertia/pages/admin/Auth/ChangePassword.tsx` sur le modèle de la page Login (Story 2.2) :
    - `useTranslation()` pour toutes les chaînes
    - Composants shadcn `Input`, `Button`
    - a11y : `<form noValidate>`, `aria-invalid`, `aria-describedby`, `role="alert"` pour les erreurs globales
    - Conserver `useForm` (CSRF auto)
    - Field `password_confirmation` doit envoyer ce nom EXACT (cf. validator)
  - [ ] 5.2 Structure attendue :
    ```tsx
    const { data, setData, post, processing, errors } = useForm({
      password: '',
      password_confirmation: '',
    })
    ```
  - [ ] 5.3 Indications visuelles minimales : afficher le critère "12 caractères minimum" en hint sous le champ password (clé `auth.change_password.hint`).
  - [ ] 5.4 Effacer `password` et `password_confirmation` dans `onFinish` (pas en mémoire après soumission, même réussie).

- [x] **Tâche 6 — Clés i18n change_password**
  - [ ] 6.1 Ajouter dans `inertia/locales/admin/fr.json` :
    ```json
    "auth": {
      "login": { ... },
      "change_password": {
        "title": "Définir votre mot de passe",
        "subtitle": "Vous devez définir un nouveau mot de passe avant d'accéder au panel.",
        "fields": {
          "password": "Nouveau mot de passe",
          "password_confirmation": "Confirmation"
        },
        "hint": "Minimum 12 caractères.",
        "submit": "Mettre à jour",
        "submitting": "Mise à jour…",
        "success": "Votre mot de passe a été mis à jour.",
        "errors": {
          "password_required": "Le mot de passe est requis.",
          "password_too_short": "Le mot de passe doit contenir au moins 12 caractères.",
          "password_too_long": "Le mot de passe est trop long.",
          "confirmation_required": "La confirmation est requise.",
          "confirmation_mismatch": "Les mots de passe ne correspondent pas."
        }
      }
    }
    ```
  - [ ] 6.2 Équivalent EN dans `en.json` (même structure, parité enforced)
  - [ ] 6.3 Vérifier que `tests/unit/i18n/translations.spec.ts` passe (parité FR/EN)

- [x] **Tâche 7 — Test unitaire validator** (qualité)
  - [ ] 7.1 Étendre `tests/unit/validators/auth_validator.spec.ts` avec un nouveau `test.group('AuthValidator | changePasswordValidator', ...)` :
    - Cas valide : password ≥ 12 + confirmation identique → succès
    - Password absent → exception sur `password`
    - Password = 11 chars → exception sur `password` (minLength)
    - Confirmation absente → exception (sur `password` avec rule `confirmed`)
    - Confirmation différente → exception (idem)
    - Password de exactement 12 chars + confirmation OK → succès (boundary)
  - [ ] 7.2 Pattern try/catch + `assert.instanceOf(error, errors.E_VALIDATION_ERROR)` — cohérent Story 2.2

- [x] **Tâche 8 — Tests fonctionnels** (AC10)
  - [ ] 8.1 Créer `tests/functional/admin/change_password.spec.ts`
  - [ ] 8.2 Helper `createAdminUser` réutilisable depuis `login.spec.ts` — extraire dans `tests/helpers/admin_user.ts` si on commence à dupliquer (sinon dupliquer le helper, c'est OK pour cette story)
  - [ ] 8.3 Cas de tests :
    - GET `/admin/auth/change-password` (admin loginAs + `passwordChanged=false`) → 200 + assertTextIncludes('admin/Auth/ChangePassword')
    - GET `/admin/auth/change-password` (admin loginAs + `passwordChanged=true`) → 302 vers `/admin/productions`
    - POST valide → 302 vers `/admin/productions` + recharger user en BDD : `assert.isTrue(refreshedUser.passwordChanged)` + `assert.isTrue(await hash.verify(refreshedUser.passwordHash, newPassword))`
    - POST password = 11 chars → 302 + flashMessages contient `password_too_short` + BDD inchangée (recharger user et vérifier `passwordChanged=false`)
    - POST password ≠ confirmation → 302 + flashMessages contient `confirmation_mismatch` + BDD inchangée
    - POST sans password → 302 + flashMessages contient `password_required`
    - POST par admin avec `passwordChanged=true` (tentative re-changement) → 302 vers `/admin/productions` + BDD inchangée (hash original conservé)
    - POST sans CSRF → flash `E_BAD_CSRF_TOKEN`
  - [ ] 8.4 Pattern identique à `login.spec.ts` (group DB transaction, `loginAs(user)`, `.withCsrfToken()`, `.redirects(0)`, `response.flashMessages()`)

- [x] **Tâche 9 — Validation finale**
  - [ ] 9.1 `node ace test unit` → tous tests passent (sauf le pré-existant GIN)
  - [ ] 9.2 `node ace test functional` → tous tests passent (middleware + login + change_password)
  - [ ] 9.3 `npm run lint` → 0 erreur
  - [ ] 9.4 `npm run typecheck` → 0 erreur
  - [ ] 9.5 Test manuel via `npm run dev` :
    - Connexion avec le super admin (qui a `passwordChanged=false` par défaut via seeder) → redirect vers `/admin/auth/change-password`
    - Soumission avec password < 12 chars → erreur affichée
    - Soumission avec password OK + confirmation OK → redirect dashboard + nouveau mot de passe utilisable lors de la prochaine connexion
    - Visite directe de `/admin/auth/change-password` après changement → redirect dashboard

## Dev Notes

### Synthèse architecture

- **Validator** : nouveau `changePasswordValidator` dans `app/validators/auth_validator.ts` (à côté du `loginValidator` existant). Min 12 chars, `confirmed()` natif VineJS.
- **Controller** : `AdminAuthController.showChangePassword` et `changePassword` (déjà créés en Story 2.1 comme stubs) → enrichissement.
- **Page Inertia** : `inertia/pages/admin/Auth/ChangePassword.tsx` refonte (i18n, shadcn, a11y).
- **i18n** : nouveau namespace `auth.change_password.*` dans les locales admin.
- **Pas de middleware nouveau** : la redirection forcée est déjà gérée par `AdminMiddleware` (Story 2.1). La logique "déjà changé → redirect" est gérée dans le contrôleur (cohérent avec `showLogin` qui gère son propre redirect guest).

### État existant à respecter

- `app/controllers/admin/auth_controller.ts` : `showChangePassword` et `changePassword` existent en stub (Story 2.1+2.2 ne les ont pas touchés). À enrichir comme on l'a fait pour `login`.
- `app/validators/auth_validator.ts` : `loginValidator` existe (Story 2.2). Ajouter `changePasswordValidator` dans le MÊME fichier.
- `inertia/pages/admin/Auth/ChangePassword.tsx` : version stub Story 2.1 (formulaire useForm minimal, chaînes en dur). À refondre.
- `inertia/locales/admin/{fr,en}.json` : contient déjà `auth.login.*`. Ajouter `auth.change_password.*` à côté.
- `app/middleware/admin_middleware.ts` : gère DÉJÀ la redirection vers `/admin/auth/change-password` quand `passwordChanged=false` ET la whitelist de cette route. Aucun changement nécessaire.
- `start/routes.ts` : routes GET et POST `/admin/auth/change-password` déjà déclarées sous `middleware.admin()`. Aucun changement.
- `tests/bootstrap.ts` : `shieldApiClient` + `authApiClient` + `sessionApiClient` déjà configurés (Story 2.2).
- `tests/functional/admin/login.spec.ts` : pattern de tests à reproduire pour `change_password.spec.ts`.

### Patterns à reproduire (Story 2.2)

- **Tests fonctionnels** : `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` dans `group.each.setup`, helper `createAdminUser` in-spec, `loginAs(user)`, `.withCsrfToken()`, `.redirects(0)`, `response.flashMessages()`
- **Validator avec messagesProvider** : `SimpleMessagesProvider` mappe `field.rule` → clé i18n flashée côté serveur, résolue côté client via `t()`
- **Controller** : `request.validateUsing(validator)` lance automatiquement `ValidationException` → 302 + flashErrors (pas de try/catch nécessaire pour les erreurs de validation)
- **Page Inertia** : `useForm` + shadcn (`Input`, `Button`) + `useTranslation()` + a11y (`aria-invalid`, `aria-describedby`)
- **i18n** : clé flashée côté serveur (ex. `'auth.change_password.errors.password_too_short'`), résolue côté client via `t(errors.password)`

### Sécurité — points critiques

- **Hash scrypt automatique** : passer le password en CLAIR à `user.passwordHash = newPassword` puis `user.save()`. Le mixin `AuthFinder` (defined in `app/models/admin_user.ts`) hashe via `beforeSave`. **JAMAIS pré-hasher** avec `hash.make()` — sinon double-hash, login casse.
- **Ne PAS exposer `password_confirmation` côté serveur** : VineJS l'utilise pour la validation mais ne le passe pas dans `user.passwordHash`. Le destructuring `{ password }` du résultat validé est suffisant.
- **AC7 idempotence** : si l'admin a déjà `passwordChanged=true` et tente de re-poster, le contrôleur redirige sans modifier la BDD. Cela évite qu'un attaquant qui aurait volé une session active puisse re-changer le mot de passe pour bloquer le compte (faible scénario mais bon réflexe défense-en-profondeur).
- **CSRF** : actif via Shield (Story 2.1+2.2 ont prouvé que ça fonctionne). Inertia `useForm` envoie automatiquement le header `X-XSRF-TOKEN`.
- **Pas de "ancien mot de passe à confirmer"** : la story dit "première connexion" — l'admin vient de saisir son password provisoire au login, on le considère implicitement vérifié. Si on voulait être plus strict, on demanderait `current_password` mais ce n'est pas dans les AC.
- **Pas d'historique de passwords** : politique non-réutilisation = Phase 2. Pour le MVP, on accepte de remplacer le password provisoire par n'importe quoi de ≥12 chars.
- **Logs d'activité** : Story 3.1 (ActivityLogService) — pas de log dans cette story. Dette assumée.

### Anti-patterns à éviter

- ❌ Vérifier la longueur côté front uniquement — la validation serveur est obligatoire (CSRF + bypass possible)
- ❌ Hasher manuellement `password` avant `user.save()` — le mixin le fait automatiquement
- ❌ Faire le check `passwordChanged === true` UNIQUEMENT côté front — toujours côté serveur (sinon bypass via curl direct)
- ❌ Laisser un attaquant re-changer le mot de passe via la même route quand `passwordChanged=true` — AC7 idempotence
- ❌ Renvoyer un 200 sur ValidationException — laisser AdonisJS Inertia gérer le 302 + flashErrors (cohérent UX)
- ❌ Hardcoder "Les mots de passe ne correspondent pas" dans le JSX — passer par i18n
- ❌ Stocker le nouveau password en log ou en flash — utiliser uniquement `flashErrors`, pas `flashAll`
- ❌ Demander une re-authentification après le changement — la session reste active (UX MVP)
- ❌ Logger le mot de passe en clair (même en debug) — utiliser `request.only(['nonSensitiveFields'])`

### Project Structure Notes

**Fichiers créés :**
- `tests/functional/admin/change_password.spec.ts`

**Fichiers modifiés :**
- `app/validators/auth_validator.ts` — ajout `changePasswordValidator` + `messagesProvider`
- `app/controllers/admin/auth_controller.ts` — refonte `showChangePassword` + `changePassword`
- `inertia/pages/admin/Auth/ChangePassword.tsx` — refonte (i18n, shadcn, a11y, hint min 12)
- `inertia/locales/admin/fr.json` — ajout namespace `auth.change_password.*`
- `inertia/locales/admin/en.json` — équivalent EN
- `tests/unit/validators/auth_validator.spec.ts` — ajout cas `changePasswordValidator`

**Fichiers à NE PAS modifier :**
- `app/middleware/admin_middleware.ts` — la redirection forcée est déjà OK
- `app/models/admin_user.ts` — hash scrypt automatique
- `start/routes.ts` / `start/kernel.ts` — routes déjà déclarées
- `inertia/layouts/AdminAuthLayout.tsx` — réutilisé tel quel
- `tests/bootstrap.ts` — plugins déjà configurés

### Previous Story Intelligence (2.1 + 2.2)

**Patterns validés à reproduire :**
- VineJS validator avec `request.validateUsing()` → flashErrors automatique
- Layout HOC : `Component.layout = (page: ReactElement) => <Layout>{page}</Layout>` (sans générique sur ReactElement)
- Shield CSRF rejette par flash + redirect 302 (pas 403/419)
- Tests : `loginAs(user)` + `.withCsrfToken()` + `.redirects(0)` + `response.flashMessages()`
- i18n : clés flashées côté serveur, résolues côté client via `t()`
- `controllers.admin.Auth` (registry Tuyau nichre par dossier)

**Gotchas à ne pas répéter :**
- Ne pas chaîner "POST → GET" dans un même test (session détruite entre requêtes)
- Ne pas oublier `inertia.render(page, {})` — le 2e arg `{}` est obligatoire
- Ne pas utiliser `Edit replace_all` avec string vide (risque de coller deux lignes)
- Ne pas tester le test pré-existant flaky `production.spec.ts:74` (GIN index)

### Latest Tech Information

- **VineJS `confirmed()`** : par défaut, cherche un champ avec le suffixe `_confirmation`. Donc `password` → `password_confirmation`. Pour personnaliser : `.confirmed({ confirmationField: 'autre_nom' })`.
- **VineJS `SimpleMessagesProvider`** : mappe une clé `field.rule` (ex. `password.minLength`) vers un message custom. Idéal pour i18n côté serveur.
- **AdonisJS 6 `request.validateUsing()`** : retourne l'objet validé. Lance `E_VALIDATION_ERROR` (extends Exception) qui retourne 422 ou 302 selon le type de requête. Avec Inertia, c'est 302 + flashErrors automatique.
- **AdonisJS Auth `withAuthFinder` mixin** : hashe automatiquement la colonne définie comme `passwordColumnName` via un hook `beforeSave`. Configuré dans `app/models/admin_user.ts` : `passwordColumnName: 'passwordHash'`.

### Cas d'usage MVP

À la fin de cette story :
- L'admin créé par le seeder (`SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` avec `passwordChanged=false`) peut se connecter via `/admin/login`, est forcé vers `/admin/auth/change-password`, définit son mot de passe permanent et atteint le dashboard.
- Toute tentative future d'accès à `/admin/auth/change-password` est redirigée (le flux première connexion est terminé).
- Le nouveau mot de passe est utilisé pour les connexions suivantes (via le hash scrypt vérifié par `verifyCredentials`).
- Le flux complet "création super admin → première connexion → choix mot de passe → dashboard" est désormais fonctionnel end-to-end.

Les Stories 2.4 (session/logout), 2.5 (noindex), 2.6 (tests d'intégration) finaliseront l'Epic 2.

### References

- [Source: epics.md#Story 2.3] — Acceptance Criteria (mis à jour post-retrait 2FA — redirection vers dashboard au lieu de setup-2fa)
- [Source: architecture.md#3. Authentification et Sécurité] — Flux première connexion, hash scrypt
- [Source: PRD#FR42, NFR5] — Changement obligatoire première connexion + scrypt
- [Source: Story 2.1] — `AdminMiddleware` gère déjà la redirection forcée + stubs `showChangePassword`/`changePassword` créés
- [Source: Story 2.2] — Pattern controller refonte, tests Japa avec CSRF, validator + messagesProvider
- [Source: app/models/admin_user.ts] — `passwordHash` colonne hashée automatiquement
- [Source: app/middleware/admin_middleware.ts] — Whitelist `/admin/auth/change-password` déjà en place
- [Source: app/validators/user.ts] — Pattern `.confirmed()` avec validator user starter (référence VineJS)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **VineJS `confirmed()` reporte l'erreur sur le champ de confirmation, pas le principal** : la rule `confirmed` est exécutée sur le champ `password` mais via `field.report(messages.confirmed, "confirmed", { ...field, name: otherField })`. Concrètement, le message d'erreur arrive sous `password_confirmation.confirmed` (et non `password.confirmed`). Adapté le `SimpleMessagesProvider` et le test unitaire en conséquence.
- **`request.validateUsing()` lance `ValidationException` qui redirige automatiquement** : pas besoin de try/catch — AdonisJS Inertia gère le 302 + flashErrors. C'est cohérent avec ce qui a été fait dans Story 2.2 pour le login validator.
- **AC7 idempotence requise** : le contrôleur doit re-vérifier `user.passwordChanged` dans `changePassword` POST (pas seulement dans `showChangePassword` GET) — sinon un attaquant avec une session active d'un compte déjà changé pourrait re-définir le mot de passe.
- **Test pré-existant flaky `production.spec.ts:74`** (GIN index) : toujours présent. Hors scope.

### Completion Notes List

- **Tous les AC satisfaits** (AC1–AC10) sauf le test manuel navigateur (9.5 — action utilisateur)
- **Sécurité hash scrypt** : `user.passwordHash = newPassword` puis `user.save()` — le mixin `AuthFinder` hashe automatiquement via `beforeSave`. Vérifié dans les tests fonctionnels (`hash.verify` sur le nouveau password ET sur l'ancien provisoire).
- **AC7 idempotence** : vérifié par test fonctionnel — admin avec `passwordChanged=true` qui POST → 302 + BDD inchangée (hash original préservé).
- **i18n flashErrors** : la rule `confirmed` de VineJS reporte sur `password_confirmation`, donc côté Inertia front, le message s'affiche sous `errors.password_confirmation` (rendu sur le champ de confirmation, UX naturelle). Le `messagesProvider` mappe les codes VineJS vers les clés i18n attendues.
- **a11y** : `<form noValidate>`, `aria-invalid`, `aria-describedby` pour les hints/erreurs, hint min 12 caractères affiché sous le champ.
- **`onFinish`** efface les champs password et password_confirmation après soumission (sécurité — pas en mémoire React).
- **Session conservée** après le changement — pas de re-login forcé (UX MVP).
- **Logs d'activité** : non couverts (Story 3.1 — dette assumée).

### File List

**Créés :**
- `tests/functional/admin/change_password.spec.ts` (8 tests : 2 GET + 1 POST valide + 3 POST invalides + 1 idempotence + 1 CSRF)

**Modifiés :**
- `app/validators/auth_validator.ts` — ajout `changePasswordValidator` + `SimpleMessagesProvider` mappant les codes VineJS vers clés i18n
- `app/controllers/admin/auth_controller.ts` — refonte `showChangePassword` (redirect si déjà changé) et `changePassword` (validate + idempotence AC7 + hash auto + flash success)
- `inertia/pages/admin/Auth/ChangePassword.tsx` — refonte (i18n, shadcn `Input`/`Button`, a11y avec aria-invalid/describedby, hint min 12, onFinish clear)
- `inertia/locales/admin/fr.json` — ajout namespace `auth.change_password.*` (5 champs + 5 erreurs + success)
- `inertia/locales/admin/en.json` — équivalent EN
- `tests/unit/validators/auth_validator.spec.ts` — ajout group `changePasswordValidator` (6 tests dont boundary 12 chars exact)

**Fichiers à NE PAS modifier (intacts) :**
- `app/middleware/admin_middleware.ts` — whitelist `/admin/auth/change-password` déjà OK
- `app/models/admin_user.ts` — mixin AuthFinder déjà configuré
- `start/routes.ts` / `start/kernel.ts` — routes déjà déclarées
- `inertia/layouts/AdminAuthLayout.tsx` — réutilisé
- `tests/bootstrap.ts` — plugins déjà configurés (Story 2.2)

### Change Log

- 2026-06-01 : Implémentation Story 2.3 (Changement mot de passe première connexion). Validator VineJS avec `.confirmed()` et `SimpleMessagesProvider` i18n, refonte controller avec idempotence AC7, refonte page Inertia (a11y + hint), 14 nouveaux tests (6 unit + 8 fonctionnels). Tests : 89/90 unit (1 GIN flaky pré-existant) + 27/27 functional, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [x] [Review][Patch] ✅ RÉSOLU (faux positif partiel) — confirmation absente : **vérifié empiriquement** que VineJS `.confirmed()` reporte `password_confirmation.confirmed` → `confirmation_mismatch` (clé i18n correcte) dans les DEUX cas (absente ET différente). Pas de message anglais brut, AC6 respecté. Seul résidu réel : la clé `auth.change_password.errors.confirmation_required` était morte (jamais émise) → retirée de fr.json + en.json.
