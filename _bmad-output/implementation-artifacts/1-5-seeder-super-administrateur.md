# Story 1.5 : Seeder super administrateur

Status: review

## Story

En tant que développeur,
Je veux un `SuperAdminSeeder` qui initialise le compte super admin unique,
Afin que l'application soit amorçable sans intervention manuelle en base de données (FR34).

## Acceptance Criteria

**AC1** — Création du compte super admin par le seeder

- **Given** la base de données est migrée et `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` sont définis dans `.env`
- **When** `node ace db:seed --files=./database/seeders/super_admin_seeder.ts` est exécuté
- **Then** un enregistrement existe dans `admin_users` avec : `email = SUPER_ADMIN_EMAIL`, `role = 'super_admin'`, `is_active = true`, `totp_enabled = false`, `password_changed = false`, `password_hash` généré via le hasher configuré (scrypt)
- **And** `created_by_id = null` (le super admin n'a pas de créateur)

**AC2** — Idempotence (pas de doublon à la ré-exécution)

- **Given** le seeder a déjà été exécuté avec succès
- **When** il est ré-exécuté avec le même `SUPER_ADMIN_EMAIL`
- **Then** aucun nouveau compte n'est créé
- **And** si `SUPER_ADMIN_PASSWORD` a changé entre les deux exécutions, le `password_hash` est mis à jour et `password_changed` est remis à `false` (force le changement à la prochaine connexion)
- **And** les autres champs (`role`, `is_active`, `totp_enabled`) ne sont pas écrasés s'ils ont été modifiés via le panel admin

**AC3** — Validation des variables d'environnement

- **Given** `SUPER_ADMIN_EMAIL` ou `SUPER_ADMIN_PASSWORD` est manquant ou vide
- **When** le seeder est exécuté
- **Then** une erreur explicite est levée avant toute interaction BDD : `"SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD doivent être définis dans .env pour exécuter SuperAdminSeeder"`
- **And** aucun enregistrement n'est créé ni modifié

**AC4** — Variables d'environnement documentées

- **Given** `.env.example` existe
- **When** un développeur consulte le fichier
- **Then** `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` sont documentés avec un commentaire indiquant qu'ils sont requis uniquement pour l'amorçage initial
- **And** `start/env.ts` déclare ces deux variables en `.optional()` (l'application doit pouvoir démarrer sans elles — seul le seeder les requiert)

**AC5** — Tests unitaires

- **Given** la suite de tests est exécutée
- **When** les tests du `SuperAdminSeeder` tournent
- **Then** les 4 scénarios passent : création initiale, idempotence sans changement, idempotence avec rotation du password, rejet si variables manquantes
- **And** tous les tests utilisent `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` (pas de persistance entre tests)

## Tasks / Subtasks

- [x] **Tâche 1 — Créer la structure seeders et le fichier seeder** (AC1)
  - [x] 1.1 Répertoire `database/seeders/` créé
  - [x] 1.2 `database/seeders/super_admin_seeder.ts` créé — structure double : `SuperAdminSeederLogic` (classe statique testable) + default export `extends BaseSeeder` (CLI)
  - [x] 1.3 Le seeder lit `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` depuis `env` (avec overrides optionnels pour les tests)
  - [x] 1.4 Le hashage est délégué au mixin `withAuthFinder` du modèle `AdminUser` (qui hash automatiquement via `beforeSave`). **Correction critique** : passer le password en clair, jamais pré-hasher (sinon double-hashage et `hash.verify` échoue)

- [x] **Tâche 2 — Logique d'idempotence** (AC1, AC2)
  - [x] 2.1 Pattern : `findBy('email')` → si non trouvé → create ; sinon `hash.verify` puis update conditionnel
  - [x] 2.2 À l'insertion : `role: 'super_admin'`, `isActive: true`, `totpEnabled: false`, `passwordChanged: false`, password en clair (hashé par le mixin)
  - [x] 2.3 À la mise à jour : ne modifie QUE `passwordHash` et `passwordChanged = false` — `isActive`, `totpEnabled`, `totpSecret` préservés (testé)
  - [x] 2.4 Retour typé `SuperAdminSeederResult` (`created` | `unchanged` | `password_rotated`) pour permettre des logs précis et des assertions de test

- [x] **Tâche 3 — Validation des variables d'environnement** (AC3, AC4)
  - [x] 3.1 Validation au début de `run()` — `throw new Error('SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD doivent être définis...')` si vide
  - [x] 3.2 `start/env.ts` ajout `SUPER_ADMIN_EMAIL` (`.optional({ format: 'email' })`) et `SUPER_ADMIN_PASSWORD` (`.optional()`)
  - [x] 3.3 `.env.example` déjà documenté depuis Story 1.1 — confirmé via `grep SUPER_ADMIN .env.example`

- [x] **Tâche 4 — Tests unitaires** (AC5)
  - [x] 4.1 `tests/unit/seeders/super_admin_seeder.spec.ts` créé
  - [x] 4.2 Setup transactionnel cohérent avec `admin_user.spec.ts`
  - [x] 4.3 Test création — defaults corrects + `hash.verify(passwordHash, password)` true
  - [x] 4.4 Test idempotence — action `unchanged`, pas de doublon, hash inchangé
  - [x] 4.5 Test rotation password — action `password_rotated`, nouveau hash valide, `passwordChanged = false`, **`isActive`/`totpEnabled`/`totpSecret` préservés**
  - [x] 4.6 Test email manquant ET test password manquant — 2 tests séparés, erreur explicite, aucun enregistrement créé
  - [x] 4.7 `node ace test --suite unit` — **35/35 tests passent** (5 nouveaux + 30 existants)

## Dev Notes

### Hashage — scrypt et non bcrypt

⚠️ **Divergence vs architecture documentée :** l'architecture mentionne "bcrypt" pour le hashage des mots de passe. La configuration réelle de Story 1.1 a installé **scrypt** comme hasher par défaut (cf. `config/hash.ts` — `default: 'scrypt'`).

**Décision pour cette story : utiliser scrypt** (conforme à NFR5 "bcrypt ou équivalent" + scrypt est memory-hard, supérieur à bcrypt sur résistance ASIC). Si l'utilisateur veut strict bcrypt, c'est une migration à part qui touchera toute la chaîne d'auth (Epic 2 inclus).

Le seeder utilise simplement `hash.make(password)` qui délègue au hasher par défaut — pas de référence directe à scrypt/bcrypt dans le code.

```typescript
import hash from '@adonisjs/core/services/hash'

const passwordHash = await hash.make(plainPassword)
```

### Structure du seeder AdonisJS Lucid

```typescript
// database/seeders/super_admin_seeder.ts
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import hash from '@adonisjs/core/services/hash'
import AdminUser from '#models/admin_user'

export default class extends BaseSeeder {
  async run() {
    const email = env.get('SUPER_ADMIN_EMAIL')
    const password = env.get('SUPER_ADMIN_PASSWORD')

    if (!email || !password) {
      throw new Error(
        'SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD doivent être définis dans .env pour exécuter SuperAdminSeeder'
      )
    }

    const existing = await AdminUser.findBy('email', email)

    if (!existing) {
      // Création initiale
      await AdminUser.create({
        email,
        passwordHash: await hash.make(password),
        role: 'super_admin',
        isActive: true,
        totpEnabled: false,
        passwordChanged: false,
        // createdById laissé null par défaut
      })
      this.logger.info(`Super admin créé : ${email}`)
      return
    }

    // Idempotence : ne modifier QUE le password s'il a changé
    const passwordUnchanged = await hash.verify(existing.passwordHash, password)
    if (passwordUnchanged) {
      this.logger.info(`Super admin déjà à jour : ${email}`)
      return
    }

    existing.passwordHash = await hash.make(password)
    existing.passwordChanged = false  // Force le changement à la prochaine connexion
    await existing.save()
    this.logger.info(`Mot de passe du super admin mis à jour : ${email}`)
  }
}
```

### `start/env.ts` — Variables à ajouter

```typescript
// Super Admin initial (Story 1.5)
SUPER_ADMIN_EMAIL: Env.schema.string.optional({ format: 'email' }),
SUPER_ADMIN_PASSWORD: Env.schema.string.optional(),
```

⚠️ **Pourquoi `.optional()` ?** L'application doit pouvoir démarrer sans ces variables (en production, après le premier seeding, on peut les retirer de `.env` pour ne pas garder un mot de passe en clair dans les variables d'environnement). Seul le `SuperAdminSeeder` les requiert au moment de son exécution, et il valide leur présence lui-même avec un message clair.

### `.env.example` — Déjà documenté

Story 1.1 a déjà ajouté ces variables :
```
# Super Admin initial (Story 1.5)
SUPER_ADMIN_EMAIL=admin@anta.community
SUPER_ADMIN_PASSWORD=
```

⚠️ **Confirmer que c'est toujours présent** après les modifications faites en 1.3 et 1.4 (qui ont nettoyé d'autres parties du fichier).

### Commande d'exécution du seeder

```bash
# Exécuter SEULEMENT ce seeder (ne pas faire `db:seed` sans flag — exécuterait TOUS les seeders du dossier)
node ace db:seed --files=./database/seeders/super_admin_seeder.ts
```

⚠️ Le flag est `--files=PATH` (avec `=`), pas `--files PATH` comme indiqué dans l'AC de l'épic. Et le chemin est **complet relatif au projet**, pas juste le nom de classe.

### Pattern de tests — Cohérence avec `admin_user.spec.ts`

```typescript
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import AdminUser from '#models/admin_user'
import SuperAdminSeeder from '../../../database/seeders/super_admin_seeder.js'
import app from '@adonisjs/core/services/app'

test.group('SuperAdminSeeder', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('crée le super admin avec les bons defaults', async ({ assert }) => {
    process.env.SUPER_ADMIN_EMAIL = 'test-super@anta.test'
    process.env.SUPER_ADMIN_PASSWORD = 'SuperSecret123!'

    const seeder = new SuperAdminSeeder(await db.connection())
    await seeder.run()

    const admin = await AdminUser.findByOrFail('email', 'test-super@anta.test')
    assert.equal(admin.role, 'super_admin')
    assert.isTrue(admin.isActive)
    assert.isFalse(admin.totpEnabled)
    assert.isFalse(admin.passwordChanged)
    assert.isNull(admin.createdById)
    assert.isTrue(await hash.verify(admin.passwordHash, 'SuperSecret123!'))
  })

  // ... autres tests
})
```

⚠️ **Subtilité d'instanciation** : `BaseSeeder` attend un argument client BDD dans son constructeur. Vérifier l'API exacte dans la doc Lucid v22 — il se peut qu'il faille passer `await db.connection()` ou utiliser un helper de testUtils.

**Alternative plus robuste pour les tests** : extraire la logique du seeder dans une méthode statique réutilisable, puis appeler cette méthode directement dans les tests :

```typescript
// Dans super_admin_seeder.ts
export class SuperAdminSeederLogic {
  static async run() {
    // toute la logique ici
  }
}

export default class extends BaseSeeder {
  async run() {
    return SuperAdminSeederLogic.run()
  }
}
```

Puis dans les tests : `await SuperAdminSeederLogic.run()` — pas besoin d'instancier `BaseSeeder`.

### Manipulation des variables d'env dans les tests

```typescript
// Sauver l'état initial pour restaurer après le test
const originalEmail = process.env.SUPER_ADMIN_EMAIL
const originalPassword = process.env.SUPER_ADMIN_PASSWORD

// ... test ...

// Restaurer (sinon les autres tests sont impactés)
process.env.SUPER_ADMIN_EMAIL = originalEmail
process.env.SUPER_ADMIN_PASSWORD = originalPassword
```

⚠️ **Attention** : `env.get()` depuis AdonisJS lit `process.env` AU CHARGEMENT — pas à chaque appel. Si on modifie `process.env` après le boot de l'app, `env.get()` peut retourner la valeur cachée. Solution : utiliser `process.env.SUPER_ADMIN_EMAIL` directement dans le seeder, ou lire `env.get()` à chaque appel via une factory.

**Décision pragmatique** : dans le seeder, utiliser `env.get()` (cohérent avec le reste du projet). Dans les tests, **définir les variables d'env AVANT le chargement de l'app** (dans `setup` du group, qui s'exécute après le boot — peut nécessiter de tester via une factory plutôt qu'en mutant `process.env`).

**Pattern alternatif simple** : passer email/password en argument optionnel au seeder pour faciliter les tests :

```typescript
export class SuperAdminSeederLogic {
  static async run(overrides?: { email?: string; password?: string }) {
    const email = overrides?.email ?? env.get('SUPER_ADMIN_EMAIL')
    const password = overrides?.password ?? env.get('SUPER_ADMIN_PASSWORD')
    // ...
  }
}
```

Les tests passent les overrides explicitement, le seeder en CLI utilise les variables d'env. **C'est le pattern recommandé pour cette story.**

### Anti-Patterns à Éviter

- ❌ Stocker `SUPER_ADMIN_PASSWORD` hashé dans `.env` → ✅ stocker en clair (le seeder hashe)
- ❌ Utiliser `bcrypt` directement (`import bcrypt from 'bcrypt'`) → ✅ utiliser `hash.make()` (abstraction AdonisJS, configurable)
- ❌ Ré-exécuter le seeder écraser `totp_enabled`/`totp_secret` du super admin → ✅ ne toucher QUE au password (idempotence préservant l'état métier)
- ❌ Créer plusieurs super admins via le seeder (ex. boucle) → ✅ exactement 1 super admin (FR34 — "compte unique")
- ❌ Faire un `AdminUser.create()` brut sans check d'existence → ✅ `findBy` puis logique conditionnelle
- ❌ Lever une erreur silencieuse si variables env manquantes → ✅ message d'erreur explicite avec le nom des variables
- ❌ Tests qui mutent `process.env` sans restaurer → ✅ pattern overrides argument OU sauvegarde/restauration en setup/teardown
- ❌ Exécuter `node ace db:seed` sans `--files=...` → ✅ toujours préciser le fichier pour éviter d'exécuter d'autres seeders à venir (Epic 2+)

### Project Structure Notes

**Fichiers créés par cette story :**
- `database/seeders/super_admin_seeder.ts` — créé
- `tests/unit/seeders/super_admin_seeder.spec.ts` — créé

**Fichiers modifiés par cette story :**
- `start/env.ts` — ajout `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` (optionnels)
- `.env.example` — vérification que ces variables sont présentes (normalement déjà ok depuis 1.1)
- `.env` — l'utilisateur devra remplir `SUPER_ADMIN_PASSWORD` avant d'exécuter le seeder en local

**Cohérence avec la structure existante :**
- Seeders dans `database/seeders/` — convention AdonisJS Lucid
- Tests dans `tests/unit/seeders/` — nouveau sous-dossier (cohérent avec `tests/unit/models/`, `tests/unit/services/`)

### Previous Story Intelligence (Stories 1.1 → 1.4)

**Patterns à reproduire :**
- Tests avec `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` — cohérent avec `admin_user.spec.ts` (Story 1.2)
- Variables env dans `start/env.ts` avec `.optional()` quand le démarrage de l'app n'en dépend pas (cohérent avec `RESEND_API_KEY` etc. en Story 1.4 — bien que je propose `.optional()` ici alors que 1.4 a laissé `string()` strict ; ce choix est différent car le seeder est exceptionnel, pas dans le chemin critique)
- Tests sans appel à des services externes (cohérent avec Story 1.3 R2 fake, Story 1.4 mail fake — ici on teste contre la BDD Supabase, ce qui est cohérent avec `admin_user.spec.ts`)

**Connexion BDD :**
- Story 1.4 a débloqué la connexion Supabase pooler (host `aws-1-ca-central-1.pooler.supabase.com`, port 5432 Session pooler, SSL activé)
- Toutes les 7 migrations Anta sont appliquées (vérifié via `migration:status`)
- 30 tests passent actuellement — le seeder doit pousser ce nombre à 34

**Pièges déjà rencontrés :**
- `assert.throws()` de Japa attend un constructeur Error, pas un prédicat — utiliser try/catch + `assert.instanceOf()` pour les erreurs custom
- `ace configure` génère parfois des valeurs par défaut génériques à personnaliser ensuite

### Cas d'usage MVP de ce seeder (contexte épique)

Ce seeder est le **point d'amorçage** de l'application Anta. Il doit être exécuté :
- **En production** : 1 seule fois après le premier déploiement, pour créer le compte super admin initial
- **En développement** : à la première installation pour avoir un compte de test
- **En CI/CD** : optionnel — si on veut un environnement de staging amorcé automatiquement

Une fois exécuté, **toute autre création de compte admin passera par le panel admin** (Epic 3 — `UsersController.create`). Le super admin créé par le seeder est le SEUL super admin (FR34), et il peut créer des comptes `admin` (rôle inférieur) mais pas d'autres `super_admin`.

### References

- [Source: epics.md#Story 1.5] — Acceptance Criteria de base
- [Source: prd.md#FR34] — "Le super administrateur dispose d'un compte unique, initialisé à la création du site"
- [Source: prd.md#NFR5] — "Mots de passe hashés en base de données (bcrypt ou équivalent)"
- [Source: architecture.md#3. Authentification et Sécurité] — Hashage bcrypt mentionné (mais scrypt en place — cf. Dev Notes)
- [Source: architecture.md#Modèle de données] — Structure `admin_users` (totp_enabled, password_changed, etc.)
- [Source: app/models/admin_user.ts] — Modèle Lucid existant (Story 1.2)
- [Source: config/hash.ts] — Hasher scrypt configuré (Story 1.1)
- [Source: 1-4-configuration-service-email.md] — Pattern de gestion des variables env optionnelles dans `start/env.ts`
- [Source: tests/unit/models/admin_user.spec.ts] — Pattern test transactionnel à reproduire

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **Découverte critique pendant l'implémentation** : le modèle `AdminUser` utilise le mixin `withAuthFinder` (depuis Story 1.2) qui hash automatiquement la colonne `passwordHash` via un hook `beforeSave`. Première version du seeder appelait `hash.make(password)` explicitement → double-hashage → `hash.verify` retournait false dans tous les tests (3/5 échecs).
- **Fix** : retirer `hash.make()` du seeder, passer le password en clair au modèle, laisser le mixin gérer. Ce comportement doit être documenté pour les futures stories qui créent/modifient des `AdminUser` (Epic 2 auth, Epic 3 user management).
- Pattern `SuperAdminSeederLogic` (classe statique avec overrides) confirmé excellent pour la testabilité — aucune manipulation de `process.env` nécessaire dans les tests.

### Completion Notes List

- AC1 ✅ Seeder créé, créera le super admin avec defaults conformes
- AC2 ✅ Idempotence validée — `unchanged` si même password, `password_rotated` si différent, champs métier (`isActive`, `totpEnabled`, `totpSecret`) préservés à la rotation
- AC3 ✅ Validation explicite des variables env avec message d'erreur clair
- AC4 ✅ Variables documentées dans `.env.example` (déjà depuis 1.1) et déclarées en `.optional()` dans `start/env.ts`
- AC5 ✅ 5 tests unitaires créés (au lieu de 4 prévus — j'ai splitté le test "env manquante" en 2 tests distincts pour `EMAIL` et `PASSWORD`)
- **Total : 35/35 tests passent**

### Change Log

- 2026-05-30 : Implémentation Story 1.5 — `SuperAdminSeederLogic` + seeder CLI + variables env + 5 tests unitaires. Fix mid-implementation : suppression du `hash.make` explicite (double-hashage détecté par les tests, mixin `withAuthFinder` du modèle hash automatiquement).

### File List

- `database/seeders/super_admin_seeder.ts` — créé
- `tests/unit/seeders/super_admin_seeder.spec.ts` — créé (5 tests)
- `start/env.ts` — modifié (ajout `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` optionnels)
