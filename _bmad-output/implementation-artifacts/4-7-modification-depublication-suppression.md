# Story 4.7 : Modification, dépublication et suppression

Status: done

## Story

En tant qu'administrateur,
Je veux modifier, dépublier ou supprimer une production existante,
Afin de maintenir le catalogue à jour et de gérer le cycle de vie des productions (FR22, FR23, FR24).

## Acceptance Criteria

**AC1 — Page d'édition pré-remplie**

- **Given** un admin clique sur "Modifier" sur une production
- **When** la page `/admin/productions/:id/edit` se charge
- **Then** le formulaire est pré-rempli avec toutes les métadonnées existantes
- **And** les fichiers et liens déjà associés sont affichés dans leurs composants respectifs (FileUploader / LinkManager fonctionnels)

**AC2 — Mise à jour des métadonnées (FR22, FR35)**

- **Given** l'admin modifie des champs et clique sur "Enregistrer"
- **When** la requête `PUT /admin/productions/:id` est traitée
- **Then** les métadonnées sont mises à jour en base
- **And** `updated_at` est mis à jour automatiquement
- **And** `status` reste inchangé (pas de republication automatique — FR22) : une production publiée reste publiée
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'update', resourceType: 'production' })`
- **And** un toast succès s'affiche : "Modifications enregistrées."

**AC3 — Modal de confirmation de dépublication (UX-DR14)**

- **Given** un admin clique sur "Dépublier" sur une production publiée
- **When** le modal de confirmation s'affiche
- **Then** il indique : "La production ne sera plus visible sur le site public. Elle repassera en brouillon."

**AC4 — Dépublication effective (FR23)**

- **Given** l'admin confirme la dépublication
- **When** `ProductionService.unpublish(production)` est appelé via `POST /admin/productions/:id/unpublish`
- **Then** `status` passe à `'draft'` (`ProductionStatus.DRAFT`)
- **And** la production n'est plus visible sur le site public
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'unpublish', resourceType: 'production' })`
- **And** un toast succès s'affiche : "Production dépubliée."

**AC5 — Modal de confirmation de suppression (UX-DR14)**

- **Given** un admin clique sur "Supprimer" sur une production
- **When** le modal de confirmation s'affiche
- **Then** il indique : "Cette action est irréversible. La production et ses fichiers associés seront supprimés définitivement."

**AC6 — Suppression effective (FR24, NFR12)**

- **Given** l'admin confirme la suppression
- **When** `ProductionService.delete(production)` est appelé via `DELETE /admin/productions/:id`
- **Then** tous les fichiers R2 associés sont supprimés via `FileStorageService.delete()`
- **And** les enregistrements `production_files` et `production_links` sont supprimés (CASCADE)
- **And** l'enregistrement `productions` est supprimé
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'delete', resourceType: 'production' })`
- **And** un toast succès s'affiche : "Production supprimée."

## Tasks / Subtasks

- [x] **Tâche 1 — Étendre `ProductionService`** (AC4, AC6)
  - [x] 1.1 `unpublish` (status=DRAFT, antaPublishedAt conservé) ; 1.2 `delete` (suppression R2 best-effort + try/catch/logger, puis `production.delete()` CASCADE)

- [x] **Tâche 2 — Ajouter `edit`, `update`, `unpublish`, `destroy`** (AC1, AC2, AC4, AC6)
  - [x] 2.1 `edit` (preload files/links, sérialisation form) ; 2.2 `update` (validate, status NON modifié, log update, redirect edit) ; 2.3 `unpublish` (service + log) ; 2.4 `destroy` (log avant + service delete + redirect liste)

- [x] **Tâche 3 — Routes + enregistrement page** (AC1, AC2, AC4, AC6)
  - [x] 3.1 GET edit, PUT update, POST unpublish, DELETE destroy ; 3.2 pas de conflit ; 3.3 page `admin/Productions/Edit` enregistrée

- [x] **Tâche 4 — Page `Edit.tsx`** (AC1, AC2)
  - [x] 4.1–4.8 `Edit.tsx` : useForm depuis `production`, StatusBadge, `ProductionForm` avec productionId/files/links (FileUploader/LinkManager actifs), submit→PUT, `ProductionFormActions saveLabelKey="productions.form.save"`, isComplete avec vrais attachements

- [x] **Tâche 5 — Étendre `ProductionFormActions`** (AC2)
  - [x] 5.1 Prop `saveLabelKey?` (défaut `save_draft`) ; Edit passe `productions.form.save`

- [x] **Tâche 6 — Activer Dépublier / Supprimer sur la liste** (AC3, AC4, AC5, AC6)
  - [x] 6.1–6.4 Boutons actifs + 2 modaux Dialog (`role="alertdialog"`), états `unpublishTarget`/`deleteTarget`, `router.post(unpublish)` / `router.delete`, désactivés pendant `isProcessing`

- [x] **Tâche 7 — Clés i18n** (AC2–AC6)
  - [x] 7.1–7.2 `edit_title`, `form.save`, `update_success`, `unpublish_success`, `delete_success`, `unpublish_modal.*`, `delete_modal.*` FR + EN

- [x] **Tâche 8 — Tests fonctionnels** (AC1, AC2, AC4, AC6)
  - [x] 8.1–8.7 `productions_edit.spec.ts` : 6 tests (GET edit, PUT update+log, FR22 status préservé, unpublish+antaPublishedAt conservé+log, DELETE + R2 assertMissing + CASCADE + log, non-auth)

- [x] **Tâche 9 — Validation finale**
  - [x] 9.1 `node ace test` → 227 tests passent (221 + 6)
  - [x] 9.2 `npm run lint` → 0 erreur
  - [x] 9.3 `npm run typecheck` → 0 erreur

## Dev Notes

### Rôle pivot de cette story

4.7 **referme le flux Epic 4** : la page `Edit` fournit le `productionId` + `files` + `links` qui rendent **pleinement fonctionnels** les composants livrés en 4.4 (FileUploader), 4.5 (LinkManager) et 4.6 (Publier). C'est ici que :
- on peut uploader/supprimer des fichiers et liens (production existante)
- le `CompletionIndicator` peut atteindre le vert (vrais attachements)
- le bouton "Publier" devient actif et fonctionnel (Story 4.6)

### `ProductionService` — ajouts cibles

```ts
import FileStorageService from '#services/file_storage_service'
import logger from '@adonisjs/core/services/logger'

static async unpublish(production: Production): Promise<void> {
  production.status = ProductionStatus.DRAFT
  await production.save() // anta_published_at conservé (FR35)
}

static async delete(production: Production): Promise<void> {
  await production.load('files')
  for (const file of production.files) {
    try {
      await FileStorageService.delete(file.fileKey)
    } catch (error) {
      // Best-effort : un fichier R2 déjà absent ne doit pas bloquer la suppression RGPD
      logger.error({ err: error, fileKey: file.fileKey }, 'R2 delete failed during production delete')
    }
  }
  await production.delete() // CASCADE → production_files + production_links
}
```

### `update` — préservation du statut (FR22)

Le `update` valide via `draftProductionValidator` (mêmes règles que le brouillon : `title` requis, reste optionnel) et **n'inclut jamais `status`** dans les champs assignés. Donc une production `published` reste `published` après modification ; une `draft` reste `draft`. Le `status` ne change QUE via `publish` (4.6) et `unpublish` (cette story).

```ts
async update({ params, request, auth, response, session }: HttpContext) {
  const production = await Production.findOrFail(params.id)
  const data = await request.validateUsing(draftProductionValidator)

  production.title = data.title
  production.summary = data.summary ?? null
  production.authors = data.authors ?? []
  production.tags = data.tags ?? []
  production.category = data.category ?? null
  production.domain = data.domain ?? null
  production.subdomain = data.subdomain ?? null
  production.language = data.language ?? null
  production.publicationCountry = data.publicationCountry ?? null
  production.journal = data.journal ?? null
  production.publisher = data.publisher ?? null
  production.isbnDoiIssn = data.isbnDoiIssn ?? null
  production.institution = data.institution ?? null
  production.licenseStatus = data.licenseStatus ?? production.licenseStatus
  production.workPublishedAt = data.workPublishedAt ? DateTime.fromISO(data.workPublishedAt) : null
  // status NON modifié
  await production.save()

  await ActivityLogService.log({ adminUserId: auth.user!.id, actionType: ActionType.UPDATE, resourceType: 'production', resourceId: production.id })
  session.flash('success', 'productions.update_success')
  return response.redirect(`/admin/productions/${production.id}/edit`)
}
```

### `edit` — sérialisation pour le formulaire

```ts
async edit({ params, inertia }: HttpContext) {
  const production = await Production.query()
    .where('id', params.id)
    .preload('files')
    .preload('links')
    .firstOrFail()

  return inertia.render('admin/Productions/Edit', {
    production: {
      id: production.id,
      status: production.status,
      title: production.title,
      summary: production.summary ?? '',
      authors: production.authors ?? [],
      tags: production.tags ?? [],
      category: production.category ?? '',
      domain: production.domain ?? '',
      subdomain: production.subdomain ?? '',
      language: production.language ?? '',
      publicationCountry: production.publicationCountry ?? '',
      journal: production.journal ?? '',
      publisher: production.publisher ?? '',
      isbnDoiIssn: production.isbnDoiIssn ?? '',
      institution: production.institution ?? '',
      licenseStatus: production.licenseStatus,
      workPublishedAt: production.workPublishedAt?.toFormat('yyyy-MM-dd') ?? '',
    },
    files: production.files.map((f) => ({
      id: f.id, originalName: f.originalName, sizeBytes: f.sizeBytes, mimeType: f.mimeType,
    })),
    links: production.links.map((l) => ({
      id: l.id, url: l.url, linkType: l.linkType, label: l.label,
    })),
  })
}
```

> `workPublishedAt?.toFormat('yyyy-MM-dd')` pour pré-remplir `<input type="date">`. Champs null → `''` (le form attend des strings).

### Page Edit — `useForm` initialisé

```tsx
const { id, status, ...formData } = production
const form = useForm<ProductionFormData>(formData)
```
Le reste suit `Create.tsx` mais avec `put` au submit, `productionId={id}` et `files`/`links` passés à `ProductionForm` + `ProductionFormActions saveLabelKey="productions.form.save"`.

### Dépublier / Supprimer — sur la liste (cohérent avec Story 4.2)

Les boutons "Dépublier"/"Supprimer" ont été **placés (désactivés)** sur la liste en Story 4.2. Cette story les **active** avec modaux de confirmation (pattern identique aux modaux de `Users/Index.tsx` — Story 3.4/3.6) :
- "Dépublier" (visible si `status === 'published'`) → modal → `router.post(.../unpublish)`
- "Supprimer" → modal (bouton rouge "Supprimer") → `router.delete(...)`

États `unpublishTarget`/`deleteTarget`, boutons désactivés pendant `isProcessing` (anti double-submit).

### Redirections

- `update` → redirect `/admin/productions/:id/edit` (reste sur l'édition).
- `unpublish` → `redirect().back()` (reste sur liste OU edit selon l'origine).
- `destroy` → redirect `/admin/productions` (la production n'existe plus).

### Clés i18n à ajouter (sous `productions.*`)

FR : `edit_title` ("Modifier la production"), `form.save` ("Enregistrer"), `update_success` ("Modifications enregistrées."), `unpublish_success` ("Production dépubliée."), `delete_success` ("Production supprimée."), `unpublish_modal` { title "Dépublier cette production ?", description "La production ne sera plus visible sur le site public. Elle repassera en brouillon.", confirm "Dépublier" }, `delete_modal` { title "Supprimer cette production ?", description "Cette action est irréversible. La production et ses fichiers associés seront supprimés définitivement.", confirm "Supprimer définitivement" }.
EN : équivalents.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `inertia/pages/admin/Productions/Edit.tsx` | Page d'édition (form pré-rempli + actions) |
| `tests/functional/admin/productions_edit.spec.ts` | Tests edit/update/unpublish/delete |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/services/production_service.ts` | Ajouter `unpublish` + `delete` |
| `app/controllers/admin/productions_controller.ts` | Ajouter `edit`, `update`, `unpublish`, `destroy` |
| `start/routes.ts` | Routes edit/update/unpublish/destroy |
| `.adonisjs/server/pages.d.ts` | Enregistrer `admin/Productions/Edit` |
| `inertia/components/admin/ProductionFormActions.tsx` | Prop `saveLabelKey?` |
| `inertia/pages/admin/Productions/Index.tsx` | Activer Dépublier/Supprimer + modaux |
| `inertia/locales/admin/fr.json` | Clés `productions.edit_title/form.save/*_success/*_modal` |
| `inertia/locales/admin/en.json` | Mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** modifier `status` dans `update` (FR22) — uniquement publish/unpublish le changent
- **NE PAS** réinitialiser `anta_published_at` à la dépublication (conservé — FR35)
- **NE PAS** bloquer la suppression de la production si un `FileStorageService.delete` R2 échoue (best-effort + log)
- **NE PAS** supprimer manuellement les `production_files`/`production_links` (CASCADE BDD s'en charge) — mais supprimer les fichiers R2 AVANT le `production.delete()` (sinon on perd les `fileKey`)
- **NE PAS** importer `inertia/lib/*` côté serveur
- **NE PAS** oublier le modal de confirmation pour les actions destructrices (UX-DR14, `role="alertdialog"`)
- **NE PAS** rediriger vers l'edit après `destroy` (la production n'existe plus → 404) — rediriger vers la liste
- **NE PAS** importer `Link` depuis `@inertiajs/react`

### Tests — patterns à suivre

- Transaction rollback ; helpers `createAdminUser` / `createProduction` / `createCompleteProduction`.
- Edit : `GET /admin/productions/:id/edit` → 200 + `assertTextIncludes('admin/Productions/Edit')` + props via `data-page`.
- Update : `.put('/admin/productions/:id').form({ title: 'Nouveau', ... }).loginAs(admin).withCsrfToken().redirects(0)` → 302 ; `await production.refresh()` → champs modifiés, `updatedAt` changé.
- FR22 : créer une production `published`, PUT update → `status` reste `published`.
- Unpublish : `.post('/admin/productions/:id/unpublish')` → `status='draft'`, `antaPublishedAt` non null.
- Delete : `drive.fake('r2')` + `fakeDisk.put(key, '...')` (poser un fichier) + créer `ProductionFile` avec cette `key`, puis DELETE → `Production.find` null, `ProductionFile`/`ProductionLink` count 0, `fakeDisk.assertMissing(key)`, log `delete`.
- Un seul POST/PUT/DELETE par test.

### Sécurité

- Toutes les routes sous `AdminMiddleware`. Admin + super_admin.
- Validation serveur (VineJS) sur update. `status` non pilotable par le payload.
- Suppression irréversible (FR24/RGPD) — modal de confirmation côté client + action serveur explicite.
- CSRF automatique.

### Dépendances cross-story

- **Story 4.3** : `ProductionForm`, `getRequiredFieldStatuses`, `ProductionFormData`, `EMPTY_PRODUCTION_FORM` (Edit n'utilise pas EMPTY mais le type).
- **Story 4.4** : `FileUploader` + `ProductionFileRow` → activés ici (productionId fourni).
- **Story 4.5** : `LinkManager` + `ProductionLinkRow` + `isAttachmentSatisfied` → activés ici.
- **Story 4.6** : `ProductionFormActions`, `ProductionService.publish` → "Publier" fonctionnel ici ; **AC4 de 4.6 (FR22) testé ici** (update préserve status).
- **Story 4.2** : `Index.tsx` (boutons Dépublier/Supprimer placés, désactivés) → activés ici ; `StatusBadge`.
- **Story 1.2/1.3** : modèle `Production`/relations, `FileStorageService`.

### Previous Story Intelligence

**Story 4.6 :**
- `ProductionFormActions` (UX-DR16) rend "Publier" actif si `isComplete && productionId`. Edit fournit `productionId` → Publier fonctionnel.
- `ProductionService` (statique) avec `publish` ; ajouter `unpublish`/`delete`.
- `redirect().back()` testé via 302.

**Story 4.4 :**
- `drive.fake('r2')` + `assertMissing` pour tester la suppression R2 ; `config/drive.ts` a la config `fakes`.
- `FileStorageService.delete(fileKey)` supprime de R2.

**Story 3.4/3.6 :**
- Pattern modaux de confirmation (Dialog `role="alertdialog"`) + états `*Target` + boutons désactivés pendant `isProcessing` dans `Users/Index.tsx` — à répliquer pour productions.

**Général :**
- `.adonisjs/server/pages.d.ts` : enregistrement manuel des nouvelles pages.
- Prettier : multi-lignes ; `npx prettier --write` au besoin.

### Project Structure Notes

- `inertia/pages/admin/Productions/Edit.tsx` → prévu dans l'arborescence architecture.
- Méthodes `edit/update/unpublish/destroy` sur le `ProductionsController` existant.
- Tests dans `tests/functional/admin/`.

### References

- [Source: epics.md#Story 4.7] — Acceptance criteria
- [Source: epics.md#FR22] — Pas de republication automatique
- [Source: epics.md#FR23] — Dépublication (retour brouillon)
- [Source: epics.md#FR24] — Suppression
- [Source: epics.md#NFR12] — Intégrité fichiers (suppression R2)
- [Source: ux-design-specification.md#UX-DR14] — Modaux de confirmation (alertdialog, bouton rouge)
- [Source: architecture.md#Séquence d'Implémentation] — `ProductionService.unpublish/delete`
- [Source: app/controllers/admin/productions_controller.ts] — contrôleur (index/create/store/publish)
- [Source: app/services/production_service.ts] — service (getMissingForPublish/publish) à étendre
- [Source: app/models/production.ts] — relations files/links, champs
- [Source: app/services/file_storage_service.ts] — `delete(fileKey)`
- [Source: inertia/components/admin/ProductionForm.tsx] — props productionId/files/links
- [Source: inertia/components/admin/ProductionFormActions.tsx] — barre d'actions (saveLabelKey à ajouter)
- [Source: inertia/pages/admin/Productions/Index.tsx] — boutons Dépublier/Supprimer à activer
- [Source: inertia/pages/admin/Users/Index.tsx] — pattern modaux de confirmation
- [Source: _bmad-output/implementation-artifacts/4-6-publication-workflow.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/4-4-upload-fichiers-r2.md] — drive.fake / FileStorageService.delete

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **Test PUT/arrays** : l'api-client `.form({ authors: ['B'] })` sérialise un array à un seul élément en string (`authors=B`) → `vine.array()` rejette (« must be an array ») → 302 validation-back, titre non modifié. Corrigé en utilisant `.json({...})` dans les tests update (reflète les visites Inertia qui envoient du JSON ; arrays préservés). Le code applicatif est correct — c'était un artefact de l'encodage form en test.
- `production.workPublishedAt?.toFormat('yyyy-MM-dd')` pour pré-remplir `<input type="date">` côté Edit.
- `loadCount`/`preload('files'/'links')` pour la page edit ; suppression R2 via `drive.fake` testée par `assertMissing`.

### Completion Notes List

- **AC1 satisfait** : `Edit.tsx` charge le formulaire pré-rempli + fichiers/liens ; FileUploader/LinkManager désormais **fonctionnels** (productionId fourni).
- **AC2 satisfait** : `update` (PUT) met à jour les métadonnées, `updated_at` auto, log `update`, toast `update_success`. `status` jamais modifié.
- **AC2/FR22 vérifié** : test « PUT sur production publiée → status reste published ».
- **AC3/AC4 satisfaits** : modal de dépublication (UX-DR14) + `unpublish` (status→draft, anta_published_at conservé, log).
- **AC5/AC6 satisfaits** : modal de suppression (UX-DR14, bouton rouge) + `delete` (suppression R2 best-effort, CASCADE production_files/links, log).
- **Epic 4 bouclé fonctionnellement** : le flux créer→éditer→uploader fichiers/liens→publier→dépublier/supprimer est complet de bout en bout.
- Tests : 227/227. Lint + typecheck verts.

### File List

**Créés :**
- `inertia/pages/admin/Productions/Edit.tsx` — page d'édition (form pré-rempli + actions)
- `tests/functional/admin/productions_edit.spec.ts` — 6 tests (edit/update/FR22/unpublish/delete/non-auth)

**Modifiés :**
- `app/services/production_service.ts` — ajout `unpublish` + `delete` (nettoyage R2)
- `app/controllers/admin/productions_controller.ts` — ajout `edit`, `update`, `unpublish`, `destroy`
- `start/routes.ts` — routes edit/update/unpublish/destroy
- `.adonisjs/server/pages.d.ts` — enregistrement `admin/Productions/Edit`
- `inertia/components/admin/ProductionFormActions.tsx` — prop `saveLabelKey`
- `inertia/pages/admin/Productions/Index.tsx` — Dépublier/Supprimer activés + 2 modaux
- `inertia/locales/admin/fr.json` — clés edit/save/update/unpublish/delete + modaux
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 4.7 (Modification/dépublication/suppression). Page Edit (active FileUploader/LinkManager/Publier), `update` (FR22 status préservé), `ProductionService.unpublish`/`delete` (R2 best-effort + CASCADE), modaux Dépublier/Supprimer sur la liste (UX-DR14), i18n FR/EN. 6 tests fonctionnels. Tests totaux : 227/227.

## Review Findings

- [x] [Review][Decision→Patch] Production publiée éditable en état incomplet — RÉSOLU (option : auto-dépublication) : `update()` revalide la complétude via `getMissingForPublish` quand `status === 'published'` ; si l'édition la rend incomplète → `status = DRAFT` + log `unpublish` + flash `productions.auto_unpublished` (avertissement). FR22 préservé pour les éditions complètes. Test FR22 ajusté (payload complet) + nouveau test D1 (édition incomplète → draft). [app/controllers/admin/productions_controller.ts:update]
