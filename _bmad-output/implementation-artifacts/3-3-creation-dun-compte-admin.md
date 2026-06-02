# Story 3.3 : Création d'un compte admin

Status: done

## Story

En tant que super administrateur,
Je veux créer un nouveau compte administrateur en saisissant son email,
Afin qu'il puisse se connecter et gérer les productions après avoir configuré son accès (FR32).

## Acceptance Criteria

**AC1 — Formulaire de création avec champ email uniquement**

- **Given** le super admin clique sur "Créer un administrateur"
- **When** le formulaire s'affiche
- **Then** seul le champ email est requis (le mot de passe provisoire est généré automatiquement)

**AC2 — Création réussie avec génération de mot de passe provisoire**

- **Given** le super admin saisit un email valide et soumet
- **When** le formulaire est traité
- **Then** un enregistrement `admin_users` est créé avec `role = 'admin'`, `is_active = true`, `password_changed = false`, `created_by_id` = id du super admin
- **And** un mot de passe provisoire sécurisé (16 caractères aléatoires) est généré et hashé (scrypt)
- **And** un email d'invitation est envoyé à l'adresse avec le mot de passe provisoire en clair
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'create', resourceType: 'admin_user' })`

**AC3 — Validation : email déjà utilisé**

- **Given** l'email saisi est déjà utilisé par un compte existant
- **When** le formulaire est soumis
- **Then** une erreur de validation s'affiche : "Cette adresse email est déjà utilisée"

**AC4 — Feedback succès avec toast**

- **Given** le compte est créé avec succès
- **When** la redirection s'effectue
- **Then** un toast succès s'affiche : "Compte créé. Un email d'invitation a été envoyé."

## Tasks / Subtasks

- [x] **Tâche 1 — Créer le validateur VineJS** (AC1, AC3)
  - [x] 1.1 Créer `app/validators/admin/create_user_validator.ts` avec un schéma VineJS : `email` requis, format email valide, unique dans `admin_users`
  - [x] 1.2 Utiliser `vine.string().email().unique({ table: 'admin_users', column: 'email' })` pour la validation côté serveur
  - [x] 1.3 Le message d'erreur pour `unique` doit être la clé i18n `users.errors.email_taken` (résolue côté frontend)

- [x] **Tâche 2 — Créer le template email d'invitation** (AC2)
  - [x] 2.1 Créer `resources/views/emails/admin_invitation.edge` sur le modèle de `test_email.edge` (branding Anta, green-700)
  - [x] 2.2 Contenu : salutation, explication du rôle (administrateur de la bibliothèque Anta), email de connexion, mot de passe provisoire, lien vers la page de login `/admin/login`, rappel que le mot de passe devra être changé à la première connexion
  - [x] 2.3 Le template reçoit les variables : `email`, `temporaryPassword`, `loginUrl`

- [x] **Tâche 3 — Ajouter les méthodes `create` et `store` dans UsersController** (AC1, AC2, AC3, AC4)
  - [x] 3.1 Dans `app/controllers/admin/users_controller.ts`, ajouter la méthode `create()` : `return inertia.render('admin/Users/Create', {})`
  - [x] 3.2 Ajouter la méthode `store()` :
    - Valider avec `createUserValidator`
    - Générer un mot de passe provisoire de 16 caractères via `string.generateRandom(16)` (`@adonisjs/core/helpers/string`)
    - Créer l'enregistrement `AdminUser` : `{ email, passwordHash: temporaryPassword, role: AdminRole.ADMIN, isActive: true, passwordChanged: false, createdById: auth.user!.id }`
    - Le mot de passe est auto-hashé par le mixin `AuthFinder` au `beforeSave`
    - Envoyer l'email d'invitation via `mail.send()` avec le template `emails/admin_invitation`
    - Appeler `ActivityLogService.log({ adminUserId: auth.user!.id, actionType: ActionType.CREATE, resourceType: 'admin_user', resourceId: user.id })`
    - Flash `session.flash('success', 'users.create_success')` puis redirect vers `/admin/users`
  - [x] 3.3 En cas d'erreur d'envoi d'email : créer le compte quand même, flash un message d'avertissement au lieu du succès (`users.create_success_no_email`), logger l'erreur via `logger.error()`

- [x] **Tâche 4 — Ajouter les routes** (AC1)
  - [x] 4.1 Dans `start/routes.ts`, dans le groupe `/admin/users` (protégé par `superAdmin()`), ajouter :
    - `router.get('users/create', [controllers.admin.Users, 'create'])` → `/admin/users/create`
    - `router.post('users', [controllers.admin.Users, 'store'])` → `POST /admin/users`
  - [x] 4.2 S'assurer que les deux routes sont DANS le groupe middleware `superAdmin()` existant

- [x] **Tâche 5 — Créer la page React `Users/Create.tsx`** (AC1, AC3)
  - [x] 5.1 Créer `inertia/pages/admin/Users/Create.tsx`
  - [x] 5.2 Formulaire avec un seul champ : email (type email, autocomplete off)
  - [x] 5.3 Validation côté client avec regex email (pas de dépendance Zod nécessaire — validation légère)
  - [x] 5.4 Validation `onBlur` (UX-DR17) : message d'erreur en `text-red-600 text-sm` sous le champ, lié via `aria-describedby`
  - [x] 5.5 Afficher les erreurs serveur (email déjà utilisé) retournées via `useForm().errors`
  - [x] 5.6 Deux boutons : "Créer" (primaire, green-700) et "Annuler" (secondaire, lien vers `/admin/users`)
  - [x] 5.7 Le bouton "Créer" passe en état loading (`processing`) pendant la soumission — spinner + disabled
  - [x] 5.8 Soumission via `useForm().post('/admin/users')` (Inertia)
  - [x] 5.9 Tous les textes via `t()` — aucune string en dur

- [x] **Tâche 6 — Activer le bouton "Créer" dans Users/Index.tsx** (AC1)
  - [x] 6.1 Dans `inertia/pages/admin/Users/Index.tsx`, remplacer les deux `<Button disabled>` par des `<Link href="/admin/users/create"><Button>...</Button></Link>` (composant `Link` de `@adonisjs/inertia/react`)
  - [x] 6.2 Le bouton dans l'état vide et celui dans le header pointent tous deux vers `/admin/users/create`

- [x] **Tâche 7 — Ajouter les clés i18n** (AC1, AC3, AC4)
  - [x] 7.1 Dans `inertia/locales/admin/fr.json`, ajouter les clés `users.create_title`, `users.form.*`, `users.errors.*`, `users.create_success*`
  - [x] 7.2 Dans `inertia/locales/admin/en.json`, ajouter les mêmes clés traduites
  - [x] 7.3 Clés ajoutées : `create_title`, `create_success`, `create_success_no_email`, `form.email`, `form.email_placeholder`, `form.submit`, `form.help`, `errors.email_taken`, `errors.email_required`, `errors.email_invalid`

- [x] **Tâche 8 — Tests fonctionnels** (AC1, AC2, AC3, AC4)
  - [x] 8.1 Créer `tests/functional/admin/users_create.spec.ts`
  - [x] 8.2 Test : super admin GET `/admin/users/create` → 200, page `admin/Users/Create`
  - [x] 8.3 Test : super admin POST `/admin/users` avec email valide → 302 redirect `/admin/users`, enregistrement créé en BDD avec `role='admin'`, `isActive=true`, `passwordChanged=false`, `createdById=superAdmin.id`
  - [x] 8.4 Test : vérifier que `ActivityLogService` a créé un log `actionType='create'`, `resourceType='admin_user'`
  - [x] 8.5 Test : POST avec email déjà existant → 302 redirect avec erreur (pas de nouveau compte créé)
  - [x] 8.6 Test : POST avec email invalide → 302 redirect avec erreur (pas de compte créé)
  - [x] 8.7 Test : admin (rôle `admin`) POST `/admin/users` → 302 redirect dashboard (protégé par SuperAdminMiddleware)
  - [x] 8.8 Test : admin (rôle `admin`) GET `/admin/users/create` → 302 redirect dashboard

- [x] **Tâche 9 — Validation finale**
  - [x] 9.1 `node ace test --suite unit` → 153 tests passent
  - [x] 9.2 `node ace test --suite functional` → 153 tests passent (aucune régression)
  - [x] 9.3 `npm run lint` → 0 erreur
  - [x] 9.4 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

La création d'un compte admin est un flux classique formulaire → contrôleur → modèle + email. Le super admin saisit uniquement l'email ; le mot de passe provisoire est généré automatiquement côté serveur, hashé par le mixin AuthFinder, et envoyé par email. L'admin invité suivra le flux première connexion (Story 2.3 — changement de mot de passe obligatoire).

### Code existant à réutiliser

- **UsersController** (`app/controllers/admin/users_controller.ts`) : existe avec la méthode `index()`. Ajouter `create()` et `store()`.
- **Route** : `GET /admin/users` est déjà configurée dans `start/routes.ts` (ligne 61), dans un groupe protégé par `middleware.admin()` + `middleware.superAdmin()`. Ajouter les nouvelles routes dans ce même groupe.
- **AdminUser model** (`app/models/admin_user.ts`) : complet avec AuthFinder mixin (auto-hash scrypt sur `passwordHash` au `beforeSave`). Colonnes : `id` (UUID auto), `email` (unique), `passwordHash`, `role`, `isActive`, `passwordChanged`, `createdById`, `createdAt`, `updatedAt`.
- **ActivityLogService** (`app/services/activity_log_service.ts`) : méthode statique `log()` avec `ActionType.CREATE` disponible. Fail-silently garanti.
- **ActionType enum** (`app/enums/action_type.ts`) : `CREATE = 'create'` disponible.
- **AdminRole enum** (`app/enums/admin_role.ts`) : `ADMIN = 'admin'` disponible.
- **Mail config** (`config/mail.ts`) : Mailgun configuré comme mailer principal. From : `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` depuis `.env`.
- **Email template existant** (`resources/views/emails/test_email.edge`) : branding Anta (green `#15803d`, max-width 560px). Copier la structure pour le template d'invitation.
- **Toast** : implémenté via `sonner` dans `AdminLayout.tsx`. Les flash messages `session.flash('success', 'clé.i18n')` sont automatiquement traduits et affichés en toast vert. Les `session.flashErrors()` sont affichés en toast rouge.
- **Page Users/Index.tsx** (`inertia/pages/admin/Users/Index.tsx`) : le bouton "Créer un administrateur" est actuellement `disabled` (ligne 32 et 42). À activer en `<Link>` vers `/admin/users/create`.
- **Composants UI** : `Button` (`inertia/components/ui/button.tsx`), `Input` (`inertia/components/ui/input.tsx`), `Label` (`inertia/components/ui/label.tsx`) — shadcn/ui disponibles.
- **Pattern Inertia form** : utiliser `useForm` d'`@inertiajs/react` pour la gestion du formulaire (state, erreurs serveur, soumission).

### Génération du mot de passe provisoire

Utiliser l'utilitaire AdonisJS natif :

```typescript
import string from '@adonisjs/core/helpers/string'
const temporaryPassword = string.generateRandom(16)
```

Le mot de passe en clair est passé au template email. Le hash scrypt est automatique via le mixin `AuthFinder` au `.create()` — on passe `passwordHash: temporaryPassword` et le hook `beforeSave` le hash.

### Envoi d'email

```typescript
import mail from '@adonisjs/mail/services/main'

await mail.send((message) => {
  message
    .to(user.email)
    .subject('Invitation — Bibliothèque Anta')
    .htmlView('emails/admin_invitation', {
      email: user.email,
      temporaryPassword,
      loginUrl: `${env.get('APP_URL')}/admin/login`,
    })
})
```

L'envoi peut échouer (mailer down, email invalide en pratique). Ne PAS bloquer la création du compte. Wrapper l'envoi dans un try/catch : si l'email échoue, logger l'erreur et flasher un message d'avertissement différent (`users.create_success_no_email`).

### Validateur VineJS — structure cible

```typescript
import vine from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().email().unique({
      table: 'admin_users',
      column: 'email',
    }),
  })
)
```

Le validateur VineJS `unique` fait une requête SQL automatique. L'erreur est retournée en 422 via Inertia (champ `errors.email`).

### Page React Create.tsx — structure cible

Utiliser `useForm` d'Inertia pour gérer le formulaire :

```tsx
import { useForm, Link } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'

export default function Create() {
  const { t } = useTranslation()
  const { data, setData, post, processing, errors } = useForm({ email: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    post('/admin/users')
  }

  return (
    <AdminLayout>
      <h1>{t('users.create_title')}</h1>
      <form onSubmit={handleSubmit}>
        <Label htmlFor="email">{t('users.form.email')}</Label>
        <Input
          id="email"
          type="email"
          value={data.email}
          onChange={(e) => setData('email', e.target.value)}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-red-600 text-sm mt-1">{errors.email}</p>
        )}
        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={processing} className="bg-green-700 hover:bg-green-800">
            {processing ? <Loader2 className="animate-spin" /> : null}
            {t('users.form.submit')}
          </Button>
          <Link href="/admin/users">
            <Button type="button" variant="outline">{t('actions.cancel')}</Button>
          </Link>
        </div>
      </form>
    </AdminLayout>
  )
}
```

### Activation du bouton dans Users/Index.tsx

Remplacer :
```tsx
<Button className="bg-green-700 hover:bg-green-800 text-white" disabled>
```

Par :
```tsx
<Link href="/admin/users/create">
  <Button className="bg-green-700 hover:bg-green-800 text-white">
    {t('users.create_button')}
  </Button>
</Link>
```

Même modification pour le bouton dans l'état vide (ligne 42).

### Clés i18n à ajouter

**FR (`inertia/locales/admin/fr.json`) :**
```json
"users": {
  "create_title": "Créer un administrateur",
  "form": {
    "email": "Adresse email",
    "email_placeholder": "admin@example.com",
    "submit": "Créer le compte",
    "help": "Un mot de passe provisoire sera généré automatiquement et envoyé par email."
  },
  "errors": {
    "email_taken": "Cette adresse email est déjà utilisée",
    "email_required": "L'adresse email est requise",
    "email_invalid": "L'adresse email n'est pas valide"
  },
  "create_success": "Compte créé. Un email d'invitation a été envoyé.",
  "create_success_no_email": "Compte créé, mais l'envoi de l'email a échoué. Transmettez le mot de passe manuellement."
}
```

**EN (`inertia/locales/admin/en.json`) :**
```json
"users": {
  "create_title": "Create an administrator",
  "form": {
    "email": "Email address",
    "email_placeholder": "admin@example.com",
    "submit": "Create account",
    "help": "A temporary password will be automatically generated and sent by email."
  },
  "errors": {
    "email_taken": "This email address is already in use",
    "email_required": "Email address is required",
    "email_invalid": "Email address is not valid"
  },
  "create_success": "Account created. An invitation email has been sent.",
  "create_success_no_email": "Account created, but the email could not be sent. Please share the password manually."
}
```

**Note :** ces clés s'ajoutent aux clés `users.*` existantes (Story 3.2). Fusionner dans le même objet `users`.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/validators/admin/create_user_validator.ts` | Validateur VineJS : email requis, format valide, unique |
| `resources/views/emails/admin_invitation.edge` | Template email d'invitation admin (branding Anta) |
| `inertia/pages/admin/Users/Create.tsx` | Page formulaire de création d'un admin |
| `tests/functional/admin/users_create.spec.ts` | Tests fonctionnels (6-8 tests) |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/users_controller.ts` | Ajouter méthodes `create()` et `store()` |
| `start/routes.ts` | Ajouter `GET /admin/users/create` et `POST /admin/users` dans le groupe superAdmin |
| `inertia/pages/admin/Users/Index.tsx` | Activer le bouton "Créer" (remplacer `disabled` par `<Link>`) |
| `inertia/locales/admin/fr.json` | Ajouter les clés `users.create_title`, `users.form.*`, `users.errors.*`, `users.create_success*` |
| `inertia/locales/admin/en.json` | Ajouter les mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** exposer le mot de passe provisoire dans la réponse HTTP ou les props Inertia — il est uniquement dans l'email
- **NE PAS** utiliser `bcrypt` pour le hashage — le projet utilise `scrypt` via le mixin AuthFinder (défaut AdonisJS 6)
- **NE PAS** créer un service dédié `AdminService` — la logique est assez simple pour rester dans le contrôleur
- **NE PAS** ajouter de champ "rôle" dans le formulaire — les comptes créés sont toujours `admin` (le super admin est unique, initialisé par seeder)
- **NE PAS** implémenter de pagination sur la page de liste — non nécessaire (quelques dizaines d'admins max)
- **NE PAS** utiliser `inertia.render()` avec un wrapper `{ data: ... }` — props directes (convention architecture)
- **NE PAS** oublier le CSRF token — le middleware CSRF est actif sur toutes les routes admin. Les soumissions via `useForm` d'Inertia incluent automatiquement le token CSRF
- **NE PAS** stocker l'URL complète de login dans le code — utiliser `env.get('APP_URL')` pour construire le lien dynamiquement
- **NE PAS** ajouter un champ mot de passe dans le formulaire — le mot de passe est généré automatiquement côté serveur
- **NE PAS** bloquer la création du compte si l'envoi d'email échoue — créer le compte quand même et avertir le super admin

### Tests — patterns à suivre

- **Transaction rollback** : `db.beginGlobalTransaction()` en setup, `db.rollbackGlobalTransaction()` en teardown
- **Fixture helper** : réutiliser le pattern `createAdminUser()` de `users_list.spec.ts`
- **Login super admin** : `.loginAs(superAdmin)` + `.withCsrfToken()`
- **Assertions POST** : vérifier le redirect 302, le flash message, l'enregistrement en BDD, le log dans `admin_activity_logs`
- **Assertions validation** : POST avec email invalide ou existant → `.assertStatus(422)` ou vérifier que les erreurs sont présentes dans la session

### Routage — ordre important

La route `GET /admin/users/create` doit être déclarée AVANT la route dynamique `GET /admin/users/:id` (si elle existe dans le futur), sinon AdonisJS interprétera "create" comme un `:id`. Dans le groupe actuel, il n'y a qu'une route `GET /admin/users` (index), donc pas de conflit — mais placer `create` en premier par convention.

### Sécurité

- Le mot de passe provisoire est envoyé en clair par email (comportement attendu pour une invitation). L'admin DEVRA le changer à la première connexion (flux Story 2.3 — `password_changed = false` force la redirection).
- L'email est validé en format et en unicité côté serveur (VineJS)
- Le CSRF est automatique via middleware AdonisJS
- Seul le super admin peut accéder aux routes de création (SuperAdminMiddleware)
- `passwordHash` n'est jamais exposé côté client (`serializeAs: null` dans le modèle)

### Dépendances cross-story

- **Story 2.2** (login) + **Story 2.3** (changement MDP 1ère connexion) : le nouvel admin suivra ces flux existants
- **Story 3.1** (ActivityLogService) : prêt, `ActionType.CREATE` disponible
- **Story 3.2** (liste admins) : le bouton "Créer" sera activé, le nouvel admin apparaîtra dans la liste
- **Stories 3.4–3.6** : ajouteront les actions (désactiver, réinitialiser MDP, supprimer) dans la colonne "Actions" de la liste

### Previous Story Intelligence

**Story 3.2 — Page de liste des administrateurs :**
- Le bouton "Créer un administrateur" est rendu `disabled` à deux endroits : header (ligne 32) et état vide (ligne 42). À activer.
- `UsersController.index()` sérialise les users avec `.map()` explicite — pattern à suivre.
- Tests : 145/145 passent. Ne casser aucun test existant.
- Le registre `.adonisjs/server/controllers.ts` a déjà l'import `Users` — les nouvelles méthodes seront auto-détectées.

**Story 3.1 — ActivityLogService :**
- Appel : `ActivityLogService.log({ adminUserId, actionType: ActionType.CREATE, resourceType: 'admin_user', resourceId: user.id })`
- Le service est fire-and-forget (try/catch interne) — ne bloque jamais l'action principale.

**Gotchas des stories précédentes :**
- `sessionApiClient` détruit la session entre requêtes — tester un seul POST par test fonctionnel
- `DateTime.toISO()` retourne `string | null` — non-null assertion `!` si nécessaire
- Le registre `.adonisjs` ne détecte pas toujours automatiquement les nouvelles méthodes de contrôleur — vérifier après ajout

### Project Structure Notes

Alignement avec `architecture.md` :
- `app/controllers/admin/UsersController.ts` → convention fichier AdonisJS v6 : `users_controller.ts` (snake_case)
- `inertia/pages/admin/Users/Create.tsx` → prévu dans l'architecture
- `app/validators/admin/create_user_validator.ts` → aligné avec le dossier `app/validators/`
- Tests dans `tests/functional/admin/` → aligné

### References

- [Source: epics.md#Story 3.3] — Acceptance criteria et définition
- [Source: architecture.md#Contrôleurs] — `admin/UsersController.ts` avec gestion comptes
- [Source: architecture.md#Authentification] — scrypt, mot de passe provisoire, flux première connexion
- [Source: architecture.md#Service Email] — Mailgun via `@adonisjs/mail`
- [Source: architecture.md#Logs d'Activité] — `ActivityLogService.log()` avec `actionType: 'create'`
- [Source: architecture.md#Règles Obligatoires] — Passer par ActivityLogService, props directes, i18n
- [Source: app/controllers/admin/users_controller.ts] — Contrôleur existant (méthode `index()`)
- [Source: inertia/pages/admin/Users/Index.tsx:32,42] — Boutons "Créer" disabled à activer
- [Source: start/routes.ts:61] — Groupe routes `/admin/users` existant
- [Source: app/models/admin_user.ts] — Modèle avec AuthFinder mixin (auto-hash scrypt)
- [Source: app/services/activity_log_service.ts] — Service de logging prêt
- [Source: app/enums/action_type.ts] — `ActionType.CREATE` disponible
- [Source: config/mail.ts] — Configuration Mailgun
- [Source: resources/views/emails/test_email.edge] — Template email existant à réutiliser
- [Source: _bmad-output/implementation-artifacts/3-2-page-de-liste-des-administrateurs.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/3-1-service-centralise-activitylogservice.md] — Intelligence ActivityLogService

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- `inertia.render('admin/Users/Create')` requiert un 2e argument (props) même vide — corrigé en `inertia.render('admin/Users/Create', {})`.
- La page `admin/Users/Create` doit être enregistrée manuellement dans `.adonisjs/server/pages.d.ts` pour le typage strict Inertia.
- Le composant `Label` de shadcn/ui n'existe pas dans ce projet — remplacé par un `<label>` HTML natif avec les classes Tailwind.
- Le `Link` doit être importé depuis `@adonisjs/inertia/react` (pas `@inertiajs/react`) — règle ESLint `@adonisjs/prefer-adonisjs-inertia-link`.
- Les erreurs de validation VineJS dans un contexte Inertia retournent 302 (redirect back avec flash errors) et non 422 — tests ajustés pour vérifier le redirect + absence de création en BDD.
- L'envoi d'email Mailgun échoue en test (pas de clé API valide) — le try/catch dans `store()` gère le cas correctement et flashe `create_success_no_email`.

### Completion Notes List

- **AC1 satisfait** : formulaire de création avec champ email uniquement, mot de passe provisoire généré automatiquement (16 caractères via `string.generateRandom(16)`).
- **AC2 satisfait** : enregistrement `admin_users` créé avec `role='admin'`, `isActive=true`, `passwordChanged=false`, `createdById=superAdmin.id`. Email d'invitation envoyé via template Edge. Action loguée via `ActivityLogService.log({ actionType: 'create', resourceType: 'admin_user' })`.
- **AC3 satisfait** : validation VineJS avec `unique({ table: 'admin_users', column: 'email' })`. Message d'erreur i18n `users.errors.email_taken`.
- **AC4 satisfait** : flash `session.flash('success', 'users.create_success')` → toast vert via sonner dans `AdminLayout.tsx`. En cas d'échec email : `users.create_success_no_email`.
- **Tests totaux** : 153/153 passent (145 existants + 8 nouveaux). Lint et typecheck verts.

### File List

**Créés :**
- `app/validators/admin/create_user_validator.ts` — validateur VineJS : email requis, format valide, unique dans admin_users
- `resources/views/emails/admin_invitation.edge` — template email d'invitation admin (branding Anta green-700)
- `inertia/pages/admin/Users/Create.tsx` — page formulaire de création d'un admin
- `tests/functional/admin/users_create.spec.ts` — 8 tests fonctionnels

**Modifiés :**
- `app/controllers/admin/users_controller.ts` — ajout méthodes `create()` et `store()`
- `start/routes.ts` — ajout `GET /admin/users/create` et `POST /admin/users` dans le groupe superAdmin
- `inertia/pages/admin/Users/Index.tsx` — bouton "Créer" activé avec `<Link>` vers `/admin/users/create`
- `inertia/locales/admin/fr.json` — ajout 10 clés i18n `users.create_*`, `users.form.*`, `users.errors.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites
- `.adonisjs/server/pages.d.ts` — enregistrement de la page `admin/Users/Create`

### Change Log

- 2026-06-01 : Implémentation Story 3.3 (Création d'un compte admin). Validateur VineJS, contrôleur store avec génération MDP provisoire + envoi email + ActivityLog, page React Create.tsx, activation bouton dans Index.tsx, i18n FR/EN, template email Edge. 8 tests fonctionnels ajoutés. Tests totaux : 153/153.

## Review Findings

- [x] [Review][Decision→Patch] Échec d'envoi d'email à la création : MDP provisoire irrécupérable — RÉSOLU (option : afficher le MDP) : sur échec email, `store()` flashe `tempPassword` ; partagé via `inertia_middleware` ; `AdminLayout` affiche un toast persistant (`closeButton`, durée infinie) avec le MDP provisoire à transmettre. Clé i18n `users.temp_password_label`. [app/controllers/admin/users_controller.ts, app/middleware/inertia_middleware.ts, inertia/layouts/AdminLayout.tsx]
- [x] [Review][Patch] Normalisation email + race d'unicité → 500 non géré — RÉSOLU : email mis en minuscules avant insertion ; `AdminUser.create` enveloppé dans try/catch → une violation de contrainte unique flashe `users.errors.email_taken` + redirect back au lieu d'un 500. [app/controllers/admin/users_controller.ts]
