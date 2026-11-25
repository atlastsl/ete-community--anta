---
baseline_commit: f085b4b
---

# Story 11.7 : Tests vignettes et productions à la une

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que développeur,
Je veux une suite de tests couvrant les vignettes, l'image extraite et la une,
Afin de garantir la cohérence de la bannière et de ses images.

## Décision de périmètre (lire en premier)

Les stories 11.1–11.6 ont livré leurs tests au fil de l'eau (1274 tests au HEAD `f085b4b`). L'inventaire ci-dessous
montre que **chaque puce de l'AC 1 et chaque spec unitaire de l'AC 2 est déjà couverte** par au moins un test, souvent
dans un fichier voisin de celui que nomme l'épique (image extraite → `production_files_poster.spec.ts`, retrait
automatique → `featured_auto_remove.spec.ts`, D37 → `media.spec.ts` / `seo.spec.ts` / transformer).

Comme la Story 10.8, cette story **ne duplique rien** : elle ajoute ce qu'aucun test ne vérifie encore, la cohérence
**entre** les surfaces (chaque spec 11.x regarde une seule route, et la plupart posent des clés factices directement en
base ou appellent les services) :

1. **Parcours de bout en bout par les vraies routes admin** : vraie image (`sharp`) et vraie vidéo (`ffmpeg`)
   téléversées, publication, `PUT /admin/featured`, remplacement / retrait de vignette, dépublication, republication,
   suppression de la production, suppression de la vidéo → à chaque étape, bannière de l'accueil (`featured`),
   `/media` (toutes les variantes de l'image affichée), page « À la une », journal, R2 factice.
2. **Matrice `/media` × bannière** : statut (publiée / brouillon / dépubliée) × à la une (oui / non) × image (aucune,
   vignette, image extraite, les deux) ; présence dans la bannière ⇔ publiée ∧ à la une ∧ image ; vignette servie ⇔
   publiée ∧ vignette (à la une ou non, D-11.2-2) ; poster servi ⇔ publiée ∧ poster ; toute `imageUrl` de la bannière
   est servie en 200 sur ses 3 variantes ; une clé non courante → 404.
3. **D37 transverse** : pour chaque état, aucune clé de vignette ni de poster dans les cartes (accueil hors bannière,
   listing, profil d'auteur) ni dans le détail (hors `posterUrl` du lecteur vidéo, D-11.3-5), aucune `og:image` ni
   `twitter:image` de production, même à la une.
4. **i18n consolidée de l'epic** : toutes les clés littérales **et** gabarits (`featured.state.${state}`,
   `productions.${kind}_modal.*`, `${key}_slot`, `activity.action.${type}`) des fichiers admin / publics de l'epic,
   ainsi que les clés envoyées par le serveur (validateurs, `FeaturedErrorCode`, codes de `ThumbnailsController`,
   flash de dépublication automatique), existent en FR et EN.
5. **A11y par lecture de source** : la règle « un seul `h1` sur l'arbre rendu » (10.8) étendue à l'accueil avec sa
   bannière (`public/FeaturedBanner` → `shared/FeaturedBanner` → `AuthorByline`) et à la page admin « À la une ».

Hors périmètre (décision PO du 2026-11-21, consignée) :
- **Pas d'axe, pas de suite `browser`, aucune dépendance npm** (Aurélien : non). L'accessibilité reste couverte par les
  tests de source.
- **Audit Lighthouse de l'accueil avec bannière** : porte manuelle d'Aurélien sur le staging après déploiement de
  l'epic (aucun accès distant depuis cette session) ; résultat à consigner ci-dessous.

## Acceptance Criteria

1. **Given** les specs fonctionnelles, **When** `npm run test:local -- functional` est exécuté (ffmpeg disponible
   localement et en CI), **Then** les scénarios de l'épique passent :
   - Vignette → pose, remplacement (ancien préfixe supprimé), retrait, format et taille refusés, journal `update`
     `{ field: 'thumbnail' }`
   - Image extraite → poster créé au téléversement d'un MP4 généré, échec non bloquant, suppression avec la vidéo
   - `/media` → vignette et poster servis pour une production publiée, 404 pour un brouillon ou une ancienne clé,
     `Cache-Control` attendus
   - Cartes et détail → aucune image dans les cartes, aucune `og:image` de production (D37)
   - Une → enregistrement ordonné, vide, > 3, brouillon, vignette requise (vidéo hébergée exemptée, vidéo externe non),
     journal `featured_update`
   - Retrait automatique → dépublication et suppression, recompactage, journal `featured_auto_remove`
   - Accueil → bannière ordonnée, absente si vide, à jour immédiatement
2. **Given** les specs unitaires (`ImageService` 16:9, `requiresThumbnail`, `deployment.spec.ts` ffmpeg, composants
   par lecture de source, parité i18n), **When** `npm run test:local -- unit` est exécuté, **Then** elles passent.
3. *(ajout 11.7)* **Parcours vignette** par les routes admin : téléversement (`POST …/thumbnail`, image `sharp`) de
   3 productions publiées, `PUT /admin/featured` → bannière ordonnée dont chaque `imageUrl` est servie (3 variantes,
   cache d'un an `immutable`) ; remplacement → la bannière suit la nouvelle clé, l'ancienne → 404 ; retrait refusé
   (`required_for_featured`) tant qu'elle est à la une ; dépublication (`POST …/unpublish`) de la 1re → retirée,
   positions 1–2 recompactées, image 404, page « À la une » à jour, journal `featured_auto_remove`
   `{ position: 1, cause: 'unpublish' }` ; republication → image de nouveau servie mais **pas** de retour dans la
   bannière ; suppression (`DELETE /admin/productions/:id`) → retirée, variantes supprimées de R2, journal
   `cause: 'delete'` ; la page Journal (`/admin/activity`) filtre et liste ces entrées.
4. *(ajout 11.7)* **Parcours vidéo** : MP4 téléversé (`POST …/files`, ffmpeg) puis publication → mise à la une sans
   vignette acceptée, bannière sur l'image extraite (`/media/posters/…`, servie) ; vignette posée → la bannière passe à
   la vignette ; vignette retirée (permis grâce au poster) → retour au **même** poster sans retraitement ; vidéo
   supprimée (`DELETE …/files/:fileId`) → poster supprimé de R2 et 404, production écartée de la bannière (D-11.6-2)
   mais toujours dans la sélection avec « Vignette manquante » (D-11.5-6), et un nouvel enregistrement est refusé
   (`thumbnail_required`).
5. *(ajout 11.7)* **Matrice** des 24 états (point 2 de la décision de périmètre), D37 vérifiée pour chaque état.
6. *(ajout 11.7)* Toutes les clés i18n (littérales, gabarits dépliés, clés du serveur) de l'epic existent en FR et EN
   dans les bonnes locales ; l'accueil (avec bannière) et la page « À la une » ont un seul `h1` sur leur arbre rendu.
7. *(porte manuelle)* **Given** le staging après livraison de l'epic, **When** un audit Lighthouse mobile 4G est lancé
   sur l'accueil avec 3 productions à la une, **Then** le LCP est < 3 s (NFR17) et le résultat est consigné ici.

## Inventaire de couverture existante (AC 1 et 2)

| Exigence | Déjà couvert par |
|---|---|
| Vignette : pose, remplacement, retrait, refus (format, taille, 40 Mpx), journal `set` / `remove`, pannes | `functional/admin/production_thumbnail.spec.ts` (19 tests) |
| Image extraite : MP4 généré, < 1 s, corrompu, audio seul, ffmpeg absent, R2 en échec, PDF, suppressions, courses | `functional/admin/production_files_poster.spec.ts` (14), `unit/services/video_frame_service.spec.ts`, `functional/admin/thumbnails_extract_video_frames.spec.ts` |
| `/media/thumbnails` et `/media/posters` : 200, cache, ETag, HEAD, brouillon / dépubliée / ancienne clé / croisée / mal formée, 503 | `functional/public/media.spec.ts` (groupes 11.2 et 11.3), `unit/services/media_service.spec.ts` |
| D37 : cartes sans image, détail sans `og:image` | `media.spec.ts` (« cartes texte malgré une vignette »), `seo.spec.ts` (« production avec vignette »), `unit/transformers/production_card_transformer.spec.ts`, `home.spec.ts` (og:image) |
| Une : ordonné, vide, > 3, doublons, brouillon, vignette requise, poster accepté, vidéo externe refusée, journal `featured_update` | `functional/admin/featured.spec.ts` (28 tests) |
| Retrait automatique : dépublication, suppression, dépublication automatique, recompactage, journal, concurrence | `functional/admin/featured_auto_remove.spec.ts` (19 tests) |
| Accueil : bannière ordonnée, vide, exclusions, à jour après `PUT` | `functional/public/home.spec.ts` (groupe 11.6) |
| `ImageService` 16:9, `requiresThumbnail`, ffmpeg (Dockerfile / CI) | `unit/services/image_service.spec.ts`, `unit/services/featured_service.spec.ts`, `unit/infrastructure/deployment.spec.ts` |
| Composants par lecture de source | `thumbnail_field`, `featured_page`, `home_featured_banner`, `production_confirm_dialog`, `media_viewer`, `activity_logs_page` |
| Parité globale fr/en | `unit/i18n/translations.spec.ts` (mêmes clés des deux côtés, pas l'usage) |

Manques : aucun test n'enchaîne téléversement réel → une → accueil → `/media` ; les specs de la une et de l'accueil
posent des clés factices sans objet R2 (jamais vérifié qu'une `imageUrl` de la bannière est réellement servie) ;
dépublication / suppression vérifiées côté table, pas côté accueil ni `/media` ; republication après retrait
automatique jamais testée ; suppression de la vidéo d'une production à la une jamais testée de bout en bout ; poster
jamais cherché dans les cartes ; aucune vérification que les clés des gabarits (`featured.state.*`, `_slot`,
`productions.*_modal.*`, `activity.action.*`) et les clés envoyées par le serveur existent ; `h1` de l'accueil avec
la bannière hors de la règle d'arbre.

## Tasks / Subtasks

- [x] T1 Parcours vignette (AC 3) — `tests/functional/public/featured_flows.spec.ts`
  - [x] Helpers : `surfaces(client)` (prop `featured` de l'accueil), `assertServed(imageUrl)` (3 variantes, 200,
        `image/webp`, cache d'un an), `assertRefused(prefix)` (variantes réécrites sur le disque factice **avant** la
        requête : la 404 vient de la règle, pas de l'objet absent), `assertD37(production)`.
  - [x] Publication par `POST …/publish`, vignettes par `POST …/thumbnail`, sélection par `PUT /admin/featured`.
  - [x] Remplacement, retrait refusé, dépublication, republication, suppression ; journal et page Journal.
- [x] T2 Parcours vidéo (AC 4) — même fichier
  - [x] MP4 généré (`makeMp4`), téléversé par `POST …/files`, poster réel ; une sans vignette ; vignette posée puis
        retirée ; vidéo supprimée ; nouvel enregistrement refusé.
- [x] T3 Matrice (AC 5) — même fichier, 24 tests générés par boucle (clés courantes et anciennes, vignette et
      poster, page « À la une » : `unavailable` / `imageState` de l'état périmé).
- [x] T4 i18n et a11y consolidés (AC 6) — `tests/unit/i18n/featured_keys.spec.ts`, `a11y_components.spec.ts`
- [x] T5 Preuve d'échec : casser temporairement chaque règle gardée par un nouveau test passant d'emblée, puis
      restaurer (`git diff` vide sur `app/` et `inertia/`).
- [x] T6 Deux exécutions complètes de la suite, lint, typecheck, build.

## Dev Notes

### Garde-fous
- Transaction globale par test (`db.beginGlobalTransaction` / `rollbackGlobalTransaction`), `drive.fake('r2')` +
  `drive.restore('r2')` ; dossier d'images temporaire `mkdtempSync` dans `group.setup`, supprimé au teardown.
- Japa : `.loginAs(admin)`, `.withCsrfToken()`, `.redirects(0)` ; `AdminUser` reçoit un mot de passe en clair.
- `publish` exige une production complète (pivot auteur + fichier pour `member`, cf. `productions_publish.spec.ts`).
- Vidéo : `makeMp4` de `tests/video_fixtures.ts` (ffmpeg `testsrc`, aucun binaire commité) ; `.timeout(60_000)` sur
  les tests qui téléversent.
- `/media` lit le disque factice : pour une 404 « règle », réécrire les variantes avant la requête (leçon de la revue
  10.8).
- Une production à la une non publiée ne peut exister que par un état périmé : la matrice l'insère directement dans
  `featured_productions` (comme `home.spec.ts`).
- Noms fictifs, aucun hôte en dur. Aucun code produit modifié sauf bug révélé (consigné).

### Règles vérifiées (sources)
- Image de la bannière : `FeaturedService.bannerRows` → `MediaService.productionImageUrl` (vignette, sinon premier MP4
  pourvu d'un poster, D-11.3-2) ; production sans image écartée (D-11.6-2).
- `/media` : `MediaService.resolve` → `thumbnails` (clé courante ∧ `published`), `posters` (clé courante ∧
  `video/mp4` ∧ `published`) ; la une n'est pas une condition (D-11.2-2).
- Retrait automatique : `ProductionService.unpublish` / `.delete` → `FeaturedService.removeProduction` (journal après
  commit) ; republier ne remet pas à la une.
- Suppression de la vidéo : `FilesController.destroy` ne touche pas la une (D-11.5-6).

### Références
- `_bmad-output/planning-artifacts/epics.md` — Epic 11, Story 11.7
- `_bmad-output/planning-artifacts/architecture.md` — P2.8 Stratégie de test, P2.5, P2.6
- Stories `11-1` … `11-6`, `10-8` (précédent), `deferred-work.md`

## Décisions (D-11.7-n)

- **D-11.7-1** : aucune duplication des specs 11.1–11.6 ; les nouveaux tests passent par les routes admin réelles et
  regardent **toutes** les surfaces à chaque étape (modèle 10.8).
- **D-11.7-2** : un fichier de parcours `tests/functional/public/featured_flows.spec.ts` (surfaces publiques pilotées
  par l'admin, comme `authors_privacy_matrix.spec.ts`), un fichier i18n `tests/unit/i18n/featured_keys.spec.ts`.
- **D-11.7-3** : une 404 de `/media` n'est retenue comme preuve qu'après réécriture des variantes sur le disque
  factice ; la suppression R2 est vérifiée séparément (`assertMissing`).
- **D-11.7-4** (reformulée à la revue) : republier une production retirée automatiquement **ne la remet pas** à la
  une : FR51 ne prévoit que le retrait, aucune remise automatique, et la sélection reste éditoriale (l'admin la
  re-sélectionne) ; sa vignette redevient servable (D-11.2-2) sans être exposée. Comportement actuel, conforme à la
  spécification, figé par le test ; à confirmer par le PO (`[Review][PO]`).
- **D-11.7-5** : pas d'axe, de suite `browser` ni de dépendance (PO, 2026-11-21) ; Lighthouse = porte manuelle (AC 7).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Premier passage de `featured_flows.spec.ts` : 8 échecs dus au test (fichiers du détail sous `props.production.files`,
  pas `props.files`) ; corrigé → 27/27.
- Preuves d'échec (règle cassée temporairement puis restaurée par `work/11-7/mutate.py`, hors dépôt ; `git diff` vide
  sur `app/` et `inertia/` ensuite) — chaque mutation fait échouer au moins un nouveau test :
  - `/media/thumbnails` sans `status = published` → 9 échecs ; `/media/posters` sans `status` → 8 ;
  - `productionImageUrl` poster avant vignette → 2 (matrice « both », parcours vidéo) ;
  - `bannerRows` gardant une production sans image → 2 (matrice, parcours vidéo) ;
  - `ProductionService.unpublish` sans `removeProduction` → parcours vignette ;
  - `FilesController.destroy` sans `PosterService.discard` → parcours vidéo ;
  - `thumbnailKey` ajouté à la carte (`production_card_transformer`) → 7 (D37 : matrice + parcours) ;
  - i18n : `featured.errors.not_found_slot` absente en EN → 2 ; `featured.state.poster` absente en FR → 1 ; code
    `bogus` ajouté à `FeaturedErrorCode` → 3 ; `settle(trace, 'thumbnail.removedx')` → 1 ; `featured.region` publique
    absente → 1 ;
  - `<h1` dans `shared/FeaturedBanner` → 2 (accueil et page « À la une »).
- Lint : `naming-convention` (`_featured`) et 3 `no-await-expression-member` corrigés.
- Suite complète `npm run test:local` : **1323 tests verts deux fois de suite** (baseline 1274, +49), code 0. `npm run
  lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Rien contre Supabase ni R2
  (`drive.fake('r2')`), aucune migration.

### Completion Notes List

- Inventaire : toutes les puces des AC 1 et 2 étaient déjà couvertes par les specs 11.1–11.6 (tableau ci-dessus) ;
  aucune duplication.
- Ajouté `tests/functional/public/featured_flows.spec.ts` (27 tests) :
  - parcours vignette (vraies images `sharp`, routes `publish`, `thumbnail`, `PUT /admin/featured`, `unpublish`,
    `DELETE` production, page Journal) : bannière, 3 variantes servies avec cache d'un an, ancienne clé supprimée de
    R2 et refusée, retrait refusé à la une, recompactage, republication sans retour à la une (D-11.7-4), journal
    `update` / `featured_update` / `featured_auto_remove` et filtres de `/admin/activity` ; sélection vidée → retrait de
    vignette permis ;
  - parcours vidéo (MP4 ffmpeg, `POST …/files`) : une sans vignette, vignette prioritaire puis retirée (même poster),
    vidéo supprimée → poster supprimé / refusé, production écartée de la bannière mais signalée « Vignette manquante »
    dans la sélection, aucun `featured_auto_remove`, ré-enregistrement refusé avec l'emplacement nommé ;
  - matrice de 24 états statut × une × image : bannière, `/media` (courantes et anciennes clés), aucune autre clé sur
    l'accueil, page « À la une » (état périmé `unavailable`), D37 (cartes de l'accueil, listing, profil, détail
    `<head>` et props hors `posterUrl`) ; 404 « règle » après réécriture des variantes (D-11.7-3).
- Ajouté `tests/unit/i18n/featured_keys.spec.ts` (20 tests) : 7 fichiers admin + helper, `labelKey` de la navigation,
  2 fichiers publics, gabarits dépliés depuis les sources (`FeaturedImageState`, `kind`, `FeaturedErrorCode` → `_slot`,
  `ActionType`), clés du serveur (validateurs, contrôleurs, flash), rendu partagé sans i18n.
- `a11y_components.spec.ts` : règle « un seul h1 sur l'arbre » étendue à l'accueil (bannière) et à la page « À la une »
  (`componentTree` accepte le layout).
- **Aucun bug produit révélé** ; aucun code produit modifié.
- AC 7 (Lighthouse staging) non exécuté : porte manuelle d'Aurélien, consignée ci-dessous et dans `deferred-work.md`.

### File List

- `tests/functional/public/featured_flows.spec.ts` (nouveau)
- `tests/unit/i18n/featured_keys.spec.ts` (nouveau)
- `tests/unit/components/a11y_components.spec.ts` (modifié)
- `_bmad-output/implementation-artifacts/11-7-tests-vignettes-et-productions-a-la-une.md` (nouveau)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié : porte Lighthouse 11.7)

### Review Findings

Revue de code du 2026-11-21 : 4 correctifs (tests et story seulement, aucun code produit modifié), 1 question PO.

- [x] [Review][Patch] D37 vide de sens sur l'accueil [tests/functional/public/featured_flows.spec.ts, `assertD37`] — la production n'était pas exigée dans les blocs de l'accueil avant les `notInclude` ; présence exigée (`production dans les blocs`).
- [x] [Review][Patch] Ordre du journal instable [featured_flows.spec.ts, `logsOf`] — `createdAt` à la milliseconde peut être ex æquo : tri secondaire par `id`, et comparaison par membres (`sameDeepMembers`) là où l'ordre n'est pas le sujet (sélection posée puis vidée).
- [x] [Review][Patch] Gabarit hors `t()` non vérifié [tests/unit/i18n/featured_keys.spec.ts] — `setError(`thumbnail.errors.${invalid}`)` de `ThumbnailField` : gabarits littéraux des espaces `thumbnail.` / `featured.` détectés aussi hors `t()`, dépliés depuis `ThumbnailClientError` (`inertia/lib/thumbnail.ts`). Preuves : préfixe faussé dans `ThumbnailField` → test de couverture en échec ; valeur `bogus` ajoutée à l'union → 2 échecs.
- [x] [Review][Patch] Story : D-11.7-4 reformulée (FR51 ne dit pas que le retrait est définitif ; comportement conforme), nombre de tests de `featured.spec.ts` corrigé (29 → 28).
- [ ] [Review][PO] Republication après retrait automatique : pas de retour à la une (D-11.7-4).

### Lighthouse (AC 7)

- À faire par Aurélien sur le staging (mobile, 4G simulée) : accueil avec 3 productions à la une ; LCP < 3 s.
  Résultat : —

## Questions ouvertes (non bloquantes, défauts retenus)

1. **Republication après retrait automatique** (D-11.7-4, `[Review][PO]`) : la production ne revient pas à la une
   (il faut la re-sélectionner). Défaut conservé et figé par le test — à confirmer.
2. **Suppression de la vidéo d'une production à la une sans vignette** (reprise de D-11.5-6 / D-11.6-2) : désormais
   couverte de bout en bout (écartée de la bannière, signalée dans la sélection) ; bloquer la suppression reste une
   question PO ouverte.
3. Constat hors epic (préexistant, Epic 4) : supprimer le dernier fichier d'une production publiée la laisse publiée
   sans fichier (la dépublication automatique FR22 n'a lieu qu'à l'enregistrement du formulaire). Non modifié.

## Change Log

- 2026-11-21 : création (bmad-create-story), inventaire de couverture.
- 2026-11-21 : implémentation (bmad-dev-story, 1323 tests verts deux fois de suite, lint, typecheck, build) : parcours
  vignette et vidéo par les routes admin, matrice `/media` × bannière × D37, i18n et a11y consolidés ; statut → review.
- 2026-11-21 : revue de code, 4 constats corrigés (présence dans les blocs de l'accueil, ordre du journal, gabarit
  `thumbnail.errors.${invalid}`, story) + 1 question PO ; 1323 tests verts, lint, typecheck, build ; statut → done.
