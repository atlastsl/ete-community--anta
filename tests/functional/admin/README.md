# Tests fonctionnels — Auth admin

Suite de tests HTTP de bout-en-bout couvrant tous les flux d'authentification du panel admin (Epic 2).

## Structure

Les tests sont organisés par feature plutôt que dans un fichier monolithique :

| Fichier | Tests | Périmètre | Story source |
|---|---|---|---|
| `middleware.spec.ts` | 7 | `AdminMiddleware` (auth, isActive, role, passwordChanged) + `SuperAdminMiddleware` | 2.1 |
| `login.spec.ts` | 11 | GET formulaire + POST credentials (valides/invalides) + CSRF + guest redirect | 2.2 |
| `change_password.spec.ts` | 8 | GET formulaire + POST (valide/invalides) + idempotence + CSRF | 2.3 |
| `logout.spec.ts` | 5 | Logout + CSRF + post-logout + session fixation | 2.4 |
| `first_login_flow.spec.ts` | * | Flux E2E intégration : login provisoire → change-password → re-login | 2.6 |

Voir aussi `tests/functional/robots_txt.spec.ts` (Story 2.5 — exclusion `/admin/` de l'indexation).

## Lancer les tests

```bash
# Toute la suite functional (CI lance ça)
node ace test --suite functional

# Un seul fichier
node ace test functional --files login
node ace test functional --files middleware

# Avec watcher
node ace test --suite functional --watch
```

## Mapping scénarios Epic 2.6 → tests existants

| Scénario AC | Fichier:test |
|---|---|
| Login valide + `passwordChanged=true` → dashboard | `login.spec.ts` → `credentials valides + passwordChanged=true → 302 vers /admin/productions` |
| Login valide + `passwordChanged=false` → change-password | `login.spec.ts` → `credentials valides + passwordChanged=false → 302 vers /admin/auth/change-password` |
| Login invalide (mauvais password) → erreur générique | `login.spec.ts` → `mauvais password → 302 redirect /admin/login + flashErrors.email générique` |
| Login invalide (email inexistant) → **MÊME** erreur générique | `login.spec.ts` → `email inexistant → 302 redirect /admin/login + MÊME message générique` |
| Compte désactivé → accès refusé | `login.spec.ts` → `compte désactivé (isActive=false) → 302 + flashErrors.email account_inactive` |
| Change password valide → success | `change_password.spec.ts` → `password ≥ 12 + confirmation OK → BDD mise à jour + 302 vers /admin/productions` |
| Change password < 12 chars → erreur | `change_password.spec.ts` → `password < 12 chars → 302 + flashErrors password_too_short + BDD inchangée` |
| Confirmation différente → erreur | `change_password.spec.ts` → `confirmation ≠ password → 302 + flashErrors confirmation_mismatch + BDD inchangée` |
| Accès route admin sans auth → redirect login | `middleware.spec.ts` → `un utilisateur anonyme est redirigé vers /admin/login` |
| Accès super admin avec rôle admin → refus | `middleware.spec.ts` → `un admin (rôle admin) est redirigé vers /admin/productions sur /admin/users` (302 + flash error — choix UX vs 403 brut, cf. Story 2.1 Dev Notes) |
| Expiration session → redirect login | `logout.spec.ts` → `un client sans cookie session ne peut pas accéder au dashboard (équivalent post-logout)` |
| Logout → session détruite + redirect | `logout.spec.ts` → `POST /admin/logout (auth + CSRF) → 302 vers /admin/login + flash success` |
| Protection CSRF → rejet | `login.spec.ts` + `change_password.spec.ts` + `logout.spec.ts` (1 test CSRF par fichier POST) |
| Flux intégration première connexion | `first_login_flow.spec.ts` → traverse Stories 2.1+2.2+2.3 |

## Patterns

### Fixture admin

Helper in-spec (à dupliquer par fichier — extraire dans `tests/helpers/` si réutilisé ≥3 fois) :

```ts
async function createAdminUser(opts = {}) {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'PlainPasswordHashedByMixin', // le mixin AuthFinder hashe via beforeSave
    role: opts.role ?? 'admin',
    passwordChanged: opts.passwordChanged ?? true,
    isActive: opts.isActive ?? true,
  })
}
```

### Requête HTTP authentifiée avec CSRF

```ts
const response = await client
  .post('/admin/logout')
  .form({ /* ... */ })
  .loginAs(user)          // @adonisjs/auth/plugins/api_client — bypass POST /admin/login
  .withCsrfToken()        // @adonisjs/shield/plugins/api_client — header X-CSRF-TOKEN
  .redirects(0)           // ne PAS suivre les 302
```

### Lecture des flash messages

```ts
const flash = response.flashMessages() // @adonisjs/session/plugins/api_client
assert.include(JSON.stringify(flash), 'auth.login.errors.invalid_credentials')
```

### Rollback BDD entre tests

```ts
test.group('...', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })
  // tests…
})
```

## Gotchas

- **Le `sessionApiClient` détruit la session entre 2 requêtes** : on ne peut PAS chaîner `POST /admin/login → GET /admin/productions` dans un même test via cookies. Pour tester un flux multi-étapes, utiliser des tests "service-level" (`AdminUser.verifyCredentials` direct, cf. `first_login_flow.spec.ts`) ou la suite `browser` (Playwright).
- **Le client API ne suit pas les redirects par défaut, MAIS** redirige par défaut 5 fois — utiliser `.redirects(0)` partout pour observer les 302 bruts.
- **Shield CSRF rejette par flash + redirect 302** (pas 403/419) — adapter les assertions.
- **`session.flashErrors({ field: 'key' })`** stocke sous `inputErrorsBag` — Inertia le lit comme `props.errors.field` côté React.
- **`request.validateUsing()` lance `ValidationException`** automatiquement gérée par AdonisJS → 302 + flashErrors. Pas de try/catch nécessaire pour les erreurs de validation.

## CI

Toute la suite functional est exécutée à chaque PR via `.github/workflows/ci.yml` :

```yaml
- name: Run functional tests
  run: node ace test --suite functional
```

Si la suite échoue, la PR est bloquée. Voir `tests/unit/infrastructure/config_files.spec.ts` pour le test anti-régression qui garantit que cette ligne reste dans `ci.yml`.
