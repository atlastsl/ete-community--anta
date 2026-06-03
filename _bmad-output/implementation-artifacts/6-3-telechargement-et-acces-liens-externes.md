# Story 6.3 : Téléchargement de fichiers et accès aux liens externes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **télécharger un fichier hébergé ou accéder à la source externe d'une production**,
afin d'**obtenir le contenu pour une consultation hors ligne ou sur la plateforme d'origine** (FR14, FR15, FR26).

## Décision de périmètre (lire en premier)

- **Téléchargement = endpoint GET qui enregistre puis redirige (302) vers l'URL signée R2** (avec `Content-Disposition: attachment` → nom d'origine). Pattern standard de download-avec-tracking : pas de CSRF (GET), offload du transfert à R2, déclenchable par un simple `<a href>` (le navigateur télécharge sans naviguer → pas de rechargement de page). Le **compteur s'incrémente en optimiste côté client** (state React local).
  - ⚠️ **Écart assumé vs le libellé « POST /stats/download » de l'epic (Story 6.5)** : on retient un endpoint **GET `/productions/:slug/files/:fileId/download`** (plus robuste pour un download). Les tests 6.5 cibleront cet endpoint. `recordDownload` est bien appelé (FR26).
- **`StatsService` n'existe pas → créé dans cette story** avec **`recordDownload` uniquement**. `recordView` (vue 10s) = Story 6.4.
- **DANS le périmètre 6.3** : `StatsService.recordDownload`, `FileStorageService.signedDownloadUrl`, endpoint de téléchargement + route, bouton « Télécharger » par fichier (dans `MediaViewer`) + incrément optimiste du compteur, rendu des **liens externes** (`embed` → iframe sécurisé ; `simple` → bouton « Accéder à la source »), gestion d'erreur R2, i18n, tests.
- **HORS périmètre** : `recordView` + `ViewTracker` réel + `POST /stats/view` = **Story 6.4** ; agrégation/dashboards stats = **Epic 7** ; lecteurs média inline = déjà fait (6.2).

## Acceptance Criteria

1. **Given** une production publiée a un fichier hébergé, **When** le visiteur clique sur **« Télécharger »**, **Then** une URL signée R2 (TTL 1h) avec `Content-Disposition: attachment` est générée et le navigateur télécharge le fichier **avec son nom d'origine**.
2. **Given** un téléchargement est déclenché, **When** la requête atteint l'endpoint, **Then** `StatsService.recordDownload(productionId, ip)` insère une ligne dans `stats_downloads` avec `production_id`, `downloaded_at`, `ip_hash` **anonymisé** (jamais l'IP brute) — FR26.
3. **Given** le téléchargement a réussi, **When** le compteur de téléchargements est affiché, **Then** il s'incrémente **sans rechargement de page** (incrément optimiste côté client).
4. **Given** le fichier R2 n'est plus disponible (clé invalide/supprimée), **When** le visiteur clique « Télécharger », **Then** un message d'erreur s'affiche (« Ce fichier n'est temporairement pas disponible. ») **et aucune erreur non gérée n'est exposée** (NFR12) ; **aucun** téléchargement n'est enregistré dans ce cas.
5. **Given** une production a un lien externe de type **`embed`**, **When** la page détail se charge, **Then** le contenu est embarqué via un `<iframe>` avec attributs de sécurité (`sandbox`, `allow`, `referrerpolicy`, `loading="lazy"`).
6. **Given** une production a un lien externe de type **`simple`**, **When** le visiteur clique sur **« Accéder à la source »**, **Then** le lien s'ouvre dans un nouvel onglet (`target="_blank" rel="noopener noreferrer"`).
7. **Given** une production en **brouillon/dépubliée** ou un **fileId** n'appartenant pas à la production (ou inexistant), **When** l'endpoint de téléchargement est appelé, **Then** une **404** est retournée (pas de fuite ni de téléchargement de contenu non publié).
8. **Given** l'interface, **When** les boutons/labels sont rendus, **Then** tous les textes passent par `react-i18next` (parité FR/EN) ; boutons accessibles (libellés explicites, cibles ≥ 44px), `aria-label` sur l'iframe embed.

## Tasks / Subtasks

- [x] **Tâche 1 — `StatsService.recordDownload`** (AC: #2)
  - [x] Créer `app/services/stats_service.ts`. `static async recordDownload(productionId: string, ip?: string | null): Promise<void>` → `StatsDownload.create({ productionId, downloadedAt: DateTime.now(), ipHash: hashIp(ip) })`.
  - [x] `private static hashIp(ip?: string | null): string | null` → `null` si pas d'IP ; sinon `crypto.createHash('sha256').update(ip + env.get('APP_KEY')).digest('hex')` (salage APP_KEY → non réversible, anonymisé). Importer `node:crypto` + `#start/env`.
  - [x] **Échec silencieux** (cohérent avec `ActivityLogService`) : envelopper l'insert dans try/catch + `logger.error`, ne jamais propager (un échec de stats ne doit pas casser le téléchargement). _Note : `recordView` sera ajouté en 6.4 ; ne pas l'implémenter ici._

- [x] **Tâche 2 — `FileStorageService.signedDownloadUrl`** (AC: #1)
  - [x] Ajouter `static async signedDownloadUrl(fileKey: string, originalName: string): Promise<string>` → `drive.use('r2').getSignedUrl(fileKey, { expiresIn: '1h', contentDisposition: \`attachment; filename="\${sanitize(originalName)}"; filename*=UTF-8''\${encodeURIComponent(originalName)}\` })`. `sanitize` retire guillemets/CR/LF du nom. flydrive `SignedURLOptions.contentDisposition` est supporté (vérifié).

- [x] **Tâche 3 — Endpoint de téléchargement** (AC: #1, #2, #4, #7)
  - [x] Route (`start/routes.ts`, après `production.show`) : `router.get('/productions/:slug/files/:fileId/download', [controllers.public.Productions, 'download']).as('production.download')`.
  - [x] `app/controllers/public/productions_controller.ts` → `async download({ params, request, response, session })` :
    - [x] Charger la production **publiée** par `slug` + son fichier `:fileId` (`.related('files').query().where('id', fileId).first()` ou requête jointe). Si production non publiée/absente OU fichier introuvable → `response.notFound()` (404, AC#7).
    - [x] **Try** `FileStorageService.signedDownloadUrl(file.fileKey, file.originalName)`. **Si échec** (catch) → `logger.error` + `session.flash('error', 'productions.download_unavailable')` + `response.redirect().toRoute('production.show', { slug })` (PAS d'enregistrement — AC#4).
    - [x] **Si succès** → `await StatsService.recordDownload(production.id, request.ip())` puis `response.redirect(signedUrl)` (302 → R2 télécharge avec le nom d'origine).
  - [x] Importer `StatsService`, `FileStorageService`, `logger`.

- [x] **Tâche 4 — `downloadUrl` par fichier dans `show`** (AC: #1, #3)
  - [x] Dans `show`, ajouter à chaque fichier sérialisé : `downloadUrl: \`/productions/\${production.slug}/files/\${f.id}/download\``. (En plus de `url` signée pour la lecture inline — 6.2.)

- [x] **Tâche 5 — Bouton « Télécharger » dans `MediaViewer`** (AC: #1, #3, #8)
  - [x] `inertia/components/public/MediaViewer.tsx` : étendre `MediaFile` avec `downloadUrl: string`. Ajouter, sous le lecteur (toujours visible, quel que soit le type), un **`<a href={downloadUrl}>` stylé bouton** « Télécharger » (icône `Download`), `min-h-11` (44px). `onClick` → appeler une prop `onDownload?()` (incrément optimiste). Pas de `target="_blank"` (téléchargement, pas navigation).
  - [x] Le bouton est rendu **même si `url === null`** (l'endpoint gère l'erreur R2 côté serveur).

- [x] **Tâche 6 — Compteur optimiste + liens externes dans la page** (AC: #3, #5, #6)
  - [x] `inertia/pages/production.tsx` :
    - [x] `downloadsCount` en **state local** (`useState(production.downloadsCount)`), affiché dans l'aside. Passer `onDownload={() => setDownloadsCount((n) => n + 1)}` à chaque `MediaViewer`.
    - [x] Remplacer la **liste simple des liens** (6.1) par : `link.linkType === 'embed'` → `<iframe src={link.url} sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="fullscreen; encrypted-media; picture-in-picture" referrerpolicy="no-referrer" loading="lazy" title={link.label || t('production_detail.external_links')} className="aspect-video w-full rounded-lg border border-stone-200" />` ; `link.linkType === 'simple'` → bouton **« Accéder à la source »** (`<a href={link.url} target="_blank" rel="noopener noreferrer">`).

- [x] **Tâche 7 — i18n (parité FR/EN)** (AC: #8)
  - [x] `inertia/locales/public/{fr,en}.json` : ajouter à `media` (ou nouveau bloc) : `download` (« Télécharger »), `download_unavailable` (« Ce fichier n'est temporairement pas disponible. ») [→ utilisée par le flash, donc clé **admin/public** lisible côté toast public], `access_source` (« Accéder à la source »). ⚠️ Le flash `productions.download_unavailable` est rendu par le toast public — ajouter la clé `productions.download_unavailable` dans les locales **publiques** (le toast lit le namespace public). Respecter `translations.spec`.

- [x] **Tâche 8 — Tests** (AC: #1, #2, #4, #7)
  - [x] `tests/functional/public/` (nouveau `download.spec.ts` ou étendre `productions.spec.ts`) avec `drive.fake('r2')` + transaction globale :
    - [x] Production publiée + fichier → `GET /productions/:slug/files/:fileId/download` → **302** (redirection vers URL signée) + **1 ligne** créée dans `stats_downloads` (`assert` via `db` ou `StatsDownload.query().count`). `.redirects(0)` pour observer le 302.
    - [x] `ip_hash` enregistré est **haché** (≠ IP brute, longueur 64 hex).
    - [x] Production brouillon → 404 ; fileId d'une autre production → 404 ; fileId inexistant → 404 (AC#7).
  - [x] `tests/unit/services/stats_service.spec.ts` : `recordDownload` insère une ligne avec `ipHash` haché (sha256, 64 hex) et `productionId` correct ; IP nulle → `ipHash` null. (Transaction globale.)
  - [x] (Source TS6305) étendre `tests/unit/components/media_viewer.spec.ts` : présence du bouton « Télécharger » (`media.download`, `href={downloadUrl}` ou `downloadUrl`). Nouveau ou étendu : vérifier dans `production.tsx` (source) la branche `embed` (`sandbox`, `referrerpolicy`) et `simple` (`rel="noopener noreferrer"`, `media.access_source`/`access_source`).
  - [x] `node ace test unit` + `node ace test functional`, lint, typecheck verts.

## Dev Notes

### État issu de 6.1/6.2 (point de départ)
- `MediaViewer` (6.2) affiche déjà un bloc par fichier (lecteur inline + nom + badge format). **On y ajoute le bouton « Télécharger ».** [Source: inertia/components/public/MediaViewer.tsx]
- `show` génère déjà `files[].url` (URL signée de lecture, TTL 1h) via `FileStorageService.signedUrl`. **On ajoute `files[].downloadUrl`** (pointant sur l'endpoint de download). [Source: app/controllers/public/productions_controller.ts#show]
- `production.tsx` rend les **liens externes en liste simple** (6.1) → **à remplacer** par embed/simple. Le type `ProductionLink` y est `{ id, url, label, linkType: 'embed' | 'simple' }`. [Source: inertia/pages/production.tsx]
- `serializeDetail` fournit `links` (déjà OK) et `downloadsCount` (compteur initial). [Source: productions_controller.ts]

### Modèles & service (existants — NE PAS réinventer)
- `StatsDownload` : `{ id, productionId, downloadedAt: DateTime, ipHash: string | null }`. [Source: app/models/stats_download.ts]
- `ProductionLink` : `{ id, productionId, url, linkType: 'embed' | 'simple', label }`. [Source: app/models/production_link.ts ; enums/link_type.ts]
- `FileStorageService.signedUrl(fileKey)` (TTL 1h) existe ; ajouter `signedDownloadUrl(fileKey, name)` (même TTL + `contentDisposition`). flydrive `SignedURLOptions.contentDisposition` confirmé. [Source: app/services/file_storage_service.ts ; node_modules/flydrive/.../types.d.ts:26]
- **Pattern échec silencieux des stats** : copier l'approche `ActivityLogService` (try/catch + `logger.error`, ne jamais propager) — un échec d'écriture stats ne doit jamais casser l'action utilisateur. [Source: app/services/activity_log_service.ts]

### Téléchargement : pourquoi GET + redirect
- Un `<a href={downloadUrl}>` vers un endpoint **GET** qui répond **302 → URL signée R2 (attachment)** déclenche un téléchargement **sans navigation** (la page reste affichée). Le compteur s'incrémente en **optimiste** (`setDownloadsCount(n+1)` au clic) → « sans rechargement » (AC#3).
- Pas de CSRF (GET). Le transfert est servi par R2 (pas par notre serveur → pas de streaming de 100 Mo).
- `request.ip()` donne l'IP client (à hacher). [Source: AdonisJS HttpContext]
- Anti-abus : l'endpoint a un effet de bord sur GET (comptage). Acceptable MVP (action explicite). Optionnel : ignorer les requêtes de prefetch (non requis ici).

### Sécurité embed (lien externe non fiable)
- L'URL d'un lien `embed` est **fournie par l'admin** mais pointe vers un tiers → iframe **sandboxé** : `sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"` + `allow="fullscreen; encrypted-media; picture-in-picture"` + `referrerpolicy="no-referrer"` + `loading="lazy"`. Compromis connu : `allow-scripts`+`allow-same-origin` permet en théorie l'évasion du sandbox, mais c'est nécessaire pour la plupart des embeds (YouTube, etc.) et les liens sont curés par l'admin. [Source: epics.md Story 6.3 ; ux UX-DR]
- Lien `simple` : `target="_blank" rel="noopener noreferrer"` (anti tab-nabbing).

### 404 & sécurité (NFR12)
- `download` filtre `status = 'published'` ET vérifie l'appartenance du fichier (`fileId` ∈ production.files). Brouillon/dépubliée/fichier étranger/inexistant → **404**. Jamais de signed URL pour du contenu non publié.

### i18n / flash
- Le flash `error` est rendu en toast par `PublicLayout` (sonner) qui lit le namespace **public** → la clé du message d'erreur DL doit exister côté **public** (`productions.download_unavailable`). [Source: inertia/layouts/PublicLayout.tsx ; productions_controller flash pattern]

### Conventions (rappel)
- `ssr: false` → composants testés par **source** (TS6305) ; props Inertia directes ; alias `~/` ; `Badge`/icônes Lucide (`Download`). [Source: project_anta_status.md]
- Gotcha BDD : tests locaux sur Supabase pollué ; suite functional `continue-on-error` en CI (Epic 8). Viser le vert local quand possible, ne pas régresser l'unit. [Source: project_anta_status.md]
- Tests stats : transaction globale + `StatsDownload.query()` pour compter ; `drive.fake('r2')`/`restore` pour le signed URL. [Source: tests/functional/admin/production_files.spec.ts]

### Stories suivantes (ne PAS implémenter ici)
- 6.4 : `StatsService.recordView` + `POST /stats/view` (CSRF-exempt/beacon) + `ViewTracker` réel (timer 10s, clearTimeout, échec silencieux). 6.5 : suite de tests consolidée. Epic 7 : agrégation/dashboards.

### Project Structure Notes
- Nouveaux : `app/services/stats_service.ts`, `tests/unit/services/stats_service.spec.ts`, (fonctionnel download). Modifiés : `file_storage_service.ts`, `productions_controller.ts` (download + downloadUrl), `start/routes.ts`, `MediaViewer.tsx`, `production.tsx`, locales publiques, specs.
- Aucune migration (tables stats déjà créées en Epic 4/1).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3, #Story 6.5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR14, #FR15, #FR26, #NFR12]
- [Source: _bmad-output/planning-artifacts/architecture.md:195, :210-212, :722, :885]
- [Source: app/services/file_storage_service.ts ; app/services/activity_log_service.ts]
- [Source: app/models/stats_download.ts ; app/models/production_link.ts]
- [Source: app/controllers/public/productions_controller.ts#show]
- [Source: inertia/components/public/MediaViewer.tsx ; inertia/pages/production.tsx]
- [Source: tests/functional/admin/production_files.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `npm run typecheck` ✅ · `npm run lint` ✅ (2 corrections : `redirect()` par chemin direct au lieu de `toRoute` — évite la dépendance au codegen routes ; format prettier de la requête fichier).
- `node ace test unit --files=stats_service.spec.ts media_viewer.spec.ts translations.spec.ts` → 15/15.
- `node ace test functional --files=download.spec.ts` → 5/5.
- Suites complètes : unit 212✓/14✗ (+6 nouveaux verts ; 14 = échecs connus pollution Supabase, 0 nouveau) ; functional 128✓/26✗ (+5 nouveaux verts ; 26 = pollution connue, 0 nouveau). Aucune régression.

### Completion Notes List

- **`StatsService.recordDownload`** (nouveau service) : insère `stats_downloads` avec `ipHash` = SHA-256(ip + APP_KEY) (anonymisé, déterministe), `null` si pas d'IP ; **échec silencieux** (try/catch + `logger.error`, calqué sur `ActivityLogService`).
- **`FileStorageService.signedDownloadUrl`** : URL signée TTL 1h + `Content-Disposition: attachment` (`filename` + `filename*=UTF-8''` pour les accents) → téléchargement avec nom d'origine.
- **Endpoint `GET /productions/:slug/files/:fileId/download`** : 404 si production non publiée / fichier étranger ou inexistant ; génère l'URL signée **avant** d'enregistrer (si R2 échoue → flash `productions.download_unavailable` + redirect détail, **sans** enregistrer — AC#4) ; sinon `recordDownload` + 302 vers R2.
- **Frontend** : bouton « Télécharger » dans `MediaViewer` (toujours visible, `<a href={downloadUrl}>`, pas de `target=_blank`), incrément **optimiste** du compteur via `onDownload` (state `downloadsCount` dans `production.tsx`) → sans rechargement (AC#3).
- **Liens externes** : `embed` → `<iframe>` sandboxé (`sandbox`/`allow`/`referrerPolicy="no-referrer"`/`loading="lazy"`) ; `simple` → bouton « Accéder à la source » (`target=_blank rel="noopener noreferrer"`).
- **Écart assumé** : download en **GET** (record + 302) plutôt que `POST /stats/download` — plus robuste, sans CSRF ; `recordDownload` bien appelé (FR26). Les tests 6.5 cibleront cet endpoint.
- i18n : `media.download`, `media.access_source`, `productions.download_unavailable` (namespace public pour le toast) — parité validée.
- Aucune migration, aucune dépendance.

### File List

**Créés :**
- `app/services/stats_service.ts`
- `tests/unit/services/stats_service.spec.ts`
- `tests/functional/public/download.spec.ts`

**Modifiés :**
- `app/services/file_storage_service.ts` (`signedDownloadUrl`)
- `app/controllers/public/productions_controller.ts` (`download` + `downloadUrl` par fichier dans `show` + imports `StatsService`)
- `start/routes.ts` (route `production.download`)
- `inertia/components/public/MediaViewer.tsx` (bouton Télécharger + `downloadUrl` + `onDownload`)
- `inertia/pages/production.tsx` (compteur optimiste, liens embed/simple, import `useState`/`ExternalLink`)
- `inertia/locales/public/fr.json`, `inertia/locales/public/en.json` (`media.download`/`access_source`, `productions.download_unavailable`)
- `tests/unit/components/media_viewer.spec.ts` (bouton télécharger + liens externes)

### Change Log

- 2026-06-02 : Implémentation Story 6.3 — téléchargement (endpoint GET record+302 vers R2 attachment, compteur optimiste) + liens externes (embed iframe sandboxé / source nouvel onglet) + `StatsService.recordDownload` (IP anonymisée). Statut → review.
