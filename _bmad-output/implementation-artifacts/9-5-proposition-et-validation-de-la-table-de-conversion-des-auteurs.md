---
baseline_commit: 3dac3cd
---

# Story 9.5 : Proposition et validation de la table de conversion des auteurs

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **product owner** (Aurélien),
je veux **recevoir une table de conversion proposée des noms d'auteurs existants vers des fiches, et pouvoir la contrôler après édition**,
afin de **valider le rattachement avant toute écriture en base** (FR56, D19).

## Décision de périmètre (lire en premier)

- **DANS 9.5** :
  - nouveau dossier `commands/` (scanné automatiquement par Ace : `FsLoader(app.commandsPath())` dans `@adonisjs/core` 7, **rien à ajouter** dans `adonisrc.ts` ni dans `.adonisjs/`) avec `commands/authors_propose.ts` (`authors:propose`) et `commands/authors_validate.ts` (`authors:validate`) ;
  - `app/services/author_conversion_service.ts` : toute la logique (extraction, regroupement, découpage, CSV, contrôle), testable sans CLI ; les commandes ne font qu'E/S fichier + affichage + code de sortie ;
  - tests unitaires du service et tests fonctionnels des deux commandes sur Postgres local.
- **HORS 9.5 (ne PAS implémenter)** :
  - `authors:apply`, `authors:verify`, `ProductionAuthorService` (`sync`, `refreshDenormalizedNames`), rapport `tmp/authors-conversion-report-<date>.txt` → **9.6** ;
  - toute écriture dans `authors`, `production_authors` ou `productions` (y compris via `Author.create`) : les deux commandes sont **en lecture seule** ;
  - sélection des auteurs dans le formulaire, seeder de démo `seed-demo:` → **9.7** ;
  - modification de `normalizeKey` (`app/helpers/normalize.ts`) : il doit rester identique (compatibilité `search_name` / `institution_key` déjà écrits) — l'unification des apostrophes et traits d'union est propre à la **clé de regroupement** de la proposition (voir Décisions) ;
  - aucune migration, aucune dépendance npm (CSV lu/écrit par un petit sérialiseur maison).
  - exécution réelle sur la base partagée : étape manuelle d'Aurélien **après** le merge (AC 6), hors de cette session.

## Acceptance Criteria

1. **Extraction** — **Given** `node ace authors:propose --out tmp/authors-conversion.csv`, **When** elle s'exécute, **Then** elle lit les noms de `productions.authors` (jsonb, **tous statuts**) et ne retient que les occurrences **non rattachées** : une occurrence (production, nom) est rattachée si la production a dans `production_authors` un auteur dont `search_name` = `normalizeKey(nom)` (après `apply` + `refreshDenormalizedNames` de 9.6, le jsonb est réécrit depuis le pivot : cette règle reconnaît donc les noms déjà convertis, et une production partiellement rattachée ne propose que ses noms restants) ; les chaînes vides ou blanches sont ignorées (comptées dans le résumé) ; chaque nom source est canonisé par `sourceKey` (trim + espaces internes compactés, casse et accents conservés) : deux graphies qui ne diffèrent que par les espaces forment une seule ligne.
2. **Regroupement** — **Given** les noms sources, **When** la proposition est construite, **Then** les noms de même **clé de regroupement** (`groupKey` : `normalizeKey`, apostrophes `’ ʼ ‘ ´ \`` → `'`, tirets `‐ - ‒ – — ―` → espace, jetons triés) reçoivent le même `author_key` ; `confidence=exact` si le `normalizeKey` du nom est celui du représentant du groupe, `confidence=grouped` sinon (« Diallo Moussa » = « Moussa Diallo », « Jean-Marc Fictif » = « Jean Marc Fictif ») **and** deux groupes dont les clés ont une similarité `pg_trgm` > 0,6 (`similarity()` explicite, calculée par Postgres) **ne sont jamais fusionnés** : chacune de leurs lignes passe en `confidence=fuzzy` et `note` cite le(s) groupe(s) proche(s) avec le score ; des homonymes partiels (même nom de famille, prénoms différents) restent distincts.
3. **Découpage prénom/nom** — **Given** le représentant d'un groupe (graphie la plus fréquente ; à égalité celle qui a un jeton en capitales, puis ordre alphabétique), **When** il est découpé, **Then** les jetons **entièrement en capitales** (≥ 2 lettres, aucune minuscule) forment `last_names` (ordre d'origine) et les autres `first_names` ; sinon (aucun ou tous en capitales) le **dernier mot** est `last_names` et le reste `first_names` ; un seul mot → `last_names` = ce mot, `first_names` vide + note ; la casse saisie est conservée (D34) ; toutes les lignes d'un groupe portent la même identité.
4. **Fiche existante** — **Given** une fiche `authors` (créée dans le panel ou par une conversion précédente) dont `groupKey(search_name)` = la clé du groupe, **When** la proposition est construite, **Then** si elle est unique, `existing_author_slug` = son slug et `first_names` / `last_names` = ceux de la fiche (note « fiche existante ») ; si plusieurs fiches correspondent, `existing_author_slug` reste vide et la note liste leurs slugs ; une fiche dont la similarité dépasse 0,6 sans égalité de clé est seulement citée en note.
5. **CSV** — **Given** la proposition, **When** elle est écrite, **Then** le fichier est en UTF-8 **avec BOM**, séparateur `;`, fins de ligne CRLF, champs entre guillemets si nécessaire (`;`, `"`, retour à la ligne, espace en bord ; `"` doublé), colonnes exactement `source_name;occurrences;productions;author_key;first_names;last_names;existing_author_slug;confidence;note` (`productions` = slugs des productions séparés par ` | ` ; lignes triées par nom, prénom, `author_key`, occurrences décroissantes) **and** `--out` doit désigner un fichier **sous `tmp/`** (sinon refus, code ≠ 0) et un fichier existant n'est jamais écrasé sans `--force` (protection du CSV déjà édité) ; la commande affiche un résumé (noms sources, groupes, exact / grouped / fuzzy, fiches existantes proposées) sans écrire de nom en base.
6. **Contrôle** — **Given** un CSV édité (fusions par `author_key`, corrections, `existing_author_slug`), **When** `node ace authors:validate --file tmp/authors-conversion.csv` s'exécute, **Then** sont des **erreurs** (code de sortie 1) : en-tête sans `;` ou colonne requise absente (`source_name`, `author_key`, `first_names`, `last_names`, `existing_author_slug`) ; ligne sans `source_name` ; nom source en double ; ligne non mappée (ni `author_key` ni `existing_author_slug`) ; un `author_key` portant plusieurs identités (`existing_author_slug`, `first_names`, `last_names` comparés après trim) ; `existing_author_slug` inconnu ; sans fiche existante, `last_names` vide, ou `first_names` / `last_names` > 120 caractères ; `author_key` > 255 ; un nom non rattaché présent en base mais absent du CSV ; CSV vide alors que des noms restent à rattacher **and** sont des **avertissements** (code 0) : `first_names` vide, ligne dont le nom n'est plus à rattacher (ignorée), deux `author_key` de même identité (homonymes → deux fiches), `author_key` déjà utilisé comme `migration_key` d'une fiche (rattachement à cette fiche) **and** elle affiche le rapport : fiches à créer, fiches existantes rattachées, noms sources mappés, liens (production × nom) qui seraient créés, productions concernées.
7. **Lecture seule** — **Given** l'une ou l'autre commande, **When** elle s'exécute, **Then** aucune ligne n'est écrite en base : toutes les lectures passent par une transaction `SET TRANSACTION READ ONLY` toujours annulée ; les comptages (`authors`, `production_authors`) et les `productions.authors` / `updated_at` sont inchangés (test fonctionnel).
8. **Hors dépôt** — **Given** le CSV, **When** la story est livrée, **Then** il n'existe que sous `tmp/` (ignoré par git : `tmp/*`), n'est jamais commité ni joint à une PR ; les tests écrivent dans un sous-dossier `tmp/` unique supprimé à la fin ; fixtures et docs n'utilisent que des noms manifestement fictifs.
9. **Exécution réelle (documentée, hors session)** — **Given** la story mergée sur `development`, **When** la proposition est générée sur la base partagée, **Then** elle l'est par Aurélien (ou sur son accord) en utilisateur `atlas` sur le VPS de dev : `doppler run -- node ace authors:propose --out tmp/authors-conversion.csv`, puis le CSV est remis à Aurélien **hors dépôt** ; après édition, `doppler run -- node ace authors:validate --file …` jusqu'au code 0 (procédure dans les Dev Notes).
10. **Non-régression** — suite complète `npm run test:local`, lint, typecheck et build verts ; `normalizeKey`, `search_name`, les écrans auteurs et le build (`build/commands/` compilé) inchangés hors ajouts.

## Tasks / Subtasks

- [x] **T1 — Service : fonctions pures** (AC 1, 2, 3, 5)
  - [x] 1.1 `app/services/author_conversion_service.ts` : `CSV_COLUMNS` (ordre exact), `REQUIRED_COLUMNS`, `FUZZY_THRESHOLD = 0.6`, `MIGRATION_KEY_MAX = 255`, `AUTHOR_NAME_MAX` réimporté de `author_validator.ts`.
  - [x] 1.2 `sourceKey(name)` (trim + `\s+` → espace) ; `groupKey(name)` (`normalizeKey`, apostrophes → `'`, tirets → espace, compaction, jetons triés par `<` simple, joints par espace) ; `authorKeyOf(groupKey)` = jetons joints par `-`.
  - [x] 1.3 `splitName(name)` → `{ firstNames, lastNames, notes: string[] }` (règle AC 3 ; « tout en capitales » et « nom seul » notés ; particule possible si le jeton qui précède le nom est entièrement en minuscules — `de`, `van`… — notée sans changer le découpage).
  - [x] 1.4 `groupSources(sources)` → groupes `{ key, authorKey, representative, rows }` ; représentant selon AC 3 ; confidence exact/grouped.
  - [x] 1.5 `toCsv(rows)` (BOM, `;`, CRLF, guillemets) et `parseCsv(text)` (BOM retiré, champs entre guillemets avec `;`/`""`/retours à la ligne, CRLF ou LF, lignes vides finales ignorées, erreur si guillemet non fermé) → `{ header: string[], records: Record<string,string>[] }` ; `delimiterError` si l'en-tête ne contient pas `;`.
- [x] **T2 — Service : lecture base** (AC 1, 2, 4, 7)
  - [x] 2.1 `readOnly(fn)` : `const trx = await db.transaction()` ; `SET TRANSACTION READ ONLY` ; `try { return await fn(trx) } finally { await trx.rollback() }` (dans un test, c'est un savepoint annulé : le mode lecture seule ne fuit pas).
  - [x] 2.2 `collectUnattached(trx)` : une requête `jsonb_array_elements_text(p.authors) WITH ORDINALITY` (id, slug, nom) + une requête pivot (`production_authors` ⨝ `authors` → `production_id`, `search_name`) ; filtre en TypeScript (`normalizeKey(nom)` ∈ noms liés de la production) ; agrégat par `sourceKey` : `occurrences`, slugs distincts triés ; nombre de chaînes vides ignorées.
  - [x] 2.3 `similarPairs(trx, keys, others?)` : `unnest(?::text[]) WITH ORDINALITY` × lui-même (`a.i < b.i`) `WHERE similarity(a.k, b.k) > ?` ; même calcul contre `search_name` des fiches existantes (groupKey) pour AC 4 ; aucun appel si la liste est vide.
  - [x] 2.4 `existingAuthors(trx)` : `id, slug, first_names, last_names, search_name, migration_key`.
  - [x] 2.5 `propose()` → `{ rows, summary }` (assemble 2.2–2.4 + T1, notes en français jointes par ` | `).
- [x] **T3 — Service : contrôle** (AC 6, 7)
  - [x] 3.1 `validate(text)` → `{ errors: string[], warnings: string[], plan: { toCreate, toAttach, sourceNames, links, productions } }` : parse, règles AC 6 dans l'ordre, comparaison avec `collectUnattached` (par `sourceKey`) et les fiches existantes (slugs, `migration_key`) dans `readOnly` ; erreurs structurelles (colonnes, séparateur, guillemet) → arrêt immédiat avec ce seul message.
  - [x] 3.2 `plan` : une clé = une fiche ; `toAttach` = clés/slugs qui visent une fiche existante (slug renseigné ou `migration_key` existant), `toCreate` = le reste ; `links` = somme des occurrences des noms mappés encore à rattacher, `productions` = productions distinctes concernées.
- [x] **T4 — Commandes Ace** (AC 5, 6, 9)
  - [x] 4.1 `commands/authors_propose.ts` : `BaseCommand`, `commandName = 'authors:propose'`, `description`, `options = { startApp: true }`, `@flags.string({ default: 'tmp/authors-conversion.csv' }) out`, `@flags.boolean() force` ; résolution `app.makePath(out)` (si relatif), refus hors `app.makePath('tmp')` (`path.relative` commençant par `..` ou absolu) ; refus si le fichier existe sans `--force` ; `mkdir -p` ; écriture ; résumé `this.logger.info/success` ; `this.exitCode = 1` sur refus.
  - [x] 4.2 `commands/authors_validate.ts` : `@flags.string({ default: 'tmp/authors-conversion.csv' }) file` ; fichier introuvable → erreur ; affiche erreurs (`logger.error`), avertissements (`logger.warning`), rapport ; `exitCode = 1` si erreurs.
  - [x] 4.3 Vérifier `node ace list` (local, valeurs de `scripts/test-local.sh`) : les deux commandes apparaissent ; build : `build/commands/*.js` présents.
- [x] **T5 — Tests** (AC 1–8, 10)
  - [x] 5.1 `tests/unit/services/author_conversion_service.spec.ts` : `sourceKey` / `groupKey` (accents, casse, ordre, `’` vs `'`, tiret vs espace) ; `splitName` (« NOM Prénom », « Prénom NOM », « Prénom1 Prénom2 Nom », tout en capitales, mot seul, initiale « A. », particule) ; `groupSources` (jetons inversés → grouped, homonymes partiels distincts, représentant) ; CSV (BOM, colonnes, guillemets, aller-retour avec `;` / `"` / retour ligne, LF accepté, guillemet non fermé) ; `propose` sur base (global transaction) : non rattachés seulement, production partiellement rattachée, fuzzy en note sans fusion, fiche existante unique / multiple ; `validate` : chaque erreur et avertissement de l'AC 6, plan chiffré.
  - [x] 5.2 `tests/functional/admin/authors_conversion.spec.ts` (commandes via `ace.create(Command, argv)` + `ui.switchMode('raw')`) : `propose` écrit le CSV (BOM, en-tête) et n'écrit rien en base (comptages + `authors`/`updated_at` d'une production identiques) ; refus hors `tmp/` et sans `--force` ; `validate` code 0 sur la proposition brute, ≠ 0 sur un CSV cassé ; `validate` n'écrit rien.
  - [x] 5.3 Noms manifestement fictifs uniquement ; dossier `tmp/authors-conversion-test-<aléa>/` supprimé en `cleanup`.
- [x] **T6 — Finitions** (AC 10)
  - [x] 6.1 `npx eslint --fix` sur les nouveaux fichiers, `npm run lint`, `npm run typecheck`, `npm run test:local` complet, build ; `git status` : aucun CSV sous `tmp/` suivi.
  - [x] 6.2 Story : cases, Dev Agent Record, File List, Change Log, Status → review ; `deferred-work.md` : marquer le report « Normalisation des clés » comme traité pour la proposition (groupKey) en gardant `normalizeKey` inchangé.

## Dev Notes

### Contraintes non négociables

- **Base Supabase partagée** : aucune migration, aucune écriture. Ne jamais lancer les commandes sous `doppler run` dans cette session ; essais manuels **uniquement** sur la base locale de test (valeurs de `scripts/test-local.sh` : `DB_HOST=127.0.0.1 DB_PORT=5433 postgres/postgres anta_test`).
- **Tests** : `npm run test:local [-- unit|functional]` ; jamais `--files`.
- **Dépôt public** : aucun nom réel (tests, docs, story), aucune IP/hôte ; le CSV reste sous `tmp/` (ignoré : `tmp/*`, seul `tmp/.gitkeep` suivi).
- `normalizeKey` inchangé (search_name, institution_key et le futur `verify` de 9.6 en dépendent).

### Décisions (prises par défaut, à valider par le PO si besoin)

- **D-9.5-a — Clé de regroupement plus tolérante que `normalizeKey`** (report « Normalisation des clés », `deferred-work.md`) : pour `grouped` seulement, `’`/`ʼ`/`‘`/`´`/`` ` `` = `'` et tirets = espace. `exact` garde la stricte égalité de `normalizeKey`. `ł`, `ø`, `æ`, `đ` ne sont pas translittérés (rares ; le fuzzy les signale).
- **D-9.5-b — « Rattaché » = égalité `normalizeKey(nom)` / `search_name` d'un auteur lié à la même production** (voir AC 1). 9.6 doit utiliser la même définition (`AuthorConversionService.sourceKey` pour apparier CSV et jsonb, et `normalizeKey` pour le test « déjà rattaché »).
- **D-9.5-c — `confidence=fuzzy` prime** sur exact/grouped pour signaler une ligne à examiner ; la note garde « regroupé avec … » quand la ligne était aussi groupée.
- **D-9.5-d — `first_names` vide = avertissement**, pas erreur (noms d'un seul mot, collectifs) ; la fiche créée en 9.6 devra être complétée avant d'être modifiable dans le panel (`firstNames` min 1 au validateur).
- **D-9.5-e — Fiche existante proposée automatiquement** quand une seule fiche a la même clé de regroupement (même niveau de confiance que `grouped`) ; Aurélien peut vider la cellule.
- **D-9.5-f — Pas de neutralisation des formules Excel** (`=`, `+`, `-`, `@` en tête) : `source_name` doit faire l'aller-retour à l'identique ; données saisies par des admins.

### Détails d'implémentation (pièges)

- **Ace v7** : `import { BaseCommand, flags } from '@adonisjs/core/ace'`, `import type { CommandOptions } from '@adonisjs/core/types/ace'`, `static options: CommandOptions = { startApp: true }` (sinon pas de connexion Lucid). Code de sortie : `this.exitCode = 1` (pas de `process.exit`). Les fichiers de `commands/` doivent exporter par défaut la classe.
- **Test des commandes** : `const ace = await app.container.make('ace')`, `ace.ui.switchMode('raw')`, `const command = await ace.create(AuthorsPropose, ['--out', rel])`, `await command.exec()`, `command.assertSucceeded()` / `assertFailed()` / `assertLogMatches(/…/)` ; `command.exitCode`. Remettre `ace.ui.switchMode('normal')` en `cleanup`.
- **Lecture seule et tests** : les tests ouvrent une transaction globale ; `db.transaction()` devient un savepoint ; `SET TRANSACTION READ ONLY` y est accepté et `ROLLBACK TO SAVEPOINT` annule le réglage — à vérifier par un test qui écrit après un appel à `propose` dans la même transaction globale. Si Postgres refuse le réglage dans un savepoint, repli : ne pas appeler `SET TRANSACTION` quand `trx.isTransaction` est imbriqué (documenter).
- **jsonb** : `productions.authors` est `NOT NULL` (tableau) ; `jsonb_array_elements_text` sur un tableau vide ne renvoie rien. Une valeur non-tableau ferait échouer la requête : filtrer `jsonb_typeof(p.authors) = 'array'`.
- **pg_trgm** : extension active (`1775918742000_enable_pg_trgm_extension.ts`) ; `similarity()` explicite comme `author_service.ts` (pas l'opérateur `%`, dépendant du GUC). Volume attendu : quelques centaines de groupes → produit cartésien de l'ordre de 10⁵ paires, acceptable.
- **Ordre de tri du CSV** : `normalizeKey(last_names)`, puis `normalizeKey(first_names)`, `author_key`, occurrences décroissantes, `source_name` — les lignes d'un groupe sont contiguës.
- **Chemin `--out`** : `path.isAbsolute(out) ? out : app.makePath(out)` ; `path.relative(app.makePath('tmp'), resolved)` ne doit ni commencer par `..` ni être vide ni absolu.

### Infra existante (NE PAS réinventer)

- `normalizeKey` (`app/helpers/normalize.ts`), `AUTHOR_NAME_MAX` (`app/validators/admin/author_validator.ts`), modèle `Author` (`searchName`, `migrationKey`, `slug`), pivot `production_authors (production_id, author_id, position)`, `Production.authorNames` (colonne `authors`).

### Procédure d'exécution réelle (AC 9, pour Aurélien — après merge)

1. En utilisateur `atlas` sur le VPS de dev, dans le dépôt à jour : `doppler run -- node ace authors:propose --out tmp/authors-conversion.csv`.
2. Remettre le CSV à Aurélien hors dépôt (jamais par une PR ni un commit).
3. Aurélien édite (Excel : séparateur `;`, UTF-8) : fusionne en donnant le même `author_key`, corrige `first_names` / `last_names`, pointe une fiche par `existing_author_slug`, sépare des homonymes en changeant la clé.
4. Le CSV édité revient sous `tmp/` ; `doppler run -- node ace authors:validate --file tmp/authors-conversion.csv` jusqu'au code 0.
5. Application : Story 9.6 (`apply --dry-run`, `apply`, `verify`), sur accord écrit d'Aurélien.

### Gotchas (memory du topic + code)

- Tests DB : `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` par test (patron `author_service.spec.ts`) ; `Production.create({ title, status, authorNames, tags: [], licenseStatus: 'member' })`.
- Unit tests touchant la base : autorisés dans ce dépôt (Postgres local).
- Timeout unitaire 2 s : garder les jeux de données petits.

### Intelligence des stories précédentes (9.1–9.4)

- Conventions : fichiers `snake_case`, docblocks anglais dans `app/`, commentaires de tests en français, « Fictitious names only (public repository) » en tête des specs.
- Le slug d'auteur (D28) et `migration_key` UNIQUE existent depuis 9.1 ; `AuthorService.create` refuse D27 (sans affiliation + consentement) — sans effet ici (aucune création).
- Reports ouverts sans lien : `page` non borné, `<Link><Button/>`, objets R2 orphelins, recherche non indexée (9.7).

### Git (branche `feat/epic-9-authors`)

- `33e19b8`/`7e24424` (9.1), `7826be9`/`fafdea7` (9.2), `744296a`/`840c6bf` (9.3), `2e64de2`/`3dac3cd` (9.4). Message : `feat(authors): … (story 9.5)`.

### Project Structure Notes

- Nouveaux : `commands/authors_propose.ts`, `commands/authors_validate.ts`, `app/services/author_conversion_service.ts`, `tests/unit/services/author_conversion_service.spec.ts`, `tests/functional/admin/authors_conversion.spec.ts` (nom imposé par 9.9).
- Aucun fichier modifié hors story / `deferred-work.md`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.5] (+ « Règles communes » de l'Epic 9 ; 9.6–9.9 pour le hors-périmètre)
- [Source: architecture.md#P2.1] (`authors.migration_key`, `search_name`, normalisation applicative) ; [#P2.2] (commandes, CSV, proposition, exécution) ; P2-05
- [Source: deferred-work.md] « Normalisation des clés » (revue 9.1)
- Code : `app/helpers/normalize.ts`, `app/models/{author,production}.ts`, `app/services/author_service.ts` (`similarity` explicite), `database/migrations/1775918745000…1775918747000`, `scripts/test-local.sh`, `/home/atlas/projects/anta/CLAUDE.local.md`

## Questions ouvertes (non bloquantes, défauts retenus)

1. `first_names` vide (nom d'un seul mot) : avertissement (D-9.5-d) — le PO peut préférer une erreur bloquante.
2. Colonne `productions` : slugs (stables, sans `;`) plutôt que titres.
3. Apostrophes / tirets assimilés pour `grouped` (D-9.5-a).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- `node ace list` en échec (« Invalid command exported from "authors_propose.js" file. Invalid URL ») : bogue amont de `@adonisjs/ace` 14.1.0 — `jsonschema` 1.5.0 ne résout plus le `$ref` racine du schéma de métadonnées sous Node 24.22 (`new URL('/#/definitions/…', 'thismessage::/')` lève). Touche **toute** commande applicative chargée par `FsLoader` (les commandes des paquets, `migration:run`, `test`, ne sont pas concernées). Corrigé en amont par `@adonisjs/ace` 14.1.2 (`$id` ajouté au schéma) : `npm update @adonisjs/ace` (mise à jour de correctif d'une dépendance transitive déjà présente, `package-lock.json` seulement ; plage `^14.1.0` de `@adonisjs/core`).
- Ace importe chaque module de `commands/` pour ses métadonnées **avant** le démarrage de l'application : un import statique du service (→ `author_validator.ts` → `vine.file`, enregistré par le provider) fait échouer `node ace list`. Les commandes importent le service paresseusement dans `run()`.
- Essai manuel sur la base locale de test (port 5433, données fictives insérées puis supprimées) : proposition (10 lignes, exact / grouped / fuzzy, apostrophe typographique groupée, nom seul noté), `validate` code 0 sur la proposition brute, code 1 sur un CSV édité fautif (identités multiples, slug inconnu, nom absent) ; `--out ../x.csv` refusé (code 1).
- `SET TRANSACTION READ ONLY` vérifié dans un savepoint (transaction globale des tests) : accepté, annulé par `ROLLBACK TO SAVEPOINT` (test « nothing leaks after »).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `AuthorConversionService` : `sourceKey`, `groupKey` (apostrophes/tirets assimilés, jetons triés ; `normalizeKey` inchangé), `authorKeyOf`, `splitName` (capitales = nom, sinon dernier mot ; notes « nom seul », « tout en capitales », « particule possible »), `groupSources` (représentant : occurrences, puis jeton en capitales, puis ordre), `readOnly` (transaction `READ ONLY` toujours annulée), `collectUnattached` (règle « rattaché » = `normalizeKey(nom)` ∈ `search_name` des auteurs liés à la production), `existingAuthors`, `similarPairs` (`similarity()` explicite > 0,6, tableaux passés en jsonb pour éviter l'expansion des tableaux par knex), `propose`, `toCsv` / `parseCsv` (BOM, `;`, CRLF, RFC 4180), `validate` (erreurs / avertissements de l'AC 6, plan : fiches à créer / rattachées, noms, liens dédoublonnés par production, productions).
- Commandes `authors:propose` (`--out` sous `tmp/` obligatoire, `--force` pour écraser) et `authors:validate` (`--file`, code 1 si erreur) ; messages en français pour le PO.
- Tests : 25 unitaires (`author_conversion_service.spec.ts`) + 4 fonctionnels (`authors_conversion.spec.ts`, commandes via `ace.create`, comptages et `productions.authors`/`updated_at` inchangés). Suite complète : voir Change Log.
- Écarts : (1) mise à jour de correctif `@adonisjs/ace` 14.1.0 → 14.1.2 (lockfile) indispensable pour exécuter toute commande de `commands/` ; (2) une fiche seulement « proche » (similarité sans égalité de clé) est citée en note sans passer la ligne en `fuzzy` (AC 4) ; (3) le plan compte un lien par (production, fiche cible) même si la fiche y est déjà liée par un autre nom (cas marginal, `apply` fera `ON CONFLICT DO NOTHING`).
- Procédure d'exécution réelle (AC 9) : Dev Notes → « Procédure d'exécution réelle », à faire par Aurélien après merge ; jamais exécutée dans cette session.

### File List

- `app/services/author_conversion_service.ts` (nouveau)
- `commands/authors_propose.ts` (nouveau)
- `commands/authors_validate.ts` (nouveau)
- `tests/unit/services/author_conversion_service.spec.ts` (nouveau)
- `tests/functional/admin/authors_conversion.spec.ts` (nouveau)
- `package-lock.json` (modifié : `@adonisjs/ace` 14.1.2)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié : report « Normalisation des clés »)
- `_bmad-output/implementation-artifacts/9-5-proposition-et-validation-de-la-table-de-conversion-des-auteurs.md` (story)

## Change Log

- 2026-11-18 : création de la story (bmad-create-story), Status ready-for-dev.
- 2026-11-18 : implémentation (bmad-dev-story) — service de conversion, commandes `authors:propose` / `authors:validate`, tests ; `@adonisjs/ace` 14.1.2 ; lint, typecheck, build verts ; `npm run test:local` complet : 652 tests verts (622 avant la story). Status → review.
