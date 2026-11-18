---
baseline_commit: 6bf12f1449742ada5f50191189376e8c952356ae
---

# Story 9.1 : Créer et modifier une fiche auteur

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur** (rôle `admin` ou `super_admin`),
je veux **créer et modifier la fiche d'un auteur (noms, prénoms, affiliations, lien Google Scholar)**,
afin de **constituer le référentiel d'auteurs auquel les productions seront rattachées** (FR52).

## Décision de périmètre (lire en premier)

- **DANS 9.1** : migrations `authors`, `author_affiliations`, `admin_activity_logs.metadata` ; helpers `normalizeKey` / `slugify` ; modèles `Author`, `AuthorAffiliation` ; `AuthorService` (création / mise à jour + remplacement des affiliations) ; validateur ; routes `admin.authors`, `.create`, `.store`, `.edit`, `.update` ; pages `Authors/{Index,Create,Edit}` + `AuthorForm` ; entrée « Auteurs » de la barre latérale ; `metadata` dans le journal et affichage « Auteur — {nom} » dans la page Journal ; i18n ; tests.
- **HORS 9.1 (ne PAS implémenter)** : recherche, filtres, compteurs, colonnes Productions/Statut, suppression → **9.2** ; photo (`photo_key`, `sharp`, `ImageService`) → **9.3** ; case et actions de consentement, badges Public / Non public / À compléter → **9.4** ; pivot `production_authors`, conversion → **9.5–9.7** ; endpoint JSON `search` / `quick` et `AuthorFormDialog` → **9.7–9.8**. Les colonnes `photo_key`, `consent_confirmed_at`, `consent_confirmed_by_id`, `migration_key` sont **créées** par la migration de 9.1 (P2.1) mais non exposées dans le formulaire.
- **Écarts assumés vis-à-vis de l'epic (le code fait foi, « Règle de lecture » P2)** :
  - **Pas de Zod** : le projet n'a ni dépendance `zod` ni schéma Zod côté client. La « double couche » est réalisée comme dans le code existant (`inertia/lib/production_completion.ts`, validation e-mail de `Users/Create.tsx`) : fonction pure `validateAuthorForm` dans `inertia/lib/author_form.ts`, mêmes règles que VineJS, retournant des **clés i18n** identiques à celles du serveur. Ne pas ajouter `zod`.
  - **Règle « ≥ 1 affiliation sauf fiche migrée »** : VineJS ne connaît pas la fiche ; le schéma accepte `affiliations` (tableau, `maxLength(20)`), puis `assertAffiliationRule(data, { isMigrated })` (même patron que `assertProductionTaxonomy`) lève `E_VALIDATION_ERROR` sur le champ `affiliations` avec `authors.form.errors.affiliation_required`. Création dans le panel → `isMigrated = false` → ≥ 1 obligatoire.
- **Base partagée** : les migrations ne sont exécutées **que sur le Postgres local de test** pendant le dev (`npm run test:local`, et `database/schema.ts` régénéré contre cette base, voir Tâche 1.5). **Jamais** de `migration:run` sous `doppler run` dans cette story : l'application sur Supabase se décidera au moment de la recette par Aurélien.

## Acceptance Criteria

1. **Migrations** — **Given** `1775918745000_create_authors_table.ts`, `1775918746000_create_author_affiliations_table.ts`, `1775918750000_add_metadata_to_admin_activity_logs.ts`, **When** `node ace migration:run` s'exécute, **Then** `authors` et `author_affiliations` existent avec colonnes, contraintes et index de P2.1 (`slug` UNIQUE, `migration_key` UNIQUE NULL, `consent_confirmed_at` / `consent_confirmed_by_id` NULL, `photo_key` NULL, `idx_authors_search_name_trgm` GIN trigram, `idx_authors_last_names`, `UNIQUE (author_id, position)`, `CHECK (position >= 1)`, `idx_author_affiliations_institution_key`) **and** `admin_activity_logs.metadata` (jsonb NULL) est ajoutée sans toucher aux lignes existantes **and** les migrations sont purement additives, leurs `down()` écrits mais jamais exécutés sur la base partagée.
2. **Normalisation et slug** — **Given** `app/helpers/normalize.ts` (`normalizeKey`) et `app/helpers/slug.ts` (`slugify`, translittération extraite de `ProductionService.generateSlug`, qui l'utilise désormais **sans changement de comportement**), **When** une fiche `Author` ou une `AuthorAffiliation` est enregistrée, **Then** les hooks `@beforeSave` écrivent `search_name` (`normalizeKey("prénoms noms")`) et `institution_key` (`normalizeKey(institution)`) **and** le slug `prenom-nom` est généré à la création (repli `auteur`, suffixe `-2`, `-3`… en cas de collision) puis **figé** : renommer l'auteur ne le modifie pas (D28).
3. **Création** — **Given** un administrateur sur `/admin/authors/create`, **When** il soumet `AuthorForm` avec Nom(s)* puis Prénom(s)* (D34), au moins une affiliation (institution*, département facultatif, ordre ↑ ↓ — la 1re est l'institution principale) et éventuellement un lien Google Scholar, **Then** la fiche est créée avec `created_by_id`, ses affiliations sont enregistrées dans l'ordre saisi (positions 1..n), redirection vers `/admin/authors/:id/edit` avec le toast « Auteur créé. » **and** le journal reçoit `create` / `author` / id avec `metadata: { name }`.
4. **Validation** — **Given** une saisie invalide (nom ou prénom vide ou > 120 caractères, aucune affiliation sur une fiche du panel, institution vide ou > 255, département > 255, URL Google Scholar non `http(s)` ou > 500), **When** le formulaire est soumis, **Then** `app/validators/admin/author_validator.ts` refuse et chaque erreur s'affiche sous son champ (clés `authors.form.errors.*`, même clé côté client et serveur) **and** le bouton × de la dernière affiliation est désactivé côté client tant que la fiche exige ≥ 1 affiliation.
5. **Modification** — **Given** une fiche sur `/admin/authors/:id/edit`, **When** l'administrateur l'enregistre, **Then** les modifications sont persistées, les affiliations **remplacées dans une transaction** (`DELETE` puis `INSERT` positions 1..n, jamais `UPDATE position`), toast « Auteur enregistré. », journal `update` / `author` avec `metadata: { name, fields: [...] }` (champs réellement modifiés parmi `lastNames`, `firstNames`, `googleScholarUrl`, `affiliations`) **and** une fiche migrée (`migration_key` non NULL) sans affiliation reste enregistrable (exception FR52).
6. **Navigation et liste** — **Given** un administrateur connecté, **When** il ouvre le panel, **Then** la barre latérale affiche « Auteurs » (icône `BookUser`) juste après « Productions », active sur toutes les sous-pages `/admin/authors*`, visible pour admin et super admin **and** `/admin/authors` liste les fiches (20/page, tri `last_names`, `first_names`, `id`) : « Prénom NOM » (NOM en capitales **à l'affichage seulement**, D13/D34), affiliation principale (sinon « Aucune affiliation » en `text-stone-500`), date de mise à jour, action « Modifier », bouton « Créer un auteur » ; liste vide → état vide existant (icône stone-300 + titre + description + bouton).
7. **Accès** — **Given** un visiteur non authentifié, **When** il appelle une route `/admin/authors*`, **Then** 302 vers `/admin/login` (groupe `middleware.admin()`) ; un `:id` non UUID ou inconnu → 404 (pas de 500 Postgres).
8. **Journal** — **Given** la page Journal (super admin), **When** une entrée porte `resourceType = 'author'`, **Then** la colonne Ressource affiche « Auteur — {metadata.name} » (repli « Auteur #xxxxxxxx » sans metadata) ; les entrées existantes restent affichées comme avant.
9. **i18n** — toutes les chaînes dans `inertia/locales/admin/{fr,en}.json` (parité vérifiée par `tests/unit/i18n/translations.spec.ts`).

## Tasks / Subtasks

- [x] **T1 — Migrations et schéma** (AC 1)
  - [x] 1.1 `database/migrations/1775918745000_create_authors_table.ts` : `id uuid PK default gen_random_uuid()`, `slug string(255) notNullable unique`, `first_names string(120) notNullable`, `last_names string(120) notNullable`, `search_name text notNullable`, `google_scholar_url string(500) nullable`, `photo_key string(255) nullable`, `consent_confirmed_at timestamp nullable`, `consent_confirmed_by_id uuid nullable → admin_users.id ON DELETE SET NULL`, `migration_key string(255) nullable unique`, `created_by_id uuid nullable → admin_users.id ON DELETE SET NULL`, `created_at timestamp notNullable default now()`, `updated_at timestamp nullable` ; index `idx_authors_last_names (last_names)` ; dans `this.defer` : `CREATE INDEX IF NOT EXISTS idx_authors_search_name_trgm ON authors USING gin (search_name gin_trgm_ops)` (pg_trgm déjà activé par `1775918742000`).
  - [x] 1.2 `1775918746000_create_author_affiliations_table.ts` : `id uuid PK`, `author_id uuid notNullable → authors.id ON DELETE CASCADE`, `position smallint notNullable`, `institution string(255) notNullable`, `institution_key string(255) notNullable`, `department string(255) nullable`, `created_at`/`updated_at` (même convention que `production_links`) ; `unique(['author_id','position'])` ; `CHECK (position >= 1)` (`table.check('?? >= 1', ['position'])` ou raw) ; index `idx_author_affiliations_institution_key (institution_key)`.
  - [x] 1.3 `1775918750000_add_metadata_to_admin_activity_logs.ts` : `alterTable` + `table.jsonb('metadata').nullable()` ; `down` : `dropColumn`. **Ne pas créer** les migrations 3, 4, 5, 7 de P2.1 (stories ultérieures) : laisser les trous de numérotation.
  - [x] 1.4 Commentaire d'en-tête dans chaque migration : « Additive — base partagée dev/staging : down() jamais exécuté » (cf. P2.1).
  - [x] 1.5 Régénérer `database/schema.ts` (fichier généré et **committé**) en exécutant `node ace migration:run` contre le Postgres local de test (mêmes variables que `scripts/test-local.sh` : `DB_HOST=127.0.0.1 DB_PORT=5433 DB_USER=postgres DB_PASSWORD=postgres DB_DATABASE=anta_test` + `NODE_ENV=test`, conteneur `anta-test-db` démarré) — **jamais sous `doppler run`**. Vérifier que le diff de `schema.ts` ne contient que les ajouts attendus (`AuthorSchema`, `AuthorAffiliationSchema`, `metadata`).
- [x] **T2 — Helpers** (AC 2)
  - [x] 2.1 `package.json` `imports` : ajouter `"#helpers/*": "./app/helpers/*.js"` (absent aujourd'hui) ; vérifier que `tsconfig.json` résout l'alias (les autres `#…` passent par `imports`, rien d'autre à faire normalement).
  - [x] 2.2 `app/helpers/normalize.ts` : `export function normalizeKey(value: string): string` → `value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()`. Sans dépendance.
  - [x] 2.3 `app/helpers/slug.ts` : `export function slugify(value: string, maxLength = 80): string` = exactement le corps actuel de `ProductionService.generateSlug` **sans** le repli (`normalize('NFD')`, diacritiques retirés, minuscules, `[^a-z0-9]+ → -`, trim des `-`, `slice(0, maxLength)`, trim final des `-`) ; retourne `''` si rien ne subsiste.
  - [x] 2.4 `ProductionService.generateSlug(title)` devient `slugify(title ?? '') || 'production'` — comportement identique (les tests existants de `production_service.spec.ts` doivent passer sans modification). La migration `1775918744000_add_slug_to_productions_table.ts` garde sa copie figée : **ne pas y toucher**.
- [x] **T3 — Modèles** (AC 2)
  - [x] 3.1 `app/models/author.ts` : colonnes camelCase (`firstNames`, `lastNames`, `searchName`, `googleScholarUrl`, `photoKey`, `consentConfirmedAt`, `consentConfirmedById`, `migrationKey`, `createdById`, `createdAt` `autoCreate`, `updatedAt` `autoCreate+autoUpdate`) ; `@hasMany(() => AuthorAffiliation, { onQuery: (q) => q.orderBy('position', 'asc') })` nommé `affiliations` ; `@beforeSave()` → `searchName = normalizeKey(\`${firstNames} ${lastNames}\`)` ; `@beforeCreate()` → si `!slug`, `slug = await Author.generateUniqueSlug(firstNames, lastNames)` (`slugify(\`${first} ${last}\`) || 'auteur'`, puis `-2`, `-3`… tant que `Author.findBy('slug', …)` existe — même patron que `ProductionService.generateUniqueSlug`, en passant `{ client: trx }` si la création est transactionnelle). **Aucun** hook ne recalcule le slug à la mise à jour (D28).
  - [x] 3.2 Getter non persisté `get displayName()` **non** nécessaire côté serveur : le format « Prénom NOM » est fait côté client (T6.1). Le journal stocke `name = \`${firstNames} ${lastNames}\`` (casse saisie, D34).
  - [x] 3.3 `app/models/author_affiliation.ts` : `authorId`, `position`, `institution`, `institutionKey`, `department`, timestamps ; `@beforeSave()` → `institutionKey = normalizeKey(institution)` ; `@belongsTo(() => Author)`.
  - [x] 3.4 `app/models/admin_activity_log.ts` : `@column() declare metadata: Record<string, unknown> | null` avec `prepare: (v) => (v == null ? null : JSON.stringify(v))` et `consume` tolérant chaîne/objet (même patron que les colonnes jsonb de `production.ts`).
- [x] **T4 — Journal** (AC 3, 5, 8)
  - [x] 4.1 `ActivityLogService.log` : `LogParams.metadata?: Record<string, unknown>` écrit dans `metadata` (`?? null`). Ne jamais lever (try/catch existant conservé). Mettre à jour `tests/unit/services/activity_log_service.spec.ts` si elle vérifie la forme des paramètres.
  - [x] 4.2 `activity_logs_controller.ts` : ajouter `resourceName: typeof log.metadata?.name === 'string' ? log.metadata.name : null` à chaque ligne sérialisée.
  - [x] 4.3 `inertia/pages/admin/ActivityLogs/Index.tsx` : `resourceLabel` → si `resourceType === 'author'` : `${t('activity.resource.author')} — ${resourceName}` (repli `${t('activity.resource.author')} #${id.slice(0,8)}`) ; autres types : **affichage actuel inchangé** (`production #xxxxxxxx`). Mettre à jour `tests/unit/components/activity_logs_page.spec.ts` (lecture de source) si nécessaire.
- [x] **T5 — Validateur, service, contrôleur, routes** (AC 3, 4, 5, 6, 7)
  - [x] 5.1 `app/validators/admin/author_validator.ts` : `authorValidator = vine.compile(vine.object({ lastNames: vine.string().trim().minLength(1).maxLength(120), firstNames: idem, affiliations: vine.array(vine.object({ institution: vine.string().trim().minLength(1).maxLength(255), department: vine.string().trim().maxLength(255).optional() })).maxLength(20), googleScholarUrl: vine.string().trim().maxLength(500).url({ require_protocol: true, protocols: ['http','https'] }).optional() }))` ; `messagesProvider` `SimpleMessagesProvider` → clés `authors.form.errors.last_names_required`, `last_names_too_long`, `first_names_required`, `first_names_too_long`, `institution_required`, `institution_too_long`, `department_too_long`, `scholar_url_invalid` (pour `url` **et** `maxLength`), `affiliations_too_many` ; utiliser les clés génériques par sélecteur de champ imbriqué (`'affiliations.*.institution.required'`, etc.). Un champ vide envoyé `''` : VineJS `optional()` traite `''`… → **vérifier** : pour `googleScholarUrl` et `department`, convertir `''` en absent côté client (ne pas envoyer la clé) **ou** côté serveur avant validation ; tester les deux chemins (POST direct avec `''`).
  - [x] 5.2 Même fichier : `export function assertAffiliationRule(data: { affiliations: unknown[] }, opts: { isMigrated: boolean })` → si `!opts.isMigrated && data.affiliations.length === 0` : `throw new errors.E_VALIDATION_ERROR([{ field: 'affiliations', message: 'authors.form.errors.affiliation_required', rule: 'minLength' }])`.
  - [x] 5.3 `app/services/author_service.ts` (réutilisé en 9.3, 9.4, 9.6, 9.8) : `static async create(payload, adminId): Promise<Author>` et `static async update(author, payload): Promise<{ author: Author; fields: string[] }>` ; chacune dans `db.transaction(async (trx) => …)` : `author.useTransaction(trx)`, save, puis `replaceAffiliations(author, affiliations, trx)` = `AuthorAffiliation.query({ client: trx }).where('authorId', id).delete()` puis création positions 1..n (`createMany` via le modèle pour déclencher `@beforeSave` → `institution_key`). `fields` = champs dont la valeur normalisée change (affiliations comparées sur `[{institution, department ?? null}]` ordonné). `googleScholarUrl` / `department` vides → `null`.
  - [x] 5.4 `app/controllers/admin/authors_controller.ts` :
    - `index` : `page` borné (`Math.max(1, Number(…) || 1)`, patron de `productions_controller`), `Author.query().preload('affiliations').orderBy('last_names').orderBy('first_names').orderBy('id').paginate(page, 20)` ; props `authors: [{ id, firstNames, lastNames, primaryAffiliation: { institution, department } | null, updatedAt }]`, `pagination` (même forme que productions). Le préchargement des affiliations suffit à 20 lignes (pas de N+1).
    - `create` : `inertia.render('admin/Authors/Create', {})` (2e argument obligatoire, gotcha Tuyau).
    - `store` : `request.validateUsing(authorValidator)` → `assertAffiliationRule(data, { isMigrated: false })` → `AuthorService.create` → log `CREATE` / `author` / `{ name }` → `session.flash('success', 'authors.flash.created')` → redirect `/admin/authors/:id/edit`.
    - `edit` : garde UUID (`UUID_RE` comme `activity_logs_controller`) sinon 404 ; `Author.query().where('id', …).preload('affiliations').firstOrFail()` ; props `author: { id, firstNames, lastNames, googleScholarUrl: '' si null, affiliations: [{ institution, department: '' si null }], isMigrated: migrationKey !== null }`.
    - `update` : même garde → validate → `assertAffiliationRule(data, { isMigrated: author.migrationKey !== null })` → `AuthorService.update` → log `UPDATE` / `author` / `{ name, fields }` (log même si `fields` est vide ? **non** : ne journaliser que si `fields.length > 0`, mais toujours flasher le succès) → flash `authors.flash.saved` → redirect `/admin/authors/:id/edit`.
    - Logs écrits **après** le commit (`ActivityLogService` hors transaction, ne lève jamais — P2.6).
  - [x] 5.5 `start/routes.ts`, dans le groupe `middleware.admin()` (pas `superAdmin`, P2-15), à côté des routes productions — `create` **avant** `:id/edit` : `GET authors/create` `.as('admin.authors.create')`, `GET authors/:id/edit` `.as('admin.authors.edit')`, `GET authors` `.as('admin.authors')`, `POST authors` `.as('admin.authors.store')`, `PUT authors/:id` `.as('admin.authors.update')`. Contrôleur référencé par `controllers.admin.Authors` (registre `#generated/controllers` régénéré par `node ace` — vérifier qu'il contient `Authors` après génération ; sinon lancer le générateur via `node ace serve`/`build` ou la commande d'index du projet).
- [x] **T6 — Front** (AC 3, 4, 5, 6)
  - [x] 6.1 `inertia/lib/author_form.ts` : types `AuthorFormData = { lastNames: string; firstNames: string; googleScholarUrl: string; affiliations: { institution: string; department: string }[] }`, `EMPTY_AUTHOR_FORM` (une affiliation vide), `formatAuthorName(first, last)` → `${first} ${last.toLocaleUpperCase('fr-FR')}` (D13/D34, réutilisé en 9.2+), `validateAuthorForm(data, { requireAffiliation })` → `Record<string, string>` de clés i18n **identiques** au serveur, indexées comme VineJS (`lastNames`, `affiliations`, `affiliations.0.institution`, `googleScholarUrl`), `toAuthorPayload(data)` (trim, retire `department`/`googleScholarUrl` vides). `inertia/lib/*.ts` n'est **pas importable** depuis un test serveur (frontière TS6305) : le test `tests/unit/lib/author_form.spec.ts` lit la **source** (patron `production_completion.spec.ts`).
  - [x] 6.2 `inertia/components/admin/AuthorForm.tsx` (contrôlé : `data`, `setData`, `errors`, `requireAffiliation`) : fieldsets avec le composant `Section` existant (copier le patron `fieldset rounded-lg border border-stone-200 p-6` / `legend`) : « Identité » → Nom(s)* puis Prénom(s)* (D34) ; « Affiliations » → sous-cartes bordées `rounded-md border border-stone-200 p-4` numérotées, Institution* + Département, boutons icône ghost `ChevronUp` / `ChevronDown` / `X` (32 px, `aria-label` « Monter l'affiliation {n} », « Descendre… », « Retirer… ») ; ↑ désactivé sur la 1re, ↓ sur la dernière, × désactivé si `requireAffiliation && length === 1` ; après déplacement, focus conservé sur le bouton de l'élément déplacé ; annonce polie (`aria-live="polite"` visuellement masqué) « Affiliation déplacée en position {n} » ; mention discrète « La première affiliation est l'institution principale. » ; bouton ghost `Plus` « Ajouter une affiliation » (désactivé à 20) ; erreur de liste `affiliations` sous le fieldset ; « Liens » → Google Scholar (`type="url"`, placeholder `https://scholar.google.com/…`). Erreurs : `t(errors[key], { defaultValue })` (serveur prioritaire, sinon client), `aria-invalid` + `aria-describedby` comme `ProductionForm`. **Pas** de photo ni de consentement (9.3, 9.4).
  - [x] 6.3 `inertia/pages/admin/Authors/Create.tsx` : `useForm<AuthorFormData>(EMPTY_AUTHOR_FORM)` ; submit → `validateAuthorForm` (si erreurs : `form.setError(...)`, stop) → `form.transform(toAuthorPayload)` puis `post(urlFor('admin.authors.store'))` ; boutons « Créer l'auteur » (vert, `Loader2` pendant `processing`) et « Annuler » (lien liste) ; titre « Créer un auteur ».
  - [x] 6.4 `Edit.tsx` : idem avec `put(urlFor('admin.authors.update', { id }))`, `requireAffiliation = !author.isMigrated`, titre « Modifier l'auteur », bouton « Enregistrer » ; fiche migrée sans affiliation → la liste peut être vide (aucune sous-carte affichée, simple bouton « Ajouter une affiliation »).
  - [x] 6.5 `Index.tsx` : en-tête h1 « Auteurs » + bouton « Créer un auteur » (`Plus`) aligné à droite (maquette `admin-authors-list.html`) ; tableau au style de `Productions/Index.tsx` (`thead bg-stone-50`, `th scope="col"`) : Auteur (lien vers l'édition, `formatAuthorName`), Affiliation principale (« Institution — Département » ou « Aucune affiliation » `text-stone-500`), Mise à jour (date locale), Actions (« Modifier », bouton outline sm) ; `Pagination` partagée ; état vide (`BookUser` size-12 stone-300, « Aucun auteur », « Créez la première fiche auteur pour l'associer à des productions. », bouton). Les colonnes Productions et Statut arrivent en 9.2 / 9.4 : ne pas les ajouter vides.
  - [x] 6.6 URLs : `urlFor` de `~/client` (registre Tuyau régénéré) pour **les nouvelles routes** ; si `urlFor` n'est pas typé pour une route après régénération, c'est que le registre n'est pas à jour — régénérer, ne pas contourner par une chaîne en dur.
  - [x] 6.7 `inertia/layouts/AdminLayout.tsx` : `NAV_ITEMS` → `{ labelKey: 'nav.authors', href: '/admin/authors', icon: BookUser }` juste après Productions ; l'état actif `url.startsWith(href)` couvre déjà les sous-pages. Mettre à jour `tests/unit/layouts/admin_layout.spec.ts` (lecture de source).
- [x] **T7 — i18n** (AC 9) : `inertia/locales/admin/{fr,en}.json` — `nav.authors` (« Auteurs » / « Authors ») ; `activity.resource.author` (« Auteur » / « Author ») ; `authors.*` : `heading`, `create_button` (« Créer un auteur »), `create_title`, `edit_title` (« Modifier l'auteur »), `table.{author,primary_affiliation,updated_at,actions}`, `no_affiliation` (« Aucune affiliation »), `actions.edit`, `empty_title`, `empty_description`, `form.sections.{identity,affiliations,links}`, `form.fields.{last_names,first_names,institution,department,google_scholar_url}`, `form.affiliation_n` (« Affiliation {{n}} »), `form.primary_hint`, `form.add_affiliation`, `form.move_up`, `form.move_down`, `form.remove` (avec `{{n}}`), `form.moved` (annonce), `form.submit_create` (« Créer l'auteur »), `form.scholar_placeholder`, `form.errors.*` (T5.1 + `affiliation_required` : « Ajoutez au moins une affiliation. »), `flash.created` (« Auteur créé. »), `flash.saved` (« Auteur enregistré. ») — libellés EXPERIENCE.md → Voice and Tone (vouvoiement, pas de point d'exclamation, boutons à l'infinitif).
- [x] **T8 — Tests** (AC 1–9) — `npm run test:local` (jamais sous Doppler)
  - [x] 8.1 Unit `tests/unit/helpers/normalize.spec.ts` (accents `Éloïse  N'DIAYE ` → `eloise n'diaye`, espaces multiples, chaîne vide) ; `tests/unit/helpers/slug.spec.ts` (translittération, troncature 80, `''` si rien) ; `production_service.spec.ts` existant **inchangé et vert**.
  - [x] 8.2 Unit `tests/unit/validators/author_validator.spec.ts` : cas valides, nom vide / 121 car., institution vide, URL `ftp://`, URL > 500, `''` pour URL et département, `assertAffiliationRule` (panel vs migrée). Patron : `production_validator.spec.ts`.
  - [x] 8.3 Unit `tests/unit/lib/author_form.spec.ts` (**lecture de source**, pas d'import — TS6305) : chaque clé `authors.form.errors.*` émise par le validateur serveur figure dans `author_form.ts` (parité des clés client/serveur, en lisant les deux sources) ; limites 120 / 255 / 500 présentes ; `formatAuthorName` utilise `toLocaleUpperCase` sur le nom seulement ; `toAuthorPayload` retire `department` / `googleScholarUrl` vides.
  - [x] 8.4 Functional `tests/functional/admin/authors_crud.spec.ts` (patron `productions_create.spec.ts` : `beginGlobalTransaction`, `loginAs`, `.withCsrfToken()`, `.redirects(0)`, envoi JSON `.json({...})` pour le tableau d'objets ; noms **fictifs**) : GET liste / create / edit 200 + composant ; non authentifié → 302 `/admin/login` (5 routes) ; rôle `admin` (pas seulement super admin) autorisé ; store → fiche + affiliations ordonnées + `search_name` + `institution_key` + `created_by_id` + log `create` avec `metadata.name` ; slug `prenom-nom`, collision → `-2`, renommage → slug inchangé ; erreurs (session `errors` avec les bonnes clés, rien créé) ; store sans affiliation → refus ; update → affiliations remplacées (ordre inversé persisté, aucune violation de `UNIQUE (author_id, position)`), log `update` avec `fields` ; update sans changement → aucun log ; fiche migrée (`migrationKey` posé par le test) sans affiliation → update accepté ; `:id` non UUID et UUID inconnu → 404 ; liste triée par nom, 20/page, page 2.
  - [x] 8.5 Functional `activity_logs.spec.ts` : une entrée `author` avec metadata → prop `resourceName`.
  - [x] 8.6 `tests/unit/i18n/translations.spec.ts` vert (parité) ; `npm run typecheck` et `npm run lint` verts ; suite complète `npm run test:local` verte (aucune régression).

### Review Findings

Revue adversariale du 2026-11-18 (Blind Hunter, Edge Case Hunter, Acceptance Auditor), constats vérifiés dans le code avant correction.

- [x] [Review][Patch] `updated_at` inchangé quand seules les affiliations changent (Lucid saute l'UPDATE sans colonne modifiée) [app/services/author_service.ts] — `updatedAt` posé explicitement ; test fonctionnel ajouté.
- [x] [Review][Patch] Deux enregistrements simultanés d'une fiche : le 2e `DELETE` ne voit pas les lignes insérées par le 1er → violation `UNIQUE (author_id, position)`, 500 [app/services/author_service.ts] — verrou `SELECT … FOR UPDATE` sur l'auteur dans la transaction.
- [x] [Review][Patch] Course sur le slug (vérification puis insertion) → violation `authors_slug_unique`, 500 [app/services/author_service.ts] — création relancée (3 essais) sur cette seule contrainte ; tests unitaires `tests/unit/services/author_service.spec.ts`.
- [x] [Review][Patch] Erreurs indexées (`affiliations.N.*`) affichées sous la mauvaise ligne après un déplacement ou un retrait [inertia/components/admin/AuthorForm.tsx] — masquées jusqu'au prochain envoi.
- [x] [Review][Patch] Focus perdu après le retrait d'une affiliation [inertia/components/admin/AuthorForm.tsx] — focus sur « Ajouter une affiliation ».
- [x] [Review][Patch] Annonce identique répétée non relue par les lecteurs d'écran [inertia/components/admin/AuthorForm.tsx] — espace insécable alterné.
- [x] [Review][Patch] Échec de validation non signalé au clavier ; erreur de liste `affiliations-error` reliée à aucun contrôle [inertia/components/admin/AuthorForm.tsx] — focus sur le premier champ invalide (erreurs client ou serveur), `aria-describedby` sur « Ajouter une affiliation ».
- [x] [Review][Patch] Page au-delà de la dernière → état « aucun auteur » trompeur [inertia/pages/admin/Authors/Index.tsx] — état vide seulement si `pagination.total === 0`.
- [x] [Review][Defer] Paramètre `page` non borné (`Infinity`, `1.5`) [app/controllers/admin/authors_controller.ts:19] — deferred, pre-existing (même patron dans 4 contrôleurs).
- [x] [Review][Defer] `<Link><Button/></Link>` (bouton dans un lien) [inertia/pages/admin/Authors/*.tsx] — deferred, pre-existing (patron de toutes les pages admin).
- [x] [Review][Defer] `normalizeKey` n'unifie pas apostrophes typographiques, traits d'union ni lettres sans décomposition (`ł`, `ø`) [app/helpers/normalize.ts] — deferred : conforme à l'architecture P2.1 ; à reconsidérer pour le dédoublonnage 9.5/9.6.

Écartés : URL Scholar non restreinte à `scholar.google.*` (AC4 exige seulement `http(s)`), écrasement silencieux en cas d'édition concurrente (dernier enregistrement gagnant, acceptable pour quelques admins), slugs `auteur` pour les noms non latins (repli prévu par AC2), débordement d'`institution_key` en hangul (irréaliste), écarts marginaux entre la validation d'URL client et serveur (le serveur tranche).

## Dev Notes

### Infra existante (NE PAS réinventer)

- **Groupe admin** `middleware.admin()` dans `start/routes.ts` (auth + actif + rôle + redirection changement de mot de passe) ; sous-groupe `superAdmin()` à **ne pas** utiliser ici.
- **Journal** : `ActivityLogService.log` (try/catch, ne lève jamais) ; enum `ActionType` (`create`, `update` suffisent en 9.1 ; `consent_*` arrivent en 9.4).
- **Flash → toast** : `session.flash('success', '<clé i18n>')`, affiché par `AdminLayout` (`notify.success(t(flash.success))`).
- **Erreurs VineJS → Inertia** : `request.validateUsing` lève, le middleware Inertia renvoie en arrière avec `errors` (clé = chemin VineJS, valeur = message = clé i18n) ; le front fait `t(errors[key], { defaultValue })`.
- **Pagination** : composant `~/components/shared/Pagination` (props `currentPage`, `lastPage`, `queryParams`), forme `pagination` des contrôleurs existants.
- **Composants UI** présents : `badge`, `button`, `dialog`, `input`, `select` (shadcn) ; icônes `lucide-react` (`BookUser`, `ChevronUp`, `ChevronDown`, `X`, `Plus`, `Loader2`).
- **pg_trgm** déjà activé (`1775918742000`).

### Fichiers modifiés — état actuel / changement / à préserver

| Fichier | Aujourd'hui | Changement 9.1 | À préserver |
|---|---|---|---|
| `app/services/production_service.ts` | `generateSlug` contient la translittération | délègue à `slugify` | sortie strictement identique (`'production'` en repli, 80 car.) |
| `app/services/activity_log_service.ts` | 4 champs | + `metadata?` | ne lève jamais |
| `app/models/admin_activity_log.ts` | pas de `metadata` | + colonne jsonb | lectures existantes |
| `app/controllers/admin/activity_logs_controller.ts` | sérialise 6 champs | + `resourceName` | filtres, pagination |
| `inertia/pages/admin/ActivityLogs/Index.tsx` | `resourceType #id` | cas `author` | rendu des autres types |
| `inertia/layouts/AdminLayout.tsx` | 4 entrées | + « Auteurs » après Productions | `superAdminOnly`, état actif, toasts |
| `start/routes.ts` | routes admin | + 5 routes auteurs | ordre `create` avant `:id` |
| `package.json` | pas de `#helpers` | + alias | autres alias |
| `database/schema.ts` | généré | régénéré (T1.5) | ne jamais éditer à la main |
| `inertia/locales/admin/{fr,en}.json` | — | + clés | parité |

### Gotchas (memory du topic + code)

- Tuyau : `inertia.render(page, {})` exige le 2e argument ; registre niché par dossier (`controllers.admin.Authors`).
- Japa : `.withCsrfToken()` sur POST/PUT, `.redirects(0)`, `loginAs()` ; `SESSION_DRIVER=memory` (déjà exporté par `test-local.sh`).
- Frontière TS6305 : tout ce qui est sous `inertia/` (composants **et** `inertia/lib/*.ts`) se teste par **lecture de source**, jamais par import (`production_completion.spec.ts`, `notify.spec.ts`).
- jsonb Lucid : `prepare: JSON.stringify` / `consume` tolérant (patron `production.ts`).
- Tables ordonnées : jamais `UPDATE position = position ± 1` (contrainte UNIQUE non différable) → `DELETE` + `INSERT` (P2.1).
- `useForm` Inertia envoie du JSON : tableau d'objets `affiliations` transmis tel quel ; clés d'erreur imbriquées `affiliations.0.institution`.
- Dépôt public : aucun nom réel d'auteur dans les tests ni les seeders ; utiliser des noms fictifs.
- shadcn : alias `~/*` ; pas de `baseUrl`.

### Stories suivantes (ne PAS implémenter ici)

9.2 liste (recherche `q`, filtre institution, filtres rapides, colonnes Productions/Statut, suppression FR55) · 9.3 photo · 9.4 consentement + badges · 9.5/9.6 conversion · 9.7 bascule production ↔ auteurs · 9.8 « Créer un auteur » en fenêtre (réutilise `AuthorForm` et `AuthorService.create`) · 9.9 tests consolidés.

### Project Structure Notes

- Nommage `snake_case` des fichiers serveur, pages admin `inertia/pages/admin/Authors/{Index,Create,Edit}.tsx`, composant `inertia/components/admin/AuthorForm.tsx` (P2.6 « Pages et composants »).
- Nouveau dossier `app/helpers/` (alias `#helpers/*`), nouveau dossier `tests/unit/helpers/`.
- Écarts documentés : pas de Zod (fonction pure côté client) ; règle d'affiliation hors schéma VineJS (`assertAffiliationRule`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.1] (+ en-tête Epic 9 « Règles communes »)
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.1 Modèle de données] (tables, tables ordonnées, normalisation, slug, migrations)
- [Source: architecture.md#P2.6] (routes admin, validateurs, pages, journal d'activité) ; P2-01, P2-03, P2-04, P2-15
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] AuthorForm, Fiche auteur, Admin sidebar, Voice and Tone (« Auteur créé. », « Auteur enregistré. »), réordonnancement ↑ ↓
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] AuthorForm, Admin sidebar (`BookUser`) ; maquette `mockups/admin-authors-list.html`
- [Source: ux-designs/ux-anta-2026-11-16/.decision-log.md] D13, D28, D34
- [Source: prd.md] FR52
- Code : `app/controllers/admin/productions_controller.ts`, `app/validators/admin/production_validator.ts`, `inertia/components/admin/ProductionForm.tsx`, `inertia/pages/admin/Users/Create.tsx`, `tests/functional/admin/productions_create.spec.ts`

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Index des contrôleurs, `pages.d.ts` et registre Tuyau (`.adonisjs/`, committés) régénérés par les hooks `init` d'`adonisrc.ts` : `node ace serve` lancé ~45 s avec les valeurs de `scripts/test-local.sh` (Postgres local, jamais Doppler).
- `database/schema.ts` régénéré par le `migration:run --force` de `npm run test:local` (base locale `anta_test`) ; diff limité à `AuthorSchema`, `AuthorAffiliationSchema`, `metadata`.
- VineJS : la règle `maxLength` d'un tableau s'appelle `array.maxLength` (clé de message `affiliations.array.maxLength`).
- `japa --files` bloque le runner dans ce projet : suites lancées entières (`unit`, `functional`).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Migrations additives `authors`, `author_affiliations` (UNIQUE (author_id, position), CHECK position ≥ 1, index trigram et institution_key) et `admin_activity_logs.metadata` ; exécutées seulement sur le Postgres local de test. Aucune exécution sur Supabase.
- Helpers `#helpers/normalize` et `#helpers/slug` ; `ProductionService.generateSlug` délègue à `slugify` (tests existants inchangés et verts).
- Modèles `Author` (search_name à chaque save, slug unique à la création puis figé, transaction respectée) et `AuthorAffiliation` (institution_key) ; `AdminActivityLog.metadata` (jsonb).
- `AuthorService.create/update` en transaction, affiliations remplacées par DELETE + INSERT ; `update` retourne les champs réellement modifiés (pas d'écriture ni de journal si rien ne change).
- Validateur VineJS + `assertAffiliationRule` (≥ 1 affiliation sauf fiche migrée) ; les chaînes vides arrivent en `null` (`convertEmptyStringsToNull`).
- Contrôleur `AuthorsController` (index paginé 20, create, store, edit, update ; 404 sur id non UUID ou inconnu) et 5 routes nommées dans le groupe `middleware.admin()`.
- Front : `inertia/lib/author_form.ts` (types, `formatAuthorName`, validation client, payload), `AuthorForm` (↑ ↓ × nommés, focus conservé, annonce `aria-live`), pages `Authors/{Index,Create,Edit}` avec `urlFor`, entrée « Auteurs » (`BookUser`) après Productions, Journal « Auteur — {nom} ».
- Écarts documentés : pas de Zod (fonction pure, convention du code) ; règle d'affiliation hors schéma VineJS.
- Tests : 497 verts (`npm run test:local`), dont unit helpers, modèle Author, validateur, parité client/serveur et composants par lecture de source, functional `authors_crud.spec.ts` (14 cas) et journal ; `npm run lint`, `npm run typecheck` et `node ace build` verts.

### File List

- `tests/unit/services/author_service.spec.ts` (revue)

- `.adonisjs/client/registry/index.ts`, `.adonisjs/client/registry/schema.d.ts`, `.adonisjs/client/registry/tree.d.ts`, `.adonisjs/server/controllers.ts`, `.adonisjs/server/pages.d.ts`, `.adonisjs/server/routes.d.ts` (générés)
- `app/controllers/admin/activity_logs_controller.ts` (modifié)
- `app/controllers/admin/authors_controller.ts` (nouveau)
- `app/helpers/normalize.ts`, `app/helpers/slug.ts` (nouveaux)
- `app/models/admin_activity_log.ts` (modifié)
- `app/models/author.ts`, `app/models/author_affiliation.ts` (nouveaux)
- `app/services/activity_log_service.ts`, `app/services/production_service.ts` (modifiés)
- `app/services/author_service.ts` (nouveau)
- `app/validators/admin/author_validator.ts` (nouveau)
- `database/migrations/1775918745000_create_authors_table.ts`, `1775918746000_create_author_affiliations_table.ts`, `1775918750000_add_metadata_to_admin_activity_logs.ts` (nouveaux)
- `database/schema.ts` (généré)
- `inertia/components/admin/AuthorForm.tsx` (nouveau)
- `inertia/layouts/AdminLayout.tsx` (modifié)
- `inertia/lib/author_form.ts` (nouveau)
- `inertia/locales/admin/fr.json`, `inertia/locales/admin/en.json` (modifiés)
- `inertia/pages/admin/ActivityLogs/Index.tsx` (modifié)
- `inertia/pages/admin/Authors/Index.tsx`, `Create.tsx`, `Edit.tsx` (nouveaux)
- `package.json` (alias `#helpers/*`)
- `start/routes.ts` (modifié)
- `tests/functional/admin/authors_crud.spec.ts` (nouveau), `tests/functional/admin/activity_logs.spec.ts` (modifié)
- `tests/unit/helpers/normalize.spec.ts`, `tests/unit/helpers/slug.spec.ts`, `tests/unit/models/author.spec.ts`, `tests/unit/validators/author_validator.spec.ts`, `tests/unit/lib/author_form.spec.ts`, `tests/unit/components/author_form.spec.ts` (nouveaux)
- `tests/unit/services/activity_log_service.spec.ts`, `tests/unit/layouts/admin_layout.spec.ts`, `tests/unit/components/activity_logs_page.spec.ts` (modifiés)

### Change Log

- 2026-11-18 : implémentation de la story 9.1 (référentiel d'auteurs : tables, modèles, service, CRUD admin création / modification, journal avec metadata).
- 2026-11-18 : code review — 8 correctifs (verrou de ligne, `updated_at`, relance sur collision de slug, accessibilité du formulaire, état vide de la liste), 3 reports ; 502 tests verts.
