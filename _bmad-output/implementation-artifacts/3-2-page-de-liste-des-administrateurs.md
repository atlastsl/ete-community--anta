# Story 3.2 : Page de liste des administrateurs

Status: done

## Story

En tant que super administrateur,
Je veux consulter la liste de tous les comptes administrateurs avec leur statut,
Afin d'avoir une vue d'ensemble des accès au panel et de pouvoir agir sur chaque compte.

## Acceptance Criteria

**AC1 — Liste des administrateurs affichée**

- **Given** un super admin est connecté et accède à `/admin/users`
- **When** la page se charge
- **Then** la liste de tous les comptes `admin_users` est affichée (hors le super admin lui-même)
- **And** chaque entrée affiche : email, rôle, statut (actif/inactif), date de création, créateur

**AC2 — État vide**

- **Given** aucun compte admin n'existe encore (hors le super admin lui-même)
- **When** la page se charge
- **Then** un état vide s'affiche : "Aucun administrateur. Créez le premier compte." avec un bouton "Créer un administrateur"

**AC3 — Distinction visuelle des comptes inactifs**

- **Given** un compte admin est inactif (`is_active = false`)
- **When** il apparaît dans la liste
- **Then** il est visuellement distinct : badge "Inactif" (destructive variant), opacité réduite sur la ligne

**AC4 — Protection d'accès (déjà implémenté)**

- **Given** un admin (rôle `admin`) tente d'accéder à `/admin/users`
- **When** `SuperAdminMiddleware` s'exécute
- **Then** l'accès est refusé et il est redirigé vers le dashboard avec un flash error
- **Note** : déjà couvert par Story 2.1 + tests dans `middleware.spec.ts`. Cette story vérifie uniquement que le contrôleur fonctionne correctement derrière le middleware existant.

## Tasks / Subtasks

- [x] **Tâche 1 — Créer UsersController (backend)** (AC1, AC2)
  - [x] 1.1 Créer `app/controllers/admin/users_controller.ts` avec une méthode `index()`
  - [x] 1.2 Requêter `AdminUser` : exclure le super admin connecté (`where('id', '!=', auth.user.id)`), charger la relation `createdBy` (le créateur), trier par `createdAt` desc
  - [x] 1.3 Passer les données via `inertia.render('admin/Users/Index', { users })` — props directes, pas de wrapper
  - [x] 1.4 Sérialiser chaque user avec les champs : `id`, `email`, `role`, `isActive`, `createdAt`, `createdBy` (email du créateur ou null)

- [x] **Tâche 2 — Mettre à jour le routage** (AC1)
  - [x] 2.1 Dans `start/routes.ts`, remplacer `[controllers.admin.Dashboard, 'users']` par `[controllers.admin.Users, 'index']` pour la route `GET /admin/users`
  - [x] 2.2 Supprimer la méthode `users()` du `DashboardController` (plus de stub nécessaire)

- [x] **Tâche 3 — Ajouter la relation `createdBy` sur AdminUser** (AC1)
  - [x] 3.1 Dans `app/models/admin_user.ts`, ajouter une relation `belongsTo(() => AdminUser, { foreignKey: 'createdById' })` nommée `createdBy`
  - [x] 3.2 Aucune migration nécessaire — la colonne `created_by_id` existe déjà

- [x] **Tâche 4 — Implémenter la page React `Users/Index.tsx`** (AC1, AC2, AC3)
  - [x] 4.1 Remplacer le contenu stub de `inertia/pages/admin/Users/Index.tsx`
  - [x] 4.2 Afficher un titre "Utilisateurs" (`h1`) avec un bouton "Créer un administrateur" (désactivé pour l'instant — sera implémenté en Story 3.3)
  - [x] 4.3 Si la liste est vide : afficher un état vide avec l'icône `Users` (lucide), le texte "Aucun administrateur. Créez le premier compte." et le bouton "Créer un administrateur"
  - [x] 4.4 Si la liste n'est pas vide : afficher un tableau HTML avec les colonnes : Email, Rôle, Statut, Créé le, Créé par
  - [x] 4.5 Colonne Rôle : Badge `Admin` (secondary) ou `Super Admin` (green-700)
  - [x] 4.6 Colonne Statut : Badge `Actif` (green outline) ou `Inactif` (destructive)
  - [x] 4.7 Lignes des comptes inactifs : ajouter `opacity-60` sur le `<tr>`
  - [x] 4.8 Colonne "Créé par" : afficher l'email du créateur ou "—" si null
  - [x] 4.9 Formater la date de création avec `toLocaleDateString()` en respectant la locale active
  - [x] 4.10 Colonne Actions : placeholder vide (les boutons Désactiver/Réinitialiser/Supprimer seront ajoutés en Stories 3.4–3.6)
  - [x] 4.11 Tous les textes via `t()` — aucune string en dur dans le composant

- [x] **Tâche 5 — Ajouter les clés i18n** (AC1, AC2)
  - [x] 5.1 Dans `inertia/locales/admin/fr.json`, ajouter les clés sous `users.*`
  - [x] 5.2 Dans `inertia/locales/admin/en.json`, ajouter les mêmes clés traduites
  - [x] 5.3 Clés nécessaires : `users.title`, `users.create_button`, `users.empty_title`, `users.empty_description`, `users.table.email`, `users.table.role`, `users.table.status`, `users.table.created_at`, `users.table.created_by`, `users.table.actions`, `users.status.active`, `users.status.inactive`

- [x] **Tâche 6 — Tests fonctionnels** (AC1, AC2, AC4)
  - [x] 6.1 Créer `tests/functional/admin/users_list.spec.ts`
  - [x] 6.2 Test : super admin GET `/admin/users` → 200, page contient `admin/Users/Index`
  - [x] 6.3 Test : la liste exclut le super admin connecté — créer 2 admins + 1 super admin, vérifier que seuls les 2 admins apparaissent dans les props
  - [x] 6.4 Test : aucun admin existant → la page se charge sans erreur (état vide géré côté React)
  - [x] 6.5 Test : admin GET `/admin/users` → 302 redirect dashboard (déjà couvert par `middleware.spec.ts`, mais vérifier la non-régression)

- [x] **Tâche 7 — Mettre à jour le test de traductions** (AC1)
  - [x] 7.1 Le test `translations.spec.ts` vérifie automatiquement la parité FR/EN — les nouvelles clés `users.*` sont incluses dans la vérification existante (aucune modification nécessaire)

- [x] **Tâche 8 — Validation finale**
  - [x] 8.1 `node ace test --suite unit` → tous tests passent
  - [x] 8.2 `node ace test --suite functional` → tous tests passent (aucune régression)
  - [x] 8.3 `npm run lint` → 0 erreur
  - [x] 8.4 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

La page de liste des administrateurs est une page Inertia classique : le contrôleur backend requête les données et les passe en props à la page React. Pas de logique métier complexe — c'est un listing read-only.

Le contrôleur `UsersController` remplace le stub `DashboardController.users()` qui servait uniquement de cible de redirection pour les tests middleware (Story 2.1).

### Code existant à réutiliser

- **Route** : `GET /admin/users` déjà configurée dans `start/routes.ts` (ligne 61), protégée par `middleware.admin()` + `middleware.superAdmin()`. Seul le handler doit changer.
- **Middleware** : `SuperAdminMiddleware` (`app/middleware/super_admin_middleware.ts`) vérifie `role === 'super_admin'`, sinon redirect avec flash error. Déjà testé dans `tests/functional/admin/middleware.spec.ts`.
- **Page stub** : `inertia/pages/admin/Users/Index.tsx` existe déjà (placeholder Epic 3). À remplacer entièrement.
- **AdminLayout** : la sidebar affiche "Utilisateurs" uniquement pour `super_admin` (logique dans `AdminLayout.tsx`, lignes 21 et 40). Déjà fonctionnel.
- **Composants UI** : `Badge` (`inertia/components/ui/badge.tsx`) avec variantes `default`, `secondary`, `destructive`, `outline`. `Button` disponible.
- **i18n** : `useTranslation()` configuré, fichiers `admin/fr.json` et `admin/en.json` existants.
- **Modèle `AdminUser`** (`app/models/admin_user.ts`) : champs `id`, `email`, `role`, `isActive`, `passwordChanged`, `createdById`, `createdAt`, `updatedAt`. Relation `hasMany(() => AdminActivityLog)` déjà déclarée. Manque : relation `belongsTo` vers le créateur (à ajouter).
- **DashboardController** (`app/controllers/admin/dashboard_controller.ts`) : méthode `users()` stub à supprimer après migration vers `UsersController`.

### Modèle AdminUser — relation `createdBy`

La colonne `created_by_id` existe déjà en BDD (FK vers `admin_users.id`). Il faut ajouter la relation Lucid self-referencing :

```typescript
@belongsTo(() => AdminUser, { foreignKey: 'createdById' })
declare createdBy: BelongsTo<typeof AdminUser>
```

Import `belongsTo` et `BelongsTo` doivent être ajoutés. Le modèle utilise déjà `hasMany` (pour `activityLogs`), donc `belongsTo` doit être ajouté à l'import `@adonisjs/lucid/orm`.

### Contrôleur cible — UsersController.index()

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import AdminUser from '#models/admin_user'

export default class UsersController {
  async index({ auth, inertia }: HttpContext) {
    const currentUser = auth.user!
    const users = await AdminUser.query()
      .where('id', '!=', currentUser.id)
      .preload('createdBy')
      .orderBy('createdAt', 'desc')

    return inertia.render('admin/Users/Index', {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISO(),
        createdBy: u.createdBy?.email ?? null,
      })),
    })
  }
}
```

### Page React — structure cible

La page doit :
1. Recevoir `users` en props (tableau sérialisé)
2. Si vide : état vide UX-DR19 (icône, texte, bouton)
3. Si non vide : tableau HTML sémantique (`<table>`)
4. Badges de rôle et de statut avec les variantes shadcn/ui
5. Opacité réduite pour les lignes inactives

Le bouton "Créer un administrateur" est rendu dès cette story (header de page + état vide) mais NE navigue PAS encore — il sera lié au formulaire de création en Story 3.3. Le bouton peut être rendu avec `disabled` ou pointer vers `#` pour l'instant.

### Pattern d'état vide (UX-DR19)

Convention du projet (confirmée par l'architecture) : ton factuel, icône picto `text-stone-300`, message guidant vers l'action suivante.

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Users className="size-12 text-stone-300" />
  <p className="mt-4 text-lg font-medium text-stone-700">{t('users.empty_title')}</p>
  <p className="mt-1 text-sm text-stone-500">{t('users.empty_description')}</p>
  <Button className="mt-6" disabled>{t('users.create_button')}</Button>
</div>
```

### Clés i18n à ajouter

**FR :**
```json
"users": {
  "title": "Utilisateurs",
  "create_button": "Créer un administrateur",
  "empty_title": "Aucun administrateur",
  "empty_description": "Créez le premier compte pour constituer votre équipe.",
  "table": {
    "email": "Email",
    "role": "Rôle",
    "status": "Statut",
    "created_at": "Créé le",
    "created_by": "Créé par",
    "actions": "Actions"
  },
  "status": {
    "active": "Actif",
    "inactive": "Inactif"
  }
}
```

**EN :**
```json
"users": {
  "title": "Users",
  "create_button": "Create an administrator",
  "empty_title": "No administrators",
  "empty_description": "Create the first account to build your team.",
  "table": {
    "email": "Email",
    "role": "Role",
    "status": "Status",
    "created_at": "Created",
    "created_by": "Created by",
    "actions": "Actions"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive"
  }
}
```

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/controllers/admin/users_controller.ts` | Contrôleur avec méthode `index()` |
| `tests/functional/admin/users_list.spec.ts` | Tests fonctionnels de la page de liste |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/models/admin_user.ts` | Ajouter relation `belongsTo` `createdBy` (self-referencing) |
| `start/routes.ts` | Remplacer handler `Dashboard.users` par `Users.index` |
| `app/controllers/admin/dashboard_controller.ts` | Supprimer la méthode `users()` |
| `inertia/pages/admin/Users/Index.tsx` | Remplacer le stub par la vraie page |
| `inertia/locales/admin/fr.json` | Ajouter les clés `users.*` |
| `inertia/locales/admin/en.json` | Ajouter les clés `users.*` |

### Anti-patterns à éviter

- **NE PAS** inclure le super admin connecté dans la liste — `where('id', '!=', auth.user.id)` obligatoire
- **NE PAS** exposer `passwordHash` dans les props Inertia — le modèle a déjà `serializeAs: null` sur `passwordHash`, mais utiliser `.map()` explicite pour ne sérialiser que les champs nécessaires
- **NE PAS** paginer dans cette story — la liste des admins sera courte (quelques dizaines max). La pagination sera ajoutée si nécessaire.
- **NE PAS** implémenter les actions (désactiver, réinitialiser, supprimer) — elles sont couvertes par les Stories 3.4, 3.5 et 3.6. La colonne "Actions" est un placeholder vide.
- **NE PAS** utiliser `inertia.render()` avec un wrapper `{ data: { users } }` — props directes (convention architecture)
- **NE PAS** stocker l'état de tri en frontend — un simple `orderBy('createdAt', 'desc')` côté serveur suffit
- **NE PAS** ajouter de composant `Table` shadcn/ui — un `<table>` HTML sémantique avec classes Tailwind est plus simple et suffisant pour cette page

### Tests — patterns à suivre

- **Tests fonctionnels** : utiliser `db.beginGlobalTransaction()` + rollback (pattern confirmé)
- **Fixture** : créer un super admin (authenticated via `.loginAs()`) + des admins de test. Pattern de `createAdminUser()` helper déjà utilisé dans `login.spec.ts` et `middleware.spec.ts`.
- **Assertion Inertia** : les tests fonctionnels vérifient `response.assertStatus(200)` et `response.assertTextIncludes('admin/Users/Index')`. Pour vérifier les props, utiliser `response.body()` ou les assertions Inertia si disponibles.

### Previous Story Intelligence (Story 3.1)

**Patterns confirmés :**
- Enum pattern : `as const` + type dérivé
- Service pattern : méthode statique, pas d'instance
- Tests : 140/140 passent — ne casser aucun test existant
- `ActivityLogService` est disponible — mais cette story est read-only, aucun log à ajouter
- Mock pattern pour tests : `(Model as any).method = ...` + restore dans finally

**Gotchas Story 2.x :**
- `sessionApiClient` détruit la session entre requêtes — tester un seul GET par test fonctionnel
- Le middleware SuperAdmin redirige (302 + flash error), pas un vrai 403 HTTP — les tests vérifient la redirection, pas le status code 403

### Project Structure Notes

Alignement avec `architecture.md` :
- `app/controllers/admin/users_controller.ts` → prévu dans l'architecture (`app/controllers/admin/UsersController.ts`)
- `inertia/pages/admin/Users/Index.tsx` → déjà créé comme stub, à remplacer
- Tests dans `tests/functional/admin/` → aligné

### Sécurité

- La route est déjà protégée par `AdminMiddleware` + `SuperAdminMiddleware` (Story 2.1)
- `passwordHash` n'est jamais inclus dans les props Inertia (sérialisation explicite)
- Aucune donnée sensible exposée côté client — seuls email, rôle, statut, dates et email du créateur

### Dépendances cross-story

- **Story 3.3** ajoutera le formulaire de création → le bouton "Créer un administrateur" deviendra fonctionnel
- **Stories 3.4–3.6** ajouteront les actions (désactiver, réinitialiser MDP, supprimer) → la colonne "Actions" sera remplie
- Cette story NE dépend d'aucune story non terminée — Story 3.1 (ActivityLogService) est terminée, et l'infrastructure auth (Epic 2) est complète

### References

- [Source: epics.md#Story 3.2] — Acceptance criteria et définition
- [Source: architecture.md#Contrôleurs] — `admin/UsersController.ts` prévu
- [Source: architecture.md#Composants React] — `admin/Users/Index.tsx`
- [Source: architecture.md#UX-DR19] — États vides : ton factuel, icône picto, texte guidant
- [Source: app/middleware/super_admin_middleware.ts] — Protection d'accès (déjà implémentée)
- [Source: start/routes.ts:61] — Route `GET /admin/users` existante
- [Source: inertia/pages/admin/Users/Index.tsx] — Stub à remplacer
- [Source: app/models/admin_user.ts] — Modèle avec `createdById` existant
- [Source: inertia/layouts/AdminLayout.tsx:21] — Nav item "Utilisateurs" conditionnel
- [Source: tests/functional/admin/middleware.spec.ts] — Tests d'accès SuperAdmin existants

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Le registre auto-généré `.adonisjs/server/controllers.ts` ne détecte pas automatiquement les nouveaux contrôleurs — ajout manuel de l'import `Users` nécessaire.
- `DateTime.toISO()` de Luxon retourne `string | null` — non-null assertion `!` ajoutée dans le contrôleur (le champ a `autoCreate: true`, jamais null en pratique).
- Test "exclut le super admin" : l'email du super admin apparaît dans le sidebar (`AdminLayout`) donc `notInclude(body, superAdmin.email)` échoue. Fix : extraction des props Inertia via `data-page` attribute + vérification des IDs utilisateurs dans les props plutôt que le texte brut.

### Completion Notes List

- **AC1 satisfait** : `UsersController.index()` charge les admins avec `preload('createdBy')`, exclut le super admin connecté, trie par date desc. Props : id, email, role, isActive, createdAt, createdBy.
- **AC2 satisfait** : état vide avec icône Users (lucide), texte i18n et bouton "Créer un administrateur" (désactivé — Story 3.3).
- **AC3 satisfait** : badge `destructive` pour les comptes inactifs + `opacity-60` sur la ligne du tableau.
- **AC4 satisfait** : protection SuperAdminMiddleware confirmée par le test de non-régression (302 redirect dashboard pour un admin).
- **Tests totaux** : 145/145 passent (140 existants + 5 nouveaux). Lint et typecheck verts.

### File List

**Créés :**
- `app/controllers/admin/users_controller.ts` — contrôleur avec méthode `index()`
- `tests/functional/admin/users_list.spec.ts` — 5 tests fonctionnels

**Modifiés :**
- `app/models/admin_user.ts` — ajout relation `belongsTo` `createdBy` (self-referencing)
- `start/routes.ts` — route `/admin/users` → `UsersController.index`
- `app/controllers/admin/dashboard_controller.ts` — suppression méthode `users()` stub
- `inertia/pages/admin/Users/Index.tsx` — remplacement du stub par la page complète (tableau, état vide, badges)
- `inertia/locales/admin/fr.json` — ajout des 12 clés `users.*`
- `inertia/locales/admin/en.json` — ajout des 12 clés `users.*`
- `.adonisjs/server/controllers.ts` — ajout import `Users` controller

### Change Log

- 2026-06-01 : Implémentation Story 3.2 (Page de liste des administrateurs). UsersController, page React avec tableau/état vide/badges, relation `createdBy` sur AdminUser, i18n FR/EN. 5 tests fonctionnels ajoutés. Tests totaux : 145/145.

## Review Findings

- [x] [Review][Patch] `createdAt.toISO()!` — RÉSOLU : `index()` utilise `u.createdAt?.toISO() ?? null` ; `UserRow.createdAt` typé `string | null` ; `formatDate()` renvoie `'—'` si null. [app/controllers/admin/users_controller.ts, inertia/pages/admin/Users/Index.tsx]
