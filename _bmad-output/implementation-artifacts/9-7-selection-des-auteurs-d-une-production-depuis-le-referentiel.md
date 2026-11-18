---
baseline_commit: 7789cf7
---

# Story 9.7 : Sélection des auteurs d'une production depuis le référentiel (bascule)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur**,
je veux **choisir les auteurs d'une production parmi les fiches enregistrées et les ordonner**,
afin que **chaque production soit rattachée à des auteurs identifiés, sans saisie libre** (FR17, FR21, FR54, D18).

## Décision de périmètre (lire en premier)

- **DANS 9.7** :
  - `GET /admin/authors/search` (`admin.authors.search`, JSON ≤ 10) dans `admin/authors_controller.ts`, réutilisant `AuthorService.applyListFilters` / `applyListOrder` ;
  - `ProductionAuthorService.sync(productionId, authorIds, trx)` (pivot DELETE + INSERT, rafraîchissement de `productions.authors`, garde « production non convertie ») et `ProductionAuthorService.count(productionId, client)` ;
  - `production_validator.ts` : `authorIds` (uuid, distincts, optionnel) ; `authors` reste accepté mais **ignoré** (contract hors Phase 2) ;
  - `admin/productions_controller.ts` : `store` / `update` en transaction + `sync`, plus aucune écriture de `authorNames` depuis la requête ; `edit` renvoie les auteurs du pivot (ordonnés) et l'état « à rattacher » ; `publish` et la dépublication automatique comptent le pivot ;
  - `ProductionService.getMissingForPublish(production, hasFile, hasLink, authorsCount)` (FR21 sur le pivot) ; `inertia/lib/production_completion.ts` aligné (`hasRequiredAuthors`) ;
  - front : `inertia/components/admin/AuthorCombobox.tsx`, `SelectedAuthorList.tsx`, fieldset « Auteurs » de `ProductionForm.tsx` (ChipInput gardé pour tags/sous-domaines), pages `Create.tsx` / `Edit.tsx` (payload `authorIds`), i18n `authors.picker.*` + `productions.form.completion.authors` (FR/EN) ;
  - seeder de démo : fiches fictives `seed-demo:` + `sync`, purge idempotente ;
  - tests (fonctionnels, unitaires, lecture de source).
- **HORS 9.7 (ne PAS implémenter)** :
  - option / bouton « Créer un auteur », `AuthorFormDialog`, `POST /admin/authors/quick` → **9.8** ;
  - lecture du pivot sur le site public (cartes, détail, filtre `author=<slug>`, `AuthorByline`) → **Epic 10** (le site public lit toujours `authorNames`) ;
  - « contract » : retrait de `authors: string[]` du validateur, de `distinctSuggestions().authors`, de la colonne → release ultérieure ;
  - toute migration (le pivot existe depuis 9.2) ; aucune nouvelle dépendance npm (combobox écrit à la main, pas de CLI shadcn) ;
  - le déploiement staging (porte manuelle, AC 10).

## Acceptance Criteria

1. **Recherche** — **Given** `GET /admin/authors/search?q=&exclude[]=` (`admin.authors.search`, groupe `middleware.admin()`), **When** il est appelé avec un `q` d'au moins 2 caractères (après `trim`), **Then** il renvoie en JSON `{ authors: [...] }` ≤ 10 éléments `{ id, name, firstNames, lastNames, primaryInstitution, primaryDepartment, isIncomplete, isPublic, photoUrl }` (`name` = « prénoms noms » saisis ; `photoUrl` = URL signée de `w128.webp` ou `null`), recherche insensible à la casse et aux accents (`search_name` : `LIKE` ou `similarity > 0,3`, `applyListFilters`), triés préfixe d'abord, puis similarité, puis nom, prénom, id (`applyListOrder`), les auteurs de `exclude[]` écartés (UUID valides seulement, `exclude` simple ou répété accepté) **and** `q` < 2 caractères → `{ authors: [] }` sans requête ; non authentifié → redirection `/admin/login`.
2. **Fieldset Auteurs** — **Given** le formulaire de production (création et édition), **When** il s'affiche, **Then** le champ « Auteur(s) » est `SelectedAuthorList` + `AuthorCombobox` (maquette `admin-author-picker.html`) ; `ChipInput` reste pour les tags et sous-domaines ; aide « Sélectionnez les auteurs dans l'ordre de la publication… ».
3. **Combobox** — **Given** `AuthorCombobox`, **Then** motif ARIA 1.2 : `input role="combobox"` (`aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`), `role="listbox"` / `role="option"` (`aria-selected`) ; recherche dès 2 caractères, anti-rebond 250 ms, requête précédente annulée (`AbortController`), `Loader2` pendant la recherche ; option = avatar `sm` (`alt=""`) + « Prénom NOM » + 1re affiliation « Institution — Département » (ou « Aucune affiliation ») + badge « À compléter » ; « Aucun auteur trouvé. » ; « Recherche indisponible, réessayez. » en cas d'erreur ; ↑ ↓ parcourent, Entrée sélectionne (sans soumettre le formulaire), Échap ferme puis vide ; la saisie se vide après sélection ; les auteurs déjà sélectionnés sont exclus (`exclude[]`) ; URL par `urlFor('admin.authors.search', {}, { qs })`.
4. **Liste sélectionnée** — **Given** `SelectedAuthorList`, **Then** ajout en fin de liste ; ↑ ↓ déplacent d'un rang (indisponibles aux extrémités), × retire ; boutons nommés « Monter {nom} », « Descendre {nom} », « Retirer {nom} » ; le focus reste sur le bouton actionné (retrait : bouton × suivant, sinon précédent, sinon champ de recherche) ; région `aria-live="polite"` : « {nom} déplacé en position {n}. » (et « {nom} retiré. ») ; pas de glisser-déposer, pas de lien vers la fiche.
5. **Enregistrement** — **Given** une production (brouillon ou publiée), **When** l'administrateur enregistre avec `authorIds` ordonnés, **Then** le validateur accepte `authorIds` (`vine.array(vine.string().uuid()).distinct().optional()`) et `ProductionAuthorService.sync` remplace les lignes pivot (positions 1..n, `DELETE` + `INSERT`) et rafraîchit `productions.authors` (`refreshDenormalizedNames`, 9.6) **dans la même transaction** que l'enregistrement de la production ; identifiant inconnu → erreur de validation `authorIds` (`productions.form.errors.author_unknown`), rien n'est écrit ; doublon ou non-UUID → erreur de validation.
6. **Rechargement** — **Given** le formulaire d'édition, **Then** les auteurs sont relus depuis le pivot, dans l'ordre (même forme que la recherche).
7. **Colonne jamais écrite depuis la requête** — **Given** `store` / `update`, **Then** les affectations `authorNames: data.authors ?? []` / `production.authorNames = data.authors ?? []` sont retirées ; un champ `authors` reçu est ignoré ; seul `ProductionAuthorService` écrit la colonne ; `authorIds` absent en `update` → pivot inchangé.
8. **Brouillon sans auteur / publication** — **Given** un brouillon sans auteur, **When** il est enregistré, **Then** il est accepté (FR20) ; `CompletionIndicator` affiche « Au moins un auteur » ; la publication est refusée tant que le pivot est vide (`getMissingForPublish` reçoit le nombre de lignes pivot) ; `production_completion.ts` aligné.
9. **Production non convertie** — **Given** `productions.authors` non vide et 0 ligne pivot, **When** le formulaire est ouvert, **Then** un avertissement « Auteurs à rattacher » affiche les noms actuels **and** enregistré sans auteur sélectionné, `sync` ne touche ni au pivot ni à la colonne (aucun nom effacé) ; une production publiée non convertie n'est pas dépubliée automatiquement pour le seul critère « auteurs » (les autres critères s'appliquent).
10. **Seeder de démo** — **Given** `database/seeders/production_demo_seeder.ts` (base **locale** uniquement), **When** il est exécuté, **Then** il crée des fiches fictives (noms inventés, `migration_key` `seed-demo:<n>`), 1 ou 2 affiliations, une partie à consentement confirmé, et rattache chaque production de démo par `ProductionAuthorService.sync` (pivot et colonne cohérents) **and** un nouveau passage purge d'abord les productions de démo puis les fiches `seed-demo:` (idempotent, aucune autre donnée touchée).
11. **Site public** — **Given** une production enregistrée via le nouveau formulaire, **Then** l'affichage public est inchangé (il lit `authorNames`) et la recherche full-text trouve l'auteur sélectionné.
12. **Porte manuelle (bloquante)** — **Given** la story prête à partir en staging, **Then** elle n'est déployée en staging (et n'est utilisée en dev contre la base partagée pour éditer des productions) **qu'après** `authors:apply` + `authors:verify` à 100 % (9.6) ; `authors:verify` est relancée juste après le déploiement et son résultat consigné ici (date, taux, code de sortie, sans nom).
13. **Non-régression** — suite complète `npm run test:local`, lint, typecheck et build verts ; aucune nouvelle dépendance dans `package.json` ; `.adonisjs/*` régénérés et commités.

## Tasks / Subtasks

- [x] **T1 — `ProductionAuthorService`** (AC 5, 7, 9)
  - [x] 1.1 `sync(productionId, authorIds, trx)` → `{ protected: boolean; changed: boolean }` : verrou `SELECT id, authors FROM productions WHERE id = ? FOR UPDATE` (décisions sur la ligne verrouillée) ; liens actuels (ordre de position) ; `authorIds` vide + 0 lien + noms jsonb non vides → `protected`, aucune écriture ; identifiants vérifiés `SELECT id FROM authors … FOR SHARE` (inconnu → `E_VALIDATION_ERROR` `authorIds`) ; ordre identique → pas de réécriture du pivot ; sinon `DELETE` + `INSERT` positions 1..n ; puis `refreshDenormalizedNames([id], trx)`.
  - [x] 1.2 `count(productionId, client)` (lignes pivot).
- [x] **T2 — Validateur et service de production** (AC 5, 8)
  - [x] 2.1 `authorIds` dans `draftProductionValidator` + type `DraftProductionPayload` ; messages `authorIds.*` → `productions.form.errors.authors_invalid`.
  - [x] 2.2 `getMissingForPublish(production, hasFile, hasLink, authorsCount)` : `authors` manquant si `authorsCount === 0`.
- [x] **T3 — Contrôleur de productions** (AC 5–9)
  - [x] 3.1 `store` : transaction `Production.create({ …, authorNames: [] }, { client: trx })` + `sync`.
  - [x] 3.2 `update` : transaction, production verrouillée, champs assignés (jamais `authorNames`), `sync` si `authorIds` fourni, dépublication automatique sur le pivot (critère auteurs ignoré si non convertie protégée), `save`, journal après commit.
  - [x] 3.3 `edit` : `authors` = pivot ordonné (forme recherche, photo signée `w128`) ; `legacyAuthorNames` = noms jsonb si 0 ligne pivot, sinon `[]`.
  - [x] 3.4 `publish` : `authorsCount` du pivot.
- [x] **T4 — Recherche** (AC 1)
  - [x] 4.1 Route `GET authors/search` → `AuthorsController.search` (`admin.authors.search`), sérialisation partagée `pickerAuthor` (réutilisée par `edit` de production : `AuthorService.toPickerOption` ou helper équivalent).
- [x] **T5 — Front** (AC 2–4, 6, 8, 9)
  - [x] 5.1 `AuthorCombobox.tsx` (ARIA 1.2, anti-rebond, annulation, états chargement / vide / erreur).
  - [x] 5.2 `SelectedAuthorList.tsx` (↑ ↓ ×, focus, `aria-live`).
  - [x] 5.3 `ProductionForm.tsx` : `ProductionFormData.authors: PickerAuthor[]`, fieldset, avertissement « Auteurs à rattacher », statut « Au moins un auteur » ; `production_completion.ts` `hasRequiredAuthors` ; `production_submit.ts` `toProductionPayload` (→ `authorIds`) ; `Create.tsx` / `Edit.tsx` (`transform`).
  - [x] 5.4 i18n FR/EN : `authors.picker.*`, `productions.form.completion.authors`, `productions.form.errors.author_unknown`, `productions.form.errors.authors_invalid`, `productions.form.authors_hint`.
- [x] **T6 — Seeder** (AC 10) : fiches `seed-demo:`, affiliations, consentement partiel, `sync`, purge productions puis fiches.
- [x] **T7 — Tests** (AC 1–11, 13)
  - [x] 7.1 `tests/functional/admin/productions_authors.spec.ts` (nouveau) : sync ordonné à la création et à l'édition, réordonnancement, identifiant inconnu (rien d'écrit), doublon refusé, `authors` reçu ignoré, `authorIds` absent → pivot inchangé, brouillon sans auteur accepté, publication refusée sans pivot puis acceptée, non convertie protégée (+ pas de dépublication automatique pour les auteurs), édition : props `authors` ordonnés et `legacyAuthorNames`, recherche full-text publique après sync ; `search` : accents, casse, exclusion, limite 10, tri préfixe, `photoUrl` (null / signée), q < 2, non authentifié.
  - [x] 7.2 `tests/unit/services/production_author_service.spec.ts` : `sync` (positions, inchangé, protection, vidage d'une production convertie).
  - [x] 7.3 `tests/unit/seeders/production_demo_seeder.spec.ts` : fiches `seed-demo:`, pivot rempli et cohérent avec la colonne, purge idempotente, autres données intactes.
  - [x] 7.4 `tests/unit/lib/production_completion.spec.ts`, `tests/unit/services/production_service.spec.ts` (4e argument), specs existantes `productions_create/edit/publish` adaptées (pivot).
  - [x] 7.5 `tests/unit/components/author_picker.spec.ts` (lecture de source : `role="combobox"`, `aria-activedescendant`, `aria-live`, boutons nommés, 250 ms, `Loader2`, `urlFor`, pas de `draggable`), parité i18n.
- [x] **T8 — Finitions** (AC 13) : `/tmp/d37/gen.sh` (registre Tuyau), lint, typecheck, build, suite complète ; `package.json` inchangé ; story (Dev Agent Record, File List, Change Log) → `review`.
- [ ] **T9 — Porte manuelle** (AC 12) : déploiement staging après `authors:apply` + `authors:verify` à 100 %, `verify` relancée après déploiement, résultat consigné — **porte manuelle — en attente d'Aurélien**.

## Dev Notes

### Contraintes non négociables

- Base Supabase partagée : **aucune migration**, jamais `doppler run` ; tests `npm run test:local` (Docker 5433) ; essais manuels `/tmp/d37/local.sh node ace …`.
- Dépôt public : noms d'auteurs manifestement fictifs dans les tests **et** le seeder (le seeder actuel contient des noms réels de personnalités dans `productions.authors` : les fiches `seed-demo:` utilisent des noms inventés et le jsonb est réécrit depuis le pivot par `sync`).
- Aucune dépendance npm nouvelle ; pas de CLI shadcn (elle a déjà ajouté une dépendance `cn` parasite) ; combobox ARIA écrit à la main avec `Input`, `Badge`, `Avatar`, `lucide-react` (`Search`, `Loader2`, `ArrowUp`, `ArrowDown`, `X`).
- Frontière TS6305 : composants et `inertia/lib/*` testés par lecture de source.

### Décisions (prises par défaut)

- **D-9.7-a — Réponse `{ authors: [...] }`** (objet extensible), champs de l'AC + `firstNames` / `lastNames` (initiales de l'avatar, « Prénom NOM » formaté côté client par `formatAuthorName`, D13/D34) et `primaryDepartment` (« Institution — Département », DESIGN.md).
- **D-9.7-b — Recherche non indexée conservée** (`LIKE '%t%' OR similarity`, report 9.2) : quelques centaines de fiches, `limit(10)` ; le report reste ouvert dans `deferred-work.md`.
- **D-9.7-c — `sync` dans la transaction du contrôleur** : la production est verrouillée `FOR UPDATE`, les fiches `FOR SHARE` (une suppression concurrente de fiche attend ; FK `RESTRICT` en dernier garde-fou). Identifiant inconnu = `E_VALIDATION_ERROR` levée dans la transaction → rollback complet (création comprise) et retour au formulaire avec l'erreur.
- **D-9.7-d — Protection des productions non converties** : `authorIds` vide + 0 lien + jsonb non vide → aucune écriture ; avertissement « Auteurs à rattacher » (noms actuels listés) tant que la sélection est vide. Dès qu'un auteur est sélectionné, la sélection remplace les anciens noms (choix explicite de l'admin).
- **D-9.7-e — Dépublication automatique** (règle D1 de 4.7) : calculée sur le pivot ; pour une production non convertie protégée, le critère « auteurs » est neutralisé (on ne dépublie pas une production publiée à cause du retard de conversion) ; `publish` reste strict (pivot vide → refus, FR21).
- **D-9.7-f — `authorIds` absent en `update`** → pivot inchangé (PUT partiel d'un client ancien sans effacement) ; le formulaire envoie toujours `authorIds` (éventuellement `[]`).
- **D-9.7-g — Ordre inchangé** → pas de `DELETE`/`INSERT` (aucune écriture inutile) ; `refreshDenormalizedNames` est toujours appelé (`IS DISTINCT FROM` : resynchronise une colonne désynchronisée sans coût).
- **D-9.7-h — Indisponible aux extrémités** : boutons ↑/↓ avec `aria-disabled="true"` (et non `disabled`) pour que le focus reste sur le bouton actionné quand l'auteur atteint une extrémité (EXPERIENCE.md : focus conservé) ; le clic est sans effet.
- **D-9.7-i — Production partiellement rattachée** (pivot non vide + noms libres en plus) : le formulaire montre le pivot ; enregistrer réécrit la colonne depuis le pivot. Après `verify` à 100 % ce cas n'existe pas (porte manuelle).
- **D-9.7-j — Seeder** : 24 fiches fictives `seed-demo:1..24`, 1–2 affiliations fictives, un tiers à consentement confirmé (`consent_confirmed_by_id` NULL) ; chaque production : 1–3 auteurs distincts par `sync` ; purge : productions `SEED_DEMO` d'abord (CASCADE pivot), puis fiches `migration_key LIKE 'seed-demo:%'`.

### Fichiers à modifier — état actuel et préservation

- `app/controllers/admin/productions_controller.ts` — `store` crée sans transaction avec `authorNames: data.authors ?? []` ; `update` assigne `production.authorNames = data.authors ?? []`, dépublie automatiquement si `getMissingForPublish` non vide, journalise `update` (+ `unpublish`) ; `edit` renvoie `authors: production.authorNames`. **Préserver** : FR22 (statut jamais modifié hors dépublication auto), flashs, redirections, journal, taxonomie (`assertProductionTaxonomy`), index (liste admin lit toujours `authorNames`).
- `app/services/production_service.ts` — `getMissingForPublish` lit `production.authorNames` → 4e argument `authorsCount`. `distinctSuggestions` inchangé (contract plus tard).
- `app/validators/admin/production_validator.ts` — ajout `authorIds` ; `authors` gardé (ignoré).
- `app/services/production_author_service.ts` (9.6) — ajouts `sync`, `count` ; `refreshDenormalizedNames`, `attachmentStates`, `fullyAttachedProductionIds` inchangés.
- `app/controllers/admin/authors_controller.ts` — ajout `search` ; `photoUrl` privé réutilisé.
- `inertia/components/admin/ProductionForm.tsx` — `ChipField({ name: 'authors' })` remplacé ; `ProductionFormData.authors: string[]` → `PickerAuthor[]` ; `ChipField` reste pour `tags` / `subdomain` (type `name` réduit).
- `inertia/pages/admin/Productions/{Create,Edit}.tsx` — `transform(toProductionPayload)` ; Edit reçoit `legacyAuthorNames`.
- `database/seeders/production_demo_seeder.ts` — ajout fiches + `sync`.
- Tests existants impactés : `productions_create.spec.ts` (attente `authorNames` depuis `authors`), `productions_edit.spec.ts`, `productions_publish.spec.ts` (publication → pivot requis), `production_service.spec.ts` (signature).

### Détails d'implémentation (pièges)

- `Production.create(…, { client: trx })` ; `production.useTransaction(trx)` ; `db.transaction(async (trx) => …)` ; `ActivityLogService.log` **après** le commit.
- `refreshDenormalizedNames` fait un `UPDATE` SQL : ne jamais assigner `authorNames` sur l'instance (sinon `save()` écraserait la colonne).
- `E_VALIDATION_ERROR` de `@vinejs/vine` (`errors.E_VALIDATION_ERROR([{ field, message, rule }])`) → Inertia : redirection arrière avec `errors.authorIds`.
- Tableaux knex : identifiants en jsonb (`jsonb_array_elements_text(?::jsonb)::uuid`), patron 9.6.
- Relation `Production.authors` : tri par position seulement si `!query.isRelatedSubQuery` (déjà en place) ; `preload('authors', (q) => q.preload('affiliations'))`.
- Tests HTTP : `.json(...)` (tableaux), `.withCsrfToken()`, `.redirects(0)`, `.loginAs(admin)` ; GET JSON : `.header('accept','application/json')` non requis (le contrôleur renvoie `response.json`) ; `exclude[]` via `.qs({ q, 'exclude[]': [...] })` ou URL brute.
- `drive.fake('r2')` pour `photoUrl` signée (patron `authors_photo.spec.ts`).
- Seeder en test : `new Seeder(db.connection()).run()` dans une transaction globale (`static environment = ['development']` ne concerne que `db:seed`).

### Intelligence des stories précédentes (9.1–9.6)

- 9.6 : `refreshDenormalizedNames` (`btrim(first || ' ' || last)`, `IS DISTINCT FROM`, `updated_at` inchangé) ; verrou + décision sur la ligne verrouillée ; tables ordonnées `DELETE` + `INSERT` (P2.1) ; « Fictitious names only » en tête des specs.
- 9.2 : `applyListFilters` / `applyListOrder` prévus pour `search` (`limit(10)`) ; `UUID_RE` du contrôleur des auteurs ; `AuthorStatusBadges`.
- 9.3 : `Avatar` (`sm` 32 px, `alt=""`, initiales `aria-hidden`), `photoUrl` signée `w128.webp`.
- Conventions : docblocks anglais dans `app/`, commentaires de tests en français ; i18n FR/EN + test de parité.

### Project Structure Notes

- Nouveaux : `inertia/components/admin/AuthorCombobox.tsx`, `inertia/components/admin/SelectedAuthorList.tsx`, `tests/functional/admin/productions_authors.spec.ts`, `tests/unit/seeders/production_demo_seeder.spec.ts`, `tests/unit/components/author_picker.spec.ts`.
- Le spec `tests/unit/models/production_authors.spec.ts` (modèle, 9.2) reste tel quel.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.7] (+ règles communes Epic 9, porte manuelle de l'Epic 9)
- [Source: architecture.md#P2.6] (route `search`, validateur `authorIds`, `getMissingForPublish`), [#P2.1] (tables ordonnées, expand/contract), [#P2.9] lot 4 (porte)
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] (AuthorCombobox, SelectedAuthorList, combobox ARIA, réordonnancement, libellés) ; [DESIGN.md#AuthorCombobox] ; maquette `mockups/admin-author-picker.html`
- [Source: 9-6-application-idempotente-et-verification-de-la-conversion.md] ; [deferred-work.md] (performance de la recherche)

## Questions ouvertes (non bloquantes, défauts retenus)

1. Production publiée non convertie : pas de dépublication automatique pour le critère auteurs (D-9.7-e).
2. Production partiellement rattachée (noms libres en plus du pivot) : réécrite depuis le pivot à l'enregistrement (D-9.7-i).
3. Recherche non indexée conservée (D-9.7-b).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- `sprint-status.yaml` absent du dépôt (supprimé lors de la mise à jour BMad v6.8.0) : suivi dans le fichier de story seulement.
- Tests et implémentation écrits couche par couche (service → contrôleurs → front) plutôt qu'en « red » strict ; chaque couche vérifiée par la suite unitaire/fonctionnelle avant la suivante.
- Middleware d'authentification : la redirection conserve la query string (`/admin/login?q=…`) ; assertion du test adaptée.
- Tuyau : `urlFor(name, {}, { qs })` sérialise les tableaux en `exclude[]=…` ; le contrôleur accepte aussi `exclude=…` répété (testé).
- `.adonisjs/*` régénérés par `/tmp/d37/gen.sh` (route `admin.authors.search`) ; `database/schema.ts` inchangé (aucune migration).
- Aucune exécution sous `doppler run`, aucune connexion à un service distant ; `package.json` / `package-lock.json` inchangés.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `ProductionAuthorService.sync` : production verrouillée `FOR UPDATE`, décisions sur la ligne verrouillée ; garde « non convertie » (sélection vide + 0 lien + jsonb non vide → aucune écriture) ; fiches lues `FOR SHARE`, identifiant inconnu → `E_VALIDATION_ERROR` sur `authorIds` ; ordre inchangé → pas de réécriture ; sinon `DELETE` + `INSERT … WITH ORDINALITY` (positions 1..n) ; `refreshDenormalizedNames` (9.6) toujours appelé. `count` pour FR21.
- `GET /admin/authors/search` (`admin.authors.search`) : `applyListFilters` / `applyListOrder` + `whereNotIn(exclude)` + `limit(10)`, q < 2 → `{ authors: [] }` ; sérialisation partagée `AuthorService.toPickerAuthors` (aussi utilisée par l'édition de production) et `signedPhotoUrl` (extrait du contrôleur des auteurs).
- Contrôleur de productions : `store` / `update` en transaction avec `sync` ; `authorNames` jamais écrit depuis la requête (`authors` ignoré) ; `authorIds` absent → auteurs inchangés ; dépublication automatique et `publish` sur le pivot (`getMissingForPublish(…, authorsCount)`), critère auteurs neutralisé pour une production non convertie protégée (D-9.7-e) ; `edit` renvoie les auteurs du pivot ordonnés et `legacyAuthorNames`.
- Front : `AuthorCombobox` (ARIA 1.2, anti-rebond 250 ms, `AbortController`, `Loader2`, états vide/erreur, Entrée sans soumission, Échap ferme puis vide), `SelectedAuthorList` (↑ ↓ × nommés, `aria-disabled` aux extrémités pour garder le focus, focus restauré, `aria-live`), fieldset Auteurs de `ProductionForm` avec avertissement « Auteurs à rattacher », `hasRequiredAuthors`, `toProductionPayload` (→ `authorIds`) ; i18n FR/EN. Aucune dépendance ajoutée.
- Seeder de démo : 24 fiches fictives `seed-demo:1..24` (noms inventés ; les noms réels de l'ancienne liste `AUTHORS` ont été retirés), 1–2 affiliations, un tiers public ; `sync` par production (1–3 auteurs) ; purge productions puis fiches `seed-demo:` non liées.
- Tests (+43) : 16 fonctionnels `productions_authors.spec.ts` (10 formulaire + 6 recherche), 6 unitaires `sync`, 2 seeder, 14 lecture de source (`author_picker.spec.ts`), 1 `production_completion`, 2 validateur, 1 `getMissingForPublish`, 1 publication ; specs `productions_create/edit/publish` adaptées. Suite complète : **738 tests verts** (695 avant) ; lint, typecheck, build verts.
- Porte manuelle (AC 12, T9) non exécutée : déploiement staging seulement après `authors:apply` + `authors:verify` à 100 % sur la base partagée — en attente d'Aurélien.

### File List

- `app/services/production_author_service.ts` (modifié : `sync`, `count`, `unknownAuthorError`)
- `app/services/author_service.ts` (modifié : `PickerAuthor`, `toPickerAuthors`, `signedPhotoUrl`)
- `app/services/production_service.ts` (modifié : `getMissingForPublish` sur le pivot)
- `app/validators/admin/production_validator.ts` (modifié : `authorIds`)
- `app/controllers/admin/productions_controller.ts` (modifié)
- `app/controllers/admin/authors_controller.ts` (modifié : `search`)
- `start/routes.ts` (modifié)
- `.adonisjs/client/registry/index.ts`, `.adonisjs/client/registry/schema.d.ts`, `.adonisjs/client/registry/tree.d.ts`, `.adonisjs/server/routes.d.ts` (régénérés)
- `database/seeders/production_demo_seeder.ts` (modifié)
- `inertia/components/admin/AuthorCombobox.tsx` (nouveau)
- `inertia/components/admin/SelectedAuthorList.tsx` (nouveau)
- `inertia/lib/author_picker.ts` (nouveau)
- `inertia/components/admin/ProductionForm.tsx` (modifié)
- `inertia/lib/production_completion.ts` (modifié)
- `inertia/lib/production_submit.ts` (modifié)
- `inertia/pages/admin/Productions/Create.tsx`, `inertia/pages/admin/Productions/Edit.tsx` (modifiés)
- `inertia/locales/admin/fr.json`, `inertia/locales/admin/en.json` (modifiés)
- `tests/functional/admin/productions_authors.spec.ts` (nouveau)
- `tests/unit/seeders/production_demo_seeder.spec.ts` (nouveau)
- `tests/unit/components/author_picker.spec.ts` (nouveau)
- `tests/functional/admin/productions_create.spec.ts`, `productions_edit.spec.ts`, `productions_publish.spec.ts` (modifiés)
- `tests/unit/services/production_author_service.spec.ts`, `tests/unit/services/production_service.spec.ts`, `tests/unit/validators/production_validator.spec.ts`, `tests/unit/lib/production_completion.spec.ts` (modifiés)
- `_bmad-output/implementation-artifacts/9-7-selection-des-auteurs-d-une-production-depuis-le-referentiel.md` (story)

## Change Log

- 2026-11-18 : création de la story (bmad-create-story), Status ready-for-dev.
- 2026-11-18 : implémentation (bmad-dev-story) — recherche d'auteurs, `ProductionAuthorService.sync`, formulaire branché sur le pivot (combobox ARIA + liste ordonnée), FR21 sur le pivot, seeder `seed-demo:`, tests ; `npm run test:local` complet : 738 tests verts (695 avant) ; lint, typecheck, build verts. Porte manuelle T9 en attente d'Aurélien. Status → review.
