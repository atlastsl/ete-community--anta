# Story 3.4 : Désactivation d'un compte admin

Status: done

## Story

En tant que super administrateur,
Je veux désactiver un compte administrateur,
Afin d'en bloquer immédiatement l'accès sans supprimer ses données (FR33).

## Acceptance Criteria

**AC1 — Modal de confirmation pour la désactivation**

- **Given** le super admin clique sur "Désactiver" sur un compte actif
- **When** le modal de confirmation s'affiche
- **Then** il indique clairement : "Cet administrateur ne pourra plus se connecter. Ses productions seront conservées."
- **And** un bouton "Désactiver" (rouge) et un bouton "Annuler" sont présents

**AC2 — Désactivation effective**

- **Given** le super admin confirme la désactivation
- **When** l'action est traitée
- **Then** `is_active` passe à `false` en base de données
- **And** toutes les sessions actives de ce compte sont invalidées immédiatement
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'update', resourceType: 'admin_user' })`
- **And** un toast succès s'affiche : "Compte désactivé."

**AC3 — Réactivation sans modal**

- **Given** un compte est désactivé
- **When** le super admin clique sur "Réactiver"
- **Then** `is_active` repasse à `true` sans modal de confirmation (action réversible)
- **And** un toast succès s'affiche : "Compte réactivé."

**AC4 — Connexion refusée après désactivation**

- **Given** un compte désactivé tente de se connecter
- **When** les credentials sont soumis
- **Then** la connexion est refusée (voir Story 2.2)
- **Note** : déjà couvert par le `AdminMiddleware` (vérifie `isActive` à chaque requête) et par le `AuthController.login()` (vérifie `isActive` après `verifyCredentials`). Cette story s'assure seulement que le flag `isActive` est bien modifié.

## Tasks / Subtasks

- [x] **Tâche 1 — Ajouter la méthode `toggleActive` dans UsersController** (AC2, AC3)
  - [x] 1.1 Dans `app/controllers/admin/users_controller.ts`, ajouter la méthode `toggleActive({ params, auth, response, session }: HttpContext)`
  - [x] 1.2 Charger l'admin cible via `AdminUser.findOrFail(params.id)`
  - [x] 1.3 Empêcher la désactivation de soi-même : si `params.id === auth.user!.id` → flash error + redirect
  - [x] 1.4 Inverser `user.isActive` (`!user.isActive`) et sauvegarder
  - [x] 1.5 Appeler `ActivityLogService.log({ adminUserId: auth.user!.id, actionType: ActionType.UPDATE, resourceType: 'admin_user', resourceId: user.id })`
  - [x] 1.6 Flash `session.flash('success', ...)` conditionnel puis redirect vers `/admin/users`

- [x] **Tâche 2 — Ajouter la route** (AC2, AC3)
  - [x] 2.1 Dans `start/routes.ts`, dans le groupe superAdmin, ajouter : `router.patch('users/:id/toggle-active', [controllers.admin.Users, 'toggleActive']).as('admin.users.toggle-active')`
  - [x] 2.2 Route DANS le groupe middleware `superAdmin()` existant — vérifié

- [x] **Tâche 3 — Ajouter les boutons d'action et le modal dans Users/Index.tsx** (AC1, AC2, AC3)
  - [x] 3.1 Remplacé le placeholder `{/* Actions: Stories 3.4–3.6 */}` par les boutons d'action
  - [x] 3.2 Pour les comptes actifs : bouton "Désactiver" (variant `destructive`, taille `sm`)
  - [x] 3.3 Pour les comptes inactifs : bouton "Réactiver" (variant `outline`, taille `sm`)
  - [x] 3.4 Modal de confirmation (Dialog shadcn/ui) pour la désactivation : `role="alertdialog"`, titre, description, bouton rouge + annuler, fermeture Échap
  - [x] 3.5 La réactivation est directe (pas de modal) — `router.patch` Inertia directement au clic
  - [x] 3.6 Utilise `router.patch(`/admin/users/${user.id}/toggle-active`)` pour les deux actions
  - [x] 3.7 Tous les textes via `t()` — aucune string en dur

- [x] **Tâche 4 — Ajouter les clés i18n** (AC1, AC2, AC3)
  - [x] 4.1 Dans `inertia/locales/admin/fr.json`, ajouté 7 clés : `deactivate_button`, `reactivate_button`, `deactivate_success`, `reactivate_success`, `self_deactivate_error`, `deactivate_modal.*`
  - [x] 4.2 Dans `inertia/locales/admin/en.json`, mêmes clés traduites
  - [x] 4.3 Toutes les clés nécessaires ajoutées

- [x] **Tâche 5 — Tests fonctionnels** (AC2, AC3, AC4)
  - [x] 5.1 Créé `tests/functional/admin/users_toggle_active.spec.ts`
  - [x] 5.2 Test : super admin PATCH sur compte actif → 302, `isActive=false` en BDD
  - [x] 5.3 Test : log `actionType='update'`, `resourceType='admin_user'` créé
  - [x] 5.4 Test : super admin PATCH sur compte inactif → 302, `isActive=true` en BDD
  - [x] 5.5 Test : auto-désactivation → 302, `isActive` inchangé
  - [x] 5.6 Test : admin PATCH → 302 redirect dashboard (SuperAdminMiddleware)
  - [x] 5.7 Test : PATCH avec ID inexistant → 404

- [x] **Tâche 6 — Validation finale**
  - [x] 6.1 `node ace test` → 159 tests passent
  - [x] 6.2 `node ace test --suite functional` → aucune régression
  - [x] 6.3 `npm run lint` → 0 erreur
  - [x] 6.4 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

La désactivation/réactivation est une bascule sur le champ `isActive` du modèle `AdminUser`. Une seule route `PATCH /admin/users/:id/toggle-active` gère les deux cas. Côté frontend, la désactivation passe par un modal de confirmation (action destructrice non réversible immédiatement pour l'admin ciblé), tandis que la réactivation est directe (action réversible).

### Invalidation des sessions

Le `AdminMiddleware` (`app/middleware/admin_middleware.ts`, ligne 21) vérifie `isActive` à chaque requête authentifiée. Si `isActive === false`, le middleware :
1. Détruit la session via `auth.use('web').logout()`
2. Flashe `errors.account_inactive`
3. Redirige vers `/admin/login`

Cela signifie que la session est invalidée de facto à la prochaine requête HTTP de l'admin désactivé. Il n'y a pas besoin de chercher et supprimer les sessions côté serveur — le middleware s'en charge. C'est le pattern recommandé pour les sessions cookie (pas de stockage serveur à nettoyer).

De plus, le `AuthController.login()` (ligne 58) vérifie aussi `isActive` après `verifyCredentials` — un compte désactivé ne peut PAS se reconnecter.

### Code existant à réutiliser

- **UsersController** (`app/controllers/admin/users_controller.ts`) : existe avec `index()`, `create()`, `store()`. Ajouter `toggleActive()`.
- **Routes** : le groupe superAdmin est dans `start/routes.ts` (lignes 59-64). Ajouter la route PATCH dans ce groupe.
- **AdminUser model** (`app/models/admin_user.ts`) : champ `isActive` (boolean) déjà disponible.
- **ActivityLogService** (`app/services/activity_log_service.ts`) : `ActionType.UPDATE` disponible.
- **Dialog** (`inertia/components/ui/dialog.tsx`) : composant shadcn/ui complet — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger`.
- **Badge** : variantes `destructive` et `outline` déjà utilisées dans Index.tsx pour le statut.
- **Toast** : flash messages automatiquement traduits et affichés via `sonner` dans `AdminLayout.tsx`.
- **Users/Index.tsx** (`inertia/pages/admin/Users/Index.tsx`) : placeholder `{/* Actions: Stories 3.4–3.6 */}` à remplacer. La colonne Actions est déjà dans le tableau.
- **Pattern Inertia** : utiliser `router.patch()` d'`@inertiajs/react` pour les actions PATCH sans navigation de page.

### Pattern Inertia pour l'action PATCH

```tsx
import { router } from '@inertiajs/react'

function handleToggleActive(userId: string) {
  router.patch(`/admin/users/${userId}/toggle-active`)
}
```

L'appel PATCH via Inertia inclut automatiquement le CSRF token. Après le redirect 302 côté serveur, Inertia recharge la page courante avec les nouvelles props (la liste est rafraîchie).

### Modal de confirmation (UX-DR14)

Le modal utilise le composant `Dialog` shadcn/ui existant. Pattern pour une action destructrice :

```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from '~/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent role="alertdialog">
    <DialogHeader>
      <DialogTitle>{t('users.deactivate_modal.title')}</DialogTitle>
      <DialogDescription>{t('users.deactivate_modal.description')}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">{t('actions.cancel')}</Button>
      </DialogClose>
      <Button variant="destructive" onClick={handleConfirm}>
        {t('users.deactivate_modal.confirm')}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Le bouton destructeur (rouge) est à droite, le bouton annuler à gauche (convention UX-DR14).

### Protection contre l'auto-désactivation

Le contrôleur doit empêcher le super admin de se désactiver lui-même. Check : `if (params.id === auth.user!.id)` → flash error + redirect. Sinon le super admin perdrait son propre accès.

### Clés i18n à ajouter

**FR (`inertia/locales/admin/fr.json`) :**
```json
"users": {
  "deactivate_button": "Désactiver",
  "reactivate_button": "Réactiver",
  "deactivate_success": "Compte désactivé.",
  "reactivate_success": "Compte réactivé.",
  "self_deactivate_error": "Vous ne pouvez pas désactiver votre propre compte.",
  "deactivate_modal": {
    "title": "Désactiver ce compte ?",
    "description": "Cet administrateur ne pourra plus se connecter. Ses productions seront conservées.",
    "confirm": "Désactiver"
  }
}
```

**EN (`inertia/locales/admin/en.json`) :**
```json
"users": {
  "deactivate_button": "Deactivate",
  "reactivate_button": "Reactivate",
  "deactivate_success": "Account deactivated.",
  "reactivate_success": "Account reactivated.",
  "self_deactivate_error": "You cannot deactivate your own account.",
  "deactivate_modal": {
    "title": "Deactivate this account?",
    "description": "This administrator will no longer be able to sign in. Their productions will be kept.",
    "confirm": "Deactivate"
  }
}
```

**Note :** ces clés s'ajoutent aux clés `users.*` existantes (Stories 3.2, 3.3). Fusionner dans le même objet.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `tests/functional/admin/users_toggle_active.spec.ts` | Tests fonctionnels (6-7 tests) |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/users_controller.ts` | Ajouter méthode `toggleActive()` |
| `start/routes.ts` | Ajouter `PATCH /admin/users/:id/toggle-active` dans le groupe superAdmin |
| `inertia/pages/admin/Users/Index.tsx` | Ajouter boutons Désactiver/Réactiver + modal de confirmation |
| `inertia/locales/admin/fr.json` | Ajouter les clés `users.deactivate_*`, `users.reactivate_*`, `users.deactivate_modal.*` |
| `inertia/locales/admin/en.json` | Ajouter les mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** créer deux routes séparées (deactivate/reactivate) — une seule route PATCH avec toggle est plus simple et cohérente
- **NE PAS** tenter de supprimer les sessions côté serveur (pas de table sessions accessible) — le `AdminMiddleware` gère l'invalidation
- **NE PAS** afficher un modal de confirmation pour la réactivation — c'est une action réversible, pas besoin de confirmation
- **NE PAS** permettre au super admin de se désactiver lui-même — check `params.id !== auth.user!.id`
- **NE PAS** utiliser `DELETE` comme verbe HTTP — c'est un update de statut, pas une suppression
- **NE PAS** oublier `role="alertdialog"` sur le DialogContent — requis par UX-DR14 pour l'accessibilité
- **NE PAS** utiliser `Link` d'Inertia pour les actions PATCH — utiliser `router.patch()` directement

### Tests — patterns à suivre

- **Transaction rollback** : `db.beginGlobalTransaction()` en setup, `db.rollbackGlobalTransaction()` en teardown
- **Fixture helper** : réutiliser le pattern `createAdminUser()` de `users_list.spec.ts` / `users_create.spec.ts`
- **Assertions PATCH** : `.patch('/admin/users/:id/toggle-active').loginAs(superAdmin).withCsrfToken().redirects(0)` → vérifier 302 + état en BDD après reload
- **CSRF** : `.withCsrfToken()` obligatoire pour les requêtes PATCH
- **404 test** : PATCH avec un UUID inexistant → 404 (via `findOrFail`)

### Sécurité

- Seul le super admin peut accéder à la route (SuperAdminMiddleware)
- Le super admin ne peut pas se désactiver lui-même (protection côté contrôleur)
- Le CSRF est automatique via middleware AdonisJS
- Les sessions de l'admin désactivé sont invalidées de facto via AdminMiddleware (vérifie isActive à chaque requête)
- Le login est refusé pour les comptes désactivés (AuthController.login vérifie isActive)

### Dépendances cross-story

- **Story 2.1** (AdminMiddleware) : vérifie `isActive` à chaque requête → invalidation de session de facto
- **Story 2.2** (login) : refuse la connexion si `isActive === false` → déjà testé
- **Story 3.1** (ActivityLogService) : `ActionType.UPDATE` disponible
- **Story 3.2** (liste admins) : badges actif/inactif et opacité déjà implémentés
- **Story 3.3** (création) : le contrôleur et les routes sont en place
- **Stories 3.5–3.6** : ajouteront les boutons "Réinitialiser MDP" et "Supprimer" dans la même colonne Actions

### Previous Story Intelligence

**Story 3.3 — Création d'un compte admin :**
- `inertia.render()` requiert un 2e argument même vide — `inertia.render('...', {})`.
- Le `Link` doit être importé depuis `@adonisjs/inertia/react` (pas `@inertiajs/react`) — règle ESLint.
- Les erreurs de validation VineJS retournent 302 (redirect back) et non 422 en contexte Inertia.
- Tests : 153/153 passent. Ne casser aucun test existant.

**Story 3.2 — Page de liste des administrateurs :**
- La colonne Actions est un placeholder vide `{/* Actions: Stories 3.4–3.6 */}`.
- Les badges actif/inactif sont déjà en place (green outline / destructive).
- L'opacité réduite (`opacity-60`) est appliquée aux lignes des comptes inactifs.

**Gotchas des stories précédentes :**
- `sessionApiClient` détruit la session entre requêtes — tester un seul PATCH par test fonctionnel
- Le registre `.adonisjs` ne détecte pas toujours les nouvelles méthodes de contrôleur automatiquement — vérifier
- L'envoi d'email échoue en test (pas de clé API Mailgun valide) — cette story n'envoie pas d'email, pas de problème

### Project Structure Notes

Alignement avec `architecture.md` :
- `app/controllers/admin/users_controller.ts` → contrôleur déjà existant, ajout de méthode
- Route PATCH → convention REST pour les mises à jour partielles
- Tests dans `tests/functional/admin/` → aligné

### References

- [Source: epics.md#Story 3.4] — Acceptance criteria et définition
- [Source: architecture.md#Contrôleurs] — `admin/UsersController.ts` avec gestion comptes
- [Source: architecture.md#Logs d'Activité] — `ActivityLogService.log()` avec `actionType: 'update'`
- [Source: architecture.md#Règles Obligatoires] — Passer par ActivityLogService, i18n
- [Source: app/controllers/admin/users_controller.ts] — Contrôleur existant (index, create, store)
- [Source: inertia/pages/admin/Users/Index.tsx:94] — Placeholder Actions `{/* Stories 3.4–3.6 */}`
- [Source: inertia/components/ui/dialog.tsx] — Composant Dialog shadcn/ui disponible
- [Source: app/middleware/admin_middleware.ts:21] — Vérifie `isActive`, invalide la session si false
- [Source: app/controllers/admin/auth_controller.ts:58] — Vérifie `isActive` au login
- [Source: start/routes.ts:59-64] — Groupe routes superAdmin existant
- [Source: app/services/activity_log_service.ts] — Service de logging prêt
- [Source: app/enums/action_type.ts] — `ActionType.UPDATE` disponible
- [Source: _bmad-output/implementation-artifacts/3-3-creation-dun-compte-admin.md] — Intelligence story précédente

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Ligne trop longue pour prettier dans `session.flash('success', user.isActive ? ... : ...)` — reformatée en multi-lignes avec `session.flash(\n  'success',\n  ...\n)`.
- Le `Row not found` warn dans les logs de test est normal — c'est le test `PATCH avec ID inexistant → 404` qui déclenche `findOrFail` sur un UUID inexistant.

### Completion Notes List

- **AC1 satisfait** : modal Dialog shadcn/ui avec `role="alertdialog"`, titre, description, bouton "Désactiver" rouge + "Annuler". Fermeture par Échap native.
- **AC2 satisfait** : `isActive` passe à `false` en BDD, session invalidée de facto via AdminMiddleware (vérifie `isActive` à chaque requête), log `ActivityLogService` créé (`actionType: 'update'`), toast "Compte désactivé." via flash.
- **AC3 satisfait** : réactivation directe sans modal, `isActive` repasse à `true`, toast "Compte réactivé."
- **AC4 satisfait** : le `AdminMiddleware` (Story 2.1) et `AuthController.login()` (Story 2.2) refusent déjà l'accès aux comptes inactifs — pas de changement nécessaire, vérifié par les tests existants.
- **Tests totaux** : 159/159 passent (153 existants + 6 nouveaux). Lint et typecheck verts.

### File List

**Créés :**
- `tests/functional/admin/users_toggle_active.spec.ts` — 6 tests fonctionnels (désactivation, réactivation, log, auto-désactivation, accès admin, 404)

**Modifiés :**
- `app/controllers/admin/users_controller.ts` — ajout méthode `toggleActive()` avec protection auto-désactivation
- `start/routes.ts` — ajout `PATCH /admin/users/:id/toggle-active` dans le groupe superAdmin
- `inertia/pages/admin/Users/Index.tsx` — ajout boutons Désactiver/Réactiver + modal de confirmation Dialog
- `inertia/locales/admin/fr.json` — ajout 7 clés i18n `users.deactivate_*`, `users.reactivate_*`, `users.deactivate_modal.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 3.4 (Désactivation d'un compte admin). Méthode `toggleActive()` dans UsersController, route PATCH, boutons d'action + modal Dialog dans Index.tsx, protection auto-désactivation, i18n FR/EN. 6 tests fonctionnels ajoutés. Tests totaux : 159/159.

## Review Findings

- [x] [Review][Decision→Patch] Un super_admin peut gérer un AUTRE super_admin — RÉSOLU (option : garde applicative) : `toggleActive`/`resetPassword`/`destroy` rejettent toute cible `role === 'super_admin'` (flash `users.protected_super_admin`) ; côté UI, les boutons d'action sont remplacés par `—` pour les lignes super_admin. Tests ajoutés (toggle/reset/delete sur super_admin → bloqué). [app/controllers/admin/users_controller.ts, inertia/pages/admin/Users/Index.tsx]
- [x] [Review][Patch] Double-soumission sur Désactiver / Réinitialiser / Supprimer — RÉSOLU : état `isProcessing` (onStart/onFinish des visites Inertia) désactive tous les boutons d'action et les boutons de confirmation des modaux pendant la requête. [inertia/pages/admin/Users/Index.tsx]
