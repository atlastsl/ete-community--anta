# Story 3.1 : Service centralisé ActivityLogService

Status: done

## Story

En tant que développeur,
Je veux un `ActivityLogService` centralisé pour tous les logs d'activité admin,
Afin que chaque action significative soit tracée de façon cohérente dans `admin_activity_logs` (NFR9).

## Acceptance Criteria

**AC1 — Interface et signature du service**

- **Given** `app/services/activity_log_service.ts` est implémenté
- **When** `ActivityLogService.log({ adminUserId, actionType, resourceType, resourceId })` est appelé
- **Then** un enregistrement est inséré dans `admin_activity_logs` avec les champs : `admin_user_id`, `action_type`, `resource_type`, `resource_id`, `created_at`

**AC2 — Typage strict des actionType**

- **Given** les `actionType` sont définis
- **When** on inspecte `ActivityLogService`
- **Then** les valeurs suivantes sont supportées : `'login' | 'create' | 'update' | 'publish' | 'unpublish' | 'delete' | 'password_reset'`
- **And** toute valeur hors de cet ensemble lève une erreur TypeScript à la compilation

**AC3 — Résilience aux erreurs DB**

- **Given** `ActivityLogService.log()` est appelé
- **When** une erreur survient lors de l'insertion en base
- **Then** l'erreur est loguée dans les logs serveur (via `logger`) mais ne bloque pas l'action principale (fail silently)

**AC4 — Intégration dans les contrôleurs existants**

- **Given** le service est en place
- **When** les contrôleurs admin effectuent des actions modifiant des données
- **Then** chaque contrôleur appelle `ActivityLogService.log()` — aucun log ad hoc dans les contrôleurs

**AC5 — Log de connexion (login)**

- **Given** un admin se connecte avec succès via `AuthController.login`
- **When** la connexion est validée
- **Then** `ActivityLogService.log({ actionType: 'login', resourceType: 'session' })` est appelé
- **And** le log est créé même si l'admin doit encore changer son mot de passe

## Tasks / Subtasks

- [x] **Tâche 1 — Créer l'enum ActionType** (AC2)
  - [x] 1.1 Créer `app/enums/action_type.ts` avec les 7 valeurs : `login`, `create`, `update`, `publish`, `unpublish`, `delete`, `password_reset`
  - [x] 1.2 Suivre le pattern existant des enums (`admin_role.ts`, `production_status.ts`) : objet `as const` + type exporté

- [x] **Tâche 2 — Implémenter ActivityLogService** (AC1, AC2, AC3)
  - [x] 2.1 Créer `app/services/activity_log_service.ts`
  - [x] 2.2 Méthode statique `log(params: LogParams): Promise<void>` — NE PAS retourner le log créé
  - [x] 2.3 `LogParams` interface : `{ adminUserId: string, actionType: ActionType, resourceType?: string, resourceId?: string }`
  - [x] 2.4 Wrap l'insertion dans un try/catch — en cas d'erreur, `logger.error()` le contexte (adminUserId, actionType, erreur) et ne PAS relancer l'exception
  - [x] 2.5 Utiliser le modèle `AdminActivityLog` existant pour l'insertion (pas de requête SQL brute)
  - [x] 2.6 Typer `actionType` avec l'enum `ActionType` — le compilateur TS bloque toute valeur invalide

- [x] **Tâche 3 — Intégrer le log de connexion dans AuthController** (AC4, AC5)
  - [x] 3.1 Dans `auth_controller.ts`, méthode `login()`, après `auth.use('web').login(user)` : appeler `ActivityLogService.log({ adminUserId: user.id, actionType: ActionType.LOGIN, resourceType: 'session' })`
  - [x] 3.2 NE PAS attendre le log pour envoyer la réponse — l'appel est `await` mais le try/catch interne au service garantit que la réponse HTTP n'est jamais bloquée

- [x] **Tâche 4 — Tests unitaires** (AC1, AC2, AC3)
  - [x] 4.1 Créer `tests/unit/services/activity_log_service.spec.ts`
  - [x] 4.2 Test : log créé correctement pour chaque `actionType` valide (7 valeurs) — vérifier l'enregistrement en BDD
  - [x] 4.3 Test : `resourceType` et `resourceId` sont optionnels — un log sans ces champs est valide
  - [x] 4.4 Test : erreur DB lors du log → l'appel ne lève pas d'exception (fail silently) — mocker le modèle ou forcer une erreur DB
  - [x] 4.5 Test : vérifier le typage TS — ceci est une vérification par compilation, pas un test runtime. S'assurer qu'un `actionType` invalide ne compile pas (commentaire dans le test)

- [x] **Tâche 5 — Test fonctionnel du log de connexion** (AC5)
  - [x] 5.1 Dans `tests/functional/admin/login.spec.ts`, ajouter une assertion dans le test de connexion réussie : après login, vérifier qu'un `AdminActivityLog` existe avec `actionType = 'login'` et `adminUserId = user.id`
  - [x] 5.2 Vérifier que le log est créé aussi quand `passwordChanged = false` (le log précède la redirection vers change-password)

- [x] **Tâche 6 — Validation finale**
  - [x] 6.1 `node ace test --suite unit` → tous tests passent
  - [x] 6.2 `node ace test --suite functional` → tous tests passent (aucune régression)
  - [x] 6.3 `npm run lint` → 0 erreur
  - [x] 6.4 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

Le `ActivityLogService` est un service stateless avec une méthode statique `log()`. Pas besoin d'injection de dépendance ni de singleton — le service n'a pas d'état interne. L'architecture suit le pattern déjà établi par `FileStorageService` (méthode statique, pas d'instance).

### Code existant à réutiliser

- **Modèle `AdminActivityLog`** (`app/models/admin_activity_log.ts`) — déjà créé en Story 1.2 avec toutes les colonnes nécessaires : `id` (uuid), `admin_user_id`, `action_type`, `resource_type`, `resource_id`, `created_at`. Relation `belongsTo(() => AdminUser)` déjà déclarée.
- **Migration `admin_activity_logs`** — table déjà en BDD avec index sur `admin_user_id` et `created_at`. Aucune migration supplémentaire nécessaire.
- **Relation inverse** — `AdminUser` a déjà `hasMany(() => AdminActivityLog)` déclaré.
- **Pattern enum** — `app/enums/admin_role.ts` et `app/enums/production_status.ts` définissent le pattern à suivre : objet `as const` + type exporté + export default.
- **`AuthController`** (`app/controllers/admin/auth_controller.ts`) — le seul contrôleur avec des actions modifiant des données à ce stade. L'intégration du log de connexion se fait dans la méthode `login()`, après la ligne `await auth.use('web').login(user)` (ligne 62).

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/enums/action_type.ts` | Enum des 7 types d'action admin |
| `app/services/activity_log_service.ts` | Service centralisé de logging |
| `tests/unit/services/activity_log_service.spec.ts` | Tests unitaires du service |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/auth_controller.ts` | Ajouter `ActivityLogService.log()` dans `login()` après `auth.use('web').login(user)` |
| `app/models/admin_activity_log.ts` | Changer le type de `actionType` de `string` à `ActionType` pour garantir le typage strict |
| `tests/functional/admin/login.spec.ts` | Ajouter assertion de vérification du log créé après login réussi |

### Contrôleurs qui utiliseront le service (futures stories)

Le service est créé dans cette story mais ne sera intégré que progressivement :
- **Story 3.1 (cette story)** : `AuthController.login()` → `actionType: 'login'`
- **Story 3.3** : création compte admin → `actionType: 'create'`, `resourceType: 'admin_user'`
- **Story 3.4** : désactivation/réactivation → `actionType: 'update'`, `resourceType: 'admin_user'`
- **Story 3.5** : réinitialisation MDP → `actionType: 'password_reset'`, `resourceType: 'admin_user'`
- **Story 3.6** : suppression compte → `actionType: 'delete'`, `resourceType: 'admin_user'`
- **Story 4.3+** : CRUD productions → `create`, `update`, `publish`, `unpublish`, `delete` avec `resourceType: 'production'`

### Signature cible du service

```typescript
import AdminActivityLog from '#models/admin_activity_log'
import type { ActionType } from '#enums/action_type'
import logger from '@adonisjs/core/services/logger'

interface LogParams {
  adminUserId: string
  actionType: ActionType
  resourceType?: string
  resourceId?: string
}

export default class ActivityLogService {
  static async log(params: LogParams): Promise<void> {
    try {
      await AdminActivityLog.create({
        adminUserId: params.adminUserId,
        actionType: params.actionType,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
      })
    } catch (error) {
      logger.error({ err: error, ...params }, 'ActivityLogService: failed to create log')
    }
  }
}
```

### Pattern enum cible

```typescript
const ActionType = {
  LOGIN: 'login',
  CREATE: 'create',
  UPDATE: 'update',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  DELETE: 'delete',
  PASSWORD_RESET: 'password_reset',
} as const

export type ActionType = (typeof ActionType)[keyof typeof ActionType]
export default ActionType
```

### Anti-patterns à éviter

- **NE PAS** créer un middleware de logging automatique — le log doit être explicite par action, avec `resourceType` et `resourceId` spécifiques
- **NE PAS** utiliser `console.log` pour logger les erreurs — utiliser `logger` d'AdonisJS (structuré, configurable)
- **NE PAS** relancer l'exception dans le catch — le log doit être fire-and-forget, l'action principale ne doit jamais échouer à cause du logging
- **NE PAS** stocker `actionType` comme string brute dans le modèle ou le service — utiliser l'enum `ActionType` systématiquement
- **NE PAS** ajouter de `resourceType` enum — c'est une string libre pour rester extensible (les valeurs seront `'session'`, `'admin_user'`, `'production'` selon le contexte)
- **NE PAS** modifier la table `admin_activity_logs` — aucune migration nécessaire, la table est déjà correcte
- **NE PAS** ajouter un import `ActivityLogService` dans `DashboardController` — il ne fait que rendre des pages, pas de mutation

### Tests — patterns à suivre

- **Tests unitaires** : utiliser `db.beginGlobalTransaction()` en setup et `db.rollbackGlobalTransaction()` en teardown (pattern confirmé dans la suite unit existante)
- **Tests fonctionnels** : les tests de login existants dans `login.spec.ts` utilisent `testUtils.db().truncate()` — ajouter une assertion `AdminActivityLog.query().where('actionType', 'login')` après le login réussi
- **Mock erreur DB** : pour tester le fail-silently, forcer une erreur en fermant la connexion ou en mockant `AdminActivityLog.create` pour qu'il throw

### Sécurité

- Les logs d'activité ne contiennent PAS de données sensibles (pas de mot de passe, pas de token)
- `admin_user_id` est une référence FK — si l'admin est supprimé (Story 3.6), les logs sont supprimés en cascade (`onDelete('CASCADE')` dans la migration)
- Les logs sont internes — jamais exposés au client React, seulement visibles via le panel super admin (Story 7)

### Previous Story Intelligence (Epic 2)

**Patterns confirmés à réutiliser :**
- Import AdonisJS services : `import logger from '@adonisjs/core/services/logger'`
- Enums : objet `as const` + type dérivé + `export default` (cf. `admin_role.ts`)
- Contrôleur auth : le `login()` fait `await auth.use('web').login(user)` puis la redirection — insérer le log entre les deux
- Tests : 136 tests passent actuellement (101 unit + 35 functional) — ne casser aucun test existant

**Gotchas :**
- Le `sessionApiClient` détruit la session entre requêtes — ne pas tenter de chaîner POST login + GET dashboard dans un seul test fonctionnel
- Les colonnes `totp_*` ont été droppées (Story 2.1) — ne pas les réintroduire dans les fixtures

### Project Structure Notes

Alignement avec la structure documentée dans `architecture.md` :
- `app/services/activity_log_service.ts` → prévu dans l'architecture (`app/services/ActivityLogService.ts`) — utiliser le snake_case pour le nom de fichier (convention AdonisJS v6)
- `app/enums/action_type.ts` → nouveau fichier, même dossier que les enums existants
- Tests dans `tests/unit/services/` → aligné avec l'architecture

### References

- [Source: epics.md#Story 3.1] — Acceptance criteria et définition
- [Source: architecture.md#Patterns de Communication] — Signature `ActivityLogService.log()` et action types
- [Source: architecture.md#Règles Obligatoires] — Passer par `ActivityLogService.log()` pour toute action admin
- [Source: app/models/admin_activity_log.ts] — Modèle Lucid existant
- [Source: database/migrations/1775918737632_create_admin_activity_logs_table.ts] — Table déjà créée avec index
- [Source: app/controllers/admin/auth_controller.ts:44-67] — Méthode `login()` à enrichir
- [Source: app/enums/admin_role.ts] — Pattern enum à reproduire

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Erreur de typage TS sur le mock `AdminActivityLog.create` dans le test fail-silently — la signature générique de Lucid empêche le remplacement direct. Fix : cast via `as any` pour le monkey-patch dans le test.
- Erreur lint (prettier) sur les apostrophes dans le nom du test — corrigé en passant aux guillemets doubles.

### Completion Notes List

- **AC1 satisfait** : `ActivityLogService.log()` insère dans `admin_activity_logs` via le modèle `AdminActivityLog` existant. 4 tests unitaires vérifient l'insertion correcte des champs.
- **AC2 satisfait** : enum `ActionType` créé avec 7 valeurs, typage strict sur le modèle et le service. Vérification par compilation (commentaire dans le test).
- **AC3 satisfait** : try/catch avec `logger.error()` — le test de fail-silently confirme que l'appel ne lève pas d'exception.
- **AC4 satisfait** : `AuthController.login()` appelle `ActivityLogService.log()` après `auth.use('web').login(user)`.
- **AC5 satisfait** : 2 tests fonctionnels vérifient le log de connexion (passwordChanged=true ET passwordChanged=false).
- **Tests totaux** : 140/140 passent (105 unit + 35 functional). Aucun test existant cassé.
- **Lint** : 0 erreur. **Typecheck** : 0 erreur.

### File List

**Créés :**
- `app/enums/action_type.ts` — enum des 7 types d'action admin
- `app/services/activity_log_service.ts` — service centralisé de logging
- `tests/unit/services/activity_log_service.spec.ts` — 4 tests unitaires

**Modifiés :**
- `app/models/admin_activity_log.ts` — type `actionType` changé de `string` à `ActionType`
- `app/controllers/admin/auth_controller.ts` — ajout import + appel `ActivityLogService.log()` dans `login()`
- `tests/functional/admin/login.spec.ts` — ajout import `AdminActivityLog` + assertions log dans 2 tests de login réussi

### Change Log

- 2026-06-01 : Implémentation Story 3.1 (ActivityLogService). Enum `ActionType` (7 valeurs), service `ActivityLogService` avec fail-silently, intégration login dans `AuthController`, typage strict sur le modèle `AdminActivityLog`. 4 tests unitaires + 2 assertions fonctionnelles ajoutées. Tests totaux : 140/140.
