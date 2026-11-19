---
baseline_commit: 1cf4ed8
---

# Story 10.8 : Tests auteurs sur le site public

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que développeur,
Je veux une suite de tests couvrant la visibilité des auteurs sur le site public,
Afin de garantir qu'aucun profil non consenti n'est exposé.

## Décision de périmètre (lire en premier)

Les stories 10.1–10.7 ont livré leurs tests au fil de l'eau (1012 tests au HEAD `1cf4ed8`). L'inventaire ci-dessous
montre que **chaque puce de l'AC 1 et chaque spec unitaire de l'AC 2 est déjà couverte** par au moins un test, souvent
dans un fichier voisin de celui que nomme l'épique (bylines → `bylines.spec.ts`, filtre `author=` → `search.spec.ts`,
section « auteurs » de la politique → `tests/unit/components/privacy_policy_page.spec.ts` car `ssr: false` : le texte
n'est jamais dans la réponse HTTP).

Cette story **ne duplique rien** : elle ajoute ce qu'aucun test ne vérifie encore, c'est-à-dire la cohérence **entre**
les surfaces, là où une fuite passerait inaperçue (chaque spec ne regarde que sa page) :

1. **Matrice de confidentialité de bout en bout** : consentement × production publiée × photo, chaque état vérifié
   d'un coup sur **toutes** les surfaces publiques (profil, `/authors` et sa recherche, facettes, bylines du détail, du
   listing et de l'accueil, filtre `author=`, `/media`, `<head>` de la production et du profil).
2. **Transitions pilotées par les vraies routes admin** (et non par `UPDATE` direct comme les specs 10.x) : retrait /
   reconfirmation du consentement, dépublication / republication de la dernière production, remplacement et retrait de
   la photo, renommage (slug figé) → effet immédiat sur toutes les surfaces publiques. C'est aussi la **non-régression
   des flux admin** : l'admin continue de voir et d'éditer les fiches non visibles.
3. **Parité i18n consolidée** des clés utilisées par l'ensemble des fichiers publics de l'epic (y compris ceux qu'aucun
   test de composant ne scanne : `Pagination`, `not_found`, `PublicLayout`…).
4. **A11y par lecture de source** : la règle « un seul `h1` par page publique » étendue aux pages `authors.tsx` et
   `author.tsx` (le `h1` du profil vit dans `AuthorProfileHeader`).

Hors périmètre (constaté, consigné) :
- **Audit Lighthouse sur le staging (AC 3)** : services distants interdits dans cette session → reporté à Aurélien
  après déploiement de l'epic (porte manuelle, résultat à consigner dans cette story).
- **Suite `browser` + axe** (architecture P2.8) : `@axe-core/playwright` n'est **pas** dans `package.json` (aucune
  dépendance ajoutée, consigne) et `tests/browser/` n'existe pas ; non demandé par l'AC de 10.8 → `deferred-work.md`.

## Acceptance Criteria

1. **Given** les specs fonctionnelles publiques, **When** `npm run test:local -- functional` est exécuté, **Then** les
   scénarios suivants passent :
   - Profil → 200 si visible ; 404 si slug inconnu, sans consentement, sans production publiée, après retrait du
     consentement, après dépublication de la dernière production
   - `/media/authors/…` → servi pour un profil public ; 404 pour un profil non public, une ancienne clé,
     `productions/…`, `..`
   - Liste → auteurs visibles seulement, recherche, filtres, tris, ex æquo, page hors limites → 302
   - Bylines → `slug` seulement pour les profils publics, ordre du pivot
   - Filtre `author=<slug>` → OU entre auteurs, ET avec les autres filtres, facette limitée aux auteurs visibles
   - SEO → balises profil (`og:type=profile`, `og:image` si photo), liste ; aucune donnée d'auteur non public dans les
     meta de production
   - Politique de confidentialité → section « auteurs » présente en FR et EN ; 404 traduite
2. **Given** les specs unitaires (`SeoService`, composants `Avatar`, `AuthorByline`, `AuthorCard`, `AuthorFilters`,
   `AuthorProfileHeader`, `SortSelect` par lecture de source, parité i18n), **When** `npm run test:local -- unit`,
   **Then** elles passent.
3. **Given** le staging après livraison de l'epic, **When** un audit Lighthouse mobile 4G est lancé sur `/authors` et
   un profil, **Then** le LCP est < 3 s (NFR17) et le résultat est consigné dans la story. *(Porte manuelle d'Aurélien,
   voir Décision de périmètre.)*
4. *(ajout 10.8)* Une matrice de bout en bout vérifie, pour chaque combinaison consentement × production
   (publiée / brouillon seulement / aucune) × photo, l'exposition attendue sur toutes les surfaces publiques ; visible
   ⇔ consentement **et** production publiée ; photo servie ⇔ consentement **et** photo (règle 10.2) ; jamais de slug,
   d'id ou de clé photo d'un auteur non visible dans une réponse publique.
5. *(ajout 10.8)* Les transitions passent par les routes admin (`withdraw-consent`, `confirm-consent`, `unpublish`,
   `publish`, `PUT /admin/authors/:id` avec photo / `removePhoto` / nouveau nom) et chaque surface publique reflète
   l'état au rechargement suivant ; l'admin voit toujours la fiche non visible.
6. *(ajout 10.8)* Toutes les clés i18n littérales des fichiers publics de l'epic existent en FR et EN ; chaque page
   publique de l'epic a un seul `h1`.

## Inventaire de couverture existante (AC 1 et 2)

| Exigence | Déjà couvert par |
|---|---|
| Profil 200 / 404 (slug inconnu, sans consentement, sans production publiée, retrait, dépublication) | `functional/public/author_profile.spec.ts` (groupe visibilité, 7 tests + course) |
| `/media` public / non public / ancienne clé / `productions/…` / `..` | `functional/public/media.spec.ts` (15 tests) |
| Liste : visibles, recherche, filtres, tris, ex æquo, 302 | `functional/public/authors_list.spec.ts` (24 tests) |
| Bylines : slug public, ordre du pivot | `functional/public/bylines.spec.ts` (12 tests) |
| Filtre `author=` : OU, ET, facette visible | `functional/public/search.spec.ts` (≈ 14 tests 10.6) |
| SEO profil / liste / production | `functional/public/seo.spec.ts` (groupe 10.7) |
| Politique : section « auteurs » FR/EN | `unit/components/privacy_policy_page.spec.ts` (ssr:false) ; titres FR/EN dans `privacy.spec.ts` |
| 404 traduite | `functional/public/not_found.spec.ts` |
| `SeoService` | `unit/services/seo_service.spec.ts` |
| `Avatar` | `unit/components/avatar.spec.ts` |
| `AuthorByline` | `unit/components/author_byline.spec.ts` |
| `AuthorCard`, `AuthorFilters` | `unit/components/authors_list.spec.ts` |
| `AuthorProfileHeader`, `SortSelect` | `unit/components/author_profile.spec.ts` |
| Parité i18n globale | `unit/i18n/translations.spec.ts` |

Manques : cohérence inter-surfaces par état (aucun test ne regarde toutes les surfaces pour un même auteur), transitions
par les routes admin (les specs 10.x modifient la base directement), photo d'un auteur consentant sans production publiée
(servie par `/media` mais jamais exposée), scan i18n de `Pagination` / `not_found` / `PublicLayout`, `h1` de
`authors.tsx` / `author.tsx` dans la règle a11y globale.

## Tasks / Subtasks

- [x] T1 Matrice de confidentialité (AC 1, 4) — `tests/functional/public/authors_privacy_matrix.spec.ts`
  - [x] Helper `surfacesOf(author)` : profil (statut, `photoBase`), `/authors` (présence), `/authors?q=<nom>`,
        `facets.author` de `/productions`, `/productions?author=<slug>` (filtre appliqué ou ignoré), slug dans les
        bylines du détail / listing / accueil d'une production publiée co-signée, `/media/authors/<clé>/w128.webp`,
        recherche de l'id / slug / clé dans chaque corps.
  - [x] 12 états (consentement oui/non × publiée / brouillon / aucune × photo oui/non) générés par boucle.
  - [x] `<head>` : profil visible avec photo → og:image (dans la matrice). La production co-signée par un auteur non
        visible est déjà couverte par `seo.spec.ts` (« production : aucune og:image… ») → non dupliquée.
- [x] T2 Transitions par l'admin (AC 5) — même fichier, groupe dédié
  - [x] `withdraw-consent` puis `confirm-consent` → disparition puis réapparition partout.
  - [x] `unpublish` de la dernière production puis `publish` → idem.
  - [x] `PUT` avec nouvelle photo → ancienne clé 404, nouvelle 200, `photoBase` mis à jour ; `removePhoto=1` → 404,
        `photoBase` null, `og:image` absente.
  - [x] Renommage → même slug, nouveau nom (profil, byline, liste) ; l'admin liste toujours la fiche non visible.
- [x] T3 i18n et a11y consolidés (AC 2, 6) — `tests/unit/i18n/public_authors_keys.spec.ts`, `a11y_components.spec.ts`
- [x] T4 Preuve d'échec : casser temporairement la règle gardée (scope `visibleOnSite`, `publicPhotoBase`, filtre de
      consentement de `MediaService.resolve`, clé i18n) pour chaque nouveau test passant d'emblée, puis restaurer.
- [x] T5 Deux exécutions complètes de la suite (fuites / ordre), lint, typecheck, build.

## Dev Notes

### Garde-fous
- Transaction globale par test (`db.beginGlobalTransaction` / `rollbackGlobalTransaction`), `drive.fake('r2')` +
  `drive.restore('r2')` ; aucune donnée ne survit (base locale partagée par toute la suite).
- Japa : `.loginAs(admin)`, `.withCsrfToken()`, `.redirects(0)` sur les POST/PUT admin ; `AdminUser` reçoit un mot de
  passe en clair (le mixin hashe).
- Noms fictifs, aucun hôte en dur (`APP_URL` de l'environnement de test).
- `/media` : chemins envoyés tels quels par le client (pas de `..` ici, donc le client Japa suffit).
- `confirm-consent` exige une affiliation ; `publish` exige une production complète (pivot + fichier ou lien selon la
  licence, cf. `productions_publish.spec.ts`).
- Photos : images générées par `sharp` (pas de binaire commité), comme `authors_photo.spec.ts`.
- Aucun code produit modifié sauf bug révélé (consigné).

### Règles vérifiées (sources)
- Visibilité : scope `visibleOnSite` (P2.1, D11) ; `MediaService.resolve` filtre `consent_confirmed_at IS NOT NULL`
  sans exiger de production publiée ; `MediaService.publicPhotoBase` n'est appelé qu'avec un auteur visible.

### Références
- `_bmad-output/planning-artifacts/epics.md` — Epic 10, Story 10.8
- `_bmad-output/planning-artifacts/architecture.md` — P2.8 Stratégie de test
- Stories `10-1` … `10-7`, `deferred-work.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Preuves d'échec (code gardé cassé temporairement puis restauré, `git diff` vide sur `app/` et `inertia/`) :
  - `Author.visibleOnSite` sans `whereHas(productions publiées)` → 4 états « consentement × brouillon/aucune » + la
    transition dépublication échouent ; sans `whereNotNull(consent_confirmed_at)` → 2 états « sans consentement ×
    publiée » + la transition retrait échouent.
  - `PublicAuthorService.visibleSlugs` sans le scope → bylines et détecteur de fuite échouent (3 tests).
  - `MediaService.resolve` sans filtre de consentement → 3 états photo + transition retrait ; sans `photo_key` courant →
    transition photo (le test remet les anciennes variantes sur le disque : sinon l'absence d'objet masquait la règle,
    premier essai passé à tort, corrigé).
  - Slug recalculé au renommage (`beforeSave`) → test de renommage échoue.
  - Clé `pagination.next` renommée dans `Pagination.tsx` → tests public + admin ; `others_one` supprimée de
    `public/en.json` → test du fichier + test des pluriels ; `not_found.authors` absente de `admin/fr.json` → test admin ;
    `h1` → `h2` dans `AuthorProfileHeader` → test a11y.
- Script de mutation : `work/10-8/mutate.sh` (hors dépôt).

### Completion Notes List

- Inventaire : toutes les puces des AC 1 et 2 étaient déjà couvertes par les specs 10.1–10.7 (tableau ci-dessus) ;
  aucune duplication.
- Ajouté : matrice de 12 états × 8 surfaces publiques (profil + og:image, `/authors?q=`, facette, filtre `author=`,
  bylines détail / listing / accueil, `/media`, recherche du slug / id / jeton photo dans 5 à 6 corps publics) ;
  4 transitions par les routes admin (consentement, publication, photo remplacée / retirée, renommage) qui vérifient
  aussi que l'admin voit et ouvre une fiche non visible ; parité i18n consolidée (12 fichiers publics, 3 fichiers
  partagés rendus aussi par le bundle admin, pluriels) ; règle « un seul h1 » étendue à `authors.tsx`, `not_found.tsx`
  et au couple `author.tsx` + `AuthorProfileHeader`.
- Aucun bug produit révélé ; aucun code produit modifié.
- AC 3 (Lighthouse staging) non exécuté : services distants interdits ici → porte manuelle d'Aurélien après
  déploiement de l'epic, résultat à consigner ci-dessous.
- Suite `browser` + axe (P2.8) absente et `@axe-core/playwright` non installé : consigné dans `deferred-work.md`.

### File List

- `tests/functional/public/authors_privacy_matrix.spec.ts` (nouveau)
- `tests/unit/i18n/public_authors_keys.spec.ts` (nouveau)
- `tests/unit/components/a11y_components.spec.ts` (modifié)
- `_bmad-output/implementation-artifacts/10-8-tests-auteurs-sur-le-site-public.md` (nouveau)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié)

### Lighthouse (AC 3)

- À faire par Aurélien sur le staging (mobile, 4G simulée) : `/authors` et un profil ; LCP < 3 s. Résultat : —

## Questions ouvertes (non bloquantes, défauts retenus)

1. **Photo d'un auteur consentant sans production publiée** : `/media` la sert (règle 10.2 : « profil public » =
   consentement) alors que le profil n'est visible nulle part ; la clé n'étant jamais exposée, le risque est faible.
   Défaut : comportement conservé et figé par la matrice. Faut-il aligner `/media` sur « visible sur le site » ?
2. **Tests d'accessibilité automatisés** (axe, P2.8) : ajouter `@axe-core/playwright` et une suite `browser`
   (Chromium dans la CI) ? Non fait sans accord (aucune dépendance ajoutée).

## Change Log

- 2026-11-19 : création (bmad-create-story), inventaire de couverture.
- 2026-11-19 : implémentation (bmad-dev-story, 1048 tests verts deux fois de suite, lint, typecheck, build) : matrice de confidentialité, transitions admin, i18n et a11y consolidés ;
  statut → review.
