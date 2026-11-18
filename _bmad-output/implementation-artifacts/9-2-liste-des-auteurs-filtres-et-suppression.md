---
baseline_commit: 7e2442487d517eef7bc41446157d13759a2c98ed
---

# Story 9.2 : Liste des auteurs, filtres et suppression

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur** (rôle `admin` ou `super_admin`),
je veux **retrouver une fiche par nom ou institution, repérer les fiches non publiques ou à compléter, et supprimer une fiche créée par erreur**,
afin de **tenir le référentiel propre** (FR52, FR55, D19, D32).

## Décision de périmètre (lire en premier)

- **DANS 9.2** :
  - migration du pivot `production_authors` (`1775918747000`) et régénération de `database/schema.ts` ;
  - modèle `Production` : propriété jsonb renommée `authorNames` (`columnName: 'authors'`) + relation `manyToMany` `authors` ; modèle `Author` : relation inverse `productions` (pour le compteur) ; adaptation de **toutes** les lectures et écritures existantes de la propriété, sans changement visible ;
  - liste `/admin/authors` : colonnes Productions et Statut, badges, recherche `q`, filtre `institution`, filtres rapides `consent=pending` / `incomplete=1` avec compteurs, filtres dans l'URL et conservés par la pagination, message « aucun résultat » ;
  - suppression : `DELETE /admin/authors/:id` (`admin.authors.destroy`), `AuthorService.delete`, dialog de confirmation dans la liste **et** dans la fiche, refus si ≥ 1 ligne pivot (bouton `aria-disabled` + infobulle dans la liste, texte visible dans la fiche), journal `delete` / `author` ;
  - composant shadcn `tooltip` (CLI), composant `AuthorStatusBadges` ; i18n ; tests.
- **HORS 9.2 (ne PAS implémenter)** :
  - photo, avatar/initiales dans la liste, suppression du préfixe R2 à la suppression d'une fiche → **9.3** (9.3 complétera `AuthorService.delete`) ;
  - actions « Confirmer / Retirer le consentement », case de consentement, badge dans la fiche → **9.4** (la colonne Actions ne contient en 9.2 que « Modifier » et « Supprimer ») ;
  - `ProductionAuthorService` (`sync`, `refreshDenormalizedNames`), conversion `authors:*` → **9.5 / 9.6** ;
  - formulaire de production branché sur le pivot, `GET /admin/authors/search`, retrait des écritures `authors: data.authors` du contrôleur de productions, `getMissingForPublish` sur le pivot, seeder → **9.7** ; `quick-store` → **9.8**.
  - En 9.2, **aucun code n'écrit dans le pivot** hors tests : la colonne `productions.authors` reste écrite par le formulaire actuel (texte libre), simplement via la propriété renommée. Le compteur « Productions » vaudra donc 0 partout tant que la conversion (9.6) n'a pas tourné : c'est attendu.
- **Base partagée** : la migration n'est exécutée **que sur le Postgres local de test** (`npm run test:local`). **Jamais** de `migration:run` sous `doppler run` dans cette story, jamais de `rollback` / `fresh` / `reset` / `db:wipe`. Le staging exécutera `migration:run --force` au démarrage de l'image quand la branche y sera déployée : la migration doit donc être strictement additive.

## Acceptance Criteria

1. **Pivot** — **Given** `database/migrations/1775918747000_create_production_authors_table.ts`, **When** `node ace migration:run` s'exécute (Postgres local uniquement), **Then** la table `production_authors` existe : `production_id uuid NOT NULL → productions.id ON DELETE CASCADE`, `author_id uuid NOT NULL → authors.id ON DELETE RESTRICT`, `position smallint NOT NULL CHECK (position >= 1)`, `PRIMARY KEY (production_id, author_id)`, `UNIQUE (production_id, position)`, index `idx_production_authors_author_id` **and** la migration est purement additive (aucune donnée transformée), son `down()` est écrit mais jamais exécuté sur la base partagée.
2. **Modèle et renommage** — **Given** le modèle `Production`, **Then** la colonne jsonb est exposée par `authorNames` (`@column({ columnName: 'authors', prepare, consume })`, mêmes `prepare`/`consume` qu'aujourd'hui) et la relation `authors` est un `manyToMany(() => Author)` sur `production_authors` (`pivotColumns: ['position']`, triée par `production_authors.position`) **and** `Author` expose `productions` (`manyToMany` inverse) **and** toutes les lectures/écritures existantes sont adaptées (tableau « Renommage » des Dev Notes) **sans changement visible** : les props Inertia gardent la clé `authors`, le champ de requête du formulaire de production reste `authors`, la recherche full-text et les facettes publiques sont inchangées, la suite existante reste verte.
3. **Colonnes et badges** — **Given** un administrateur sur `/admin/authors`, **When** la liste s'affiche, **Then** le tableau présente Auteur, Affiliation principale, Productions (nombre de lignes pivot, tous statuts de production, aligné à droite, `tabular-nums`), Statut, Mise à jour, Actions (D32, maquette `admin-authors-list.html`) **and** le statut est rendu par des badges informatifs non cliquables : « Public » si `consent_confirmed_at` non NULL, sinon « Non public » ; en plus « À compléter » si la fiche n'a aucune affiliation (dérivé, jamais stocké, P2-03).
4. **Recherche et filtres** — **Given** des fiches variées, **When** l'administrateur saisit une recherche (`q`, validée par Entrée), choisit une institution (`institution`) ou active un filtre rapide « Consentement en attente » (`consent=pending` = fiches « Non public ») ou « À compléter » (`incomplete=1`), **Then** la liste est filtrée **côté serveur** : `q` normalisé par `normalizeKey` puis `search_name LIKE %q%` OU `similarity(search_name, q) > 0.3` (insensible à la casse et aux accents), institution par `institution_key` sur **n'importe quelle** affiliation de la fiche ; les filtres se cumulent (ET) **and** ils sont dans l'URL, tout changement de filtre ramène à la page 1, la pagination les conserve **and** chaque filtre rapide est un bouton bascule (`aria-pressed`) affichant son compteur **and** un filtrage sans résultat affiche « Aucun auteur ne correspond à ces filtres. » avec « Effacer les filtres » (l'état vide « Aucun auteur » de 9.1 reste réservé au référentiel vide sans filtre).
5. **Suppression autorisée** — **Given** une fiche associée à 0 production, **When** l'administrateur clique « Supprimer » (liste ou fiche) puis confirme dans le dialog, **Then** la fiche et ses affiliations (CASCADE) sont supprimées, redirection vers `/admin/authors` avec le toast « Auteur supprimé. » **and** le journal reçoit `delete` / `author` / id avec `metadata: { name }` (écrit après la suppression effective).
6. **Suppression refusée (FR55)** — **Given** une fiche associée à au moins une production (brouillon compris), **Then** dans la liste le bouton « Supprimer » est `aria-disabled="true"` (pas `disabled` : il reste focusable), n'ouvre pas le dialog, et une infobulle « Suppression impossible : fiche liée à {n} production(s) (brouillons compris). » s'affiche au survol **et** au focus, reliée au bouton par `aria-describedby` ; dans la fiche (`/admin/authors/:id/edit`), le même texte est visible sous le bouton, relié par `aria-describedby` **and** un appel direct à `DELETE /admin/authors/:id` est refusé : rien n'est supprimé, aucune entrée de journal, redirection vers `/admin/authors` avec un flash d'erreur ; la FK `RESTRICT` sert de garde-fou (une violation `23503` est traduite en ce même refus, jamais en 500).
7. **Accès** — **Given** un visiteur non authentifié, **When** il appelle `DELETE /admin/authors/:id` (ou toute route `/admin/authors*`), **Then** 302 vers `/admin/login` ; un `:id` non UUID ou inconnu → 404 ; rôles `admin` et `super_admin` autorisés (P2-15).
8. **i18n** — toutes les nouvelles chaînes dans `inertia/locales/admin/{fr,en}.json` (`authors.list.*`, `authors.badges.*`, `authors.delete.*`, + compléments de `authors.table.*`, `authors.actions.*`, `authors.flash.*`), parité vérifiée par `tests/unit/i18n/translations.spec.ts`.

## Tasks / Subtasks

- [x] **T1 — Migration du pivot et schéma** (AC 1)
  - [x] 1.1 Créer `database/migrations/1775918747000_create_production_authors_table.ts` (timestamp **imposé**, comble le trou laissé par 9.1). En-tête : « Ordered pivot production ↔ author (Phase 2, P2.1 - Story 9.2). Reordering is always DELETE + INSERT in a transaction. Additive only - shared dev/staging database: down() is written but never executed. » Contenu :
    ```ts
    this.schema.createTable('production_authors', (table) => {
      table.uuid('production_id').notNullable()
        .references('id').inTable('productions').onDelete('CASCADE')
      table.uuid('author_id').notNullable()
        .references('id').inTable('authors').onDelete('RESTRICT')
      table.smallint('position').notNullable()
      table.primary(['production_id', 'author_id'])
      table.unique(['production_id', 'position'])
      table.check('?? >= 1', ['position'], 'production_authors_position_check')
      table.index(['author_id'], 'idx_production_authors_author_id')
    })
    ```
    Pas de colonne `id` ni de timestamps (P2.1). `down()` : `dropTable`. Ne **pas** créer les migrations 4, 5, 7 de P2.1.
  - [x] 1.2 Régénérer `database/schema.ts` (généré, **committé**) via le `migration:run --force` de `npm run test:local` (base locale `anta_test`, port 5433) — **jamais sous Doppler**. Vérifier que le diff ne contient que l'ajout `ProductionAuthorSchema` (clé primaire composite : si le générateur produit quelque chose d'inattendu, ne pas éditer à la main, le signaler dans le Debug Log).
- [x] **T2 — Modèles et renommage `authorNames`** (AC 2)
  - [x] 2.1 `app/models/production.ts` : remplacer `declare authors: string[]` par
    ```ts
    /** Denormalized "First Last" names, ordered like the pivot (P2-02). Read-only outside ProductionAuthorService (Story 9.6+). */
    @column({ columnName: 'authors', prepare: …, consume: … })   // prepare/consume inchangés
    declare authorNames: string[]

    @manyToMany(() => Author, {
      pivotTable: 'production_authors',
      pivotColumns: ['position'],
      onQuery: (query) => query.orderBy('production_authors.position', 'asc'),
    })
    declare authors: ManyToMany<typeof Author>
    ```
    Clés pivot par défaut correctes (`production_id`, `author_id`) ; `pivotTimestamps` laissé à `false` (pas de colonnes). Import `manyToMany` / `ManyToMany` depuis `@adonisjs/lucid/orm` / `@adonisjs/lucid/types/relations`.
  - [x] 2.2 `app/models/author.ts` : `@manyToMany(() => Production, { pivotTable: 'production_authors' }) declare productions: ManyToMany<typeof Production>` (sert à `withCount('productions')`). L'import circulaire `author.ts` ↔ `production.ts` est sans risque (relations paresseuses `() => Model`, même situation que `production.ts` ↔ `production_service.ts`) ; vérifier au démarrage des tests.
  - [x] 2.3 Adapter chaque fichier du tableau « Renommage » (Dev Notes) : remplacer **les accès à la propriété du modèle** `production.authors` → `production.authorNames`, sans toucher aux noms SQL (`'authors'` dans du SQL brut = colonne, inchangé), aux clés de props Inertia (`authors:`), au champ de requête `data.authors`, ni à `ProductionSuggestions.authors`.
  - [x] 2.4 `npm run typecheck` : toute lecture oubliée de `production.authors` comme `string[]` échoue (type `ManyToMany`), c'est le filet de sécurité ; le corriger en `authorNames`. Attention aux affectations `Object.assign` / `Partial<Production>` dans les tests (voir Dev Notes, piège n° 2).
- [x] **T3 — Service** (AC 3, 4, 5, 6)
  - [x] 3.1 `app/services/author_service.ts` — ajouter (toujours en `static`, patron du fichier) :
    - `static productionsCount(authorId: string, client?): Promise<number>` → `db.from('production_authors').where('author_id', authorId).count('* as total')` (`Number(...)`).
    - `static async delete(author: Author): Promise<{ deleted: true } | { deleted: false; productionsCount: number }>` : dans `db.transaction` : `Author.query({ client: trx }).where('id', author.id).forUpdate().firstOrFail()` (verrou de ligne : un `INSERT` concurrent dans le pivot prend un `FOR KEY SHARE` sur l'auteur et attend), puis `productionsCount` dans la transaction ; si > 0 → `{ deleted: false, productionsCount }` ; sinon `author.useTransaction(trx); await author.delete()` (affiliations supprimées par CASCADE). Envelopper : une erreur `code === '23503'` (FK RESTRICT, garde-fou) → `{ deleted: false, productionsCount: await this.productionsCount(author.id) }` ; toute autre erreur est relancée. **Ne pas** supprimer de photo (9.3 complétera ici).
    - `static applyListFilters(query, filters)` (ou une méthode `list(filters, page)` — au choix, mais **réutilisable** par 9.7 pour `search`) qui applique `q`, `institution`, `consent`, `incomplete` sur une requête `Author.query()` (détail SQL en Dev Notes « Requêtes »).
    - `static async quickFilterCounts(): Promise<{ consentPending: number; incomplete: number }>` : une seule requête `SELECT count(*) FILTER (WHERE consent_confirmed_at IS NULL) AS consent_pending, count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM author_affiliations aa WHERE aa.author_id = authors.id)) AS incomplete FROM authors`. Compteurs **globaux** (indépendants des autres filtres : ils signalent le travail restant, parcours 5) — voir Questions.
    - `static async institutionOptions(): Promise<{ value: string; label: string }[]>` : `SELECT institution_key AS value, mode() WITHIN GROUP (ORDER BY institution) AS label FROM author_affiliations GROUP BY institution_key ORDER BY label` (même règle que la facette publique D14, graphie la plus fréquente).
- [x] **T4 — Contrôleur et route** (AC 3–7)
  - [x] 4.1 `app/controllers/admin/authors_controller.ts` `index` :
    - Lire et assainir les paramètres : `q` = `strInput` (trim, non vide) tronqué à 100 caractères ; `institution` = `strInput` → `normalizeKey` (idempotent : accepte la clé ou un libellé) ; `consent` = `'pending'` sinon `null` ; `incomplete` = `request.input('incomplete') === '1'` ; `page` borné comme aujourd'hui.
    - Requête : `Author.query().preload('affiliations').withCount('productions')` + filtres (T3) + tri : avec `q` → rang préfixe puis similarité puis `last_names`, `first_names`, `id` ; sans `q` → tri actuel (`last_names`, `first_names`, `id`) **inchangé** (test 9.1 existant). `paginate(page, 20)`.
    - Props (ajouts, forme 9.1 conservée) : par ligne `productionsCount: Number(author.$extras.productions_count)`, `isPublic: author.consentConfirmedAt !== null`, `isIncomplete: author.affiliations.length === 0` ; au niveau page `filters: { q, institution, consent, incomplete }` (valeurs normalisées renvoyées pour pré-remplir l'UI ; `institution` = clé), `counts: { consentPending, incomplete }`, `institutionOptions`.
  - [x] 4.2 `edit` : ajouter la prop `author.productionsCount` (`AuthorService.productionsCount`).
  - [x] 4.3 `destroy({ params, auth, response, session })` : `findOrFail` (garde UUID existante → 404) ; `const name = AuthorService.displayName(author)` **avant** ; `AuthorService.delete(author)` ; si refusé → `session.flash('error', 'authors.delete.refused')`, `response.redirect('/admin/authors')`, **aucun** log ; si supprimé → `ActivityLogService.log({ actionType: ActionType.DELETE, resourceType: 'author', resourceId: author.id, metadata: { name } })` (après le commit, ne lève jamais), `session.flash('success', 'authors.flash.deleted')`, `response.redirect('/admin/authors')`. Redirection fixe vers la liste (pas `back()` : depuis la fiche, « back » mènerait à une page 404).
  - [x] 4.4 Mettre à jour le docblock de la classe (« Search, filters and deletion come with Story 9.2 » n'est plus vrai).
  - [x] 4.5 `start/routes.ts`, dans le groupe `middleware.admin()`, à la suite des routes auteurs : `router.delete('authors/:id', [controllers.admin.Authors, 'destroy']).as('admin.authors.destroy')`.
  - [x] 4.6 Régénérer le registre Tuyau et les fichiers `.adonisjs/*` (générés, **committés**) : comme en 9.1, lancer `node ace serve` ~45 s avec les variables de `scripts/test-local.sh` (Postgres local, jamais Doppler) puis l'arrêter ; vérifier que `urlFor('admin.authors.destroy', { id })` est typé.
- [x] **T5 — Composants UI** (AC 3, 6)
  - [x] 5.1 Ajouter `inertia/components/ui/tooltip.tsx` par la CLI : `npx shadcn@latest add tooltip` (style `new-york`, `components.json` existant, alias `~/*`, méta-paquet `radix-ui` déjà installé — `@radix-ui/react-tooltip` est déjà présent dans `node_modules` via `radix-ui`). Vérifier le diff : seul `tooltip.tsx` doit apparaître (si la CLI touche `package.json`, `app.css` ou `components.json`, annuler ces changements). Si la CLI est indisponible (réseau), recopier la source shadcn v4 new-york du composant en important `import { Tooltip as TooltipPrimitive } from "radix-ui"` (comme `dialog.tsx`). Ne **pas** ajouter `baseUrl` à un tsconfig.
  - [x] 5.2 `inertia/components/admin/AuthorStatusBadges.tsx` (réutilisé par 9.4 dans la fiche et 9.7 dans le combobox) : props `{ isPublic: boolean; isIncomplete: boolean }` ; rend « Public » (`Badge variant="outline"` `border-green-600 text-green-700`, token `badge-public`) ou « Non public » (`variant="secondary"` `bg-stone-100 text-stone-700`, `badge-not-public`), puis « À compléter » si `isIncomplete` (`border-amber-300 bg-amber-50 text-amber-800`, `badge-incomplete`) ; conteneur `flex flex-wrap gap-1`. Badges non interactifs (`span`, pas de rôle bouton). Patron : `StatusBadge.tsx`.
- [x] **T6 — Page liste** `inertia/pages/admin/Authors/Index.tsx` (AC 3, 4, 6)
  - [x] 6.1 Barre de filtres (patron `Productions/Index.tsx`, maquette `admin-authors-list.html`) : `form role="search"` avec `Input` (icône `Search`, `aria-label` et placeholder « Rechercher un auteur »), validé par Entrée ; `Select` Institution (`aria-label` « Institution », 1re option « Toutes les institutions » = sentinelle `ALL_VALUE = 'all'`, options `institutionOptions` — valeur = clé, libellé = graphie) ; groupe `role="group"` `aria-label="Filtres rapides"` de deux boutons bascule `aria-pressed` « Consentement en attente {n} » et « À compléter {n} » (`rounded-full`, inactif : outline `border-stone-300 bg-white text-stone-700` ; actif : token `filter-chip-active` = `bg-green-700 text-white` ; compteur `rounded-full px-1.5 text-xs tabular-nums`, `bg-stone-100` / `bg-amber-100 text-amber-800` à l'état inactif) ; bouton ghost « Effacer les filtres » si un filtre est actif.
  - [x] 6.2 Navigation : `applyFilters(overrides)` fusionne les filtres actifs, retire les valeurs vides, **n'inclut pas `page`** (retour page 1), `router.get(urlFor('admin.authors'), params, { preserveState: true, preserveScroll: true })` — `urlFor`, jamais d'URL en dur. `activeQuery` (`q`, `institution`, `consent`, `incomplete: '1' | undefined`) est passé à `Pagination` via `queryParams` (conservation des filtres).
  - [x] 6.3 Tableau : colonnes Auteur, Affiliation principale, **Productions** (`text-right tabular-nums`, `th` aligné à droite), **Statut** (`AuthorStatusBadges`), Mise à jour, Actions. Actions : « Modifier » (existant) + « Supprimer » (bouton `variant="ghost" size="sm"` `text-red-600 hover:bg-red-50`, patron Productions).
    - `productionsCount === 0` → `onClick` ouvre le dialog (cible = la ligne).
    - `productionsCount > 0` → **même bouton** avec `aria-disabled="true"`, `aria-describedby={\`author-delete-hint-${id}\`}`, classes `opacity-50 cursor-not-allowed`, `onClick` qui ne fait rien (`e.preventDefault()`), **pas** d'attribut `disabled` ; enveloppé dans `Tooltip` / `TooltipTrigger asChild` / `TooltipContent` (texte `authors.delete.blocked` avec `count`). Ajouter en plus un `<span id="author-delete-hint-{id}" className="sr-only">` portant le même texte : la description reste disponible pour les lecteurs d'écran même tooltip fermée (Radix ne pose son propre `aria-describedby` que pendant l'ouverture, et la prop explicite du bouton prime sur la sienne).
  - [x] 6.4 Dialog de suppression (patron `Productions/Index.tsx` : `Dialog` + `DialogContent role="alertdialog"`) : titre « Supprimer cette fiche auteur ? », description « La fiche de {nom} et ses affiliations seront définitivement supprimées. » (nom au format `formatAuthorName`), « Annuler » (`DialogClose`) + « Supprimer » (`variant="destructive"`, désactivé pendant la requête) → `router.delete(urlFor('admin.authors.destroy', { id }), { preserveScroll: true, onStart, onFinish })`.
  - [x] 6.5 États vides : `pagination.total === 0` **et** aucun filtre actif → état vide 9.1 inchangé ; `pagination.total === 0` **avec** filtre actif → barre de filtres conservée + message « Aucun auteur ne correspond à ces filtres. » + bouton « Effacer les filtres » ; le bouton « Créer un auteur » de l'en-tête reste visible dès qu'un filtre est actif.
- [x] **T7 — Fiche** `inertia/pages/admin/Authors/Edit.tsx` (AC 5, 6)
  - [x] 7.1 Prop `author.productionsCount` (l'exclure de `formData` comme `id` / `isMigrated`).
  - [x] 7.2 À droite de la rangée Enregistrer / Annuler (`ml-auto`), bouton « Supprimer » (même style rouge). `productionsCount === 0` → ouvre le même dialog (T6.4, factoriser si utile dans `inertia/components/admin/DeleteAuthorDialog.tsx`) ; `> 0` → `aria-disabled="true"`, `aria-describedby="author-delete-hint"`, sans action, et **texte visible** sous le bouton `<p id="author-delete-hint" className="mt-2 text-sm text-stone-600">` « Suppression impossible : fiche liée à {n} production(s) (brouillons compris). » (pas de tooltip ici, D32).
- [x] **T8 — i18n** (AC 8) — `inertia/locales/admin/{fr,en}.json`, sous `authors` (libellés EXPERIENCE.md, vouvoiement, pas de point d'exclamation, boutons à l'infinitif) :
  - `table.productions` « Productions » / « Productions » ; `table.status` « Statut » / « Status » ;
  - `actions.delete` « Supprimer » / « Delete » ;
  - `list.search_label` « Rechercher un auteur » / « Search for an author » ; `list.institution_label` « Institution » / « Institution » ; `list.institution_all` « Toutes les institutions » / « All institutions » ; `list.quick_filters` « Filtres rapides » / « Quick filters » ; `list.consent_pending` « Consentement en attente » / « Consent pending » ; `list.incomplete` « À compléter » / « Incomplete » ; `list.clear_filters` « Effacer les filtres » / « Clear filters » ; `list.no_results` « Aucun auteur ne correspond à ces filtres. » / « No author matches these filters. » ;
  - `badges.public` « Public » / « Public » ; `badges.not_public` « Non public » / « Not public » ; `badges.incomplete` « À compléter » / « Incomplete » ;
  - `delete.title` « Supprimer cette fiche auteur ? » / « Delete this author record? » ; `delete.description` « La fiche de {{name}} et ses affiliations seront définitivement supprimées. » / « The record of {{name}} and its affiliations will be permanently deleted. » ; `delete.confirm` « Supprimer » / « Delete » ; `delete.blocked` « Suppression impossible : fiche liée à {{count}} production(s) (brouillons compris). » / « Cannot delete: this record is linked to {{count}} production(s), drafts included. » ; `delete.refused` (flash, sans interpolation : `AdminLayout` appelle `t(flash.error)` sans paramètre) « Suppression impossible : cette fiche est liée à au moins une production (brouillons compris). » / « Cannot delete: this record is linked to at least one production, drafts included. » ;
  - `flash.deleted` « Auteur supprimé. » / « Author deleted. ».
  - Convention du projet pour les pluriels : forme « (s) » dans une seule clé (`results_count`), pas de suffixes `_one`/`_other`.
- [x] **T9 — Tests** — `npm run test:local` uniquement (jamais sous Doppler) ; noms **fictifs** uniquement
  - [x] 9.1 Non-régression du renommage : adapter les specs listées dans « Renommage » (lectures `production.authors` → `authorNames`, fixtures modèle `authors:` → `authorNames:`), sans toucher aux payloads HTTP `.json({ authors })` ni aux assertions sur les props Inertia `row.authors`. La suite existante doit passer **sans autre modification**.
  - [x] 9.2 Unit `tests/unit/models/production.spec.ts` (ou nouveau `production_authors.spec.ts` dans `tests/unit/models/`) : `production.related('authors').attach({ [a2.id]: { position: 1 }, [a1.id]: { position: 2 } })` puis `load('authors')` → ordre par position, `$extras.pivot_position` ; `authorNames` lit/écrit toujours la colonne `authors` (vérifier par `db.from('productions').select('authors')`) ; suppression de la production → lignes pivot supprimées (CASCADE) ; `author.delete()` avec une ligne pivot → erreur `23503` (RESTRICT) ; doublon de position → violation `UNIQUE (production_id, position)`.
  - [x] 9.3 Unit `tests/unit/services/author_service.spec.ts` (existant, compléter) : `delete` sans lien → supprimé + affiliations supprimées ; avec un lien → `{ deleted: false, productionsCount: 1 }` et fiche intacte ; `quickFilterCounts` ; `institutionOptions` (deux graphies d'une même clé → une option, libellé le plus fréquent).
  - [x] 9.4 Functional `tests/functional/admin/authors_list.spec.ts` (patron `authors_crud.spec.ts` : `beginGlobalTransaction`, `loginAs`, `.withCsrfToken()`, `.redirects(0)`, `extractProps`, `flashedErrors`) — pivot alimenté dans les fixtures par `attach` ou `db.table('production_authors').insert(...)` :
    - colonnes : `productionsCount` (fiche liée à 2 productions dont 1 brouillon → 2), `isPublic`, `isIncomplete` ;
    - `q` : « eloise » trouve « Éloïse », casse ignorée, recherche sur le nom de famille, aucun résultat → `authors: []`, `pagination.total === 0` ; caractères `%` / `_` sans effet joker ;
    - `institution` : clé d'une graphie accentuée trouve la fiche dont la 2e affiliation correspond ; `institutionOptions` dédoublonnées ;
    - `consent=pending`, `incomplete=1`, cumul des deux, valeurs invalides (`consent=foo`) ignorées ; `counts` exacts ; `filters` renvoyés ;
    - pagination : 21+ fiches non publiques, `?consent=pending&page=2` → page 2 filtrée ;
    - suppression OK : 302 `/admin/authors`, fiche et affiliations supprimées, flash `authors.flash.deleted`, journal `delete` / `author` avec `metadata.name` ;
    - suppression refusée avec **1 brouillon** lié : 302, flash `error` = `authors.delete.refused`, fiche intacte, **aucune** entrée de journal ;
    - `DELETE` non authentifié → 302 `/admin/login` ; `:id` non UUID / inconnu → 404 ; rôle `admin` autorisé ;
    - `GET edit` → `author.productionsCount`.
  - [x] 9.5 Unit composants par **lecture de source** (jamais d'import, TS6305) : `tests/unit/components/authors_index_page.spec.ts` — `aria-pressed`, `role="group"`, `aria-disabled`, `aria-describedby={\`author-delete-hint-`, absence de `disabled={` sur le bouton refusé, `TooltipContent`, `role="alertdialog"`, `urlFor('admin.authors.destroy'`, `queryParams={activeQuery}`, aucune URL `/admin/authors` en dur ; `Edit.tsx` — `id="author-delete-hint"` + `aria-describedby="author-delete-hint"` ; `AuthorStatusBadges.tsx` — trois clés `authors.badges.*` ; toutes les clés `t('authors.…')` utilisées existent en FR et EN.
  - [x] 9.6 Mettre à jour le test « non authentifié » de `authors_crud.spec.ts` s'il énumère les routes (ajouter `DELETE`), ou couvrir dans `authors_list.spec.ts`. `tests/unit/i18n/translations.spec.ts` vert ; `npm run typecheck`, `npm run lint` et `node ace build` verts ; suite complète `npm run test:local` verte.

## Dev Notes

### Contraintes non négociables

- **Base Supabase partagée dev/staging** : migration **additive uniquement** ; `down()` écrit mais **jamais exécuté** ; jamais de `migration:rollback` / `fresh` / `reset` / `db:wipe` ; la migration ne s'exécute pendant le dev **que** sur le Postgres Docker local (`npm run test:local`).
- **Tests** : uniquement `npm run test:local [-- unit|functional]` (conteneur `anta-test-db`, port 5433, valeurs CI) ; jamais sous `doppler run` (le script refuse de toute façon). `japa --files` bloque le runner dans ce projet : lancer les suites entières (Debug Log 9.1).
- **Fichiers générés et committés** : `.adonisjs/*` (registre Tuyau, `controllers.ts`, `pages.d.ts`, `routes.d.ts`) et `database/schema.ts` — régénérés, jamais édités à la main.
- **Frontière TS6305** : tout ce qui est sous `inertia/` (composants, pages, `inertia/lib/*.ts`) se teste par **lecture de source**, jamais par import depuis un test serveur.
- **Tables ordonnées** (`production_authors`, `author_affiliations`) : réordonnancement par `DELETE` + `INSERT` dans une transaction, jamais `UPDATE … SET position = position ± 1` (contrainte UNIQUE non différable). Aucune réorganisation n'est écrite en 9.2, mais les fixtures de test doivent insérer des positions 1..n distinctes.
- **Dépôt public** : aucun nom de personne réelle dans les tests ou fixtures (noms fictifs : « Éloïse Fictive », « Jean Marc Exemple »…) ; ne pas en ajouter en renommant les fixtures existantes.
- **FK `RESTRICT` sur l'auteur** : garde-fou de FR55. La vérification applicative (comptage sous verrou) donne le message ; la FK garantit qu'aucun chemin (console, futur code) ne supprime une fiche liée.
- **Migration** : timestamp `1775918747000` **obligatoire** (ordre P2.1 : 1 authors, 2 affiliations, **3 pivot**).
- Ne pas exécuter de migration contre Supabase, ne pas commiter (le commit est fait par Aurélien / l'orchestrateur), push seulement après test par Aurélien.

### Renommage `productions.authors` → propriété `authorNames` (état actuel / changement / à préserver)

Piège n° 1 — **Lucid `merge`/`create` résout aussi les noms de colonne** (vérifié dans `@adonisjs/lucid` 22.4.2, `BaseModel.merge` : `$hasColumn(key)` puis `$keys.columnsToAttributes.get(key)` **avant** le test des relations) : `Production.create({ authors: [...] })` continue donc de remplir `authorNames`. Ça ne casse pas, mais c'est trompeur : convertir les fixtures en `authorNames`.
Piège n° 2 — **`Object.assign(p, { authors: [...] })` ou `p.authors = []` n'utilisent PAS ce mécanisme** : ils écrasent la propriété de relation et laissent `authorNames` indéfini → `getMissingForPublish` change de résultat. Le typage (`Partial<Production>`, `ManyToMany`) les signale : corriger, ne jamais caster.

| Fichier | Aujourd'hui | Changement 9.2 | À préserver |
|---|---|---|---|
| `app/models/production.ts` | `@column({ prepare, consume }) declare authors: string[]` | `authorNames` + `columnName: 'authors'` ; relation `@manyToMany authors` | `prepare`/`consume` jsonb identiques ; hook slug ; autres relations |
| `app/models/author.ts` | pas de relation production | `@manyToMany productions` | hooks `searchName`, slug figé |
| `app/controllers/admin/productions_controller.ts` | l. 72 `authors: p.authors ?? []` ; l. 137 `authors: production.authors ?? []` ; l. 175 `production.authors = data.authors ?? []` ; l. 268 `authors: data.authors ?? []` (`Production.create`) | `p.authorNames` ; `production.authorNames` ; `production.authorNames = data.authors ?? []` ; `authorNames: data.authors ?? []` | clés de props `authors` ; champ de requête `data.authors` (le retrait des écritures est 9.7) ; dépublication auto, logs |
| `app/controllers/public/productions_controller.ts` | l. 22 et 39 `authors: p.authors ?? []` ; l. 190 `SeoService.forProduction(locale, production, …)` reçoit le **modèle** | `p.authorNames` ; passer une forme explicite `{ title, summary, slug, authors: production.authorNames }` (sinon `production.authors` = relation non chargée → byline perdue ; le typage le signale) | clés de props `authors` ; meta SEO identiques |
| `app/controllers/public/home_controller.ts` | l. 35 `authors: p.authors ?? []` | `p.authorNames` | type `authors: string[]` de la carte |
| `app/services/production_service.ts` | l. 113 `production.authors` dans `getMissingForPublish` ; l. 86 `jsonbValues('authors')` (SQL) ; type `ProductionSuggestions.authors` | `production.authorNames` (l. 113 seulement) | clé manquante `'authors'` (lue par `CompletionIndicator` / `production_completion.ts`) ; SQL et type inchangés |
| `app/services/search_service.ts` | `applyJsonbFilter(query, 'authors', …)` et `distinctJsonbValues('authors')` = **SQL brut** sur la colonne | aucun | filtre `author` et facette publiques |
| `app/services/seo_service.ts` | paramètre de forme `{ authors?: string[] | null }` | aucun (l'appelant adapte) | `tests/unit/services/seo_service.spec.ts` inchangé |
| `app/validators/admin/production_validator.ts` | champ `authors: string[]` | aucun (« contract » hors Phase 2) | |
| `database/seeders/production_demo_seeder.ts` | `multiInsert` brut avec la colonne `authors` | aucun | (pivot ajouté en 9.7) |
| migrations `…733547`, `…743000` (trigger `search_vector` sur `NEW.authors::text`) | — | **ne jamais toucher** | recherche full-text |
| `inertia/**` | lit la prop `authors` | aucun | |
| Tests : `tests/unit/models/production.spec.ts` (l. 24, 36, 52, 103, 132, 159), `tests/unit/services/production_service.spec.ts` (l. 11 `p.authors = []`, l. 28 `authors: ['A']` via `Object.assign`, l. 118), `tests/functional/admin/productions_create.spec.ts` (l. 64, 99 lectures `created!.authors`), `productions_edit.spec.ts` (l. 26 fixture, l. 85 lecture), fixtures `Production.create({ authors })` de `productions_list`, `productions_publish`, `productions_stats`, `production_files`, `production_links`, `users_delete`, `public/{listing,stats_view,home,search,productions,download}`, `unit/services/{search_service,stats_service}` | lectures/affectations de la propriété | `authorNames` | `.json({ authors: … })` (HTTP) ; `row.authors` (props) ; `seo_service.spec.ts` ; `production_validator.spec.ts` |

Faire un dernier `grep -rn "\.authors\b" app/ tests/` : chaque occurrence restante doit être une prop Inertia, un champ de requête, le type `ProductionSuggestions`, la relation, ou du SQL.

### Requêtes (liste)

```ts
// q (normalisé, ≤ 100 car.) : échapper les jokers LIKE
const term = normalizeKey(q).replace(/[\\%_]/g, (c) => `\\${c}`)
query.where((sub) => {
  sub.whereRaw('search_name LIKE ?', [`%${term}%`])
     .orWhereRaw('similarity(search_name, ?) > 0.3', [normalizeKey(q)])
})
// tri avec q : préfixe d'un mot d'abord, puis similarité, puis nom de famille
query.orderByRaw("(search_name LIKE ? OR search_name LIKE ?) DESC", [`${term}%`, `% ${term}%`])
     .orderByRaw('similarity(search_name, ?) DESC', [normalizeKey(q)])
     .orderBy('last_names').orderBy('first_names').orderBy('id')

// institution (clé normalisée) : n'importe quelle affiliation
query.whereExists((sub) => sub.from('author_affiliations')
  .whereColumn('author_affiliations.author_id', 'authors.id')
  .where('author_affiliations.institution_key', key))
// consent=pending
query.whereNull('consent_confirmed_at')
// incomplete=1
query.whereNotExists((sub) => sub.from('author_affiliations')
  .whereColumn('author_affiliations.author_id', 'authors.id'))
```

- `similarity()` vient de `pg_trgm` (activé par `1775918742000`) ; seuil explicite `> 0.3` plutôt que l'opérateur `%` (dépend du GUC `pg_trgm.similarity_threshold`). Le `LIKE '%…%'` est servi par `idx_authors_search_name_trgm` ; l'`OR similarity` force un parcours séquentiel, acceptable pour quelques centaines de fiches (P2.1). Garder cette logique dans `AuthorService` : 9.7 (`GET /admin/authors/search`) la réutilisera avec `limit(10)`.
- `withCount('productions')` sur la relation `manyToMany` → `$extras.productions_count` (chaîne en Postgres : `Number(...)`). Les relations préchargées + le `withCount` évitent tout N+1 sur 20 lignes.
- La recherche porte sur `search_name` (« prénoms noms ») ; « Aucune affiliation » / `isIncomplete` se déduisent des affiliations préchargées (pas de requête de plus).

### Infra existante (NE PAS réinventer)

- **Patron liste filtrée** : `app/controllers/admin/productions_controller.ts` (`strInput`, bornage `page`, props `current*`) et `inertia/pages/admin/Productions/Index.tsx` (`activeQuery`, `applyFilters`, `ALL_VALUE`, `Select`, `form role="search"`, `Pagination queryParams`, dialogs `role="alertdialog"`, `visitOptions` `onStart`/`onFinish`).
- **Refus avec flash d'erreur** : `users_controller.destroy` (`session.flash('error', …)` + redirection) ; `AdminLayout` affiche `flash.error` en toast rouge (`notify.error(t(flash.error))`).
- **Pagination** : `~/components/shared/Pagination` (`queryParams` ignore les valeurs vides).
- **Composants UI** présents : `badge`, `button`, `dialog`, `input`, `select` (shadcn new-york, `radix-ui` 1.4.3) ; **`tooltip` absent** → T5.1. Icônes `lucide-react` (`Search`, `Trash2` facultatif, `Loader2`).
- **`AuthorService`** (9.1) : `displayName`, transaction + `forUpdate()` (patron du verrou de `update`), `emptyToNull` ; **`formatAuthorName`** dans `inertia/lib/author_form.ts` (« Prénom NOM », D13/D34).
- **Journal** : `ActivityLogService.log({ …, metadata })` (hors transaction, ne lève jamais) ; la page Journal affiche déjà « Auteur — {metadata.name} » pour `resourceType = 'author'` (9.1), y compris pour une fiche supprimée.
- **`normalizeKey`** (`#helpers/normalize`) : idempotent, donc applicable à une clé déjà normalisée.

### Fichiers touchés (hors renommage) — état actuel / changement / à préserver

| Fichier | Aujourd'hui (9.1) | Changement 9.2 | À préserver |
|---|---|---|---|
| `app/controllers/admin/authors_controller.ts` | `index` paginé sans filtre ; `edit` ; `store` ; `update` ; garde UUID `findOrFail` | filtres, `withCount`, props `filters`/`counts`/`institutionOptions`, `productionsCount` dans `edit`, `destroy` | tri par défaut, forme des props existantes, garde UUID → 404, logs après commit |
| `app/services/author_service.ts` | `create` (relance sur collision de slug), `update` (verrou, `updatedAt` explicite), `replaceAffiliations` | `delete`, `productionsCount`, filtres, `quickFilterCounts`, `institutionOptions` | comportement de `create`/`update` (tests `author_service.spec.ts`) |
| `start/routes.ts` | 5 routes auteurs dans `middleware.admin()` | + `DELETE authors/:id` `.as('admin.authors.destroy')` | ordre `create` avant `:id/edit` ; pas de `superAdmin()` |
| `inertia/pages/admin/Authors/Index.tsx` | tableau 4 colonnes, état vide si `total === 0`, bouton créer masqué si vide | barre de filtres, 2 colonnes, actions supprimer, dialog, état « aucun résultat » | `formatAuthorName`, lien d'édition, « Aucune affiliation » `text-stone-500`, `urlFor` |
| `inertia/pages/admin/Authors/Edit.tsx` | formulaire + Enregistrer / Annuler | bouton Supprimer + dialog ou texte d'explication | validation client, `requireAffiliation`, `transform(toAuthorPayload)` |
| `inertia/locales/admin/{fr,en}.json` | `authors.*` de 9.1 | clés T8 | parité, clés existantes |
| `tests/functional/admin/authors_crud.spec.ts` | 14 cas | éventuellement `DELETE` dans le test « non authentifié » | autres cas inchangés (le tri par défaut, 20/page) |

### Gotchas (memory du topic + code)

- Tuyau : `inertia.render(page, {})` exige le 2e argument ; registre niché par dossier (`controllers.admin.Authors`) ; régénérer `.adonisjs/` après l'ajout de la route.
- Japa : `.withCsrfToken()` sur POST/PUT/**DELETE**, `.redirects(0)`, `loginAs()` ; `SESSION_DRIVER=memory` (exporté par `test-local.sh`).
- Inertia : une redirection 302 après `DELETE` est convertie en 303 par l'adaptateur (déjà le cas pour productions/users) ; dans les tests sans en-tête Inertia, attendre 302.
- `aria-disabled` ≠ `disabled` : un bouton `disabled` n'est plus focusable et l'infobulle au focus devient impossible (EXPERIENCE « Action indisponible ») ; garder le bouton focusable et neutraliser le clic.
- Radix `Select` refuse `value=""` : sentinelle `'all'` (patron Productions).
- shadcn : alias `~/*` ; pas de `baseUrl` (déprécié TS6) ; v4 = méta-paquet `radix-ui`.
- Les compteurs de lignes pivot restent à 0 sur les données réelles tant que 9.6 n'a pas tourné : ne pas l'interpréter comme un bug en recette.

### Intelligence de la story précédente (9.1)

- Verrou `SELECT … FOR UPDATE` dans la transaction pour sérialiser les écritures concurrentes d'une fiche : réutiliser pour `delete`.
- Lucid saute l'`UPDATE` sans colonne modifiée (corrigé par `updatedAt` explicite) — non concerné ici.
- État vide trompeur au-delà de la dernière page corrigé par `pagination.total === 0` : conserver, et distinguer désormais « filtré sans résultat ».
- Reports de la revue 9.1 toujours ouverts, **hors périmètre** : `page` non borné (`Infinity`, `1.5`), `<Link><Button/></Link>`, `normalizeKey` sans unification des apostrophes typographiques (impact : une recherche « n'diaye » avec apostrophe droite ne trouve pas « N’Diaye » saisi avec apostrophe typographique — la similarité trigram limite l'effet ; ne pas corriger ici).
- 497 → 502 tests verts à la fin de 9.1 ; `node ace serve` ~45 s pour régénérer `.adonisjs/`.

### Git (branche `feat/epic-9-authors`)

- `33e19b8` feat(authors) story 9.1, `7e24424` fix(authors) revue 9.1 : patrons à suivre (fichiers `snake_case`, docblocks en anglais dans le code, commentaires de tests en français, `Noms fictifs uniquement (dépôt public)` en tête de spec).
- Aucune dépendance npm à ajouter (`radix-ui` couvre le tooltip).

### Project Structure Notes

- Nouveaux fichiers : `database/migrations/1775918747000_create_production_authors_table.ts`, `inertia/components/ui/tooltip.tsx` (CLI), `inertia/components/admin/AuthorStatusBadges.tsx`, éventuellement `inertia/components/admin/DeleteAuthorDialog.tsx`, `tests/functional/admin/authors_list.spec.ts`, `tests/unit/components/authors_index_page.spec.ts`.
- Écart assumé vis-à-vis de l'epic : aucun. Choix par défaut documentés : compteurs globaux, filtre institution sur toutes les affiliations, redirection fixe vers la liste après suppression (succès ou refus), tri « préfixe d'un mot » (au lieu du seul préfixe de `search_name`, qui commence par les prénoms).
- Pas de maquette dédiée à la fiche auteur dans `ux-anta-2026-11-16/mockups/` : la fiche suit la mise en page de 9.1 + D32 (« texte visible dans la fiche »).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.2] (+ « Règles communes » de l'Epic 9 ; 9.3–9.8 pour le hors-périmètre)
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.1 Modèle de données] (pivot, tables ordonnées, `authorNames` expand/contract, migrations)
- [Source: architecture.md#P2.6] (routes `admin.authors` + `.destroy`, journal `delete` / `author`, composants shadcn par CLI) ; P2-01, P2-02, P2-03, P2-04, P2-15
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] tableau des routes admin (l. 48), Voice and Tone (badges, suppression impossible, « Aucun auteur ne correspond »), « Suppression d'une fiche », « Badges auteurs », « Action indisponible »
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] AdminAuthorsTable, Badges auteurs, tokens `badge-*`, `filter-chip-active` ; maquette `mockups/admin-authors-list.html`
- [Source: ux-designs/ux-anta-2026-11-16/.decision-log.md] D19, D32
- [Source: _bmad-output/implementation-artifacts/9-1-creer-et-modifier-une-fiche-auteur.md] Dev Notes, Review Findings, reports
- Code : `app/controllers/admin/productions_controller.ts`, `inertia/pages/admin/Productions/Index.tsx`, `app/controllers/admin/users_controller.ts#destroy`, `inertia/components/admin/StatusBadge.tsx`, `tests/functional/admin/authors_crud.spec.ts`, `/home/atlas/projects/anta/CLAUDE.local.md`

## Questions ouvertes (non bloquantes, défauts retenus)

1. **Compteurs des filtres rapides** : globaux (tout le référentiel) ou recalculés selon la recherche / l'institution en cours ? Défaut : **globaux** (indicateur de travail restant, parcours 5). Changement trivial si Aurélien préfère des compteurs contextuels.
2. **Filtre Institution** : sur toutes les affiliations d'une fiche (défaut) ou seulement l'affiliation principale ?
3. **Texte du dialog de suppression** : non fourni par EXPERIENCE.md ; proposé « Supprimer cette fiche auteur ? » / « La fiche de {nom} et ses affiliations seront définitivement supprimées. » — à valider.
4. **Specs existantes contenant des noms de personnes réelles** (`seo_service.spec.ts`, `search.spec.ts`, `search_service.spec.ts`) : antérieures à la règle Phase 2, non modifiées par cette story ; un nettoyage séparé peut être planifié.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), workflow `bmad-dev-story`, exécution autonome.

### Debug Log References

- `npx shadcn@latest add tooltip` : la CLI a résolu l'alias `utils` vers un paquet npm `cn` (import `from "cn"` + ajout de `cn` dans `package.json`/`package-lock.json`). Changements de `package.json`/`package-lock.json` annulés (`git checkout`), `node_modules/cn` supprimé, import corrigé en `~/lib/utils`, `"use client"` ajouté comme `dialog.tsx`. Le composant généré n'enveloppe pas `Root` dans un `Provider` : `TooltipProvider` est posé dans `Authors/Index.tsx`.
- `database/schema.ts` régénéré par le `migration:run --force` de `npm run test:local` : seul ajout `ProductionAuthorSchema`. Clé primaire composite : le générateur ne marque `isPrimary` que sur `productionId` (pas `authorId`) ; non édité à la main (fichier généré), sans effet sur le code (aucun modèle n'étend ce schéma).
- 1er passage de la suite : 2 échecs corrigés — regex trop large dans le test de source (`page:` matchait `(page: ReactElement)` du layout ; remplacé par un contrôle sur le corps de `applyFilters`) et assertion `deepEqual` de `GET edit` dans `authors_crud.spec.ts` (nouvelle prop `productionsCount` voulue par T4.2/AC 6 → `productionsCount: 0` ajouté à l'attendu).
- `.adonisjs/*` régénérés par `node ace serve` ~45 s sur la base locale (registre Tuyau : `admin.authors.destroy` typé).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- T1 : migration `1775918747000_create_production_authors_table.ts` (PK composite, UNIQUE (production_id, position), CHECK position >= 1, index `idx_production_authors_author_id`, FK CASCADE / RESTRICT), appliquée uniquement sur le Postgres Docker local.
- T2 : `Production.authorNames` (`columnName: 'authors'`, prepare/consume inchangés) + relation `manyToMany authors` triée par position ; `Author.productions`. Renommage appliqué aux contrôleurs admin/public, `ProductionService.getMissingForPublish`, `SeoService.forProduction` appelé avec une forme explicite ; fixtures/lectures de tests converties (payloads HTTP et props Inertia `authors` inchangés).
- T3 : `AuthorService.productionsCount`, `delete` (verrou `FOR UPDATE`, comptage dans la transaction, 23503 traduit en refus), `applyListFilters` (q normalisé + jokers LIKE échappés + similarité > 0.3, institution sur toute affiliation, consent, incomplete) et `applyListOrder` (préfixe d'un mot, similarité, puis nom/prénom/id — tri par défaut inchangé), `quickFilterCounts` (compteurs globaux, une requête), `institutionOptions` (`mode()`).
- T4 : `index` (filtres assainis, `q` ≤ 100 car., `withCount('productions')`, props `productionsCount`/`isPublic`/`isIncomplete`, `filters`, `counts`, `institutionOptions`), `edit` (`productionsCount`), `destroy` (refus → flash `authors.delete.refused` sans journal ; succès → journal `delete`/`author` `metadata.name` après commit, flash `authors.flash.deleted` ; redirection fixe `/admin/authors`), route `DELETE authors/:id` `admin.authors.destroy`.
- T5–T7 : `ui/tooltip.tsx`, `AuthorStatusBadges`, `DeleteAuthorDialog` (partagé liste + fiche ; reste ouvert, bouton désactivé avec spinner pendant la requête, se ferme à `onFinish`), barre de filtres, colonnes Productions/Statut, bouton refusé `aria-disabled` + `aria-describedby` + infobulle + `sr-only`, état « aucun résultat » distinct de l'état vide ; fiche : bouton Supprimer `ml-auto`, texte visible relié par `aria-describedby`.
- T8 : clés FR/EN ajoutées (parité vérifiée par `translations.spec.ts`).
- T9 : nouveaux specs `tests/unit/models/production_authors.spec.ts` (6), `tests/functional/admin/authors_list.spec.ts` (11), `tests/unit/components/authors_index_page.spec.ts` (10), compléments `author_service.spec.ts` (6), `DELETE` ajouté au test « non authentifié » de `authors_crud.spec.ts`. Suite complète : 535 tests verts (502 → 535) ; `npm run typecheck`, `npm run lint`, `node ace build` verts.
- Écarts : tests écrits juste après l'implémentation de chaque couche plutôt qu'en « red » strict ; tri séparé dans `applyListOrder` (réutilisable par 9.7) ; `authors_crud.spec.ts` « GET edit » complété de `productionsCount: 0`.

### File List

- `_bmad-output/implementation-artifacts/9-2-liste-des-auteurs-filtres-et-suppression.md` (modifié)
- `.adonisjs/client/registry/index.ts` (généré)
- `.adonisjs/client/registry/schema.d.ts` (généré)
- `.adonisjs/client/registry/tree.d.ts` (généré)
- `.adonisjs/server/routes.d.ts` (généré)
- `database/migrations/1775918747000_create_production_authors_table.ts` (nouveau)
- `database/schema.ts` (généré)
- `app/models/production.ts`
- `app/models/author.ts`
- `app/services/author_service.ts`
- `app/services/production_service.ts`
- `app/controllers/admin/authors_controller.ts`
- `app/controllers/admin/productions_controller.ts`
- `app/controllers/public/home_controller.ts`
- `app/controllers/public/productions_controller.ts`
- `start/routes.ts`
- `inertia/components/ui/tooltip.tsx` (nouveau)
- `inertia/components/admin/AuthorStatusBadges.tsx` (nouveau)
- `inertia/components/admin/DeleteAuthorDialog.tsx` (nouveau)
- `inertia/pages/admin/Authors/Index.tsx`
- `inertia/pages/admin/Authors/Edit.tsx`
- `inertia/locales/admin/fr.json`
- `inertia/locales/admin/en.json`
- `tests/functional/admin/authors_list.spec.ts` (nouveau)
- `tests/unit/components/authors_index_page.spec.ts` (nouveau)
- `tests/unit/models/production_authors.spec.ts` (nouveau)
- `tests/unit/services/author_service.spec.ts`
- `tests/functional/admin/authors_crud.spec.ts`
- `tests/functional/admin/production_files.spec.ts`, `production_links.spec.ts`, `productions_create.spec.ts`, `productions_edit.spec.ts`, `productions_list.spec.ts`, `productions_publish.spec.ts`, `productions_stats.spec.ts`, `users_delete.spec.ts`
- `tests/functional/public/download.spec.ts`, `home.spec.ts`, `listing.spec.ts`, `productions.spec.ts`, `search.spec.ts`, `stats_view.spec.ts`
- `tests/unit/models/production.spec.ts`, `tests/unit/services/production_service.spec.ts`, `search_service.spec.ts`, `stats_service.spec.ts`

## Change Log

| Date | Version | Description |
|---|---|---|
| 2026-11-18 | 1.0 | Story 9.2 implémentée : pivot `production_authors`, renommage `authorNames`, liste filtrée des auteurs (recherche, institution, filtres rapides avec compteurs), suppression avec refus FR55, tooltip shadcn, badges de statut, 33 tests ajoutés (535 verts). Statut → review. |
