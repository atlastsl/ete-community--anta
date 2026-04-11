# Story 1.2 : Migrations PostgreSQL et modèles Lucid

Status: review

## Story

En tant que développeur,
Je veux toutes les tables PostgreSQL créées avec leurs index et les modèles Lucid ORM correspondants,
Afin que les epics suivants puissent stocker et interroger les données sans travail de migration supplémentaire.

## Acceptance Criteria

**AC1** — 7 tables créées par `node ace migration:run`

- **Given** la connexion PostgreSQL est configurée dans `.env`
- **When** `node ace migration:run` est exécuté
- **Then** les 7 tables sont créées : `admin_users`, `productions`, `production_files`, `production_links`, `stats_views`, `stats_downloads`, `admin_activity_logs`
- **And** toutes les colonnes correspondent au modèle de données de l'architecture (snake_case, types corrects, clés étrangères)

**AC2** — Trigger tsvector opérationnel

- **Given** la table `productions` existe
- **When** le trigger PostgreSQL tsvector est installé
- **Then** la colonne `search_vector` est mise à jour automatiquement sur INSERT et UPDATE, couvrant : `title`, `summary`, `authors`, `tags`, `category`, `domain`, `subdomain`, `language`

**AC3** — Index GIN vérifié

- **Given** le trigger tsvector est actif
- **When** un index GIN est créé sur `search_vector`
- **Then** `EXPLAIN ANALYZE` confirme l'utilisation de l'index GIN sur les requêtes `@@ to_tsquery`

**AC4** — Modèles Lucid complets

- **Given** les migrations sont exécutées
- **When** les modèles Lucid sont créés
- **Then** chaque table dispose d'un modèle TypeScript : `Production`, `AdminUser`, `ProductionFile`, `ProductionLink`, `StatsView`, `StatsDownload`, `AdminActivityLog`
- **And** les relations sont déclarées (hasMany, belongsTo)
- **And** les types TypeScript sont corrects

**AC5** — Enums TypeScript utilisés dans les modèles

- **Given** les modèles sont créés
- **When** les enums TypeScript sont définis
- **Then** `app/enums/ProductionStatus.ts`, `app/enums/LicenseStatus.ts` et `app/enums/AdminRole.ts` existent
- **And** ces enums sont utilisés dans les `@column` des modèles correspondants

## Tasks / Subtasks

- [x] **Tâche 1 — Passer de SQLite à PostgreSQL** (Prérequis à tout)
  - [x] 1.1 Installer le driver PostgreSQL : `npm install pg`
  - [x] 1.2 Mettre à jour `config/database.ts` : décommenter et activer la connexion `pg`, définir `connection: 'pg'` comme défaut, supprimer la connexion `sqlite` comme défaut
  - [x] 1.3 Mettre à jour `start/env.ts` : ajouter les variables DB (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`)
  - [x] 1.4 Renseigner `.env` avec les valeurs PostgreSQL locales (ne pas commiter)

- [x] **Tâche 2 — Nettoyer la migration kit et le modèle User** (AC1)
  - [x] 2.1 Supprimer `database/migrations/1761885935168_create_users_table.ts` (table `users` du kit — remplacée par `admin_users`)
  - [x] 2.2 Supprimer `app/models/user.ts` (sera remplacé par `AdminUser.ts`)
  - [x] 2.3 Mettre à jour `config/auth.ts` : remplacer `import('#models/user')` par `import('#models/admin_user')`
  - [x] 2.4 Ne pas éditer `database/schema.ts` manuellement — il sera régénéré automatiquement par `node ace migration:run`

- [x] **Tâche 3 — Ajouter le path alias `#enums/*` et créer les enums** (AC5)
  - [x] 3.1 Ajouter dans `package.json` → `"imports"` : `"#enums/*": "./app/enums/*.js"` (absent du kit — bloquant pour tout import `#enums/...`)
  - [x] 3.2 Créer `app/enums/ProductionStatus.ts`
  - [x] 3.3 Créer `app/enums/LicenseStatus.ts`
  - [x] 3.4 Créer `app/enums/AdminRole.ts`

- [x] **Tâche 4 — Créer les 7 migrations dans l'ordre des dépendances FK** (AC1, AC2, AC3)
  - [x] 4.1 `1775918726313_create_admin_users_table.ts` — table sans FK externe (self-referential nullable)
  - [x] 4.2 `1775918733547_create_productions_table.ts` — FK sur `admin_users.id`, colonne `search_vector tsvector`, trigger + index GIN via `this.defer`
  - [x] 4.3 `1775918734339_create_production_files_table.ts` — FK sur `productions.id`
  - [x] 4.4 `1775918735161_create_production_links_table.ts` — FK sur `productions.id`
  - [x] 4.5 `1775918736010_create_stats_views_table.ts` — FK sur `productions.id`
  - [x] 4.6 `1775918736820_create_stats_downloads_table.ts` — FK sur `productions.id`
  - [x] 4.7 `1775918737632_create_admin_activity_logs_table.ts` — FK sur `admin_users.id`

- [x] **Tâche 5 — Créer les 7 modèles Lucid** (AC4)
  - [x] 5.1 `app/models/admin_user.ts` — remplace `user.ts`, inclut `withAuthFinder`
  - [x] 5.2 `app/models/production.ts`
  - [x] 5.3 `app/models/production_file.ts`
  - [x] 5.4 `app/models/production_link.ts`
  - [x] 5.5 `app/models/stats_view.ts`
  - [x] 5.6 `app/models/stats_download.ts`
  - [x] 5.7 `app/models/admin_activity_log.ts`

- [x] **Tâche 6 — Exécuter et vérifier** (AC1, AC2, AC3)
  - [x] 6.1 Exécuter `node ace migration:run` — 0 erreur (7 tables migrées sur Supabase)
  - [x] 6.2 Vérifier en base que les 7 tables existent (confirmé via migration output)
  - [x] 6.3 Vérifier le trigger tsvector via test Japa — `search_vector IS NOT NULL` après INSERT
  - [x] 6.4 Vérifier l'index GIN via test Japa — EXPLAIN confirme `idx_productions_search_vector`

- [x] **Tâche 7 — Tests** (AC4)
  - [x] 7.1 Écrire `tests/unit/models/admin_user.spec.ts` — 4 tests (création, defaults, unique email, self-ref FK)
  - [x] 7.2 Écrire `tests/unit/models/production.spec.ts` — 7 tests (création, tsvector, GIN, relations files/links/createdBy)
  - [x] 7.3 `node ace test` passe — 11 tests, 0 échec

## Dev Notes

### CRITIQUE — Passage SQLite → PostgreSQL

Le kit AdonisJS a été initialisé avec SQLite comme BDD par défaut (`config/database.ts` utilise `better-sqlite3`). **Cette story doit switcher vers PostgreSQL avant toute migration.**

**Étapes obligatoires :**

```bash
npm install pg
```

Puis dans `config/database.ts`, décommenter et activer la section `pg` :

```typescript
import env from '#start/env'
import app from '@adonisjs/core/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'pg',
  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: app.inDev,
    },
  },
})

export default dbConfig
```

⚠️ Supprimer la connexion `sqlite` complète (ou la commenter) — ne pas laisser deux connexions actives.

### CRITIQUE — Migration et modèle User du kit

Le kit AdonisJS a généré :

- `database/migrations/1761885935168_create_users_table.ts` → crée une table `users`
- `app/models/user.ts` → modèle `User` étendant `UserSchema`
- `database/schema.ts` → auto-généré, déclare `UserSchema`

**Ces fichiers sont à remplacer** — l'architecture Anta n'a pas de table `users`, seulement `admin_users`.

Action requise :

1. **Supprimer** `database/migrations/1761885935168_create_users_table.ts`
2. **Supprimer** `app/models/user.ts`
3. `database/schema.ts` sera régénéré automatiquement après `migration:run` avec les nouveaux modèles — **ne pas éditer manuellement**
4. Mettre à jour `config/auth.ts` pour référencer `AdminUser` :

```typescript
provider: sessionUserProvider({
  model: () => import('#models/admin_user'),
}),
```

### Enums TypeScript

```typescript
// app/enums/ProductionStatus.ts
const ProductionStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const

export type ProductionStatus = (typeof ProductionStatus)[keyof typeof ProductionStatus]
export default ProductionStatus
```

```typescript
// app/enums/LicenseStatus.ts
const LicenseStatus = {
  MEMBER: 'member',
  FREE_LICENSE: 'free_license',
  EXTERNAL_LINK: 'external_link',
} as const

export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus]
export default LicenseStatus
```

```typescript
// app/enums/AdminRole.ts
const AdminRole = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole]
export default AdminRole
```

### Schémas de migration complets

**`admin_users`** (créer en premier — productions.created_by_id en dépend) :

```typescript
// Colonnes obligatoires issues de l'architecture
table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').toSQL().sql)
// OU : table.increments('id') si UUID non requis au stade migration
table.string('email', 254).notNullable().unique()
table.string('password_hash').notNullable()
table.enum('role', ['admin', 'super_admin']).notNullable()
table.boolean('is_active').notNullable().defaultTo(true)
table.string('totp_secret').nullable()
table.boolean('totp_enabled').notNullable().defaultTo(false)
table.boolean('password_changed').notNullable().defaultTo(false)
table.uuid('created_by_id').nullable().references('id').inTable('admin_users').onDelete('SET NULL')
table.timestamps(true, true) // created_at + updated_at automatiques
```

⚠️ **UUID dans PostgreSQL** : utiliser `table.uuid('id').primary()` avec `gen_random_uuid()` comme défaut (nécessite l'extension `uuid-ossp` ou PostgreSQL 13+ qui l'inclut nativement via `gen_random_uuid()`).

Alternative plus simple si l'UUID auto n'est pas supporté dans Knex pour cette version :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
```

**`productions`** (contient trigger tsvector — voir section dédiée) :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table.string('title').notNullable()
table.text('summary').nullable()
table.jsonb('authors').notNullable().defaultTo('[]') // array d'auteurs
table.jsonb('tags').notNullable().defaultTo('[]') // array de tags
table.string('category').nullable()
table.string('domain').nullable()
table.string('subdomain').nullable()
table.string('language').nullable()
table.string('publication_country').nullable()
table.string('journal').nullable()
table.string('publisher').nullable()
table.string('isbn_doi_issn').nullable()
table.string('institution').nullable()
table.enum('license_status', ['member', 'free_license', 'external_link']).notNullable()
table.enum('status', ['draft', 'published', 'unpublished']).notNullable().defaultTo('draft')
table.date('work_published_at').nullable() // saisie admin, publique
table.timestamp('anta_published_at').nullable() // première publication Anta, interne
table.specificType('search_vector', 'tsvector').nullable()
table.uuid('created_by_id').nullable().references('id').inTable('admin_users').onDelete('SET NULL')
table.timestamps(true, true)

// Index sur les colonnes de filtrage fréquent
table.index(['status'], 'idx_productions_status')
table.index(['license_status'], 'idx_productions_license_status')
table.index(['language'], 'idx_productions_language')
```

**`production_files`** :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table
  .uuid('production_id')
  .notNullable()
  .references('id')
  .inTable('productions')
  .onDelete('CASCADE')
table.string('file_key').notNullable() // clé R2 — jamais l'URL complète
table.string('original_name').notNullable()
table.string('mime_type').notNullable()
table.bigInteger('size_bytes').notNullable()
table.string('storage_provider').notNullable().defaultTo('r2')
table.timestamps(true, true)
```

**`production_links`** :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table
  .uuid('production_id')
  .notNullable()
  .references('id')
  .inTable('productions')
  .onDelete('CASCADE')
table.string('url').notNullable()
table.enum('link_type', ['embed', 'simple']).notNullable()
table.string('label').nullable()
table.timestamps(true, true)
```

**`stats_views`** :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table
  .uuid('production_id')
  .notNullable()
  .references('id')
  .inTable('productions')
  .onDelete('CASCADE')
table.timestamp('recorded_at').notNullable().defaultTo(this.raw('now()'))
table.string('ip_hash').nullable() // anonymisé — hash de l'IP
table.string('session_id').nullable()
// Pas de updated_at — stats en append only
table.index(['production_id'], 'idx_stats_views_production_id')
table.index(['recorded_at'], 'idx_stats_views_recorded_at')
```

**`stats_downloads`** :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table
  .uuid('production_id')
  .notNullable()
  .references('id')
  .inTable('productions')
  .onDelete('CASCADE')
table.timestamp('downloaded_at').notNullable().defaultTo(this.raw('now()'))
table.string('ip_hash').nullable() // anonymisé
table.index(['production_id'], 'idx_stats_downloads_production_id')
```

**`admin_activity_logs`** :

```typescript
table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
table
  .uuid('admin_user_id')
  .notNullable()
  .references('id')
  .inTable('admin_users')
  .onDelete('CASCADE')
table.string('action_type').notNullable() // login | create | update | publish | delete | ...
table.string('resource_type').nullable()
table.string('resource_id').nullable()
table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
// Pas de updated_at — logs immuables
table.index(['admin_user_id'], 'idx_admin_activity_logs_admin_user_id')
table.index(['created_at'], 'idx_admin_activity_logs_created_at')
```

### Trigger tsvector — SQL brut dans la migration productions

**La migration `productions` doit utiliser `this.defer` pour exécuter le SQL brut du trigger après la création de la table.**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'productions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // ... colonnes comme ci-dessus ...
    })

    // Trigger tsvector — doit s'exécuter après la création de la table
    this.defer(async (db) => {
      // Créer la fonction trigger
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION productions_search_vector_update()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector := to_tsvector(
            'simple',
            coalesce(NEW.title, '') || ' ' ||
            coalesce(NEW.summary, '') || ' ' ||
            coalesce(NEW.authors::text, '') || ' ' ||
            coalesce(NEW.tags::text, '') || ' ' ||
            coalesce(NEW.category, '') || ' ' ||
            coalesce(NEW.domain, '') || ' ' ||
            coalesce(NEW.subdomain, '') || ' ' ||
            coalesce(NEW.language, '')
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)

      // Attacher le trigger à la table
      await db.rawQuery(`
        CREATE TRIGGER productions_search_vector_trigger
        BEFORE INSERT OR UPDATE ON productions
        FOR EACH ROW EXECUTE FUNCTION productions_search_vector_update();
      `)

      // Index GIN pour performances full-text search
      await db.rawQuery(`
        CREATE INDEX idx_productions_search_vector
        ON productions USING GIN (search_vector);
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP TRIGGER IF EXISTS productions_search_vector_trigger ON productions`)
      await db.rawQuery(`DROP FUNCTION IF EXISTS productions_search_vector_update()`)
    })
    this.schema.dropTable(this.tableName)
  }
}
```

⚠️ **`this.defer` s'exécute dans la même transaction que le schema** — si la table échoue, le trigger ne sera pas créé non plus. C'est le comportement attendu.

⚠️ **`'simple'` comme configuration tsvector** est intentionnel — couvre toutes les langues sans stemming agressif. L'architecture prescrit `'simple'`.

### Modèles Lucid — Patterns obligatoires

**Conventions depuis l'architecture :**

- Fichiers modèles : `PascalCase` singulier (`Production.ts`, `AdminUser.ts`)
- Emplacement : `app/models/`
- Import des enums dans les modèles

**`AdminUser.ts`** — remplace `User.ts`, utilisé par `config/auth.ts` :

```typescript
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import AdminRole, { type AdminRole as AdminRoleType } from '#enums/AdminRole'
import type AdminActivityLog from '#models/admin_activity_log'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'passwordHash',
})

export default class AdminUser extends compose(BaseModel, AuthFinder) {
  static table = 'admin_users'

  @column({ isPrimary: true })
  declare id: string // UUID

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare passwordHash: string

  @column()
  declare role: AdminRoleType

  @column()
  declare isActive: boolean

  @column({ serializeAs: null })
  declare totpSecret: string | null

  @column()
  declare totpEnabled: boolean

  @column()
  declare passwordChanged: boolean

  @column()
  declare createdById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => AdminActivityLog)
  declare activityLogs: HasMany<typeof AdminActivityLog>
}
```

⚠️ **`passwordHash` dans Lucid** : la colonne en base est `password_hash` (snake_case). Lucid mappe automatiquement `passwordHash` (camelCase) → `password_hash`. Vérifier que `withAuthFinder` utilise `passwordColumnName: 'passwordHash'` (camelCase du modèle, pas snake_case de la DB).

**`Production.ts`** :

```typescript
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import ProductionStatus, {
  type ProductionStatus as ProductionStatusType,
} from '#enums/ProductionStatus'
import LicenseStatus, { type LicenseStatus as LicenseStatusType } from '#enums/LicenseStatus'
import type AdminUser from '#models/admin_user'
import type ProductionFile from '#models/production_file'
import type ProductionLink from '#models/production_link'

export default class Production extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID

  @column()
  declare title: string

  @column()
  declare summary: string | null

  @column()
  declare authors: string[] // JSONB array

  @column()
  declare tags: string[] // JSONB array

  @column()
  declare category: string | null

  @column()
  declare domain: string | null

  @column()
  declare subdomain: string | null

  @column()
  declare language: string | null

  @column()
  declare publicationCountry: string | null

  @column()
  declare journal: string | null

  @column()
  declare publisher: string | null

  @column()
  declare isbnDoiIssn: string | null

  @column()
  declare institution: string | null

  @column()
  declare licenseStatus: LicenseStatusType

  @column()
  declare status: ProductionStatusType

  @column.date()
  declare workPublishedAt: DateTime | null // date saisie admin, publique

  @column.dateTime()
  declare antaPublishedAt: DateTime | null // première publication Anta, interne

  // search_vector n'est pas déclaré dans le modèle — géré côté PostgreSQL uniquement

  @column()
  declare createdById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => AdminUser, { foreignKey: 'createdById' })
  declare createdBy: BelongsTo<typeof AdminUser>

  @hasMany(() => ProductionFile)
  declare files: HasMany<typeof ProductionFile>

  @hasMany(() => ProductionLink)
  declare links: HasMany<typeof ProductionLink>
}
```

**`ProductionFile.ts`** :

```typescript
export default class ProductionFile extends BaseModel {
  static table = 'production_files'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column()
  declare fileKey: string // clé R2 — jamais l'URL

  @column()
  declare originalName: string

  @column()
  declare mimeType: string

  @column()
  declare sizeBytes: number

  @column()
  declare storageProvider: string // 'r2' par défaut

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
```

**`ProductionLink.ts`** :

```typescript
export default class ProductionLink extends BaseModel {
  static table = 'production_links'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column()
  declare url: string

  @column()
  declare linkType: 'embed' | 'simple'

  @column()
  declare label: string | null

  // timestamps
  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
```

**`StatsView.ts`** et **`StatsDownload.ts`** — pas de `updatedAt` (append only) :

```typescript
// StatsView.ts
export default class StatsView extends BaseModel {
  static table = 'stats_views'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column.dateTime()
  declare recordedAt: DateTime

  @column()
  declare ipHash: string | null

  @column()
  declare sessionId: string | null

  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
```

**`AdminActivityLog.ts`** — pas de `updatedAt` (logs immuables) :

```typescript
export default class AdminActivityLog extends BaseModel {
  static table = 'admin_activity_logs'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare adminUserId: string

  @column()
  declare actionType: string // login | create | update | publish | delete | ...

  @column()
  declare resourceType: string | null

  @column()
  declare resourceId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => AdminUser)
  declare adminUser: BelongsTo<typeof AdminUser>
}
```

### start/env.ts — Variables DB à ajouter

```typescript
// Ajouter dans le schema Env.create :
DB_HOST: Env.schema.string({ format: 'host' }),
DB_PORT: Env.schema.number(),
DB_USER: Env.schema.string(),
DB_PASSWORD: Env.schema.secret(),
DB_DATABASE: Env.schema.string(),
```

### Conventions de Nommage Obligatoires

| Élément           | Convention                     | Exemple                                                   |
| ----------------- | ------------------------------ | --------------------------------------------------------- |
| Tables PostgreSQL | `snake_case` pluriel           | `admin_users`, `production_files`                         |
| Colonnes DB       | `snake_case`                   | `created_by_id`, `password_hash`, `is_active`             |
| Index             | `idx_{table}_{colonnes}`       | `idx_productions_status`, `idx_productions_search_vector` |
| Migrations        | `{timestamp}_{action}_{table}` | `1234567890_create_productions_table`                     |
| Fichiers modèles  | `PascalCase` singulier         | `Production.ts`, `AdminUser.ts`                           |
| Propriétés Lucid  | `camelCase`                    | `createdById`, `passwordHash`, `isActive`                 |

### Anti-Patterns à Éviter

- ❌ Conserver le modèle `User` du kit → ✅ Remplacer par `AdminUser` mappé sur `admin_users`
- ❌ Oublier de mettre à jour `config/auth.ts` après suppression de `User` → erreur au démarrage
- ❌ Déclarer `search_vector` comme `@column` dans le modèle `Production` → c'est une colonne gérée par trigger PostgreSQL, non modifiable via Lucid
- ❌ Créer la migration `productions` avant `admin_users` → erreur FK au `migration:run`
- ❌ Utiliser `table.string('id').primary()` pour les UUID → utiliser `table.uuid('id').primary()`
- ❌ Écrire `this.raw('gen_random_uuid()')` directement dans le schema builder → utiliser `this.db.rawQuery()` à l'intérieur de `this.defer` pour le trigger, mais `this.raw()` reste valide dans `table.defaultTo()`
- ❌ Éditer `database/schema.ts` manuellement → ce fichier est auto-généré
- ❌ Stocker une URL complète R2 dans `production_files.file_key` → stocker uniquement la clé (Story 1.3 couvre les URLs signées)

### Tests

**Pattern de test depuis la Story 1.1 :** Japa + `@japa/api-client` configuré dans `tests/bootstrap.ts`.

**Tests unitaires modèles** — nécessitent une vraie BDD PostgreSQL (pas de mocks) :

```typescript
// tests/unit/models/admin_user.spec.ts
import { test } from '@japa/runner'
import AdminUser from '#models/admin_user'

test.group('AdminUser model', () => {
  test('crée un admin user', async ({ assert }) => {
    const user = await AdminUser.create({
      email: 'test@anta.test',
      passwordHash: 'hashed',
      role: 'admin',
    })
    assert.equal(user.email, 'test@anta.test')
    assert.equal(user.role, 'admin')
    assert.isTrue(user.isActive) // défaut
    assert.isFalse(user.totpEnabled) // défaut
    await user.delete() // cleanup
  })
})
```

### Project Structure Notes

**Alignement avec l'architecture :**

- `database/migrations/` — 7 fichiers au lieu de 1 (suppression du fichier `users` du kit)
- `app/models/` — 7 modèles (`AdminUser.ts` remplace `user.ts`)
- `app/enums/` — 3 fichiers (dossier existait déjà via Story 1.1 avec `.gitkeep`)

**Import paths (package.json `imports`) :**

- `#models/*` → `./app/models/*.js` ✅ déjà configuré
- `#enums/*` → ❌ **ABSENT** — doit être ajouté en Tâche 3.1 : `"#enums/*": "./app/enums/*.js"`

### Références

- [Source: architecture.md#1. Architecture des Données] — Schéma complet des 7 tables
- [Source: architecture.md#Conventions de Nommage] — Tables snake*case, index idx*\*, migrations timestamp
- [Source: architecture.md#Structure Cible du Dépôt] — Emplacements `database/migrations/`, `app/models/`, `app/enums/`
- [Source: architecture.md#3. Authentification] — Flux `password_changed`, `totp_enabled`, `is_active` pour admin_users
- [Source: epics.md#Story 1.2] — Acceptance Criteria, trigger tsvector, index GIN
- [Source: 1-1-initialisation-projet-adonisjs-inertia-react.md#Dev Notes] — Kit utilise SQLite (confirmation), `@japa/api-client` configuré pour tests

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

- Switch SQLite → PostgreSQL : `pg` installé, `config/database.ts` réécrit, `start/env.ts` enrichi avec les 5 variables DB
- `DB_PASSWORD` validé comme `string.optional()` pour supporter les env sans mot de passe (ex: trust auth)
- Migration kit nettoyée : `1761885935168_create_users_table.ts` supprimé, `app/models/user.ts` supprimé
- `config/auth.ts` mis à jour pour référencer `#models/admin_user`
- Fichiers kit restants adaptés : `new_account_controller.ts`, `session_controller.ts`, `user_transformer.ts` — import `#models/user` → `#models/admin_user`
- Path alias `#enums/*` ajouté dans `package.json` imports
- 3 enums créés : `ProductionStatus`, `LicenseStatus`, `AdminRole` (pattern `as const` + type exporté)
- 7 migrations avec UUID `gen_random_uuid()`, enums `useNative: true`, timestamps `defaultTo(now())`
- Trigger tsvector + index GIN créés via `this.defer` dans la migration `productions`
- 7 modèles Lucid avec relations `hasMany`/`belongsTo` et types TypeScript
- Colonnes JSONB `authors`/`tags` : `prepare`/`consume` ajoutés dans `Production.ts` (Lucid ne sérialise pas automatiquement les arrays pour PostgreSQL)
- `AdminUser.refresh()` nécessaire après `create()` pour obtenir les valeurs par défaut DB (isActive, totpEnabled, passwordChanged)
- BDD de dev passée de locale à Supabase en cours de story
- 11 tests unit (4 AdminUser + 7 Production) couvrant : CRUD, defaults, unicité, self-ref FK, tsvector trigger, GIN index, relations files/links/createdBy
- Lint + format propres

### Change Log

- 2026-04-11 : Story 1.2 implémentée — 7 migrations PostgreSQL, 7 modèles Lucid, 3 enums, trigger tsvector + GIN index, switch SQLite→PostgreSQL, 11 tests passants

### File List

- config/database.ts (réécrit — SQLite → PostgreSQL)
- config/auth.ts (modifié — import AdminUser)
- start/env.ts (modifié — ajout variables DB)
- package.json (modifié — ajout `pg`, alias `#enums/*`)
- .env (modifié — ajout credentials PostgreSQL Supabase — NE PAS COMMITER)
- app/enums/production_status.ts (créé)
- app/enums/license_status.ts (créé)
- app/enums/admin_role.ts (créé)
- app/enums/.gitkeep (supprimé)
- database/migrations/1761885935168_create_users_table.ts (supprimé)
- database/migrations/1775918726313_create_admin_users_table.ts (créé)
- database/migrations/1775918733547_create_productions_table.ts (créé — inclut trigger + GIN)
- database/migrations/1775918734339_create_production_files_table.ts (créé)
- database/migrations/1775918735161_create_production_links_table.ts (créé)
- database/migrations/1775918736010_create_stats_views_table.ts (créé)
- database/migrations/1775918736820_create_stats_downloads_table.ts (créé)
- database/migrations/1775918737632_create_admin_activity_logs_table.ts (créé)
- database/schema.ts (auto-régénéré par migration:run)
- app/models/user.ts (supprimé)
- app/models/admin_user.ts (créé — remplace user.ts, avec withAuthFinder)
- app/models/production.ts (créé — avec prepare/consume JSONB)
- app/models/production_file.ts (créé)
- app/models/production_link.ts (créé)
- app/models/stats_view.ts (créé)
- app/models/stats_download.ts (créé)
- app/models/admin_activity_log.ts (créé)
- app/controllers/new_account_controller.ts (modifié — import AdminUser)
- app/controllers/session_controller.ts (modifié — import AdminUser)
- app/transformers/user_transformer.ts (modifié — import AdminUser)
- tests/unit/models/admin_user.spec.ts (créé — 4 tests)
- tests/unit/models/production.spec.ts (créé — 7 tests)
