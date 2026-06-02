# Story 3.6 : Suppression d'un compte admin

Status: done

## Story

En tant que super administrateur,
Je veux supprimer définitivement un compte administrateur et ses données personnelles,
Afin de respecter le droit à l'effacement (RGPD) — FR39.

## Acceptance Criteria

**AC1 — Modal de confirmation pour la suppression**

- **Given** le super admin clique sur "Supprimer" sur un compte admin
- **When** le modal de confirmation s'affiche
- **Then** il indique explicitement : "Cette action est irréversible. Le compte et les logs d'activité associés seront supprimés. Les productions créées par cet administrateur seront conservées."
- **And** le bouton de confirmation est rouge et libellé "Supprimer définitivement"

**AC2 — Suppression effective avec nettoyage des données**

- **Given** le super admin confirme la suppression
- **When** l'action est traitée
- **Then** l'enregistrement `admin_users` est supprimé de la base de données
- **And** tous les enregistrements `admin_activity_logs` liés à ce compte sont supprimés (CASCADE automatique via FK)
- **And** les enregistrements `productions` créés par ce compte voient leur `created_by_id` mis à `null` (SET NULL automatique via FK)
- **And** toutes les sessions actives du compte sont invalidées (de facto via AdminMiddleware)
- **And** un toast succès s'affiche : "Compte supprimé définitivement."

**AC3 — Session invalidée après suppression**

- **Given** le compte supprimé tente de se connecter (session expirée non encore nettoyée)
- **When** la session est vérifiée
- **Then** l'utilisateur est déconnecté et redirigé vers `/admin/login`
- **Note** : le `AdminMiddleware` tente `auth.authenticateUsing(['web'])` qui échoue si le user n'existe plus en BDD → redirect login. Aucun changement de code nécessaire.

## Tasks / Subtasks

- [x] **Tâche 1 — Ajouter la méthode `destroy` dans UsersController** (AC2)
  - [x] 1.1 Méthode `destroy({ params, auth, response, session }: HttpContext)` ajoutée
  - [x] 1.2 Protection auto-suppression : `params.id === auth.user!.id` → flash error + redirect
  - [x] 1.3 Charge l'admin cible via `AdminUser.findOrFail(params.id)`
  - [x] 1.4 `await user.delete()` — FK CASCADE/SET NULL gèrent le nettoyage
  - [x] 1.5 Flash `users.delete_success` puis redirect `/admin/users`

- [x] **Tâche 2 — Ajouter la route** (AC2)
  - [x] 2.1 Route `DELETE /admin/users/:id` ajoutée dans le groupe superAdmin

- [x] **Tâche 3 — Ajouter le bouton et le modal dans Users/Index.tsx** (AC1)
  - [x] 3.1 Bouton "Supprimer" (variant `ghost`, rouge, taille `sm`) ajouté dans la colonne Actions
  - [x] 3.2 Modal Dialog avec `role="alertdialog"`, message d'irréversibilité, bouton "Supprimer définitivement" rouge
  - [x] 3.3 Utilise `router.delete()` d'Inertia
  - [x] 3.4 State `deleteTarget` séparé des autres modaux
  - [x] 3.5 Tous les textes via `t()`

- [x] **Tâche 4 — Ajouter les clés i18n** (AC1, AC2)
  - [x] 4.1 FR : 4 clés ajoutées (`delete_button`, `delete_success`, `self_delete_error`, `delete_modal.*`)
  - [x] 4.2 EN : mêmes clés traduites
  - [x] 4.3 Toutes les clés ajoutées

- [x] **Tâche 5 — Tests fonctionnels** (AC2, AC3)
  - [x] 5.1 `tests/functional/admin/users_delete.spec.ts` créé
  - [x] 5.2 Test : DELETE → 302, admin supprimé de la BDD
  - [x] 5.3 Test : admin_activity_logs supprimés en CASCADE
  - [x] 5.4 Test : auto-suppression → 302 + compte intact
  - [x] 5.5 Test : admin DELETE → 302 redirect dashboard
  - [x] 5.6 Test : DELETE ID inexistant → 404

- [x] **Tâche 6 — Validation finale**
  - [x] 6.1 `node ace test` → 168 tests passent
  - [x] 6.2 Aucune régression
  - [x] 6.3 `npm run lint` → 0 erreur
  - [x] 6.4 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

La suppression est une opération simple grâce aux contraintes FK configurées dans les migrations. Un simple `await user.delete()` déclenche les cascades PostgreSQL :
- `admin_activity_logs` → supprimés (ON DELETE CASCADE)
- `productions.created_by_id` → mis à NULL (ON DELETE SET NULL)
- `admin_users.created_by_id` (self-ref) → mis à NULL (ON DELETE SET NULL)

Pas besoin de logique de nettoyage manuelle côté applicatif.

### Pas de log ActivityLogService pour la suppression

La suppression efface les logs de l'admin ciblé via CASCADE. Logger la suppression elle-même via `ActivityLogService` n'a pas de sens : le log appartiendrait au super admin qui a effectué la suppression, pas à l'admin supprimé. Comme l'epic ne le mentionne pas explicitement (contrairement aux stories 3.3–3.5 qui listent l'appel ActivityLogService), et que les logs de l'admin sont de toute façon supprimés, on ne logue pas cette action.

### Invalidation des sessions

Même pattern que les stories précédentes. Le `AdminMiddleware` tente `auth.authenticateUsing(['web'])` à chaque requête. Si l'admin n'existe plus en BDD, l'authentification échoue → redirect `/admin/login`. Aucun changement de code nécessaire.

### Code existant à réutiliser

- **UsersController** (`app/controllers/admin/users_controller.ts`) : existe avec `index()`, `create()`, `store()`, `toggleActive()`, `resetPassword()`. Ajouter `destroy()`.
- **Routes** : le groupe superAdmin dans `start/routes.ts`. Ajouter la route DELETE dans ce groupe.
- **AdminUser model** : méthode `.delete()` disponible via Lucid ORM.
- **Dialog** : composant `Dialog` shadcn/ui déjà importé et utilisé dans `Users/Index.tsx` (modaux désactivation + réinitialisation).
- **Pattern protection auto-action** : déjà implémenté dans `toggleActive()` (Story 3.4) — même check `params.id === auth.user!.id`.

### Protection contre l'auto-suppression

Même pattern que Story 3.4 (auto-désactivation) : `if (params.id === auth.user!.id)` → flash error + redirect. Le super admin ne doit pas pouvoir se supprimer lui-même.

### Clés i18n à ajouter

**FR (`inertia/locales/admin/fr.json`) :**
```json
"users": {
  "delete_button": "Supprimer",
  "delete_success": "Compte supprimé définitivement.",
  "self_delete_error": "Vous ne pouvez pas supprimer votre propre compte.",
  "delete_modal": {
    "title": "Supprimer définitivement ce compte ?",
    "description": "Cette action est irréversible. Le compte et les logs d'activité associés seront supprimés. Les productions créées par cet administrateur seront conservées.",
    "confirm": "Supprimer définitivement"
  }
}
```

**EN (`inertia/locales/admin/en.json`) :**
```json
"users": {
  "delete_button": "Delete",
  "delete_success": "Account permanently deleted.",
  "self_delete_error": "You cannot delete your own account.",
  "delete_modal": {
    "title": "Permanently delete this account?",
    "description": "This action is irreversible. The account and associated activity logs will be deleted. Productions created by this administrator will be kept.",
    "confirm": "Delete permanently"
  }
}
```

### Fichiers à créer

| Fichier | Description |
|---|---|
| `tests/functional/admin/users_delete.spec.ts` | Tests fonctionnels (5 tests) |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/users_controller.ts` | Ajouter méthode `destroy()` |
| `start/routes.ts` | Ajouter `DELETE /admin/users/:id` dans le groupe superAdmin |
| `inertia/pages/admin/Users/Index.tsx` | Ajouter bouton "Supprimer" + modal de confirmation |
| `inertia/locales/admin/fr.json` | Ajouter les clés `users.delete_*`, `users.delete_modal.*` |
| `inertia/locales/admin/en.json` | Ajouter les mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** supprimer manuellement les `admin_activity_logs` — la FK CASCADE s'en charge
- **NE PAS** mettre à jour manuellement `productions.created_by_id` — la FK SET NULL s'en charge
- **NE PAS** permettre au super admin de se supprimer lui-même — check `params.id !== auth.user!.id`
- **NE PAS** soft-delete — FR39 exige la suppression effective pour conformité RGPD
- **NE PAS** envoyer d'email de notification à l'admin supprimé — le compte n'existe plus, et aucun email de notification n'est mentionné dans l'epic
- **NE PAS** appeler `ActivityLogService.log()` pour cette action — les logs de l'admin supprimé sont effacés par CASCADE, et l'epic ne demande pas de loguer la suppression

### Tests — patterns à suivre

- **Transaction rollback** : `db.beginGlobalTransaction()` en setup, `db.rollbackGlobalTransaction()` en teardown
- **Fixture helper** : réutiliser le pattern `createAdminUser()` des tests précédents
- **Vérification suppression** : `await AdminUser.find(id)` → `assert.isNull(result)` après le DELETE
- **Vérification CASCADE** : créer un `AdminActivityLog` pour l'admin, puis vérifier qu'il est supprimé après le DELETE de l'admin
- **CSRF** : `.withCsrfToken()` obligatoire pour DELETE

### Sécurité

- Seul le super admin peut accéder à la route (SuperAdminMiddleware)
- Le super admin ne peut pas se supprimer lui-même
- Le CSRF est automatique via middleware AdonisJS
- Les sessions de l'admin supprimé sont invalidées de facto via AdminMiddleware
- La suppression est conforme RGPD : toutes les données personnelles (email, hash MDP, logs) sont effacées

### Dépendances cross-story

- **Story 3.1** (ActivityLogService) : les logs de l'admin sont supprimés par CASCADE — pas de log de suppression
- **Story 3.4** (désactivation) : pattern protection auto-action réutilisé
- **Stories 3.2–3.5** : tous les boutons de la colonne Actions sont maintenant présents après cette story

### Previous Story Intelligence

**Story 3.5 — Réinitialisation MDP :**
- 3 modaux Dialog sont déjà en place (deactivateTarget, resetTarget). Ajouter `deleteTarget` comme 4e state.
- Tests : 163/163 passent. Ne casser aucun test existant.

**Story 3.4 — Désactivation :**
- Pattern protection auto-action : `if (params.id === auth.user!.id)` → flash error + redirect. Réutiliser.
- `router.patch()` / `router.post()` d'Inertia utilisés. Utiliser `router.delete()` ici.

**Gotchas :**
- `Link` doit venir de `@adonisjs/inertia/react`, mais pour les actions (DELETE), utiliser `router` d'`@inertiajs/react`.
- Prettier exige des multi-lignes pour les longues chaînes.

### Project Structure Notes

Alignement avec `architecture.md` :
- `app/controllers/admin/users_controller.ts` → contrôleur existant, ajout de méthode
- Route DELETE → convention REST pour les suppressions
- Tests dans `tests/functional/admin/` → aligné

### References

- [Source: epics.md#Story 3.6] — Acceptance criteria et définition
- [Source: architecture.md#Conformité] — FR39, suppression de comptes admin (RGPD)
- [Source: app/controllers/admin/users_controller.ts] — Contrôleur existant
- [Source: inertia/pages/admin/Users/Index.tsx] — Colonne Actions avec 3 boutons existants
- [Source: start/routes.ts:59-70] — Groupe routes superAdmin existant
- [Source: database/migrations/1775918737632_create_admin_activity_logs_table.ts:14] — FK CASCADE sur admin_user_id
- [Source: database/migrations/1775918733547_create_productions_table.ts:45] — FK SET NULL sur created_by_id
- [Source: database/migrations/1775918726313_create_admin_users_table.ts:27] — FK SET NULL sur created_by_id (self-ref)
- [Source: app/middleware/admin_middleware.ts] — Auth échoue si user supprimé → redirect login
- [Source: _bmad-output/implementation-artifacts/3-5-reinitialisation-mot-de-passe-admin.md] — Intelligence story précédente

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Prettier a reformaté une chaîne de méthodes `.delete().loginAs().withCsrfToken()` sur une seule ligne dans le test CASCADE — corrigé via `npx prettier --write`.

### Completion Notes List

- **AC1 satisfait** : modal Dialog avec `role="alertdialog"`, message d'irréversibilité explicite, bouton "Supprimer définitivement" rouge + "Annuler". State `deleteTarget` séparé.
- **AC2 satisfait** : `user.delete()` supprime l'admin de la BDD. FK CASCADE supprime les `admin_activity_logs` liés. FK SET NULL met `productions.created_by_id` à null. Toast "Compte supprimé définitivement." via flash.
- **AC3 satisfait** : le `AdminMiddleware` échoue à `authenticateUsing()` si le user n'existe plus → redirect `/admin/login`. Aucun changement nécessaire — vérifié par l'infrastructure existante.
- **Tests totaux** : 168/168 passent (163 existants + 5 nouveaux). Lint et typecheck verts.

### File List

**Créés :**
- `tests/functional/admin/users_delete.spec.ts` — 5 tests fonctionnels (suppression, CASCADE logs, auto-suppression, accès admin, 404)

**Modifiés :**
- `app/controllers/admin/users_controller.ts` — ajout méthode `destroy()` avec protection auto-suppression
- `start/routes.ts` — ajout `DELETE /admin/users/:id` dans le groupe superAdmin
- `inertia/pages/admin/Users/Index.tsx` — ajout bouton "Supprimer" (ghost rouge) + modal Dialog confirmation + state `deleteTarget`
- `inertia/locales/admin/fr.json` — ajout 4 clés i18n `users.delete_*`, `users.delete_modal.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 3.6 (Suppression d'un compte admin — RGPD). Méthode `destroy()` dans UsersController, route DELETE, bouton ghost rouge + modal Dialog dans Index.tsx, FK CASCADE/SET NULL gèrent le nettoyage, i18n FR/EN. 5 tests fonctionnels ajoutés. Tests totaux : 168/168.

## Review Findings

- [x] [Review][Decision→Patch] `destroy()` n'écrit aucun log d'activité — RÉSOLU (option : ajouter le log) : `ActivityLogService.log({ actionType: DELETE, resourceType: 'admin_user', resourceId, adminUserId: acteur })` appelé AVANT `user.delete()`. Attribué au super admin acteur → survit au CASCADE. Garde super_admin également ajouté. Tests : log delete créé + suppression d'un super_admin bloquée. [app/controllers/admin/users_controller.ts]
