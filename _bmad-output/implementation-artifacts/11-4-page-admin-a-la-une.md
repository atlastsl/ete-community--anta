---
baseline_commit: 8a560a5
---

# Story 11.4 : Page admin « À la une »

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur**,
je veux **choisir jusqu'à 3 productions publiées à mettre à la une et leur ordre**,
afin d'**éditorialiser la bannière de l'accueil** (FR47, FR50, D20, D26, D30).

## Décision de périmètre (lire en premier)

- Story **avec une migration additive** (`1775918749000_create_featured_productions_table.ts`, numéro réservé par l'architecture P2.1), **sans dépendance npm**, sans composant shadcn ajouté (combobox écrit à la main comme `AuthorCombobox`).
- **DANS 11.4** :
  - table `featured_productions`, `FeaturedService` (`requiresThumbnail`, `save`, sélection, candidats, garde du retrait de vignette) ;
  - `FEATURED_UPDATE` dans `ActionType`, journal `featured_selection` `{ before, after }`, libellés de la page Journal ;
  - routes `admin.featured`, `.update`, `.candidates` (groupe `middleware.admin()`), `featured_controller.ts`, `featured_validator.ts` ;
  - page `inertia/pages/admin/Featured/Index.tsx`, composants `FeaturedSlot`, `ProductionPicker`, `BannerPreview` (`inertia/components/admin/`), logique pure `inertia/lib/featured.ts` ;
  - entrée « À la une » (`Star`) dans la barre latérale, après « Auteurs » ;
  - `ThumbnailField` : premier montage (dans `FeaturedSlot`), verrou de page (`onBusyChange`), aperçu masquable (`showPreview`) ;
  - refus `thumbnail.errors.required_for_featured` au retrait de la vignette d'une production à la une qui l'exige.
- **HORS 11.4 (ne PAS implémenter)** :
  - retrait automatique à la dépublication / suppression, `FEATURED_AUTO_REMOVE`, avertissement des dialogs, `isFeatured` → **11.5** ;
  - prop `featured` de l'accueil, `FeaturedBanner` / `FeaturedCard` publics → **11.6** (`BannerPreview` en est une reproduction admin réduite ; la disposition est factorisée dans `inertia/lib/featured.ts` pour 11.6) ;
  - suppression de la vidéo (et donc du poster) d'une production à la une sans vignette : non bloquée en 11.4 (voir Questions ouvertes).

## Acceptance Criteria

1. **Migration** — **Given** `1775918749000_create_featured_productions_table.ts`, **When** elle est exécutée, **Then** `featured_productions` existe : `position` smallint PK `CHECK (position BETWEEN 1 AND 3)`, `production_id` uuid NOT NULL UNIQUE FK `productions` `ON DELETE CASCADE`, `created_by_id` uuid NULL FK `admin_users` `ON DELETE SET NULL`, `created_at` timestamptz NOT NULL défaut `now()` ; `down()` écrit, jamais exécuté.
2. **Règle FR50** — **Given** `FeaturedService.requiresThumbnail(production)`, **When** elle est évaluée, **Then** une vignette est requise sauf si la production possède un fichier `video/mp4` avec `poster_key` (même règle que `PosterService.displayed`, D-11.3-2) ; une vidéo en lien externe seulement, ou un MP4 sans poster, requiert une vignette.
3. **Enregistrement** — **Given** `FeaturedService.save(productionIds, adminId)`, **When** il s'exécute, **Then** la sélection est remplacée dans une transaction (`DELETE` puis `INSERT` positions 1..n, jamais `UPDATE position`) **and** toute production inconnue, non publiée ou dépourvue de la vignette requise est refusée (`FeaturedError` → `featured.errors.not_found` / `not_published` / `thumbnail_required`), rien n'étant écrit **and** une sélection identique à l'actuelle n'écrit rien (D-11.4-4).
4. **Journal** — **Given** une sélection enregistrée qui change, **When** le contrôleur répond, **Then** `featured_update` est journalisé (`resourceType: 'featured_selection'`, `resourceId` NULL, `metadata: { before: [ids], after: [ids] }`) **and** la page Journal traduit l'action (« Sélection à la une modifiée ») et la ressource (« Sélection à la une »), le filtre l'expose (10 types).
5. **Navigation** — **Given** la barre latérale admin, **When** un admin ou super admin l'ouvre, **Then** « À la une » (`Star`, `nav.featured`) apparaît après « Auteurs » et mène à `GET /admin/featured` (`admin/Featured/Index`).
6. **Page** — **Given** `GET /admin/featured`, **When** elle s'affiche, **Then** elle montre le h1, le texte d'introduction (EXPERIENCE.md:89), le compteur « n / 3 emplacements », 3 `FeaturedSlot` ordonnés dans une `<ol>` (1 = grand format), une `BannerPreview` et la barre « Enregistrer » ; prop `selection` = productions à la une ordonnées (forme `FeaturedItem`, URLs d'aperçu signées `w800`).
7. **Sélecteur** — **Given** le premier emplacement vide, **When** l'admin tape ≥ 2 caractères, **Then** `ProductionPicker` (combobox ARIA 1.2, ↑ ↓ / Entrée / Échap, région d'état polie) interroge `GET /admin/featured/candidates?q=&exclude[]=` : productions **publiées** par titre (`ILIKE` + `similarity`, trigramme existant) ou auteur (noms dénormalisés ou `authors.search_name` du pivot), ≤ 10, déjà choisies exclues ; chaque option montre la miniature 16:9 (ou `ImageOff`), le titre, auteurs · catégorie et l'état « Vignette » / « Vidéo hébergée — image extraite » / « Sans vignette — à téléverser » ; une production sans vignette reste sélectionnable. Les emplacements vides suivants affichent « Emplacement libre ».
8. **Emplacement rempli** — **Given** un emplacement rempli, **When** il s'affiche, **Then** il montre la pastille de rang, l'image 16:9 (vignette, sinon image extraite avec la mention « Image extraite de la vidéo », sinon icône), le titre, les auteurs, « Catégorie · Domaine », le badge « Affichée » ou « Vignette manquante », les boutons nommés ↑ « Monter … », ↓ « Descendre … » (permutation avec le voisin, focus conservé, annonce polie) et « Retirer » (les suivants remontent, D30, sans confirmation D-11.4-3) **and** un `ThumbnailField` (aperçu masqué, déjà montré par l'emplacement) permet de téléverser, remplacer ou retirer la vignette sur place (D37).
9. **Vignette manquante (D20, D26)** — **Given** un emplacement dont la production n'a pas la vignette requise, **When** il est rempli, **Then** un avertissement (« Cette production n'a pas de vignette… ») entoure le `ThumbnailField` en ligne ; le téléversement ne perd pas l'état non enregistré des emplacements **and** « Enregistrer » est désactivé avec l'explication visible reliée par `aria-describedby` (« Enregistrement impossible : l'emplacement {n} n'a pas de vignette. ») et se réactive dès le téléversement (états rafraîchis par `candidates?ids[]=`, D-11.4-2).
10. **Aperçu** — **Given** `BannerPreview`, **When** les emplacements changent (non enregistrés), **Then** il reproduit la disposition `lg` (1 = pleine largeur, 2 = deux colonnes, 3 = la 1re sur 2/3 et deux empilées) avec les seuls emplacements valides, non interactif (`aria-hidden` sur le rendu, aucun lien), et la ligne d'état « 2 productions affichées — l'emplacement 3 attend sa vignette » ou « Aucune bannière sur l'accueil ».
11. **Enregistrer** — **Given** une sélection valide (y compris vide), **When** l'admin clique « Enregistrer », **Then** `PUT /admin/featured` (`featured_validator.ts` : `productionIds` uuid distincts, ≤ 3) enregistre la sélection, toast « Sélection à la une enregistrée. » ; une sélection vide retire la bannière (FR47) **and** un échec (validation, refus, stockage) est flashé par `flashValidationErrors` (champ `productionIds`, clé `featured.errors.*`) et affiché en toast d'erreur persistant, emplacements conservés **and** quitter la page avec des changements non enregistrés (navigation Inertia ou fermeture d'onglet) demande confirmation ; les visites de la page elle-même (enregistrement, vignettes) ne la demandent jamais.
12. **Visites concurrentes** — **Given** plusieurs `ThumbnailField` sur la page, **When** l'un téléverse ou retire, **Then** les autres champs, les actions d'emplacement, le sélecteur et « Enregistrer » sont désactivés jusqu'à la fin de sa visite (verrou de page, D-11.4-1) ; pendant l'enregistrement, idem.
13. **Retrait de vignette refusé** — **Given** une production à la une qui requiert une vignette, **When** un admin retire sa vignette (`DELETE /admin/productions/:id/thumbnail`), **Then** le retrait est refusé (`thumbnail.errors.required_for_featured`, « Vignette requise pour une production à la une. », erreur du champ `thumbnail`), la vignette et ses variantes restent, rien n'est journalisé ; la vérification a lieu dans la transaction verrouillée du retrait (D-11.4-5).

## Tasks / Subtasks

- [x] **T1 — Migration et service** (AC 1, 2, 3, 13)
  - [x] 1.1 `database/migrations/1775918749000_create_featured_productions_table.ts`.
  - [x] 1.2 `app/services/featured_service.ts` : `FEATURED_MAX_SLOTS`, `FeaturedError`, `requiresThumbnail`, `missingThumbnail`, `selectionIds`, `save` (`LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE`, productions `FOR SHARE` + fichiers, refus, `DELETE` + `INSERT`), `assertThumbnailRemovable(productionId, trx)`, `selection()`, `candidates({ q, exclude })`, `items(ids)`, `toItems` (URLs signées vignette / poster).
  - [x] 1.3 `ThumbnailService.remove(production, { guard })` : garde appelée dans la transaction après le verrou de la ligne.
- [x] **T2 — Routes, contrôleur, validateur, journal** (AC 3, 4, 6, 7, 11, 13)
  - [x] 2.1 `ActionType.FEATURED_UPDATE`.
  - [x] 2.2 `app/validators/admin/featured_validator.ts` (messages = clés `featured.errors.*`).
  - [x] 2.3 `app/controllers/admin/featured_controller.ts` : `index`, `update` (erreurs flashées sur `productionIds`, toujours redirection arrière, journal après commit si changement), `candidates` (`q`, `exclude[]`, `ids[]`).
  - [x] 2.4 `start/routes.ts` : `admin.featured`, `admin.featured.update`, `admin.featured.candidates` ; codegen Tuyau.
  - [x] 2.5 `ThumbnailsController.destroy` : garde `FeaturedService.assertThumbnailRemovable` → `required_for_featured`.
  - [x] 2.6 Page Journal : ressource `featured_selection`.
- [x] **T3 — Front** (AC 5–12)
  - [x] 3.1 `inertia/lib/featured.ts` (pur) : type `FeaturedItem`, `imageState`, `isMissingThumbnail`, `firstBlockedSlot`, `displayedSlots`, `waitingSlots`, `isDirty`, `moveSlot`, `removeSlot`, `bannerLayout`, `shouldConfirmLeave`, `firstErrorKey`.
  - [x] 3.2 `ProductionPicker.tsx`, `FeaturedSlot.tsx`, `BannerPreview.tsx`.
  - [x] 3.3 `inertia/pages/admin/Featured/Index.tsx` (état local, verrou, rafraîchissement, enregistrement, confirmation de sortie).
  - [x] 3.4 `ThumbnailField` : `onBusyChange`, `showPreview`.
  - [x] 3.5 `AdminLayout` : entrée « À la une ».
  - [x] 3.6 i18n admin fr/en : `nav.featured`, `featured.*`, `thumbnail.errors.required_for_featured`, `activity.action.featured_update`, `activity.resource.featured_selection`.
- [x] **T4 — Tests** (tous les AC)
  - [x] 4.1 Unit `tests/unit/services/featured_service.spec.ts` : `requiresThumbnail` (vignette seule, MP4 avec / sans poster, lien externe, autre type), `missingThumbnail`.
  - [x] 4.2 Functional `tests/functional/admin/featured.spec.ts` : migration (contraintes), page et props, enregistrement ordonné, remplacement, vide, > 3 / doublon / uuid refusés, brouillon et dépubliée refusés, vignette manquante refusée, poster accepté, inconnue refusée, no-op sans journal, journal `before`/`after`, `candidates` (publiées seulement, titre, auteur, exclusion, `ids[]`, < 2 caractères), accès (invité redirigé, admin simple autorisé), retrait de vignette refusé / permis (poster, hors une).
  - [x] 4.3 Unit `tests/unit/lib/featured.spec.ts` (exécution) ; composants par lecture de source (`featured_page.spec.ts`, `thumbnail_field.spec.ts`, `admin_layout.spec.ts`, `activity_logs_page.spec.ts`) ; `activity_logs.spec.ts` (10 types).
  - [x] 4.4 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/services/thumbnail_service.ts` (11.1) : `remove(production)` verrouille la ligne (`FOR NO KEY UPDATE`) dans une transaction puis met `thumbnail_key` à NULL ; variantes supprimées après commit.
- `app/controllers/admin/thumbnails_controller.ts` : toujours redirection arrière, erreurs du champ `thumbnail` par `flashValidationErrors` (`fail(code)`), pas de flash de succès.
- `app/services/poster_service.ts` (11.3) : `displayed(files)` = premier `video/mp4` pourvu d'un poster ; `signedUrl(prefix)` (`w800`).
- `inertia/components/admin/ThumbnailField.tsx` : props `productionId`, `previewUrl`, `hasThumbnail`, `posterPreviewUrl`, `onChange`, `disabled` ; visites `preserveState` (D20), erreurs de sa propre visite, toast de succès local. Jamais monté avant 11.4.
- `inertia/components/admin/AuthorCombobox.tsx` : modèle du combobox (debounce 250 ms, `AbortController`, région d'état toujours montée).
- `inertia/layouts/AdminLayout.tsx` : `NAV_ITEMS` ; toasts du flash indexés sur la chaîne (un flash identique répété ne se rejoue pas).
- `app/controllers/admin/activity_logs_controller.ts` : `Object.values(ActionType)` → nouveau type exposé automatiquement ; page Journal : `resourceLabel`.

### Garde-fous

- Tables ordonnées : `DELETE` + `INSERT` (architecture « Tables ordonnées ») ; PK non différable.
- `ActivityLogService.log` hors transaction, après commit, ne lève jamais.
- Toute réponse d'erreur du `PUT` et du retrait de vignette = redirection arrière + `flashValidationErrors` (jamais de page d'erreur Inertia qui remplacerait la page, `handler.ts`).
- `exclude[]` / `ids[]` : qs `arrayLimit: 20` → valeurs d'objet acceptées ; UUID filtrés avant Postgres.
- Inertia 2.3 annule une visite synchrone en cours au départ d'une autre : verrou de page (D-11.4-1).
- Composants `inertia/` testés par lecture de source ; logique dans `inertia/lib/featured.ts` (sans import) testée à l'exécution.
- Dépôt public : aucune donnée réelle dans les tests.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.4] ; en-tête Epic 11.
- [Source: architecture.md#P2.1] `featured_productions`, « Tables ordonnées » ; [#P2.5] « Règle FR50 côté serveur » ; [#P2.6] routes, « Enregistrement de la une », `featured_validator.ts`, composants, « Journal d'activité » ; P2-11, P2-17.
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md:52, 87–93, 124–131, 160–164, 169–170, 256–265] ; [DESIGN.md:255–260, 377–381] ; maquette `mockups/admin-featured.html`.
- [Source: 11-1-…md] `[Review][Defer]` envois simultanés (→ verrou), question « Retirer sans confirmation », D-11.1-5 ; [Source: 11-3-…md] D-11.3-2, D-11.3-6, prop `posterPreviewUrl` ; [deferred-work.md:149].

## Décisions (D-11.4-n)

- **D-11.4-1** : visites concurrentes → **verrou de page** plutôt que `async: true` : `ThumbnailField` signale `onBusyChange(true)` **avant** de lancer sa visite et `false` à la fin ; tant qu'un champ ou l'enregistrement est en cours, les autres champs, ↑ ↓ « Retirer », le sélecteur et « Enregistrer » sont désactivés. Une visite asynchrone remplacerait quand même les props à sa réponse et laisserait partir un enregistrement pendant qu'une vignette change ; le verrou est déterministe.
- **D-11.4-2** : après un téléversement / retrait de vignette, la redirection du champ ne rafraîchit que la sélection **enregistrée** (`selection`) ; l'état des emplacements non enregistrés est relu par `GET /admin/featured/candidates?ids[]=…` (même forme `FeaturedItem`, publiées seulement, `q` ignoré) plutôt que par une nouvelle route.
- **D-11.4-3** : « Retirer » d'un emplacement **sans confirmation** : modification locale, annulable tant qu'elle n'est pas enregistrée (et la sortie de page est confirmée) ; EXPERIENCE.md ne prévoit aucun dialog. Le « Retirer » de la vignette (`ThumbnailField`, question de 11.1) reste **sans dialog** comme `FileUploader` : la seule perte irréversible qui compte (vignette exigée d'une production à la une) est refusée par le serveur (AC 13). À confirmer par le PO.
- **D-11.4-4** : enregistrer une sélection identique à la sélection courante n'écrit rien et ne journalise rien (toast de succès quand même).
- **D-11.4-5** (amendée à la revue) : sérialisation et **ordre des verrous, règle commune à tout écrivain de la sélection** : (1) les lignes `productions` concernées d'abord (`save` : `FOR SHARE` ; retrait de vignette : `FOR NO KEY UPDATE`), (2) **ensuite** `LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE` (deux enregistrements concurrents ne se heurtent pas sur la PK). L'ordre inverse interbloque avec `ProductionService.delete`, qui tient la ligne de la production quand son `CASCADE` demande `ROW EXCLUSIVE` sur la table (constaté à la revue, reproduit par le test de concurrence). **11.5 doit suivre la même règle** : `FeaturedService.removeProduction` appelé dans la transaction de `unpublish` / `delete`, **avant** le `DELETE FROM productions`, ligne de la production verrouillée d'abord, verrou de table ensuite. `ThumbnailService.remove` vérifie l'appartenance à la une et la règle FR50 **après** son verrou de ligne : quel que soit l'ordre d'arrivée, une production à la une ne perd jamais sa vignette requise.
- **D-11.4-6** : toast de succès émis par la page (pas de flash serveur, comme 11.1 : un flash identique répété ne se rejoue pas dans `AdminLayout`) ; échecs = clé `featured.errors.*` sur `productionIds`, toast d'erreur persistant.
- **D-11.4-7** : candidats : terme normalisé ≥ 2 caractères, ≤ 10 résultats ; titre `ILIKE %terme%` ou `similarity(title, terme) > 0.3`, ou auteur (`productions.authors` texte `ILIKE`, ou `authors.search_name LIKE` via le pivot — la conversion des auteurs n'étant pas encore appliquée partout, les deux sources) ; tri : titre commençant par le terme, similarité, date de publication Anta décroissante, id.
- **D-11.4-8** : confirmation de sortie par `window.confirm` (gestionnaire `router.on('before')` synchrone) et `beforeunload` (message générique du navigateur) ; les visites lancées par la page (compteur en ref, posé avant la visite) ne sont jamais interceptées.
- **D-11.4-9** (amendée à la revue) : la bannière est **un seul rendu partagé**, `inertia/components/shared/FeaturedBanner.tsx` (dossier `shared/` comme `Avatar`, `Pagination`) : grille D35, carte FR49 (image, titre, auteurs, totaux `Eye` / `Download`), titres `featured-title-lg` / `card-title`, première image `eager` + `fetchpriority="high"`, lien étiré si `href`. Sans clé i18n (textes passés par le point d'entrée : instances admin et public distinctes). `BannerPreview` l'affiche dans la largeur publique (1152 px) réduite par `zoom: 0.62`, sans `href`. **Reste pour 11.6** : branchement public (`home.tsx`, prop `featured`, `aria-label`, `AuthorByline` par `renderAuthors`, `srcSet` / `sizes` par `inertia/lib/media.ts`).
- **D-11.4-10** : `ThumbnailField` gagne `showPreview` (défaut `true`) : dans l'emplacement, l'image (vignette ou image extraite + mention) est montrée par `FeaturedSlot` (160 px, maquette), le champ ne garde que ses actions, son aide, sa progression et ses erreurs.
- **D-11.4-11** (revue) : succès de l'enregistrement seulement si la réponse est la page `admin/Featured/Index` **et** que sa sélection est celle envoyée (`saveSucceeded`) ; sinon (CSRF expiré renvoyé en arrière avec l'ancienne sélection, session expirée → connexion) toast d'erreur persistant, emplacements conservés.
- **D-11.4-12** (revue) : visites propres à la page reconnues par **méthode + chemin** dans l'événement `before` (`isOwnVisit` : `PUT /admin/featured`, `POST` / `DELETE /admin/productions/<id d'un emplacement>/thumbnail`), plus de compteur global : un lien de la barre latérale pendant un téléversement demande confirmation.
- **D-11.4-13** (revue) : uuid identiques à la casse près → `featured.errors.duplicate` (dédoublonnage en minuscules dans `save`, avant toute requête).
- **D-11.4-14** (revue) : `FeaturedItem.unavailable` (statut ≠ publiée) : badge « Non publiée » + avertissement, bloque l'enregistrement (« … la production de l'emplacement {n} n'est plus publiée. »), jamais dans l'aperçu ; `candidates?ids[]=` renvoie tous les statuts, une production supprimée disparaît de l'emplacement (`mergeRefreshed`). Les refus `not_found` / `not_published` / `thumbnail_required` nomment l'emplacement (entrée `position` du sac d'erreurs → clé `…_slot`).
- **D-11.4-15** (revue) : `FeaturedItem` porte `viewsCount` / `downloadsCount` (FR49) et `authors` structurés (fiches `{ firstNames, lastNames }` du pivot, puis noms libres non rattachés `{ name }`), affichés « Prénom NOM » par `formatAuthorName` (D13/D34) dans l'emplacement, le sélecteur et l'aperçu.
- **D-11.4-16** (revue) : échec du rafraîchissement après une vignette → alerte en ligne `role="alert"` avec « Réessayer » ; « Enregistrer » attend un rafraîchissement réussi (état des vignettes inconnu).
- **D-11.4-17** (revue, maquette) : emplacement libre titré « Ajouter une production à la une » (h3) ; image manquante = encadré pointillé ambre « Vignette requise » ; titre de l'emplacement en `card-title` (`font-display text-lg font-semibold leading-[1.375]`).

## Review Findings

- [x] [Review][Patch] Interblocage `save` / suppression de production [app/services/featured_service.ts] — `LOCK TABLE` pris avant les lignes `FOR SHARE` ; `ProductionService.delete` tient la ligne puis son `CASCADE` demande la table. Ordre inversé (lignes puis table), règle écrite pour 11.5 (D-11.4-5) ; test à deux connexions réelles (échoue en 1 s avec l'ancien ordre : interblocage détecté) + test d'ordre des instructions.
- [x] [Review][Patch] Faux toast « Sélection enregistrée » [inertia/pages/admin/Featured/Index.tsx, inertia/lib/featured.ts] — toute réponse de page était un succès (CSRF expiré, session expirée) → `saveSucceeded` (composant + sélection renvoyée = envoyée), testé à l'exécution (D-11.4-11).
- [x] [Review][Patch] Garde de sortie contournée pendant un téléversement [Index.tsx, lib/featured.ts] — compteur global remplacé par `isOwnVisit` (méthode + chemin), testé (D-11.4-12).
- [x] [Review][Patch] uuid en casses différentes → erreur `storage` [app/services/featured_service.ts] — dédoublonnage en minuscules → `duplicate` ; tests (doublon, majuscules seules enregistrées en minuscules) (D-11.4-13).
- [x] [Review][Patch] `BannerPreview` n'était pas le rendu réel [inertia/components/shared/FeaturedBanner.tsx, BannerPreview.tsx] — composant partagé (grille, carte, totaux FR49, jetons de titre), `viewsCount` / `downloadsCount` dans `FeaturedItem`, auteurs « Prénom NOM » via `formatAuthorName` ; branchement public consigné pour 11.6 (D-11.4-9, D-11.4-15).
- [x] [Review][Patch] Productions non publiées dans la sélection enregistrée [featured_service.ts, FeaturedSlot.tsx, featured_controller.ts, lib/featured.ts] — `unavailable`, refus nommant l'emplacement, `mergeRefreshed` sans élément périmé (D-11.4-14).
- [x] [Review][Patch] Écarts UX (DESIGN.md:377, maquette) [FeaturedSlot.tsx] — titre « Ajouter une production à la une », encadré « Vignette requise », titre `card-title` (D-11.4-17).
- [x] [Review][Patch] Échec du rafraîchissement sans reprise [Index.tsx] — alerte avec « Réessayer », enregistrement suspendu (D-11.4-16).
- [x] [Review][Patch] Suivi : report 11.1 « envois simultanés » coché comme résolu par 11.4 ; cette section.

## Questions ouvertes (non bloquantes, défauts retenus)

1. « Retirer » la vignette sans dialog de confirmation (D-11.4-3, reprise de 11.1).
2. Supprimer la vidéo (donc son poster) d'une production à la une sans vignette n'est pas bloqué : la bannière la montrerait sans image jusqu'à correction (11.6 l'ignore ou la montre vide) — bloquer comme le retrait de vignette ?

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites avant le code (`featured.spec.ts`, `featured_service.spec.ts`, `lib/featured.spec.ts`, `featured_page.spec.ts`, ajouts `thumbnail_field`, `admin_layout`, `activity_logs_page`, `activity_logs` à 10 types) → échec de chargement (fichiers absents).
- 1er passage ciblé : 96/99 ; corrigés : clé de message VineJS du `maxLength` d'un tableau = `productionIds.array.maxLength` (pas `productionIds.maxLength`), `pg_get_constraintdef` cite `"position"`, regex du test 11.3 de `showPoster` adaptée à `showPreview`.
- Codegen Tuyau (`/tmp/d37/gen.sh`) relancé après la création de la page (sinon `inertia.render('admin/Featured/Index')` refusé au typecheck) ; `database/schema.ts` régénéré par les migrations de test (`FeaturedProductionSchema`).
- Suite complète `npm run test:local` : **1211 tests verts** (baseline 1157, +54), code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Rien contre Supabase ni R2 (`drive.fake('r2')`) ; migration jamais appliquée sur Supabase.
- Revue (9 correctifs) : le test de concurrence échoue avec l'ancien ordre des verrous (interblocage détecté par Postgres en ~1 s) et passe avec le nouveau. Après correctifs : **1227 tests verts** (+16), `npm run test:local` code 0, lint 0, typecheck 0, build 0.

### Completion Notes List

- Migration `1775918749000_create_featured_productions_table.ts` (numéro réservé, additive) : PK `position` + CHECK 1..3, `production_id` UNIQUE CASCADE, `created_by_id` SET NULL, `created_at` `now()`.
- `FeaturedService` : `requiresThumbnail` (= aucun MP4 avec poster, via `PosterService.displayed`), `missingThumbnail`, `save` (verrou de table `SHARE ROW EXCLUSIVE`, productions `FOR SHARE`, refus `not_found` / `not_published` / `thumbnail_required`, no-op sans écriture, `DELETE` + `INSERT`), `assertThumbnailRemovable`, `selection`, `items(ids)`, `candidates` (D-11.4-7), `toItems` (URLs signées `w800`).
- `ThumbnailService.remove(production, { guard })` ; `ThumbnailsController.destroy` refuse `thumbnail.errors.required_for_featured` (champ `thumbnail`, rien journalisé).
- `FeaturedController` : `index`, `update` (erreurs VineJS et refus → `flashValidationErrors` sur `productionIds`, échec inattendu → `featured.errors.storage` + `logger.error`, journal `featured_update` après commit si changement), `candidates` (`q`/`exclude[]` ou `ids[]`). Routes `admin.featured`, `.update`, `.candidates` dans le groupe `middleware.admin()`.
- Front : page `admin/Featured/Index` (état local, verrou de page, rafraîchissement `ids[]`, PUT avec toasts locaux, confirmation de sortie `router.on('before')` + `beforeunload`, annonces polies, focus conservé), `FeaturedSlot`, `ProductionPicker` (combobox ARIA 1.2), `BannerPreview` (disposition `lg`, emplacements valides seulement), logique pure `inertia/lib/featured.ts` ; `ThumbnailField` : `onBusyChange` (signalé avant la visite), `showPreview` ; entrée « À la une » (`Star`) après « Auteurs » ; page Journal : « Sélection à la une ».
- i18n admin fr/en : `nav.featured`, `featured.*` (libellés d'EXPERIENCE.md), `thumbnail.errors.required_for_featured`, `activity.action.featured_update`, `activity.resource.featured_selection`.
- `deferred-work.md` : reports 11.1 (envois simultanés, aperçu du poster) marqués résolus ; nouveau report « suppression de la vidéo d'une production à la une ».
- Non vérifié dans un navigateur (pas de `.env`, aucune session de dev lancée) : le comportement client est couvert par la logique pure et les tests de source.

### File List

- database/migrations/1775918749000_create_featured_productions_table.ts (nouveau)
- database/schema.ts (régénéré)
- app/services/featured_service.ts (nouveau)
- app/services/thumbnail_service.ts
- app/controllers/admin/featured_controller.ts (nouveau)
- app/controllers/admin/thumbnails_controller.ts
- app/validators/admin/featured_validator.ts (nouveau)
- app/enums/action_type.ts
- start/routes.ts
- .adonisjs/client/registry/index.ts, schema.d.ts, tree.d.ts ; .adonisjs/server/controllers.ts, pages.d.ts, routes.d.ts (codegen)
- inertia/lib/featured.ts (nouveau)
- inertia/pages/admin/Featured/Index.tsx (nouveau)
- inertia/components/admin/FeaturedSlot.tsx (nouveau)
- inertia/components/admin/ProductionPicker.tsx (nouveau)
- inertia/components/admin/BannerPreview.tsx (nouveau)
- inertia/components/shared/FeaturedBanner.tsx (nouveau, revue)
- inertia/components/admin/ThumbnailField.tsx
- inertia/layouts/AdminLayout.tsx
- inertia/pages/admin/ActivityLogs/Index.tsx
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- tests/functional/admin/featured.spec.ts (nouveau)
- tests/functional/admin/activity_logs.spec.ts
- tests/unit/services/featured_service.spec.ts (nouveau)
- tests/unit/lib/featured.spec.ts (nouveau)
- tests/unit/components/featured_page.spec.ts (nouveau)
- tests/unit/components/thumbnail_field.spec.ts
- tests/unit/components/activity_logs_page.spec.ts
- tests/unit/layouts/admin_layout.spec.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/11-1-vignette-d-une-production-dans-le-panel-admin.md (revue : report coché)
- _bmad-output/implementation-artifacts/11-4-page-admin-a-la-une.md (nouveau)

## Change Log

- 2026-11-21 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-21 : implémentation (table `featured_productions`, `FeaturedService`, routes et contrôleur « À la une », journal `featured_update`, page admin avec `FeaturedSlot` / `ProductionPicker` / `BannerPreview`, verrou de page et `showPreview` de `ThumbnailField`, refus `required_for_featured`, entrée de navigation) ; 1211 tests verts ; statut review.
- 2026-11-21 : revue de code — 9 correctifs (ordre des verrous lignes → table + règle pour 11.5, succès d'enregistrement vérifié, visites propres par méthode + chemin, doublons de casse, bannière partagée `shared/FeaturedBanner` avec totaux et auteurs « Prénom NOM », productions non publiées `unavailable`, écarts de maquette, « Réessayer » du rafraîchissement, suivi) ; 1227 tests verts ; statut done.
