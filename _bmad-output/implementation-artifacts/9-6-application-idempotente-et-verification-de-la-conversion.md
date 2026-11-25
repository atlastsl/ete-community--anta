---
baseline_commit: e35d7fd
---

# Story 9.6 : Application idempotente et vérification de la conversion

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **product owner** (Aurélien),
je veux **appliquer la table de conversion validée puis vérifier que 100 % des noms sont rattachés**,
afin que **chaque production existante conserve tous ses auteurs, dans leur ordre, rattachés à des fiches** (FR56).

## Décision de périmètre (lire en premier)

- **DANS 9.6** :
  - `app/services/production_author_service.ts` (nouveau) : `refreshDenormalizedNames(productionIds, client)` (réécriture SQL de `productions.authors` depuis le pivot) et `fullyAttachedProductionIds(authorId, client)` (garde-fou du renommage) ;
  - branchement dans `AuthorService.update` : un changement de `firstNames` / `lastNames` rafraîchit les productions de la fiche (même transaction) ;
  - `AuthorConversionService.apply(text, { dryRun })` et `AuthorConversionService.verify()` + formatage du rapport ;
  - commandes `commands/authors_apply.ts` (`authors:apply --file … [--dry-run] [--report …]`) et `commands/authors_verify.ts` (`authors:verify`) ;
  - tests unitaires (`production_author_service.spec.ts`, ajouts à `author_service.spec.ts`) et fonctionnels (`authors_conversion.spec.ts`, nouveau groupe).
- **HORS 9.6 (ne PAS implémenter)** :
  - `ProductionAuthorService.sync(productionId, authorIds)`, `authorIds` dans le validateur de production, `SelectedAuthorList` / `AuthorCombobox`, retrait des affectations `authors: data.authors` des contrôleurs, `getMissingForPublish`, seeder `seed-demo:` → **9.7** ;
  - toute modification du formulaire de production, de `production_validator.ts`, de `admin/productions_controller.ts` ;
  - toute migration (aucune n'est nécessaire : `authors.migration_key` UNIQUE et le pivot existent depuis 9.1/9.2) ; le trigger `productions_search_vector_update` et sa fonction restent **inchangés** ;
  - toute entrée du journal d'activité pour `apply` (aucun admin acteur ; traçabilité = `migration_key` + rapport) ;
  - l'exécution réelle sur Supabase (porte manuelle, voir AC 9 et Dev Notes).

## Acceptance Criteria

1. **Dénormalisation** — **Given** `ProductionAuthorService.refreshDenormalizedNames(productionIds, client?)`, **When** il est appelé, **Then** `productions.authors` de chaque production listée est réécrit en **une requête SQL** depuis le pivot : `COALESCE(jsonb_agg(btrim(a.first_names || ' ' || a.last_names) ORDER BY pa.position), '[]'::jsonb)` (colonne `NOT NULL` : pivot vide → `[]`) ; seules les lignes dont la valeur change sont mises à jour (`IS DISTINCT FROM`), `updated_at` n'est pas modifié (donnée dérivée) ; liste vide → aucun appel SQL ; le trigger `productions_search_vector_update` est inchangé et recalcule `search_vector` (la recherche full-text trouve l'auteur sous son nom rafraîchi).
2. **Renommage** — **Given** une fiche liée à des productions, **When** son prénom ou son nom change via `AuthorService.update` (Story 9.1), **Then** dans la même transaction, toutes ses productions **entièrement rattachées** (chaque nom jsonb a un auteur lié de même `matchKey`, évalué **avant** le renommage) sont rafraîchies ; une production partiellement rattachée (nom libre ajouté par l'ancien formulaire) n'est pas réécrite (aucun nom libre effacé) ; un changement d'affiliation, de Scholar ou de photo seul ne rafraîchit rien.
3. **Apply** — **Given** un CSV que `authors:validate` accepte, **When** `node ace authors:apply --file tmp/authors-conversion.csv` est exécuté, **Then** le CSV est d'abord recontrôlé par `AuthorConversionService.validate` : en cas d'erreur, rien n'est écrit, les erreurs sont affichées, code 1 **and** sinon, dans **une seule transaction** (productions verrouillées `FOR UPDATE`) :
   - chaque occurrence non rattachée (règle `matchKey`, celle de 9.5) est appariée à sa ligne CSV par `sourceKey` ;
   - cible `existing_author_slug` → cette fiche (aucune écriture sur la fiche : ni noms, ni `migration_key`) ;
   - sinon cible `author_key` → fiche de `migration_key = author_key` si elle existe (**noms jamais écrasés** ; différence signalée dans le rapport), sinon création : `first_names` / `last_names` du CSV, `migration_key = author_key`, consentement NULL, aucune affiliation (« À compléter »), `created_by_id` NULL, slug D28 (hook du modèle) ;
   - pour chaque production ayant au moins une occurrence nouvellement rattachable : liste ordonnée = cibles dans l'ordre exact du tableau jsonb, **dédoublonnée à la première occurrence** (liens existants conservés, liens existants hors noms ajoutés en fin dans leur ordre), réécrite par `DELETE` + `INSERT … ON CONFLICT DO NOTHING` avec positions 1..n (jamais d'`UPDATE` de position, P2.1) ;
   - les productions déjà entièrement rattachées sont ignorées (aucune écriture) ;
   - puis `refreshDenormalizedNames` sur les productions devenues entièrement rattachées ; une production qui garde un nom sans ligne CSV (nom ajouté entre `validate` et `apply`) reçoit ses liens mais **pas** de rafraîchissement, et figure dans le rapport (« partiellement rattachée »).
4. **Doublon dans une production** — **Given** deux noms sources d'une même production qui désignent la même fiche (fusion par `author_key` ou `existing_author_slug`), **When** `apply` s'exécute, **Then** la fiche n'y est liée qu'une fois, à la position de sa première occurrence, les positions sont 1..n, et après rafraîchissement le jsonb contient le nom de la fiche une seule fois ; `verify` compte la production comme rattachée.
5. **Rapport** — **Given** `apply` (avec ou sans `--dry-run`), **When** il se termine sans erreur, **Then** un rapport texte est écrit sous `tmp/` (défaut `tmp/authors-conversion-report-<AAAA-MM-JJTHH-MM-SS>.txt`, `--report` pour un autre chemin sous `tmp/`, refusé hors `tmp/`, jamais écrasé, mode 0600) : mode (APPLICATION / SIMULATION), fichier CSV, comptages, fiches créées (slug, `migration_key`, nom), fiches existantes utilisées (slug ; noms différents signalés), liens créés (production → fiche, position), productions ignorées (déjà rattachées), productions partiellement rattachées ; la console affiche les comptages ; **aucune entrée** dans `admin_activity_logs`.
6. **Dry-run** — **Given** `--dry-run`, **When** `apply` s'exécute, **Then** les mêmes calculs et le même rapport sont produits (marqués SIMULATION), puis la transaction est **annulée** : comptages et empreintes de `authors`, `production_authors`, `productions` inchangés.
7. **Idempotence** — **Given** `apply` exécuté deux fois avec le même CSV, **When** l'état est comparé, **Then** la seconde exécution ne crée aucune fiche ni aucun lien, ne déplace aucune position (empreintes identiques) et ignore toutes les productions **and** relancé avec un CSV complété de nouveaux noms (productions ajoutées entre-temps), seuls ces nouveaux noms sont rattachés (le CSV complet est accepté : les lignes déjà rattachées sont des avertissements « n'est plus à rattacher »).
8. **Verify** — **Given** `node ace authors:verify`, **When** il s'exécute (lecture seule, `readOnly`), **Then** il affiche : productions et occurrences contrôlées, taux de rattachement (arrondi **vers le bas**, « 100 % » seulement si tout est rattaché), productions dont un nom jsonb n'a pas d'auteur lié (slug + noms), productions aux positions incohérentes (≠ 1..n), productions dont un auteur lié n'apparaît pas dans `productions.authors` (dénormalisation désynchronisée), fiches orphelines (sans production : celles issues de la conversion — `migration_key` non NULL — listées en avertissement, celles du panel comptées), éléments vides / non textuels ignorés **and** code de sortie 0 si 100 % des occurrences sont rattachées et aucune position incohérente ni désynchronisation, 1 sinon ; base sans aucun nom → 0 (« rien à rattacher »).
9. **Porte manuelle (bloquante, hors session)** — **Given** la story terminée côté code et tests locaux, **When** la conversion est exécutée sur la base partagée, **Then** elle l'est **uniquement après validation explicite et écrite du CSV par Aurélien**, en utilisateur `atlas` sur le VPS de dev : `doppler run -- node ace authors:apply --file … --dry-run` → `apply` → `verify` = 100 % (procédure en Dev Notes) **and** le résultat (date, comptages, code de sortie de `verify`, sans aucun nom) est consigné dans cette story ; CSV et rapport restent hors dépôt **and** la même séquence est rejouée en production lors de la release « bascule » (Story 8.6 en attente).
10. **Non-régression** — suite complète `npm run test:local`, lint, typecheck et build verts ; `normalizeKey`, `matchKey`, `sourceKey`, le trigger de recherche, les écrans auteurs et productions inchangés hors ajouts ; aucun fichier de `tmp/` commité.

## Tasks / Subtasks

- [x] **T1 — `ProductionAuthorService`** (AC 1, 2)
  - [x] 1.1 `app/services/production_author_service.ts` : `refreshDenormalizedNames(productionIds: string[], client?: QueryClientContract): Promise<number>` — identifiants passés en jsonb (`jsonb_array_elements_text(?::jsonb)::uuid`, knex développe les tableaux), `UPDATE … FROM (sous-requête)` + `IS DISTINCT FROM`, renvoie le nombre de lignes modifiées ; liste vide → 0 sans requête.
  - [x] 1.2 `attachedState(productionIds, client)` (ou équivalent) : pour chaque production, noms jsonb textuels non vides et `matchKey` des auteurs liés → `fullyAttached` ; `fullyAttachedProductionIds(authorId, client)` = productions liées à la fiche et entièrement rattachées.
- [x] **T2 — Renommage** (AC 2)
  - [x] 2.1 `AuthorService.update` : si `fields` contient `lastNames` ou `firstNames`, calculer `fullyAttachedProductionIds(author.id, trx)` sous le verrou **avant** `author.save()`, puis `refreshDenormalizedNames(ids, trx)` après.
- [x] **T3 — `apply`** (AC 3–7)
  - [x] 3.1 `AuthorConversionService.apply(text, { dryRun })` → `{ errors, warnings, result? }` : `validate` d'abord (erreurs → retour sans écriture) ; puis transaction (`db.transaction()` manuel : `commit` ou `rollback` si `dryRun`, `rollback` sur exception).
  - [x] 3.2 Dans la transaction : `SELECT id, slug, authors FROM productions ORDER BY slug FOR UPDATE` ; liens existants (pivot ⨝ authors, ordre de position) ; fiches par slug / `migration_key` ; mapping CSV `sourceKey(source_name)` → ligne.
  - [x] 3.3 Résolution des cibles avec cache (une création par `author_key`) ; `Author.create({...}, { client: trx })`.
  - [x] 3.4 Par production : ordre jsonb, dédoublonnage, liens existants conservés, `DELETE` + `INSERT … ON CONFLICT DO NOTHING`, liens créés = nouveaux couples ; ignorées / partielles.
  - [x] 3.5 `refreshDenormalizedNames` sur les productions entièrement rattachées modifiées.
  - [x] 3.6 `formatApplyReport(result, meta)` (texte, français).
- [x] **T4 — `verify`** (AC 8)
  - [x] 4.1 `AuthorConversionService.verify()` dans `readOnly` → structure de rapport + `complete: boolean`.
- [x] **T5 — Commandes** (AC 3, 5, 6, 8)
  - [x] 5.1 `commands/authors_apply.ts` : `--file` (défaut `tmp/authors-conversion.csv`), `--dry-run`, `--report` ; import paresseux du service dans `run()` ; chemin du rapport sous `tmp/` (même règle que `propose`, helper partagé `resolveUnderTmp`), `wx` + 0600 ; erreurs → code 1.
  - [x] 5.2 `commands/authors_verify.ts` : affichage + `exitCode = 1` si incomplet.
- [x] **T6 — Tests** (AC 1–8, 10)
  - [x] 6.1 `tests/unit/services/production_author_service.spec.ts` : réécriture dans l'ordre, pivot vide → `[]`, prénom vide sans espace parasite, `updated_at` inchangé, recherche full-text après rafraîchissement, `fullyAttachedProductionIds`.
  - [x] 6.2 `tests/unit/services/author_service.spec.ts` : renommage → productions rafraîchies ; production partielle non réécrite ; changement d'affiliation seul sans effet.
  - [x] 6.3 `tests/functional/admin/authors_conversion.spec.ts` (nouveau groupe 9.6) : ordre conservé ; fusion par `author_key` ; rattachement à une fiche existante (noms et `migration_key` intacts) ; upsert par `migration_key` sans écraser les noms ; fiches non publiques et « À compléter » (`created_by_id` NULL, 0 affiliation) ; doublon dans une production (lien unique, positions 1..n) ; idempotence (deux exécutions = mêmes empreintes) ; CSV complété (seuls les nouveaux noms) ; `--dry-run` (empreintes inchangées, rapport SIMULATION) ; CSV invalide → code 1, rien écrit ; rapport sous `tmp/`, refus hors `tmp/` ; aucune entrée `admin_activity_logs` ; `verify` 0 à 100 %, ≠ 0 sinon (nom non rattaché, position incohérente) ; noms fictifs uniquement.
- [x] **T7 — Finitions** (AC 10)
  - [x] 7.1 `npx eslint --fix`, `npm run lint`, `npm run typecheck`, `npm run test:local` complet, build ; `git status` sans fichier de `tmp/`.
  - [x] 7.2 Story : cases, Dev Agent Record, File List, Change Log, Status → review.
- [ ] **T8 — Porte manuelle** (AC 9) : résultat de l'exécution sur la base partagée consigné dans la story (date, comptages, code de `verify`, sans nom) — **porte manuelle — en attente d'Aurélien** (validation écrite du CSV, puis procédure des Dev Notes ; hors session de dev).

### Review Findings

- [x] [Review][Patch] Éléments jsonb non textuels et valeur non tableau [author_conversion_service.ts, production_author_service.ts, authors_verify.ts] — `inspectAuthors` : une production avec un élément non textuel ou une valeur non tableau n'est jamais « entièrement rattachée » ni convertie : liens écrits le cas échéant, aucun rafraîchissement, compartiment « valeurs non textuelles conservées » du rapport ; `verify` la liste et échoue ; le renommage l'ignore, ainsi que toute production sans nom exploitable (plus de « every » vide) (amende D-9.6-h).
- [x] [Review][Patch] Renommage : verrou et décision sur la ligne verrouillée [production_author_service.ts, author_service.ts] — `fullyAttachedProductionIds(authorId, trx)` verrouille les productions candidates (`SELECT … FOR UPDATE`, ordre par id) avant d'évaluer « entièrement rattachée », dans la transaction du renommage ; « renommé » = colonne modifiée par rapport à l'instance chargée **et** différente de la ligne verrouillée.
- [x] [Review][Patch] Liens absents du jsonb republiés par le rafraîchissement [author_conversion_service.ts] — une production dont une fiche liée ne correspond à aucun nom du jsonb n'est plus modifiée (ni pivot ni jsonb, aucune fiche créée pour elle) : section « désynchronisées » du rapport (`verify` la signale déjà) ; amende D-9.6-g. Couvre aussi deux fiches homonymes liées à une même production (aucun lien perdu).
- [x] [Review][Patch] Revalidation dans la transaction d'apply [author_conversion_service.ts] — `checkRecords` (contrôle partagé avec `validate`) tourne sur la transaction d'`apply`, après le verrou des productions (`REPEATABLE READ` hors tests) ; toute erreur → rollback, erreurs retournées sans exception ; fiche `existing_author_slug` introuvable = erreur de validation (plus de `throw new Error`) ; conflit de sérialisation / interblocage (40001, 40P01) → message clair, rollback.
- [x] [Review][Patch] Rapport écrit avant le commit [author_conversion_service.ts, authors_apply.ts] — texte construit dans la transaction, écrit (`wx`, 0600, sous `tmp/`) avant le commit ; échec d'écriture → rollback, code 1 « rapport non écrit … aucune écriture en base » ; échec du commit après écriture → rapport supprimé, code 1 ; `--dry-run` produit le même rapport au libellé près, puis annule.
- [x] [Review][Patch] Liens réellement insérés [author_conversion_service.ts] — `ON CONFLICT DO NOTHING … RETURNING` : le rapport liste les lignes insérées ; un écart avec le nombre attendu est une anomalie et la production n'est pas rafraîchie (pivot incomplet jamais publié).
- [x] [Review][Patch] Positions à trous ou ordre différent du jsonb [author_conversion_service.ts] — une production entièrement rattachée dont les positions ne sont pas 1..n ou dont l'ordre diffère de l'ordre du jsonb est recompactée (`DELETE` + `INSERT` dans l'ordre du jsonb) puis rafraîchie : compartiment « réordonnées ».
- [x] [Review][Patch] Ordre du pivot non vérifié [author_conversion_service.ts, authors_verify.ts] — pour chaque production complète, `verify` compare l'ordre du pivot à la suite des fiches correspondant aux noms du jsonb (première occurrence) : « ordre incohérent », code 1.
- [x] [Review][Patch] Hygiène du rapport [author_conversion_service.ts] — « Productions examinées » = somme des compartiments (converties, réordonnées, déjà rattachées, aucun nom exploitable, partielles, non textuelles, désynchronisées, anomalies) ; une fiche atteinte par slug et par `migration_key` est listée une fois (par id, « par existing_author_slug, migration_key »).
- [x] [Review][Patch] Avertissement sur les productions laissées en l'état [authors_apply.ts] — avertissement explicite recommandant `node ace authors:verify` ; code de sortie 0 une fois la transaction validée (documenté dans la commande), `verify` reste la porte de complétude.
- [x] [Review][Patch] Tests ajoutés [authors_conversion.spec.ts, production_author_service.spec.ts, author_service.spec.ts] — un test par correctif (11, tous en échec sans le correctif), plus : CSV complété relancé → « n'est plus à rattacher » dans la sortie et le rapport ; rapport `--dry-run` identique au rapport réel au libellé et à la date près. Le chemin « production partielle » (nom ajouté après le CSV) n'est plus atteignable : la revalidation dans la transaction refuse le CSV (« absent du CSV », rien d'écrit), ce que couvrent le test de revalidation et le test « CSV invalide » ; le compartiment « partiellement rattachées » reste en garde-fou.

Écartés :
- Noms NULL dans la concaténation : colonnes `first_names` / `last_names` NOT NULL.
- Colonnes de pivot perdues au `DELETE` + `INSERT` : le pivot n'a que `production_id`, `author_id`, `position`.
- Slug hors transaction : le hook de slug utilise `author.$trx`.
- Homonymes co-auteurs d'une même production confondus : cas extrême, contrôlé sur le CSV (aucun lien n'est plus perdu : voir « désynchronisées »).

Reportés :
- [x] [Review][Defer] Interblocage possible entre `apply` et un renommage concurrent — procédure : geler les modifications admin pendant `apply`, relancer `verify` juste après (l'interblocage éventuel est annulé proprement, message « modification concurrente ») — voir `deferred-work.md`.
- [x] [Review][Defer] Renommage d'une fiche liée à une production partiellement rattachée : ancien nom conservé jusqu'au prochain `propose` / `apply` (question ouverte à Aurélien) — voir `deferred-work.md`.

Revue de code close : la porte manuelle T8 (exécution sur la base partagée) reste non cochée, en attente d'Aurélien ; elle ne bloque pas le statut `done` de la revue de code.

## Dev Notes

### Contraintes non négociables

- **Base Supabase partagée** : aucune migration, jamais `doppler run` dans une session de dev ; essais manuels uniquement sur la base locale (`/tmp/d37/local.sh node ace …`, port 5433).
- **Tests** : `npm run test:local [-- unit|functional]`, jamais `--files`.
- **Dépôt public** : noms manifestement fictifs ; CSV et rapports seulement sous `tmp/` (ignoré : `tmp/*`), dossier de test unique supprimé en `cleanup`.
- `normalizeKey`, `sourceKey`, `matchKey` inchangés : ils définissent « rattaché » pour `propose`, `validate`, `apply`, `verify` et le renommage.

### Décisions (prises par défaut)

- **D-9.6-a — Rattachement à `existing_author_slug` sans écriture** : la fiche (panel ou conversion antérieure) n'est jamais modifiée — ni noms, ni `migration_key` (une fiche du panel garde `migration_key` NULL ; la traçabilité est le rapport). `validate` refuse déjà un `author_key` qui est la `migration_key` d'une autre fiche (9.5).
- **D-9.6-b — Upsert par `migration_key` sans écraser** : une fiche de même `migration_key` est réutilisée telle quelle (elle a pu être corrigée dans le panel depuis) ; si les noms du CSV diffèrent, le rapport le signale (« noms du CSV ignorés »).
- **D-9.6-c — Nom dénormalisé `btrim(first_names || ' ' || last_names)`** : l'expression de P2.1 avec `btrim` pour les fiches sans prénom (D-9.5-d) : « FICTIF » et non « ␣FICTIF ». `matchKey` ignore les espaces : sans effet sur la règle « rattaché ».
- **D-9.6-d — `updated_at` des productions inchangé** par le rafraîchissement (donnée dérivée, pas une modification éditoriale) ; seules les lignes dont le jsonb change sont mises à jour (le trigger de recherche ne tourne que pour elles).
- **D-9.6-e — `apply` revalide le CSV** et refuse toute erreur (« Given un CSV validé ») ; une production qui garde un nom sans ligne CSV n'est jamais rafraîchie (sinon le nom libre serait effacé du jsonb) : elle est « partiellement rattachée » dans le rapport et fait échouer `verify`.
- **D-9.6-f — Renommage : seules les productions entièrement rattachées sont rafraîchies** (même raison ; d'ici la bascule 9.7, l'ancien formulaire peut encore ajouter un nom libre à une production convertie). Une production partielle garde l'ancien nom ; un `propose` / `apply` ultérieur la traite.
- **D-9.6-g — Liens existants conservés** : liste finale = cibles des noms dans l'ordre jsonb ; réécriture `DELETE` + `INSERT` (P2.1). *Amendé en revue* : une production ayant un lien dont la fiche ne correspond à aucun nom du jsonb n'est plus touchée (rapport « désynchronisées ») au lieu d'ajouter ce lien en fin.
- **D-9.6-h — `verify` échoue aussi** sur positions incohérentes et désynchronisation pivot/jsonb (intégrité) ; les fiches orphelines ne font jamais échouer (une fiche du panel peut ne pas avoir de production) ; vides : comptés, sans échec (le rafraîchissement les retire). *Amendé en revue* : valeurs non textuelles (élément non chaîne, valeur non tableau) jamais rafraîchies, donc listées et en échec ; échec aussi sur un ordre du pivot différent de l'ordre du jsonb.
- **D-9.6-i — Rapport horodaté à la seconde** (`<date>` de l'AC = `AAAA-MM-JJTHH-MM-SS`, UTC) pour ne jamais écraser le rapport d'un dry-run ; `--report` pour les tests.
- **D-9.6-j — Verrou** : `SELECT … FROM productions … FOR UPDATE` dans la transaction d'`apply` (quelques centaines de lignes) : une édition concurrente par l'ancien formulaire attend la fin de la conversion.

### Fichiers à modifier — état actuel et préservation

- `app/services/author_service.ts` — `update` : compare `before`/`after` (noms trimés), verrouille la fiche `FOR UPDATE`, sauvegarde, remplace les affiliations, gère photo et consentement. **Change** : calcul des productions à rafraîchir avant `save`, rafraîchissement après. **Préserver** : retour anticipé sans changement, verrou, D27, photo (upload avant / suppression après commit), `fields` (journal `update` du contrôleur inchangé).
- `app/services/author_conversion_service.ts` (9.5) — **ajouts seulement** : `apply`, `verify`, `formatApplyReport`, `resolveUnderTmp` ; réutiliser `parseCsv`, `validate`, `sourceKey`, `matchKey`, `readOnly`, `existingAuthors`. Le docblock d'en-tête est mis à jour (9.6).
- `commands/authors_propose.ts` — peut réutiliser `resolveUnderTmp` (comportement identique, tests 9.5 verts).
- Non modifiés : trigger `productions_search_vector_update` (migration `1775918743000_subdomain_to_jsonb_array.ts`, indexe `authors::text`, `BEFORE INSERT OR UPDATE` → se déclenche sur l'`UPDATE` SQL du rafraîchissement), modèle `Production` (`authorNames` = colonne `authors` jsonb NOT NULL ; relation `authors` manyToMany `pivotColumns: ['position']`), contrôleurs.

### Détails d'implémentation (pièges)

- **Transactions** : en test, une transaction globale est ouverte → `db.transaction()` est un savepoint ; `rollback()` en dry-run annule le savepoint seulement. `apply` utilise `const trx = await db.transaction()` + `try { …; dryRun ? await trx.rollback() : await trx.commit() } catch (e) { await trx.rollback(); throw e }`.
- **Ordre des appels** : `validate` ouvre sa propre transaction en lecture seule **avant** la transaction d'écriture (pas d'imbrication READ ONLY dans la transaction d'écriture).
- **Tableaux knex** : passer les identifiants en `JSON.stringify(ids)` + `jsonb_array_elements_text(?::jsonb)` (patron de `similarPairs`).
- **Positions** : contrainte `UNIQUE (production_id, position)` non différable → `DELETE` de toutes les lignes de la production puis `INSERT` multi-lignes.
- **Création de fiche** : `Author.create({ firstNames, lastNames, migrationKey, createdById: null }, { client: trx })` — hooks `normalizeSearchName` et `assignSlug` (slug via `author.$trx`). Pas d'`AuthorService.create` (pas de photo, pas de journal, pas de retry de slug : un seul écrivain dans la transaction).
- **Commandes** : import paresseux du service dans `run()` (Ace charge les modules avant le boot) ; `static options = { startApp: true }` ; `this.exitCode = 1` ; tests `ace.create(Cmd, argv)` + `ace.ui.switchMode('raw')`, `assertSucceeded/assertFailed/assertLogMatches`.
- **Recherche** : `search_vector @@ websearch_to_tsquery('simple', 'fictif')` après rafraîchissement (config `simple` du trigger).
- **Taux** : `Math.floor(attached * 10000 / total) / 100` → « 99,99 % » jamais arrondi à 100.

### Procédure d'exécution réelle (AC 9 — porte manuelle, après merge et validation écrite d'Aurélien)

1. Le CSV validé par Aurélien (accord **écrit**) est déposé sous `tmp/` du dépôt sur le VPS de dev, utilisateur `atlas`.
2. `doppler run -- node ace authors:validate --file tmp/authors-conversion.csv` → code 0.
3. `doppler run -- node ace authors:apply --file tmp/authors-conversion.csv --dry-run` → lire le rapport `tmp/authors-conversion-report-…txt` (SIMULATION) ; le transmettre à Aurélien hors dépôt si besoin.
4. `doppler run -- node ace authors:apply --file tmp/authors-conversion.csv` → rapport APPLICATION.
5. `doppler run -- node ace authors:verify` → code 0, « 100 % ».
6. Consigner ici (section « Résultat de la porte manuelle ») : date, comptages (fiches créées / existantes, liens, productions traitées / ignorées), taux et code de `verify` — **aucun nom**. CSV et rapports restent sous `tmp/`, jamais commités ni joints à une PR.
7. Production : même séquence lors de la release « bascule » (Story 8.6 en attente).

### Intelligence des stories précédentes (9.1–9.5)

- 9.5 : `matchKey` est la règle unique « rattaché » (D-9.5-b amendé) ; `sourceKey` apparie CSV et jsonb ; `readOnly` = `REPEATABLE READ, READ ONLY` (READ ONLY seul en savepoint) ; CSV `;` BOM, neutralisation des formules (`'`) retirée par `parseCsv` ; `validate` : stale = avertissement, `author_key`/slug contradictoires = erreur ; plan approximatif pour les liens déjà présents (report 9.5 → rapport exact ici, liens réellement insérés).
- 9.5 : écriture de fichier `wx` + `chmod 0600` ; chemin `--out` sous `tmp/` (`path.relative`).
- 9.1 : `AuthorService.update` verrouille la fiche ; `firstNames` min 1 au validateur (une fiche migrée sans prénom doit être complétée avant modification).
- Conventions : docblocks anglais dans `app/`, messages CLI et commentaires de tests en français, « Fictitious names only (public repository) » en tête des specs ; tests DB : `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` par test.

### Git (branche `feat/epic-9-authors`)

- Derniers commits : `209953e`/`e35d7fd` (9.5), `2e64de2`/`3dac3cd` (9.4), `744296a`/`840c6bf` (9.3). Message : `feat(authors): … (story 9.6)`. Pas de push (après test d'Aurélien).

### Project Structure Notes

- Nouveaux : `app/services/production_author_service.ts`, `commands/authors_apply.ts`, `commands/authors_verify.ts`, `tests/unit/services/production_author_service.spec.ts`.
- Modifiés : `app/services/author_service.ts`, `app/services/author_conversion_service.ts`, `commands/authors_propose.ts` (helper partagé), `tests/unit/services/author_service.spec.ts`, `tests/functional/admin/authors_conversion.spec.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.6] (+ règles communes Epic 9 ; 9.7 pour le hors-périmètre)
- [Source: architecture.md#P2.1] (`productions.authors` expand/contract, tables ordonnées DELETE + INSERT) ; [#P2.2] (`apply`, `verify`, exécution) ; P2-02, P2-05
- [Source: 9-5-proposition-et-validation-de-la-table-de-conversion-des-auteurs.md] (D-9.5-b, D-9.5-d, Review Findings) ; [deferred-work.md] (report 9.5 « liens comptés approximativement »)
- Code : `app/services/author_conversion_service.ts`, `app/services/author_service.ts`, `app/models/{author,production}.ts`, `database/migrations/1775918743000_subdomain_to_jsonb_array.ts`, `database/migrations/1775918747000_create_production_authors_table.ts`, `commands/authors_{propose,validate}.ts`

## Questions ouvertes (non bloquantes, défauts retenus)

1. Fiche existante pointée par `existing_author_slug` : pas de `migration_key` écrite (D-9.6-a).
2. Upsert par `migration_key` : noms non écrasés, différence signalée (D-9.6-b).
3. Rafraîchissement au renommage limité aux productions entièrement rattachées (D-9.6-f).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Import circulaire `author_conversion_service` ↔ `production_author_service` : sans effet (aucune utilisation au niveau module, liaisons ESM résolues à l'appel) ; les commandes importent toujours le service paresseusement dans `run()`.
- `--dry-run` : drapeau Ace dérivé de la propriété `dryRun` (dash-case) ; vérifié par `node ace authors:apply --help` (base locale).
- Essai manuel sur la base locale (port 5433) : `node ace list` liste les quatre commandes ; `authors:verify` sur base vide → « Rien à rattacher (100 %) », code 0.
- Aucune exécution sous `doppler run`, aucune connexion à Supabase.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `ProductionAuthorService` : `refreshDenormalizedNames` (un `UPDATE … FROM` SQL, `btrim(first_names || ' ' || last_names)` ordonné par position, `[]` si pivot vide, `IS DISTINCT FROM`, `updated_at` inchangé, identifiants passés en jsonb), `attachmentStates` / `fullyAttachedProductionIds` (règle `matchKey`). Trigger de recherche non modifié ; test full-text après rafraîchissement.
- `AuthorService.update` : sur changement de prénom / nom, productions entièrement rattachées calculées sous le verrou avant `save`, rafraîchies après, même transaction (D-9.6-f).
- `AuthorConversionService` : `namesOf`, `resolveUnderTmp` (réutilisé par `authors:propose`), `apply` (revalidation, transaction unique, productions `FOR UPDATE`, upsert par `migration_key` sans écrasement, rattachement par slug sans écriture, ordre jsonb, dédoublonnage à la première occurrence, `DELETE` + `INSERT … ON CONFLICT DO NOTHING` positions 1..n, productions déjà rattachées ignorées, partielles non rafraîchies, `refreshDenormalizedNames`), `formatApplyReport`, `verify` (taux arrondi vers le bas, non rattachés, positions, désynchronisation, orphelines).
- Commandes `authors:apply` (`--file`, `--dry-run`, `--report` sous `tmp/`, `wx` + 0600, rapport `tmp/authors-conversion-report-<AAAA-MM-JJTHH-MM-SS>.txt`) et `authors:verify` (code 1 si incomplet/incohérent). Aucune entrée de journal d'activité (testé).
- Tests : 5 unitaires `production_author_service.spec.ts`, 2 unitaires `author_service.spec.ts` (renommage), 8 fonctionnels `authors_conversion.spec.ts` (groupe 9.6). Suite complète : 683 tests verts (668 avant), lint, typecheck, build verts (`build/commands/authors_{apply,verify}.js`).
- Écarts assumés (décisions de la story) : `btrim` dans l'expression de P2.1 (D-9.6-c) ; rapport horodaté à la seconde + `--report` (D-9.6-i) ; `verify` échoue aussi sur positions incohérentes / désynchronisation (D-9.6-h).
- Porte manuelle (AC 9, T8) non exécutée : en attente de la validation écrite du CSV par Aurélien ; procédure dans les Dev Notes.

### File List

- `app/services/production_author_service.ts` (nouveau)
- `app/services/author_conversion_service.ts` (modifié : apply, verify, rapport, helpers)
- `app/services/author_service.ts` (modifié : rafraîchissement au renommage)
- `commands/authors_apply.ts` (nouveau)
- `commands/authors_verify.ts` (nouveau)
- `commands/authors_propose.ts` (modifié : helper `resolveUnderTmp`)
- `tests/unit/services/production_author_service.spec.ts` (nouveau)
- `tests/unit/services/author_service.spec.ts` (modifié)
- `tests/functional/admin/authors_conversion.spec.ts` (modifié : groupe 9.6)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié : report 9.5 traité)
- `_bmad-output/implementation-artifacts/9-6-application-idempotente-et-verification-de-la-conversion.md` (story)

## Change Log

- 2026-11-18 : création de la story (bmad-create-story), Status ready-for-dev.
- 2026-11-18 : implémentation (bmad-dev-story) — `ProductionAuthorService`, rafraîchissement au renommage, `authors:apply` / `authors:verify`, tests ; lint, typecheck, build verts ; `npm run test:local` complet : 683 tests verts (668 avant). Porte manuelle en attente d'Aurélien. Status → review.
- 2026-11-18 : revue de code (bmad-code-review) — 11 correctifs (valeurs non textuelles, verrou du renommage, désynchronisées intouchées, revalidation dans la transaction, rapport avant commit, liens insérés comptés, recompactage, ordre vérifié, hygiène du rapport, avertissement), 2 reports, 4 écartés ; `npm run test:local` complet : 695 tests verts (683 avant) ; lint, typecheck, build verts. Status → done (porte manuelle T8 toujours en attente d'Aurélien).
