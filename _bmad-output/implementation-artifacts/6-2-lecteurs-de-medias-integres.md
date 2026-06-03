# Story 6.2 : Lecteurs de médias intégrés

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **lire un document ou visionner un média directement dans le navigateur, sans téléchargement préalable**,
afin d'**évaluer le contenu avant de décider de le télécharger** (FR11, FR12, FR13, UX-DR8).

## Décision de périmètre (lire en premier)

- **Stratégie lecteurs (décision Aurélien 2026-06-02)** : **PDF en `<iframe>` natif** (rendu navigateur, 0 dépendance) ; **EPUB en repli** (bouton « Ouvrir / Télécharger », pas de lecteur inline pour le MVP) ; **MP4 → `<video>`**, **MP3/AAC → `<audio>`** natifs HTML5. **Aucune dépendance front ajoutée.** Lecture inline EPUB reportée (amélioration ultérieure).
- **URLs signées R2** : générées **côté serveur dans `show`** (TTL 1h via `FileStorageService.signedUrl`), injectées dans les props (une `url` par fichier). Pas d'endpoint séparé.
- **DANS le périmètre 6.2** : composant `MediaViewer` (dispatch par MIME) + `PdfViewer`, génération des URLs signées dans `show`, intégration dans `inertia/pages/production.tsx` (remplace la liste simple de fichiers posée en 6.1), gestion multi-fichiers, repli gracieux si URL indisponible, i18n, tests.
- **HORS périmètre (Story 6.3)** : bouton **« Télécharger »** + `StatsService.recordDownload` + message d'erreur de téléchargement ; **iframe d'un lien externe `embed`** (sandbox) ; bouton **« Accéder à la source »** pour `external_link`. En 6.2, si une production n'a **aucun fichier hébergé**, on n'affiche **aucun lecteur** (le bouton source viendra en 6.3).
- **HORS périmètre (Story 6.4)** : enregistrement de vue (timer 10s).

## Acceptance Criteria

1. **Given** une production a un fichier **PDF** (`application/pdf`) associé, **When** la page détail se charge, **Then** un lecteur intégré (`<iframe>` pointant sur l'URL signée R2) affiche le PDF dans le navigateur, avec un `title` accessible.
2. **Given** une production a un fichier **EPUB** (`application/epub+zip`), **When** la page détail se charge, **Then** aucun lecteur inline n'est rendu mais un bouton **« Ouvrir le document »** (URL signée, `target="_blank" rel="noopener noreferrer"`) est affiché, accompagné du nom et du format du fichier.
3. **Given** une production a un fichier **MP4** (`video/mp4`), **When** la page se charge, **Then** un lecteur `<video controls>` (contrôles natifs : lecture, pause, volume, plein écran) lit le fichier via l'URL signée R2 (TTL 1h).
4. **Given** une production a un fichier **MP3/AAC** (`audio/mpeg`, `audio/aac`), **When** la page se charge, **Then** un lecteur `<audio controls>` (contrôles natifs) lit le fichier via l'URL signée R2 (TTL 1h).
5. **Given** une production a **plusieurs fichiers**, **When** la page se charge, **Then** chaque fichier dispose de son propre lecteur/bloc d'accès, listé avec son **nom** et son **format** (badge MIME).
6. **Given** une production a `licenseStatus = 'external_link'` et **aucun fichier hébergé**, **When** la page se charge, **Then** **aucun lecteur intégré** n'est affiché (le bouton « Accéder à la source » relève de la Story 6.3).
7. **Given** l'URL signée d'un fichier n'a pas pu être générée (erreur R2), **When** la page se rend, **Then** le bloc du fichier affiche un état de repli discret (« Aperçu indisponible » + nom/format) **sans** erreur non gérée exposée (NFR12).
8. **Given** le rendu serveur de `show`, **When** la production a des fichiers, **Then** chaque fichier sérialisé porte une `url` signée (TTL 1h) ; la génération est faite côté serveur (jamais la clé R2 brute exposée).
9. **Given** l'interface, **When** les lecteurs sont rendus, **Then** tous les textes/labels passent par `react-i18next` (FR/EN, parité stricte) ; les lecteurs sont accessibles (iframe `title`, contrôles natifs clavier, boutons avec libellés explicites) et **n'empêchent jamais** l'accès au reste de la page (UX-DR8 — « le lecteur s'efface »).

## Tasks / Subtasks

- [x] **Tâche 1 — URLs signées dans `show`** (AC: #1–#4, #7, #8)
  - [x] `app/controllers/public/productions_controller.ts` → méthode `show` : après le chargement de la production (déjà `preload('files')`), construire `filesWithUrls` via `Promise.all(production.files.map(...))` : `{ id, originalName, mimeType, sizeBytes, url }` où `url = await FileStorageService.signedUrl(f.fileKey)`.
  - [x] **Repli par fichier** : envelopper `signedUrl` dans un `try/catch` → `url: null` en cas d'échec (NFR12, AC#7). Logger l'erreur (`logger.error`) sans la propager.
  - [x] Passer `{ ...serializeDetail(production), files: filesWithUrls }` à `inertia.render('production', ...)` (remplacer les `files` sans url de la 6.1). Importer `FileStorageService` + `logger`.
  - [x] `serializeDetail` : retirer `files` de l'objet retourné OU le laisser et l'écraser dans `show` (au choix, mais une seule source de `files` dans les props finales).

- [x] **Tâche 2 — Composant `PdfViewer`** (AC: #1)
  - [x] Créer `inertia/components/public/PdfViewer.tsx` : `<iframe src={url} title={t('media.pdf_viewer_title', { name })} className="h-[75vh] w-full rounded-lg border border-stone-200" />`. Pas de `sandbox` (URL R2 de confiance ; le viewer PDF natif a besoin de ses scripts). `loading="lazy"`.

- [x] **Tâche 3 — Composant `MediaViewer` (dispatch par MIME)** (AC: #1–#7, #9)
  - [x] Créer `inertia/components/public/MediaViewer.tsx`. Props : `{ file: { id, originalName, mimeType, sizeBytes, url: string | null } }`.
  - [x] En-tête de bloc : nom du fichier + `Badge` format (MIME ou libellé court). Toujours visible.
  - [x] Dispatch par `file.mimeType` :
    - `application/pdf` → `<PdfViewer url={url} name={originalName} />`
    - `video/mp4` → `<video controls preload="metadata" src={url} className="w-full rounded-lg" />`
    - `audio/mpeg` | `audio/aac` → `<audio controls preload="metadata" src={url} className="w-full" />`
    - `application/epub+zip` → bouton/lien « Ouvrir le document » (`<a href={url} target="_blank" rel="noopener noreferrer">`, style `Button`)
    - défaut → même repli que EPUB (« Ouvrir le document »)
  - [x] Si `url === null` (AC#7) → afficher « Aperçu indisponible » (texte discret) + nom/format, **aucun** lecteur.
  - [x] Réutiliser `Badge` (`~/components/ui/badge`) et le style bouton (`~/components/ui/button` ou classes). Lucide icône `FileText`/`ExternalLink` optionnelle.

- [x] **Tâche 4 — Intégration page détail** (AC: #5, #6)
  - [x] `inertia/pages/production.tsx` : remplacer la **section « fichiers » en liste simple** (posée en 6.1) par un rendu `production.files.map((f) => <MediaViewer key={f.id} file={f} />)` dans la colonne principale (≈2/3). Conserver le titre de section `t('production_detail.files')`.
  - [x] Mettre à jour le type `ProductionFile` de la page : ajouter `url: string | null`.
  - [x] Si `files.length === 0` → ne rien rendre côté lecteurs (AC#6). La section « liens externes » (liste simple 6.1) reste inchangée ; l'interactivité des liens (embed/source) est en 6.3.

- [x] **Tâche 5 — i18n (parité FR/EN)** (AC: #9)
  - [x] `inertia/locales/public/{fr,en}.json` : ajouter le bloc `media` : `pdf_viewer_title` (« Lecteur PDF : {{name}} »), `open_document` (« Ouvrir le document »), `unavailable` (« Aperçu indisponible »), `audio_fallback`/`video_fallback` optionnels (« Votre navigateur ne peut pas lire ce média. »). Respecter `tests/unit/i18n/translations.spec.ts`.

- [x] **Tâche 6 — Tests** (AC: #1–#8)
  - [x] `tests/functional/public/productions.spec.ts` (étendre) : production publiée **avec un `ProductionFile`** (`drive.fake('r2')` au setup, `restore` au teardown) → `GET /productions/:slug` → 200 + `props.production.files[0].url` est une chaîne non vide (URL signée). Créer le `ProductionFile` via `ProductionFile.create({ productionId, fileKey, originalName, mimeType, sizeBytes, storageProvider: 'r2' })`.
  - [x] Cas multi-fichiers : 2 fichiers (pdf + mp4) → `files.length === 2`, chacun avec `url`.
  - [x] (Source-assertion, frontière TS6305) `tests/unit/components/media_viewer.spec.ts` : `readFileSync` sur `MediaViewer.tsx` + assertions de présence des branches (`application/pdf`, `video/mp4`, `audio/`, `application/epub+zip`, `target="_blank"`, `rel="noopener`). Idem pour `PdfViewer.tsx` (`<iframe`, `title`).
  - [x] Vérifier `node ace test unit` + `node ace test functional`, lint, typecheck verts.

## Dev Notes

### État issu de la Story 6.1 (point de départ)
- La page `inertia/pages/production.tsx` existe avec une **section fichiers en LISTE SIMPLE** (nom + badge MIME) — à **remplacer** par `MediaViewer`. Le type `ProductionFile` y est `{ id, originalName, mimeType, sizeBytes }` → **ajouter `url: string | null`**. [Source: inertia/pages/production.tsx]
- `show` charge déjà `preload('files')` + `preload('links')` et sérialise via `serializeDetail` (controller public). **C'est là qu'on ajoute les URLs signées.** [Source: app/controllers/public/productions_controller.ts#show]
- `ProductionCard` / serialize / route `production.show` / SeoService.forProduction : déjà en place (6.1), **ne pas retoucher**.

### Service de stockage (existant — NE PAS réinventer)
- `FileStorageService.signedUrl(fileKey: string): Promise<string>` → URL signée R2 **TTL 1h**. [Source: app/services/file_storage_service.ts:65-68]
- **Formats autorisés** (whitelist serveur) = mapping exact des lecteurs : `application/pdf`, `application/epub+zip`, `video/mp4`, `audio/mpeg`, `audio/aac`. Pas d'autre MIME possible en base. [Source: app/services/file_storage_service.ts:4-10 `ALLOWED_MIME_TYPES`]
- `ProductionFile` : `{ id, productionId, fileKey, originalName, mimeType, sizeBytes, storageProvider }`. [Source: app/models/production_file.ts]

### Décision lecteurs (verrouillée)
- L'architecture **reporte le choix de lib PDF/EPUB** : « `PdfViewer.tsx` est le contrat, la lib est un détail d'implémentation ». On retient **iframe natif PDF + repli EPUB**, **0 dépendance**. [Source: architecture.md:943 ; ux-design-specification.md#MediaViewer:761-768]
- UX-DR8 / principe « la production, pas l'interface » : lecteurs discrets, **le téléchargement et le reste de la page restent toujours accessibles** — ne jamais forcer un lecteur plein écran modal. [Source: ux-design-specification.md:72,126,226,243]

### Sécurité & robustesse
- **Ne jamais exposer la clé R2 brute** au client : seules des URLs signées (NFR — `architecture.md:643`). Générées serveur.
- **Repli gracieux** (NFR12) : une URL signée qui échoue (clé manquante) → `url: null` → bloc « Aperçu indisponible », jamais d'exception non gérée. Le message d'erreur **de téléchargement** détaillé relève de 6.3.
- iframe PDF : URL R2 de confiance → pas de `sandbox` requis (le sandbox casse le viewer PDF natif). L'iframe `embed` d'un **lien externe** (non confiance, avec `sandbox`) relève de **6.3**, pas ici.

### URLs signées : génération dans `show` (pattern)
```ts
import FileStorageService from '#services/file_storage_service'
import logger from '@adonisjs/core/services/logger'
// ...dans show, après avoir récupéré `production` :
const files = await Promise.all(
  production.files.map(async (f) => {
    let url: string | null = null
    try {
      url = await FileStorageService.signedUrl(f.fileKey)
    } catch (error) {
      logger.error({ err: error, fileKey: f.fileKey }, 'signed URL generation failed')
    }
    return { id: f.id, originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, url }
  })
)
return inertia.render('production', {
  production: { ...serializeDetail(production), files },
  meta: SeoService.forProduction(locale, production),
})
```
TTL 1h : suffisant pour une session de lecture ; les URLs sont régénérées à chaque rendu de page.

### Conventions front (rappel 6.1)
- Pages/composants publics : alias `~/`, `useTranslation()`, namespace public, `PublicLayout` auto-appliqué par `app.tsx`. [Source: inertia/app.tsx]
- `Badge` dispo (`variant` default/secondary/outline). Icônes `lucide-react`. [Source: inertia/components/ui/badge.tsx]
- **Frontière TS6305** : `MediaViewer`/`PdfViewer` se testent par **lecture de source** (`readFileSync` + assert), jamais par import dans un test serveur. [Source: project_anta_status.md#Gotchas Epic 5]

### Tests — drive.fake (pattern existant)
- `group.each.setup` : `await db.beginGlobalTransaction()` ; teardown : `drive.restore('r2')` + `db.rollbackGlobalTransaction()`. Appeler `drive.fake('r2')` dans le test (ou setup) avant de générer une URL signée. [Source: tests/functional/admin/production_files.spec.ts:50-57]
- Le disque `r2` fake supporte `getSignedUrl` (retourne une URL fake) → `props.production.files[0].url` non vide.
- Gotcha BDD : tests locaux sur Supabase pollué ; viser le vert quand possible, ne pas régresser l'unit. Suite functional `continue-on-error` en CI (fix Epic 8). [Source: project_anta_status.md]

### Stories suivantes (ne PAS implémenter ici)
- 6.3 : bouton « Télécharger » + `StatsService.recordDownload` + message d'erreur DL ; iframe `embed` (sandbox) + « Accéder à la source » des `ProductionLink`. 6.4 : `ViewTracker` réel (timer 10s).

### Project Structure Notes
- Nouveaux fichiers : `inertia/components/public/MediaViewer.tsx`, `inertia/components/public/PdfViewer.tsx`, `tests/unit/components/media_viewer.spec.ts`. Modifiés : `productions_controller.ts` (show), `inertia/pages/production.tsx`, locales publiques, `tests/functional/public/productions.spec.ts`.
- Aucune migration, aucune dépendance npm.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]
- [Source: _bmad-output/planning-artifacts/prd.md#FR11, #FR12, #FR13, #NFR12]
- [Source: _bmad-output/planning-artifacts/architecture.md:258, :643, :761-768, :943]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#MediaViewer, UX-DR8]
- [Source: app/services/file_storage_service.ts]
- [Source: app/controllers/public/productions_controller.ts#show]
- [Source: inertia/pages/production.tsx]
- [Source: app/models/production_file.ts]
- [Source: tests/functional/admin/production_files.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `npm run typecheck` ✅ · `npm run lint` ✅.
- `node ace test unit --files=media_viewer.spec.ts` → 5/5 (après correction d'une assertion : `sandbox=` au lieu de `sandbox` — le mot apparaissait dans un commentaire de `PdfViewer`).
- `node ace test functional --files=productions.spec.ts` → 10/10 (3 base + 5 détail 6.1 + 2 médias 6.2).
- Suites complètes : unit 206✓/14✗ (14 = échecs connus pollution Supabase : 12 search_service + 2 super_admin, 0 nouveau, +5 nouveaux verts) ; functional 123✓/26✗ (26 = pollution connue, 0 nouveau, +2 nouveaux verts). Aucune régression.

### Completion Notes List

- **URLs signées R2 dans `show`** : `Promise.all` sur `production.files`, `FileStorageService.signedUrl(fileKey)` (TTL 1h), **try/catch par fichier** → `url: null` + `logger.error` en cas d'échec R2 (NFR12). Props finales : `{ ...serializeDetail(p), files }` (les `files` avec url écrasent ceux de `serializeDetail`).
- **`MediaViewer`** dispatch par MIME : `application/pdf` → `PdfViewer` (iframe natif) ; `video/mp4` → `<video controls>` ; `audio/mpeg`|`audio/aac` → `<audio controls>` ; `application/epub+zip` + défaut → bouton « Ouvrir le document » (`target="_blank" rel="noopener noreferrer"`). `url === null` → « Aperçu indisponible ».
- **`PdfViewer`** : `<iframe>` (h-75vh) avec `title` accessible, `loading="lazy"`, **pas de `sandbox`** (URL R2 de confiance ; le sandbox casserait le viewer PDF natif).
- **Décision respectée** : 0 dépendance (PDF iframe + EPUB repli). MP4/MP3/AAC natifs.
- **Page détail** : la liste simple de fichiers (6.1) est remplacée par `MediaViewer` par fichier ; section « liens externes » inchangée (interactivité embed/source = 6.3).
- **Hors périmètre confirmé non touché** : téléchargement/`recordDownload`, iframe embed + « Accéder à la source » (6.3), `ViewTracker` réel (6.4).
- i18n : bloc `media` FR/EN (parité validée).

### File List

**Créés :**
- `inertia/components/public/MediaViewer.tsx`
- `inertia/components/public/PdfViewer.tsx`
- `tests/unit/components/media_viewer.spec.ts`

**Modifiés :**
- `app/controllers/public/productions_controller.ts` (`show` : URLs signées par fichier + imports `FileStorageService`/`logger`)
- `inertia/pages/production.tsx` (type `ProductionFile` + `url`, rendu `MediaViewer` par fichier)
- `inertia/locales/public/fr.json`, `inertia/locales/public/en.json` (bloc `media`)
- `tests/functional/public/productions.spec.ts` (groupe « lecteurs de médias » + `drive.fake`/`ProductionFile`)

### Change Log

- 2026-06-02 : Implémentation Story 6.2 — lecteurs de médias intégrés (PDF iframe natif, MP4/MP3/AAC HTML5, EPUB repli ; URLs signées R2 TTL 1h générées serveur ; 0 dépendance). Statut → review.
