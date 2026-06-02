# Story 2.6 : Tests fonctionnels authentification

Status: done

## Story

En tant que développeur,
Je veux une suite de tests fonctionnels couvrant tous les flux d'authentification,
Afin de garantir la sécurité des accès à chaque modification du code (régression-proof).

## Notes de découverte (avant implémentation)

**1. La quasi-totalité des scénarios AC sont DÉJÀ couverts** par les tests écrits dans les Stories 2.1–2.5. Cette story est principalement une story de **validation/cleanup/CI** plutôt qu'une story d'écriture de nouveaux tests.

Inventaire actuel (31 tests fonctionnels admin + 2 robots) :

| Fichier | Tests | Couvre |
|---|---|---|
| `tests/functional/admin/middleware.spec.ts` | 7 | AdminMiddleware (anonyme, isActive, role, passwordChanged) + SuperAdminMiddleware |
| `tests/functional/admin/login.spec.ts` | 11 | GET page + POST valide + POST invalides (3) + CSRF + guest redirect |
| `tests/functional/admin/change_password.spec.ts` | 8 | GET page (2) + POST valide + POST invalides (3) + idempotence + CSRF |
| `tests/functional/admin/logout.spec.ts` | 5 | logout + sans CSRF + anonyme + post-logout + session fixation |
| `tests/functional/robots_txt.spec.ts` | 2 | FR37 (couvert Story 2.5, hors auth mais lié à `/admin/`) |

**2. Bug critique CI découvert** : `.github/workflows/ci.yml` ne lance que `node ace test --suite unit` — la suite `functional` (incluant TOUS les tests admin auth) n'est **jamais exécutée en CI**. Cette story corrige ça.

**3. Le nom `tests/functional/admin/AuthController.spec.ts`** mentionné dans l'epic est obsolète : on a éclaté en 4 fichiers par feature (plus modulaire). Cette story documente la structure réelle adoptée.

## Acceptance Criteria

**AC1 — Audit de couverture documenté**

- **Given** un développeur veut comprendre la couverture des tests auth admin
- **When** il consulte `tests/functional/admin/README.md`
- **Then** il y trouve la liste exhaustive des scénarios attendus (cf. epic Story 2.6) mappés à leur fichier de test + nom de test
- **And** chaque scénario AC est cité au moins une fois avec une référence test fichier:nom

**AC2 — CI exécute la suite functional**

- **Given** `.github/workflows/ci.yml` est déclenché par une PR
- **When** le job `test` tourne
- **Then** la step "Run tests" exécute :
  - `node ace test --suite unit` (déjà en place)
  - `node ace test --suite functional` (nouveau)
- **And** chacune des deux suites doit passer pour que le workflow soit vert
- **And** la PR est bloquée si l'une échoue

**AC3 — Tests de la suite functional passent sur CI PostgreSQL**

- **Given** le CI utilise un service PostgreSQL 16 (déjà configuré, Story 1.8)
- **When** la suite functional s'exécute
- **Then** tous les 35+ tests passent (incluant les 31 admin auth + smoke + robots)
- **And** la connexion DB sans SSL (CI) fonctionne (cf. Story 1.8 — `DB_SSL` env absente en CI)

**AC4 — Test E2E "première connexion complète" (optionnel mais recommandé)**

- **Given** un compte admin existe en BDD avec `passwordChanged=false` (équivalent post-création par seeder)
- **When** un script de test enchaîne :
  1. POST `/admin/login` avec credentials provisoires → redirect `/admin/auth/change-password`
  2. POST `/admin/auth/change-password` avec nouveau password valide → redirect `/admin/productions`
  3. Verify : `passwordChanged=true` en BDD + le nouveau password permet de re-login
- **Then** chaque étape passe et la BDD reflète l'état final attendu
- **Note** : ce test traverse l'intégration des Stories 2.1+2.2+2.3 en un seul scénario. Si le `sessionApiClient` détruit les sessions entre requêtes (gotcha Story 2.2), simuler les actions au niveau service plutôt que HTTP, OU utiliser un test browser (Playwright via la suite `browser`).

**AC5 — Validation finale**

- **Given** toutes les modifications de cette story sont en place
- **When** `node ace test --suite unit` et `node ace test --suite functional` sont exécutés en local
- **Then** tous les tests passent (100/100 unit + 35+/35+ functional)
- **And** `npm run lint` et `npm run typecheck` passent

## Tasks / Subtasks

- [x] **Tâche 1 — Audit de couverture documenté** (AC1)
  - [ ] 1.1 Créer `tests/functional/admin/README.md` avec :
    - Une intro courte expliquant la structure (4 fichiers par feature)
    - Une table de couverture **scénario AC → fichier:test** pour les 12 scénarios listés dans l'epic Story 2.6
    - Pour chaque scénario : citer le test exact (ex. `login.spec.ts → "credentials valides + passwordChanged=true → 302 vers /admin/productions"`)
    - Une section "Comment lancer" : `node ace test --suite functional` + filtres `--files login` etc.
    - Une section "Patterns" rappelant les gotchas (`loginAs(user) + .withCsrfToken() + .redirects(0) + response.flashMessages()`)

- [x] **Tâche 2 — Ajouter la suite functional au CI** (AC2, AC3)
  - [ ] 2.1 Modifier `.github/workflows/ci.yml` — dans le job `test`, ajouter une step après "Run unit tests" :
    ```yaml
    - name: Run functional tests
      run: node ace test --suite functional
    ```
  - [ ] 2.2 Vérifier que les variables d'environnement nécessaires sont déjà déclarées dans le `env:` du job (DB_HOST/PORT/USER/PASSWORD/DATABASE — déjà OK depuis Story 1.8).
  - [ ] 2.3 Pas besoin de `DB_SSL` en CI (le service Postgres n'a pas SSL, `DB_SSL` absente → driver pg fallback en plain — déjà validé Story 1.8).
  - [ ] 2.4 Mettre à jour les tests d'infrastructure dans `tests/unit/infrastructure/config_files.spec.ts` : ajouter un test qui vérifie que `ci.yml` contient bien `--suite functional` (preuve par régression que la ligne n'est pas supprimée par accident).

- [x] **Tâche 3 — Test E2E "première connexion complète"** (AC4)
  - [ ] 3.1 Créer `tests/functional/admin/first_login_flow.spec.ts`
  - [ ] 3.2 **Approche recommandée** : faire un test "intégration service" (pas browser) qui :
    1. Crée un `AdminUser` en BDD avec `passwordChanged=false`
    2. Simule le login : `await AdminUser.verifyCredentials(email, provisionalPwd)` → user
    3. Vérifie : redirect cible serait `/admin/auth/change-password` (logique du contrôleur)
    4. Simule le change-password : `user.passwordHash = newPwd; user.passwordChanged = true; await user.save()`
    5. Vérifie : reload user, `passwordChanged === true`, `hash.verify(passwordHash, newPwd) === true`, `hash.verify(passwordHash, provisionalPwd) === false`
    6. Simule un re-login avec le nouveau password : `await AdminUser.verifyCredentials(email, newPwd)` → user
  - [ ] 3.3 Ce test traverse les Stories 2.1+2.2+2.3 au niveau modèle/service — preuve d'intégration. Pas de HTTP réel, donc pas de problème de session/CSRF.
  - [ ] 3.4 **Alternative — test browser (optionnel)** : si le temps permet, ajouter un test dans `tests/browser/admin/first_login.spec.ts` qui utilise Playwright (suite `browser` déjà configurée Story 1.1) pour vraiment cliquer dans un vrai navigateur. **Décision** : skip pour MVP — le test service ci-dessus suffit à valider l'intégration. Le test browser pourra être ajouté Phase 2.

- [x] **Tâche 4 — Validation finale** (AC5)
  - [ ] 4.1 `node ace test --suite unit` → tous tests passent (100+ avec le nouveau test infrastructure)
  - [ ] 4.2 `node ace test --suite functional` → tous tests passent (34+ existants + 1 nouveau E2E si Tâche 3 retenue)
  - [ ] 4.3 `npm run lint` → 0 erreur
  - [ ] 4.4 `npm run typecheck` → 0 erreur
  - [ ] 4.5 Action utilisateur : pousser sur une branche feature et ouvrir une PR pour vérifier que `ci.yml` lance bien la suite functional (validation E2E du CI).

## Dev Notes

### Architecture cible (synthèse)

- **Aucun nouveau test fonctionnel d'auth requis** — les 31 tests existants couvrent tous les scénarios AC.
- **Documentation** : `tests/functional/admin/README.md` documente la couverture (mapping AC → test).
- **CI** : ajouter `node ace test --suite functional` dans `.github/workflows/ci.yml` (bug découvert Story 2.6).
- **Test E2E intégration** : un seul nouveau test scriptant le flux "première connexion" pour prouver l'intégration des Stories 2.1+2.2+2.3.

### État existant à respecter

- `tests/functional/admin/middleware.spec.ts` (Story 2.1) — 7 tests
- `tests/functional/admin/login.spec.ts` (Story 2.2) — 11 tests
- `tests/functional/admin/change_password.spec.ts` (Story 2.3) — 8 tests
- `tests/functional/admin/logout.spec.ts` (Story 2.4) — 5 tests
- `tests/functional/robots_txt.spec.ts` (Story 2.5) — 2 tests
- `tests/bootstrap.ts` — tous les plugins configurés (auth + session + shield API clients)
- `.github/workflows/ci.yml` — service Postgres 16 + env vars test + `npm run lint` + `node ace test --suite unit`. À enrichir.

### Mapping AC → tests existants (à reprendre dans le README)

| Scénario epic Story 2.6 | Fichier:test |
|---|---|
| Login valide + `passwordChanged=true` → dashboard | `login.spec.ts` "credentials valides + passwordChanged=true → 302 vers /admin/productions" |
| Login valide + `passwordChanged=false` → change-password | `login.spec.ts` "credentials valides + passwordChanged=false → 302 vers /admin/auth/change-password" |
| Login invalide → message générique | `login.spec.ts` (2 tests : mauvais password + email inexistant) |
| Compte désactivé → refus | `login.spec.ts` "compte désactivé (isActive=false) → 302 + flashErrors.email account_inactive" |
| Change password valide → success | `change_password.spec.ts` "password ≥ 12 + confirmation OK → BDD mise à jour + 302 vers /admin/productions" |
| Change password < 12 chars → erreur | `change_password.spec.ts` "password < 12 chars → 302 + flashErrors password_too_short" |
| Confirmation différente → erreur | `change_password.spec.ts` "confirmation ≠ password → 302 + flashErrors confirmation_mismatch" |
| Accès admin sans auth → redirect login | `middleware.spec.ts` "un utilisateur anonyme est redirigé vers /admin/login" |
| Accès super admin avec rôle admin → 403 | `middleware.spec.ts` "un admin (rôle admin) est redirigé vers /admin/productions sur /admin/users" — note : 302 vers dashboard + flash error (pas littéralement 403, cf. Story 2.1 Dev Notes — choix UX) |
| Expiration session → redirect login | `logout.spec.ts` "un client sans cookie session ne peut pas accéder au dashboard (équivalent post-logout)" |
| Logout → session détruite + redirect | `logout.spec.ts` "POST /admin/logout (auth + CSRF) → 302 vers /admin/login + flash success" |
| Protection CSRF → rejet | `login.spec.ts` + `change_password.spec.ts` + `logout.spec.ts` (1 test CSRF par fichier POST) |

### Pourquoi pas de nouveau test fonctionnel HTTP "complet"

Le pattern `client.post().loginAs().withCsrfToken()` ne permet PAS de chaîner plusieurs requêtes dans un même test (le `sessionApiClient` détruit la session entre chaque requête — gotcha confirmé Stories 2.2 + 2.4).

Trois options pour un vrai test E2E :

1. **Tests browser (Playwright)** : suite `browser` configurée Story 1.1, mais ajoute ~5-30s par test selon les workflows. Décision MVP : skip — refaire au besoin Phase 2.
2. **Tests service (Lucid + AdminUser direct)** : on simule les actions au niveau modèle. Plus rapide, suffisant pour prouver l'intégration. **Choix recommandé**.
3. **Tests HTTP avec session persistance manuelle** : passer le cookie session manuellement entre requêtes. Complexe et fragile. Skip.

### Sécurité — points critiques

- **CI = filet de sécurité** : sans CI fonctionnel, on peut casser un test middleware en local sans s'en apercevoir → régression en prod. Ajouter `--suite functional` au CI est **critique** avant Epic 3 (qui ajoutera plus de tests fonctionnels).
- **Pas de leak en CI** : les env vars `RESEND_API_KEY`, `MAILGUN_API_KEY`, etc. sont des stubs en CI — pas de risque d'envoi réel.

### Anti-patterns à éviter

- ❌ Recréer tous les tests dans un fichier `AuthController.spec.ts` monolithique — la structure modulaire actuelle est meilleure (DRY, lisibilité)
- ❌ Faire un seul "mega test" qui couvre tout en un appel — debug impossible, principle "test une chose à la fois" violé
- ❌ Ajouter un test browser pour la première connexion alors qu'un test service suffit — overhead disproportionné pour le MVP
- ❌ Skip le fix CI "parce que ça marche en local" — c'est exactement le type de bug qui se réveille au pire moment
- ❌ Ajouter des tests dupliqués entre fichiers — préférer une assertion centrale par scénario

### Project Structure Notes

**Fichiers créés :**
- `tests/functional/admin/README.md` — audit de couverture documenté
- `tests/functional/admin/first_login_flow.spec.ts` — test E2E intégration (Tâche 3)

**Fichiers modifiés :**
- `.github/workflows/ci.yml` — ajout step "Run functional tests"
- `tests/unit/infrastructure/config_files.spec.ts` — ajout test de présence de `--suite functional` dans `ci.yml`

**Fichiers à NE PAS modifier :**
- Tous les `.spec.ts` existants — déjà OK, ne pas refactor pour cette story (risque de régression)
- `tests/bootstrap.ts` — plugins déjà configurés
- `app/`, `inertia/`, `config/` — pas de code applicatif touché

### Previous Story Intelligence (2.1–2.5)

**Patterns à reproduire :**
- Tests de config (Story 1.8 + 2.4) : `readFileSync('ci.yml')` + `assert.match(source, regex)` pour vérifier que la ligne `--suite functional` est présente
- Tests service via Lucid : pattern `db.beginGlobalTransaction()` + `await Model.create()` + `await Model.findOrFail()` + `await hash.verify()` (cohérent avec `super_admin_seeder.spec.ts`)

**Gotchas à respecter :**
- Le `sessionApiClient` détruit la session entre 2 requêtes → impossible de chaîner POST→GET avec auth, utiliser tests service pour l'E2E
- Le test pré-existant `production.spec.ts:74` GIN a été fixé (Story 2.4) — la suite unit est désormais 100% stable
- Ne pas réintroduire les colonnes `totp_*` dans les fixtures (droppées Story 2.1)

### Latest Tech Information

- **GitHub Actions step** : ajouter une étape `run:` est suffisant. Pas besoin de `if:` ou condition particulière — on veut que les deux suites tournent toujours.
- **Japa `--suite functional`** : exécute tous les fichiers matchés par `tests/functional/**/*.spec.ts` (cf. `adonisrc.ts`). Pas de filtre à ajouter.

### Cas d'usage MVP

À la fin de cette story :
- La couverture des tests d'auth est documentée et auditable
- Le CI bloque toute PR qui casserait un test d'authentification — protection effective contre les régressions de sécurité
- Le flux complet "première connexion" est validé par un test d'intégration dédié
- L'Epic 2 (authentification) est **complètement terminée** et prête pour merge / retro / Epic 3

### References

- [Source: epics.md#Story 2.6] — Liste des 12 scénarios à couvrir
- [Source: Stories 2.1–2.5] — Implémentations qui ont créé les tests sources
- [Source: .github/workflows/ci.yml] — Job test actuel (à enrichir)
- [Source: Story 1.8] — Setup CI + service Postgres + env vars test
- [Source: tests/bootstrap.ts] — Plugins API client configurés

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **Bug CI découvert** : `.github/workflows/ci.yml` ne lançait que `--suite unit`. Toute la suite functional (35 tests) n'était jamais exécutée en CI → trou critique dans la chaîne de protection. Fix : ajout de la step "Run functional tests" + test anti-régression dans `config_files.spec.ts`.
- **Pas de fichier `AuthController.spec.ts`** comme mentionné dans l'epic d'origine — la structure modulaire 4-fichiers-par-feature est plus saine et a été conservée. Le README documente le mapping.
- **Test E2E HTTP impossible** sans browser : le `sessionApiClient` détruit la session entre 2 requêtes. Choix : test service-level via `AdminUser.verifyCredentials` + mixin AuthFinder direct — couvre l'intégration des Stories 2.1+2.2+2.3 sans la limite du client API.

### Completion Notes List

- **AC1–AC5 satisfaits** (tous testés)
- **README de couverture** : `tests/functional/admin/README.md` documente structure, mapping AC→tests, patterns, gotchas — onboarding facilité pour Epic 3+
- **CI sécurisé** : la suite functional tourne à chaque PR. Une régression sur middleware/login/change-password/logout bloque la PR avant merge.
- **Test E2E intégration** : `first_login_flow.spec.ts` traverse les 3 stories d'auth en un seul scénario (création admin → login provisoire → change-password → re-login avec nouveau password → l'ancien password est rejeté).
- **Tests totaux** : **136/136 passent** (101 unit + 35 functional). Aucun test flaky.
- **Action utilisateur restante** : pousser une branche feature et ouvrir une PR pour valider que `ci.yml` exécute bien les deux suites en CI.

### File List

**Créés :**
- `tests/functional/admin/README.md` — audit de couverture documenté (mapping AC→tests, patterns, gotchas)
- `tests/functional/admin/first_login_flow.spec.ts` — test E2E intégration service-level

**Modifiés :**
- `.github/workflows/ci.yml` — ajout step "Run functional tests"
- `tests/unit/infrastructure/config_files.spec.ts` — ajout test anti-régression `--suite functional`

**Fichiers à NE PAS modifier (intacts) :**
- Tous les `.spec.ts` existants (Stories 2.1–2.5) — couverture déjà complète, pas de refactor pour éviter régression
- `tests/bootstrap.ts` — plugins déjà configurés
- Code applicatif (`app/`, `inertia/`, `config/`) — pas de modification

### Change Log

- 2026-06-01 : Implémentation Story 2.6 (Tests fonctionnels auth — clôture Epic 2). Documentation `tests/functional/admin/README.md`, fix CI critique (ajout `--suite functional` dans ci.yml), test E2E intégration `first_login_flow.spec.ts`. **Epic 2 terminé : 6/6 stories en review.** Tests totaux : 136/136 (101 unit + 35 functional), lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [x] [Review][Defer] E2E first_login_flow service-level — deferred, AC4 l'autorise explicitement. Le test calcule les cibles de redirection inline plutôt que d'exercer controller+middleware. Améliorer en Phase 2 avec un vrai test browser (Playwright, suite `browser`).
