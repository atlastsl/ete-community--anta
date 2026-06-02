# Story 3.5 : Réinitialisation du mot de passe d'un admin

Status: done

## Story

En tant que super administrateur,
Je veux réinitialiser le mot de passe d'un administrateur,
Afin qu'il puisse récupérer l'accès à son compte si nécessaire (FR43).

## Acceptance Criteria

**AC1 — Modal de confirmation pour la réinitialisation**

- **Given** le super admin clique sur "Réinitialiser le mot de passe" sur un compte admin
- **When** le modal de confirmation s'affiche
- **Then** il indique : "Un nouveau mot de passe provisoire sera généré et envoyé par email. L'administrateur devra le changer à sa prochaine connexion."

**AC2 — Réinitialisation effective**

- **Given** le super admin confirme la réinitialisation
- **When** l'action est traitée
- **Then** un nouveau mot de passe provisoire (16 caractères aléatoires) est généré et hashé (scrypt)
- **And** `password_changed` passe à `false` en base de données
- **And** toutes les sessions actives du compte sont invalidées
- **And** un email est envoyé à l'admin avec le nouveau mot de passe provisoire en clair
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'password_reset', resourceType: 'admin_user' })`
- **And** un toast succès s'affiche : "Mot de passe réinitialisé. Un email a été envoyé."

**AC3 — Flux première connexion après réinitialisation**

- **Given** l'admin dont le mot de passe a été réinitialisé se connecte
- **When** il fournit le nouveau mot de passe provisoire
- **Then** il est redirigé vers la page de changement de mot de passe (flux Story 2.3, car `password_changed = false`)
- **Note** : déjà couvert par le `AdminMiddleware` (vérifie `passwordChanged` à chaque requête) et le `AuthController.login()` (redirige vers change-password si `password_changed = false`). Cette story s'assure seulement que `passwordChanged` est bien remis à `false` et que le nouveau MDP est fonctionnel.

## Tasks / Subtasks

- [x] **Tâche 1 — Ajouter la méthode `resetPassword` dans UsersController** (AC2)
  - [x] 1.1 Méthode `resetPassword({ params, auth, response, session }: HttpContext)` ajoutée
  - [x] 1.2 Charge l'admin cible via `AdminUser.findOrFail(params.id)`
  - [x] 1.3 Génère un MDP provisoire de 16 caractères via `string.generateRandom(16)`
  - [x] 1.4 Met à jour `user.passwordHash` (auto-hashé par AuthFinder) + `user.passwordChanged = false`
  - [x] 1.5 Appelle `ActivityLogService.log({ actionType: ActionType.PASSWORD_RESET, resourceType: 'admin_user' })`
  - [x] 1.6 Envoie l'email via `mail.send()` avec template `emails/admin_password_reset`
  - [x] 1.7 Try/catch email : flash `users.reset_password_success_no_email` si échec
  - [x] 1.8 Flash succès puis redirect vers `/admin/users`

- [x] **Tâche 2 — Créer le template email de réinitialisation** (AC2)
  - [x] 2.1 `resources/views/emails/admin_password_reset.edge` créé (branding Anta green-700)
  - [x] 2.2 Contenu : notification de réinitialisation, credentials, lien login, rappel changement MDP
  - [x] 2.3 Variables : `email`, `temporaryPassword`, `loginUrl`

- [x] **Tâche 3 — Ajouter la route** (AC2)
  - [x] 3.1 Route `POST /admin/users/:id/reset-password` ajoutée dans le groupe superAdmin
  - [x] 3.2 POST utilisé (action non idempotente avec effets de bord)

- [x] **Tâche 4 — Ajouter le bouton et le modal dans Users/Index.tsx** (AC1)
  - [x] 4.1 Bouton "Réinitialiser MDP" (variant `outline`, taille `sm`) ajouté dans la colonne Actions
  - [x] 4.2 Modal Dialog avec `role="alertdialog"`, titre, description, bouton confirmation green-700 + annuler
  - [x] 4.3 Utilise `router.post()` d'Inertia pour l'action
  - [x] 4.4 State `resetTarget` séparé du `deactivateTarget`
  - [x] 4.5 Tous les textes via `t()`

- [x] **Tâche 5 — Ajouter les clés i18n** (AC1, AC2)
  - [x] 5.1 FR : 4 clés ajoutées (`reset_password_button`, `reset_password_success`, `reset_password_success_no_email`, `reset_password_modal.*`)
  - [x] 5.2 EN : mêmes clés traduites
  - [x] 5.3 Toutes les clés nécessaires ajoutées

- [x] **Tâche 6 — Tests fonctionnels** (AC2, AC3)
  - [x] 6.1 `tests/functional/admin/users_reset_password.spec.ts` créé
  - [x] 6.2 Test : POST → 302, `passwordChanged=false`, hash modifié
  - [x] 6.3 Test : log `actionType='password_reset'` créé
  - [x] 6.4 Test : admin POST → 302 redirect dashboard
  - [x] 6.5 Test : POST ID inexistant → 404

- [x] **Tâche 7 — Validation finale**
  - [x] 7.1 `node ace test` → 163 tests passent
  - [x] 7.2 Aucune régression
  - [x] 7.3 `npm run lint` → 0 erreur
  - [x] 7.4 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

La réinitialisation du mot de passe est une action du super admin qui génère un nouveau MDP provisoire, le hash via le mixin AuthFinder, remet `passwordChanged = false`, envoie le MDP en clair par email, et logue l'action. L'admin réinitialisé suivra automatiquement le flux de première connexion (Story 2.3) grâce au check `passwordChanged` dans le `AdminMiddleware`.

### Note sur le hashage

L'épics mentionne "hashé (bcrypt)" mais le projet utilise **scrypt** (défaut AdonisJS 6 via le mixin `AuthFinder`). Le hashage est automatique au `save()` — on passe le mot de passe en clair dans `passwordHash` et le hook `beforeSave` le hash.

### Invalidation des sessions

Comme pour la Story 3.4, le `AdminMiddleware` gère l'invalidation de facto. Quand `passwordChanged = false`, le middleware redirige vers `/admin/auth/change-password` à chaque requête. L'admin réinitialisé ne peut plus accéder au dashboard tant qu'il n'a pas changé son MDP.

### Code existant à réutiliser

- **UsersController** (`app/controllers/admin/users_controller.ts`) : existe avec `index()`, `create()`, `store()`, `toggleActive()`. Ajouter `resetPassword()`.
- **Routes** : le groupe superAdmin est dans `start/routes.ts` (lignes 59-67). Ajouter la route POST dans ce groupe.
- **AdminUser model** : champs `passwordHash` et `passwordChanged` disponibles. Le mixin AuthFinder hash automatiquement `passwordHash` au `save()`.
- **ActivityLogService** : `ActionType.PASSWORD_RESET` disponible.
- **Mail** : `mail.send()` et `env.get('APP_URL')` déjà utilisés dans `store()` (Story 3.3). Même pattern.
- **Email template** : `resources/views/emails/admin_invitation.edge` existe comme modèle. Créer un template similaire pour la réinitialisation.
- **Dialog** : composant `Dialog` shadcn/ui déjà importé et utilisé dans `Users/Index.tsx` (modal désactivation, Story 3.4).
- **`string.generateRandom(16)`** : déjà importé dans le contrôleur (Story 3.3).
- **Pattern try/catch email** : déjà implémenté dans `store()` — même pattern pour `resetPassword()`.

### Pattern contrôleur — structure cible

```typescript
async resetPassword({ params, auth, response, session }: HttpContext) {
  const user = await AdminUser.findOrFail(params.id)

  const temporaryPassword = string.generateRandom(16)
  user.passwordHash = temporaryPassword
  user.passwordChanged = false
  await user.save()

  await ActivityLogService.log({
    adminUserId: auth.user!.id,
    actionType: ActionType.PASSWORD_RESET,
    resourceType: 'admin_user',
    resourceId: user.id,
  })

  try {
    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Réinitialisation de mot de passe — Anta')
        .htmlView('emails/admin_password_reset', {
          email: user.email,
          temporaryPassword,
          loginUrl: `${env.get('APP_URL')}/admin/login`,
        })
    })
    session.flash('success', 'users.reset_password_success')
  } catch (error) {
    logger.error({ err: error, email: user.email }, 'Failed to send password reset email')
    session.flash('success', 'users.reset_password_success_no_email')
  }

  return response.redirect('/admin/users')
}
```

### Choix POST vs PATCH

`POST` est utilisé plutôt que `PATCH` car la réinitialisation génère une nouvelle ressource (nouveau MDP) et déclenche des effets de bord (email, invalidation session). Ce n'est pas une mise à jour partielle idempotente.

### Clés i18n à ajouter

**FR (`inertia/locales/admin/fr.json`) :**
```json
"users": {
  "reset_password_button": "Réinitialiser MDP",
  "reset_password_success": "Mot de passe réinitialisé. Un email a été envoyé.",
  "reset_password_success_no_email": "Mot de passe réinitialisé, mais l'envoi de l'email a échoué. Transmettez le mot de passe manuellement.",
  "reset_password_modal": {
    "title": "Réinitialiser le mot de passe ?",
    "description": "Un nouveau mot de passe provisoire sera généré et envoyé par email. L'administrateur devra le changer à sa prochaine connexion.",
    "confirm": "Réinitialiser"
  }
}
```

**EN (`inertia/locales/admin/en.json`) :**
```json
"users": {
  "reset_password_button": "Reset password",
  "reset_password_success": "Password reset. An email has been sent.",
  "reset_password_success_no_email": "Password reset, but the email could not be sent. Please share the password manually.",
  "reset_password_modal": {
    "title": "Reset password?",
    "description": "A new temporary password will be generated and sent by email. The administrator will need to change it on their next sign-in.",
    "confirm": "Reset"
  }
}
```

**Note :** ces clés s'ajoutent aux clés `users.*` existantes (Stories 3.2–3.4). Fusionner dans le même objet.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `resources/views/emails/admin_password_reset.edge` | Template email de réinitialisation MDP (branding Anta) |
| `tests/functional/admin/users_reset_password.spec.ts` | Tests fonctionnels (4-5 tests) |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/users_controller.ts` | Ajouter méthode `resetPassword()` |
| `start/routes.ts` | Ajouter `POST /admin/users/:id/reset-password` dans le groupe superAdmin |
| `inertia/pages/admin/Users/Index.tsx` | Ajouter bouton "Réinitialiser MDP" + modal de confirmation |
| `inertia/locales/admin/fr.json` | Ajouter les clés `users.reset_password_*`, `users.reset_password_modal.*` |
| `inertia/locales/admin/en.json` | Ajouter les mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** utiliser bcrypt — le projet utilise scrypt (défaut AdonisJS 6 via AuthFinder mixin)
- **NE PAS** exposer le mot de passe provisoire dans la réponse HTTP ou les props Inertia — uniquement dans l'email
- **NE PAS** bloquer la réinitialisation si l'envoi d'email échoue — réinitialiser le MDP en BDD quand même et avertir le super admin
- **NE PAS** réutiliser le modal de désactivation — créer un state `resetTarget` séparé
- **NE PAS** utiliser PATCH — POST est plus approprié (action non idempotente avec effets de bord)
- **NE PAS** oublier de remettre `passwordChanged = false` — sinon l'admin réinitialisé ne sera pas redirigé vers le flux de changement de MDP

### Tests — patterns à suivre

- **Transaction rollback** : `db.beginGlobalTransaction()` en setup, `db.rollbackGlobalTransaction()` en teardown
- **Fixture helper** : réutiliser le pattern `createAdminUser()` des tests précédents
- **Vérification MDP changé** : sauvegarder le `passwordHash` avant le POST, puis vérifier qu'il a changé après `user.refresh()`
- **Vérification `passwordChanged`** : `assert.isFalse(user.passwordChanged)` après le POST
- **CSRF** : `.withCsrfToken()` obligatoire pour POST

### Sécurité

- Seul le super admin peut accéder à la route (SuperAdminMiddleware)
- Le CSRF est automatique via middleware AdonisJS
- Le mot de passe provisoire est envoyé en clair par email (comportement attendu pour une réinitialisation). L'admin DEVRA le changer à la prochaine connexion (`password_changed = false`)
- Le hash scrypt est automatique via le mixin AuthFinder

### Dépendances cross-story

- **Story 2.3** (changement MDP première connexion) : l'admin réinitialisé suivra ce flux (car `password_changed = false`)
- **Story 3.1** (ActivityLogService) : `ActionType.PASSWORD_RESET` disponible
- **Story 3.3** (création admin) : pattern email + try/catch réutilisé
- **Story 3.4** (désactivation) : modal Dialog pattern réutilisé dans Index.tsx
- **Story 3.6** : ajoutera le bouton "Supprimer" dans la même colonne Actions

### Previous Story Intelligence

**Story 3.4 — Désactivation d'un compte admin :**
- Le modal Dialog est déjà implémenté dans Index.tsx avec un state `deactivateTarget`. Ajouter un state `resetTarget` séparé.
- Le `router.patch()` d'Inertia est utilisé pour toggle-active. Utiliser `router.post()` pour reset-password (même pattern, verbe différent).
- Prettier exige des multi-lignes pour les `session.flash()` longs.
- Tests : 159/159 passent. Ne casser aucun test existant.

**Story 3.3 — Création d'un compte admin :**
- Pattern email avec try/catch et deux flash messages (succès / succès_no_email) déjà en place dans `store()`.
- `string.generateRandom(16)` et `mail.send()` déjà importés dans le contrôleur.
- L'envoi d'email Mailgun échoue en test — le try/catch gère le cas.

**Gotchas :**
- `Link` doit venir de `@adonisjs/inertia/react` — mais pour les actions (PATCH/POST), utiliser `router` d'`@inertiajs/react`.
- Le registre `.adonisjs` ne détecte pas toujours les nouvelles méthodes — vérifier après ajout.

### Project Structure Notes

Alignement avec `architecture.md` :
- `app/controllers/admin/users_controller.ts` → contrôleur déjà existant, ajout de méthode
- Route POST → convention pour les actions non idempotentes
- Template email dans `resources/views/emails/` → aligné
- Tests dans `tests/functional/admin/` → aligné

### References

- [Source: epics.md#Story 3.5] — Acceptance criteria et définition
- [Source: architecture.md#Authentification] — scrypt (pas bcrypt), mot de passe provisoire, flux première connexion
- [Source: architecture.md#Logs d'Activité] — `ActivityLogService.log()` avec `actionType: 'password_reset'`
- [Source: app/controllers/admin/users_controller.ts] — Contrôleur existant (index, create, store, toggleActive)
- [Source: inertia/pages/admin/Users/Index.tsx] — Colonne Actions avec boutons désactiver/réactiver + modal
- [Source: start/routes.ts:59-67] — Groupe routes superAdmin existant
- [Source: app/services/activity_log_service.ts] — Service de logging prêt
- [Source: app/enums/action_type.ts] — `ActionType.PASSWORD_RESET` disponible
- [Source: resources/views/emails/admin_invitation.edge] — Template email modèle
- [Source: app/middleware/admin_middleware.ts:32] — Vérifie `passwordChanged`, redirige vers change-password
- [Source: _bmad-output/implementation-artifacts/3-4-desactivation-dun-compte-admin.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/3-3-creation-dun-compte-admin.md] — Pattern email + try/catch

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Aucun problème spécifique. Le pattern est identique à celui de Story 3.3 (store) — les imports `string`, `mail`, `logger`, `env` étaient déjà dans le contrôleur.
- Le `Row not found` warn dans les logs de test est normal — test 404 avec UUID inexistant.

### Completion Notes List

- **AC1 satisfait** : modal Dialog avec `role="alertdialog"`, titre, description expliquant la procédure, bouton "Réinitialiser" (green-700) + "Annuler". State `resetTarget` séparé du `deactivateTarget`.
- **AC2 satisfait** : MDP provisoire 16 chars généré, `passwordHash` mis à jour (auto-hashé scrypt), `passwordChanged = false`, email envoyé via template Edge dédié, log `ActivityLogService` (`actionType: 'password_reset'`), toast via flash.
- **AC3 satisfait** : le flux première connexion est garanti car `passwordChanged = false` → `AdminMiddleware` redirige vers `/admin/auth/change-password`. Déjà couvert par l'infrastructure existante (Story 2.3).
- **Tests totaux** : 163/163 passent (159 existants + 4 nouveaux). Lint et typecheck verts.

### File List

**Créés :**
- `resources/views/emails/admin_password_reset.edge` — template email de réinitialisation MDP (branding Anta)
- `tests/functional/admin/users_reset_password.spec.ts` — 4 tests fonctionnels

**Modifiés :**
- `app/controllers/admin/users_controller.ts` — ajout méthode `resetPassword()` avec génération MDP + email + ActivityLog
- `start/routes.ts` — ajout `POST /admin/users/:id/reset-password` dans le groupe superAdmin
- `inertia/pages/admin/Users/Index.tsx` — ajout bouton "Réinitialiser MDP" + modal Dialog confirmation + state `resetTarget`
- `inertia/locales/admin/fr.json` — ajout 4 clés i18n `users.reset_password_*`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 3.5 (Réinitialisation du mot de passe admin). Méthode `resetPassword()` dans UsersController, template email Edge, route POST, bouton + modal Dialog dans Index.tsx, i18n FR/EN. 4 tests fonctionnels ajoutés. Tests totaux : 163/163.

## Review Findings

- [x] [Review][Decision→Patch] Reset MDP n'invalide pas la session active de la cible (AC2) — RÉSOLU (option : marqueur de version) : nouvelle colonne `session_version` (migration `1775918741000`). `resetPassword` l'incrémente ; `auth_controller.login` stocke `authVersion` en session ; `AdminMiddleware` compare `(session.get('authVersion') ?? 0) !== user.sessionVersion` → logout + redirect login. Toute session ouverte avant le reset est ainsi invalidée. Test : `sessionVersion` passe à 1 après reset. [migration, app/models/admin_user.ts, app/middleware/admin_middleware.ts, app/controllers/admin/auth_controller.ts, app/controllers/admin/users_controller.ts]
- [x] [Review][Decision→Patch] `resetPassword` sans garde auto-cible — RÉSOLU : garde `params.id === auth.user!.id` ajouté (flash `users.self_reset_error`), cohérent avec `toggleActive`/`destroy`. Test ajouté. [app/controllers/admin/users_controller.ts]
