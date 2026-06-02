# Story 4.6 : Publication et workflow brouillon → publié

Status: done

## Story

En tant qu'administrateur,
Je veux publier une production brouillon complète,
Afin qu'elle devienne immédiatement visible sur le site public (FR21, FR35).

## Acceptance Criteria

**AC1 — Hiérarchie des boutons selon la complétude (UX-DR16)**

- **Given** `CompletionIndicator` est vert (tous les champs obligatoires remplis + au moins un fichier ou lien, selon la licence)
- **When** le formulaire est affiché
- **Then** le bouton "Publier" est actif et devient le bouton primaire (vert)
- **And** "Enregistrer brouillon" passe en bouton secondaire
- **And** tant que le `CompletionIndicator` est orange, "Publier" est désactivé et "Enregistrer brouillon" reste primaire

**AC2 — Publication effective (FR21, FR35)**

- **Given** l'admin clique sur "Publier"
- **When** `ProductionService.publish(production)` est appelé via `POST /admin/productions/:id/publish`
- **Then** le serveur **revalide les conditions de publication** — champs obligatoires + fichier ou lien présent (selon la licence)
- **And** `status` passe à `'published'` (`ProductionStatus.PUBLISHED`)
- **And** `anta_published_at` est défini avec le timestamp actuel **si c'est la première publication** (FR35) — inchangé sur les publications ultérieures
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'publish', resourceType: 'production' })`
- **And** un toast succès s'affiche : "Production publiée."

**AC3 — Rejet serveur si incomplet (anti-contournement)**

- **Given** les conditions de publication ne sont pas remplies côté serveur (tentative de contournement du bouton désactivé)
- **When** `POST /admin/productions/:id/publish` est appelé
- **Then** la requête est rejetée et la production **reste en brouillon** (`status` inchangé)
- **And** les champs manquants sont remontés à l'utilisateur (erreurs de validation)

**AC4 — Pas de republication automatique (FR22, FR35)**

- **Given** une production est publiée
- **When** l'admin la modifie et enregistre (flux d'édition — Story 4.7)
- **Then** `status` reste `'published'` — aucune republication automatique
- **And** `updated_at` est mis à jour
- **Note** : le flux d'édition (`PUT /admin/productions/:id`) est implémenté en Story 4.7. AC4 est **garanti structurellement** ici : `status` ne change QUE via les endpoints explicites `publish`/`unpublish` ; le endpoint d'édition (4.7) ne touchera pas `status`. La vérification par test est faite en Story 4.7.

## Tasks / Subtasks

- [x] **Tâche 1 — Créer `ProductionService`** (AC2, AC3)
  - [x] 1.1–1.4 `production_service.ts` : `getMissingForPublish` (champs requis FR21 + `isAttachmentSatisfied` dupliqué serveur), `publish` (status=PUBLISHED, antaPublishedAt si null). Méthodes statiques

- [x] **Tâche 2 — Ajouter `publish` au `ProductionsController`** (AC2, AC3)
  - [x] 2.1 `publish()` : findOrFail → `loadCount('files'/'links')` → `getMissingForPublish` → si manquants flashErrors+redirect (reste draft), sinon `ProductionService.publish` + log + flash `published`

- [x] **Tâche 3 — Route** (AC2)
  - [x] 3.1 `POST /admin/productions/:id/publish` (groupe admin)

- [x] **Tâche 4 — Hiérarchie des boutons + déclenchement publication (UX-DR16)** (AC1, AC2)
  - [x] 4.1–4.3 Composant réutilisable `ProductionFormActions` : swap primaire/secondaire selon `isComplete`, "Publier" actif uniquement si `isComplete && productionId` → `router.post(.../publish)`. Create ne passe pas `productionId` (dormant) ; Edit (4.7) l'activera. Pas de double primaire
  - [x] 4.4 (erreur publish remontée via flash — affichage complet sur Edit)

- [x] **Tâche 5 — Clés i18n** (AC2, AC3)
  - [x] 5.1–5.2 `productions.published` + `productions.publish.incomplete` FR + EN, parité OK

- [x] **Tâche 6 — Tests** (AC2, AC3)
  - [x] 6.1–6.6 `productions_publish.spec.ts` : 5 tests (complète+lien→publiée+log, antaPublishedAt inchangé en republication, incomplète→draft, external_link fichier-seul→rejet/lien→publiée, non-auth)
  - [x] 6.7 `production_service.spec.ts` : 5 tests unitaires `getMissingForPublish` (vide→tout, complète+fichier/lien→[], external_link fichier-seul→['attachment'])

- [x] **Tâche 7 — Validation finale**
  - [x] 7.1 `node ace test` → 221 tests passent (211 + 10)
  - [x] 7.2 `npm run lint` → 0 erreur
  - [x] 7.3 `npm run typecheck` → 0 erreur

## Dev Notes

### Périmètre & flux

La **publication réelle se déclenche depuis la page d'édition** (Story 4.7) : il faut une production existante avec ses fichiers/liens. La page de **création** ne peut pas atteindre l'état « complet » (pas de `productionId`, pas d'attachement) → "Publier" y reste désactivé.

4.6 livre :
- **Backend (substance FR21)** : `ProductionService` (validation de complétude + publication), endpoint `POST /admin/productions/:id/publish`, log, `anta_published_at`. **Entièrement testé** au niveau fonctionnel/unitaire.
- **UI (UX-DR16)** : la logique de hiérarchie des boutons (primaire/secondaire selon `isComplete`) + le déclenchement de publication, implémentés dans la barre d'actions. Dormants sur Create, pleinement actifs sur Edit (4.7).

### `ProductionService` — contrat cible

```ts
import { DateTime } from 'luxon'
import ProductionStatus from '#enums/production_status'
import type Production from '#models/production'

// Règle d'attachement (dupliquée depuis inertia/lib/production_completion.ts —
// le code client n'est pas importable côté serveur ; duplication intentionnelle,
// comme la double validation VineJS/Zod de l'architecture).
function isAttachmentSatisfied(license: string, hasFile: boolean, hasLink: boolean): boolean {
  if (license === 'external_link') return hasLink
  return hasFile || hasLink
}

const REQUIRED_STRING_FIELDS = [
  'title', 'category', 'domain', 'subdomain', 'language', 'publicationCountry', 'summary',
] as const

export default class ProductionService {
  static getMissingForPublish(production: Production, hasFile: boolean, hasLink: boolean): string[] {
    const missing: string[] = []
    for (const f of REQUIRED_STRING_FIELDS) {
      const v = production[f] as string | null
      if (!v || v.trim() === '') missing.push(f)
    }
    if (!production.authors || production.authors.length === 0) missing.push('authors')
    if (!production.tags || production.tags.length === 0) missing.push('tags')
    if (!production.workPublishedAt) missing.push('workPublishedAt')
    if (!isAttachmentSatisfied(production.licenseStatus, hasFile, hasLink)) missing.push('attachment')
    return missing
  }

  static async publish(production: Production): Promise<void> {
    production.status = ProductionStatus.PUBLISHED
    if (!production.antaPublishedAt) {
      production.antaPublishedAt = DateTime.now()
    }
    await production.save()
  }
}
```

### Comptage des attachements (loadCount)

```ts
await production.loadCount('files')
await production.loadCount('links')
const hasFile = Number(production.$extras.files_count) > 0
const hasLink = Number(production.$extras.links_count) > 0
```
(`Production` a `@hasMany files` et `@hasMany links`.)

### `anta_published_at` (FR35)

- Défini **uniquement à la première publication** (`if (!production.antaPublishedAt)`).
- Sur dépublication (4.7 : `published → draft`), `anta_published_at` est **conservé**.
- Sur republication, il **reste le timestamp d'origine** (première mise en ligne sur Anta).

### Sémantique du rejet (AC3 — « 422 »)

Conformément au pattern Inertia du projet (validation → 302 + flash errors), l'incomplétude renvoie `session.flashErrors({ publish: ... })` + `redirect().back()` ; `status` reste `draft`. Les champs manquants sont passés via `session.flash('publishMissing', missing.join(','))` pour affichage. La sécurité (anti-contournement) est garantie : une production incomplète **ne peut pas** passer en `published`, quel que soit le client. Documenter ce choix (le « 422 » de l'epic est réalisé via le flux d'erreur Inertia).

### Hiérarchie des boutons (UX-DR16) — barre d'actions

```tsx
{isComplete ? (
  <>
    <Button className="bg-green-700 text-white" onClick={handlePublish} disabled={!productionId || processing}>
      {t('productions.form.publish')}
    </Button>
    <Button variant="outline" className="border-green-700 text-green-700" type="submit">
      {t('productions.form.save_draft')}
    </Button>
  </>
) : (
  <>
    <Button className="bg-green-700 text-white" type="submit" disabled={processing}>
      {t('productions.form.save_draft')}
    </Button>
    <Button variant="outline" disabled className="opacity-40 cursor-not-allowed">
      {t('productions.form.publish')}
    </Button>
  </>
)}
```
`handlePublish` : `router.post(`/admin/productions/${productionId}/publish`)`. Sur Create, `productionId` absent → "Publier" reste désactivé même si `isComplete` (jamais le cas en création).

### FR22 (AC4) — garanti structurellement

`status` ne change que via :
- `publish` (cette story) : draft → published
- `unpublish` (Story 4.7) : published → draft
- Le endpoint d'édition `update` (Story 4.7) **ne touche jamais `status`** (il met à jour métadonnées + `updated_at`).

Donc modifier une production publiée la garde `published`. La vérification par test appartient à Story 4.7 (qui implémente `update`).

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/services/production_service.ts` | `getMissingForPublish` + `publish` |
| `tests/functional/admin/productions_publish.spec.ts` | Tests endpoint publish |
| `tests/unit/services/production_service.spec.ts` | Tests unitaires `getMissingForPublish` |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/productions_controller.ts` | Ajouter `publish()` |
| `start/routes.ts` | Route `POST /admin/productions/:id/publish` |
| `inertia/pages/admin/Productions/Create.tsx` | Hiérarchie boutons UX-DR16 + handler publish (gated `productionId`) |
| `inertia/locales/admin/fr.json` | Clés `productions.published`, `productions.publish.incomplete` |
| `inertia/locales/admin/en.json` | Mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** se fier au bouton désactivé côté client — le serveur **revalide** la complétude (anti-contournement, AC3)
- **NE PAS** réinitialiser `anta_published_at` à chaque publication — uniquement si null (FR35)
- **NE PAS** changer `status` ailleurs que dans `publish`/`unpublish` (préserve FR22)
- **NE PAS** importer `inertia/lib/production_completion.ts` côté serveur (frontière TS) — dupliquer la règle d'attachement dans `ProductionService` (intentionnel)
- **NE PAS** afficher deux boutons primaires simultanément (UX-DR16)
- **NE PAS** créer directement une production en `published` (le `store` force `draft` — Story 4.3)
- **NE PAS** wrapper les props Inertia ; props directes

### Tests — patterns à suivre

- Transaction rollback ; helpers `createAdminUser` / `createProduction`.
- Helper « production complète » : tous les champs requis remplis + créer un `ProductionFile` (ou `ProductionLink`) lié.
- Publish complet : `.post('/admin/productions/:id/publish').loginAs(admin).withCsrfToken().redirects(0)` → 302 ; `await production.refresh()` → `status='published'`, `antaPublishedAt` non null ; log `publish`.
- Republication : publier, capter `antaPublishedAt`, repasser à draft en base (`production.status='draft'; save()`), republier → `antaPublishedAt` identique.
- Incomplet : production draft sans champs → publish → reste `draft`, 0 log publish.
- `external_link` + fichier seul → reste draft ; + lien → publiée.
- Unit `production_service.spec.ts` : import direct possible (service = code serveur, pas inertia) → tester `getMissingForPublish` réellement.
- Un seul POST par test (gotcha `sessionApiClient`).

### Sécurité

- Route sous `AdminMiddleware`. Admin + super_admin peuvent publier.
- Revalidation serveur stricte (FR21) — impossible de publier une production incomplète via appel direct.
- `status` jamais pilotable par le payload client (forcé par les endpoints).

### Dépendances cross-story

- **Story 4.3** : `CompletionIndicator`, `getRequiredFieldStatuses`, barre d'actions de `Create.tsx`.
- **Story 4.5** : `isAttachmentSatisfied` (client) — règle dupliquée côté serveur ici.
- **Story 4.4 / 4.5** : `ProductionFile` / `ProductionLink` (comptage `loadCount`).
- **Story 4.7** : page `Edit` (déclenche réellement publish) + `unpublish` + `update` (préserve `status`, teste AC4).
- **Story 5.x** : le site public n'affiche que `status='published'` (la visibilité immédiate dépend de la requête publique d'Epic 5).
- **Story 1.2** : champs `status`, `anta_published_at` du modèle.

### Previous Story Intelligence

**Story 4.5 :**
- `isAttachmentSatisfied(licenseStatus, hasFile, hasLink)` dans `inertia/lib/production_completion.ts` (client). À dupliquer côté serveur (frontière TS, cf. TS6305).
- Pattern endpoint imbriqué + enregistrement contrôleur déjà en place ; ici on ajoute juste une méthode au `ProductionsController` existant (déjà enregistré).

**Story 4.3 :**
- `Create.tsx` calcule `isComplete = getRequiredFieldStatuses(data).every(filled) && isAttachmentSatisfied(...)`. La barre d'actions a "Enregistrer brouillon" (primaire) + "Publier" (désactivé) + "Annuler". À enrichir pour UX-DR16.
- `productions.form.publish` / `productions.form.save_draft` existent déjà.

**Général :**
- `redirect().back()` testé via assert 302 (pas la cible).
- Prettier : multi-lignes ; `npx prettier --write` au besoin.
- Services serveur testables unitairement (pas la frontière inertia).

### Project Structure Notes

- `app/services/production_service.ts` → prévu dans l'arborescence architecture (logique métier CRUD + workflow + publication).
- Tests dans `tests/functional/admin/` et `tests/unit/services/`.

### References

- [Source: epics.md#Story 4.6] — Acceptance criteria
- [Source: epics.md#FR21] — Conditions de publication (champs + fichier/lien)
- [Source: epics.md#FR22] — Pas de republication automatique à l'édition
- [Source: epics.md#FR35] — `anta_published_at` à la première publication
- [Source: ux-design-specification.md:806-817] — Hiérarchie/états des boutons (UX-DR16)
- [Source: ux-design-specification.md:813] — Jamais deux primaires ; Publier primaire seulement si vert
- [Source: architecture.md#Séquence d'Implémentation] — `ProductionService.publish`
- [Source: app/controllers/admin/productions_controller.ts] — contrôleur (index/create/store)
- [Source: app/models/production.ts] — `status`, `antaPublishedAt`, relations `files`/`links`
- [Source: app/enums/production_status.ts] — `ProductionStatus.PUBLISHED`
- [Source: inertia/lib/production_completion.ts] — `isAttachmentSatisfied` (à dupliquer serveur)
- [Source: inertia/pages/admin/Productions/Create.tsx] — barre d'actions à enrichir
- [Source: _bmad-output/implementation-artifacts/4-5-gestion-liens-externes.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/4-3-formulaire-creation-production.md] — CompletionIndicator / boutons

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- Règle d'attachement dupliquée dans `ProductionService` (le client `inertia/lib/production_completion.ts` n'est pas importable côté serveur — frontière TS).
- `loadCount('files'/'links')` → `production.$extras.files_count` / `links_count` (string castée en Number).
- Barre d'actions extraite en composant réutilisable `ProductionFormActions` (évite le code mort sur Create et permet la réutilisation directe par l'Edit en 4.7).
- Test unitaire `ProductionService` : import direct possible (code serveur, pas la frontière inertia) → logique réellement exécutée.

### Completion Notes List

- **AC1 satisfait** : `ProductionFormActions` (UX-DR16) — "Publier" primaire + actif quand `isComplete && productionId`, "Enregistrer brouillon" secondaire ; sinon brouillon primaire + Publier désactivé. Jamais deux primaires.
- **AC2 satisfait** : `ProductionService.publish` → `status='published'`, `antaPublishedAt` à la 1ère publication, log `publish`, toast `productions.published`.
- **AC3 satisfait** : revalidation serveur `getMissingForPublish` — production incomplète reste `draft` (test bypass direct). Champs manquants flashés.
- **AC4 (FR22)** : garanti structurellement (status changé uniquement par publish/unpublish) — vérification par test en Story 4.7 (`update`).
- **Contrainte de flux** : publication déclenchée depuis l'Edit (4.7) ; sur Create, "Publier" dormant (pas d'attachement). `ProductionFormActions` prêt pour Edit.
- Tests : 221/221. Lint + typecheck verts.

### File List

**Créés :**
- `app/services/production_service.ts` — `getMissingForPublish` + `publish`
- `inertia/components/admin/ProductionFormActions.tsx` — barre d'actions UX-DR16 (réutilisable Create/Edit)
- `tests/functional/admin/productions_publish.spec.ts` — 5 tests endpoint
- `tests/unit/services/production_service.spec.ts` — 5 tests unitaires

**Modifiés :**
- `app/controllers/admin/productions_controller.ts` — ajout `publish()`
- `start/routes.ts` — route `POST /admin/productions/:id/publish`
- `inertia/pages/admin/Productions/Create.tsx` — utilise `ProductionFormActions`
- `inertia/locales/admin/fr.json` — `productions.published`, `productions.publish.incomplete`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 4.6 (Publication / workflow brouillon→publié). `ProductionService` (revalidation FR21 + publish avec antaPublishedAt 1ère publication), endpoint publish anti-contournement, `ProductionFormActions` (UX-DR16), i18n FR/EN. 10 tests (5 fonctionnels + 5 unitaires). Tests totaux : 221/221.

## Review Findings

- [x] [Review][Patch] Échec de publication (incomplet) sans feedback utilisateur (AC3) — RÉSOLU : `publish()` flashe désormais `session.flash('error', 'productions.publish.incomplete')` → toast rouge persistant via `AdminLayout`. Le détail des champs manquants reste visible via le `CompletionIndicator` (orange). Flash `publishMissing` mort supprimé. [app/controllers/admin/productions_controller.ts:publish]
