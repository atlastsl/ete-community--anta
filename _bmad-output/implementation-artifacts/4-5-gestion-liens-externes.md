# Story 4.5 : Gestion des liens externes

Status: done

## Story

En tant qu'administrateur,
Je veux associer des liens externes (embed ou lien simple) à une production,
Afin de référencer du contenu sous copyright ou hébergé sur des plateformes tierces (FR19, NFR11).

## Acceptance Criteria

**AC1 — Formulaire inline d'ajout de lien (UX-DR11)**

- **Given** le composant `LinkManager` est affiché dans le formulaire
- **When** l'admin clique sur "Ajouter un lien"
- **Then** un formulaire inline apparaît avec les champs : URL, type (embed / lien simple), label

**AC2 — Ajout d'un lien sans rechargement**

- **Given** l'admin remplit les champs et confirme
- **When** le lien est ajouté
- **Then** il apparaît dans la liste des liens associés sans rechargement de page (visite Inertia partielle)
- **And** un enregistrement `production_links` est créé avec `url`, `link_type`, `label`

**AC3 — Validation de l'URL**

- **Given** l'URL saisie n'est pas valide
- **When** l'admin tente de confirmer l'ajout
- **Then** une erreur de validation s'affiche : "URL invalide. Veuillez saisir une URL complète (https://...)"

**AC4 — Suppression d'un lien**

- **Given** un lien existe dans la liste
- **When** l'admin clique sur "Supprimer" sur ce lien
- **Then** le lien est retiré de la liste et l'enregistrement `production_links` est supprimé

**AC5 — Exigence de lien pour licence `external_link`**

- **Given** la production a `license_status = 'external_link'`
- **When** `CompletionIndicator` se met à jour
- **Then** au moins un lien externe est requis pour que l'indicateur passe au vert (un fichier hébergé seul ne suffit pas)

## Tasks / Subtasks

- [x] **Tâche 1 — Créer l'enum `LinkType`** (AC2)
  - [x] 1.1 `app/enums/link_type.ts` (embed/simple) ; 1.2 `production_link.ts` typé via `LinkType`

- [x] **Tâche 2 — Créer le validateur de lien** (AC3)
  - [x] 2.1–2.2 `createLinkValidator` (url http/https requis, linkType enum, label optionnel) + messages → `productions.links.errors.invalid_url`

- [x] **Tâche 3 — Créer le `LinksController`** (AC2, AC4)
  - [x] 3.1–3.4 `links_controller.ts` (`store` findOrFail+validate+create+flash, `destroy` scopé+delete) ; `Links` enregistré dans le registre

- [x] **Tâche 4 — Routes** (AC2, AC4)
  - [x] 4.1 `POST /admin/productions/:productionId/links` + `DELETE .../:linkId` (groupe admin)

- [x] **Tâche 5 — Composant `LinkManager` (UX-DR11)** (AC1, AC2, AC3, AC4)
  - [x] 5.1–5.7 `LinkManager.tsx` : bouton "Ajouter un lien" → form inline (URL/Select type/label), `useForm.post` avec `onSuccess` reset+close, erreur `errors.url`, liste (badge type, label, URL tronquée) + suppression `router.delete`, tout via `t()`

- [x] **Tâche 6 — Logique de complétude fichier/lien (AC5) + intégration form** (AC5)
  - [x] 6.1 `inertia/lib/production_completion.ts` → `isAttachmentSatisfied` (external_link ⇒ hasLink ; sinon hasFile||hasLink)
  - [x] 6.2 `ProductionForm` : prop `links?`, **prop `hasFileOrLink` supprimée**, calcul interne via `isAttachmentSatisfied`
  - [x] 6.3 Section Fichiers & Liens : `<FileUploader>` + `<LinkManager>` si `productionId`
  - [x] 6.4 `Create.tsx` adapté (plus de `hasFileOrLink` ; `isComplete` via `isAttachmentSatisfied(..., false, false)`)

- [x] **Tâche 7 — Clés i18n** (AC1–AC4)
  - [x] 7.1–7.2 `productions.links.*` FR + EN, parité OK

- [x] **Tâche 8 — Tests** (AC2, AC3, AC4, AC5)
  - [x] 8.1 `production_links.spec.ts` : 5 tests (lien valide, URL invalide→0, type invalide→0, delete, non-auth)
  - [x] 8.2 `production_completion.spec.ts` : 2 tests (logique AC5, lecture source)

- [x] **Tâche 9 — Validation finale**
  - [x] 9.1 `node ace test` → 211 tests passent (204 + 7)
  - [x] 9.2 `npm run lint` → 0 erreur
  - [x] 9.3 `npm run typecheck` → 0 erreur

## Dev Notes

### Symétrie avec Story 4.4 (fichiers)

Cette story est le pendant « liens » de la 4.4 « fichiers ». Mêmes patterns :
- Endpoint REST imbriqué sous la production (`/admin/productions/:productionId/links`).
- Composant (`LinkManager`) rendu dans la section "Fichiers & Liens" de `ProductionForm`, **fonctionnel uniquement avec `productionId`** (donc sur l'Edit, Story 4.7). Page création → hint.
- Modèle `ProductionLink` + migration + FK CASCADE déjà en place (Story 1.2).
- Tests au niveau contrôleur (endpoint), pas de R2 ici (les liens ne touchent pas le stockage).

Différence : pas de validation de fichier/MIME — juste une **validation d'URL** (VineJS `.url()`), et **pas d'appel R2**.

### Modèle `ProductionLink` (Story 1.2)

`id`, `productionId`, `url`, `linkType` (`'embed' | 'simple'`), `label` (nullable), timestamps. FK `production_id` CASCADE. Enum natif PostgreSQL `link_type`.

### AC5 — Raffinement de la complétude (le point délicat)

La règle de publication pour l'attachement dépend de la licence (UX spec lignes 873-874) :
- **`external_link`** : au moins **un lien** requis (un fichier hébergé seul **ne suffit pas**) — le contenu est sous copyright, donc référencé par lien.
- **`member` / `free_license`** : au moins **un fichier OU un lien**.

Helper pur (réutilisé par `CompletionIndicator` et le bouton Publier, et plus tard la validation serveur de publication en 4.6) :

```ts
// inertia/lib/production_completion.ts
export function isAttachmentSatisfied(
  licenseStatus: 'member' | 'free_license' | 'external_link',
  hasFile: boolean,
  hasLink: boolean
): boolean {
  if (licenseStatus === 'external_link') return hasLink
  return hasFile || hasLink
}
```

Refactor de `ProductionForm` (introduit en 4.3, enrichi en 4.4) : **supprimer la prop `hasFileOrLink`** au profit d'un calcul interne à partir de `files`, `links` et `data.licenseStatus`. Mettre à jour `Create.tsx` en conséquence (sur la page création, `files`/`links` sont vides → `isAttachmentSatisfied` renvoie false → "Publier" désactivé, comportement inchangé).

> La validation **serveur** de cette règle (au moment de publier) est gérée en Story 4.6. Ici, c'est uniquement l'indicateur client.

### Validation d'URL (AC3)

`vine.string().trim().url({ require_protocol: true, protocols: ['http', 'https'] })`. Message mappé vers `productions.links.errors.invalid_url` = "URL invalide. Veuillez saisir une URL complète (https://...)". Conformément au pattern Inertia du projet, l'échec de validation renvoie un 302 + `errors.url` (affiché par `LinkManager`).

### Pattern contrôleur `store` — cible

```ts
async store({ request, params, response, session }: HttpContext) {
  const production = await Production.findOrFail(params.productionId)
  const data = await request.validateUsing(createLinkValidator)

  await ProductionLink.create({
    productionId: production.id,
    url: data.url,
    linkType: data.linkType,
    label: data.label ?? null,
  })

  session.flash('success', 'productions.links.added')
  return response.redirect().back()
}
```

### Ajout inline « sans rechargement » (AC2)

`LinkManager` utilise `useForm` Inertia. Au succès, Inertia effectue une visite partielle (pas de full reload navigateur) qui recharge les props de la page → la liste `links` se met à jour. Le formulaire inline est réinitialisé/fermé via `onSuccess`. C'est la sémantique « sans rechargement de page » attendue.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/enums/link_type.ts` | Enum `LinkType` (embed/simple) |
| `app/controllers/admin/links_controller.ts` | `store` + `destroy` |
| `inertia/components/admin/LinkManager.tsx` | Gestion inline des liens (UX-DR11) |
| `inertia/lib/production_completion.ts` | Helper pur `isAttachmentSatisfied` (AC5) |
| `tests/functional/admin/production_links.spec.ts` | Tests endpoint |
| `tests/unit/lib/production_completion.spec.ts` | Test logique AC5 (lecture source) |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/models/production_link.ts` | Typer `linkType` via `LinkType` |
| `app/validators/admin/production_validator.ts` | Ajouter `createLinkValidator` (ou fichier dédié) |
| `start/routes.ts` | Routes liens (groupe admin) |
| `.adonisjs/server/controllers.ts` | Import `Links` |
| `inertia/components/admin/ProductionForm.tsx` | Prop `links?`, calcul interne `isAttachmentSatisfied`, rendre `LinkManager`, supprimer prop `hasFileOrLink` |
| `inertia/pages/admin/Productions/Create.tsx` | Adapter au nouveau contrat `ProductionForm` (plus de `hasFileOrLink`) |
| `inertia/locales/admin/fr.json` | Clés `productions.links.*` |
| `inertia/locales/admin/en.json` | Mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** valider l'URL uniquement côté client — VineJS `.url()` côté serveur (défense en profondeur)
- **NE PAS** rendre `LinkManager` fonctionnel sans `productionId` (page création → hint, comme `FileUploader`)
- **NE PAS** oublier AC5 : pour `external_link`, un fichier seul ne satisfait PAS la complétude — il faut un lien
- **NE PAS** dupliquer la logique d'attachement : centraliser dans `isAttachmentSatisfied` (réutilisé indicateur + bouton + futur serveur 4.6)
- **NE PAS** utiliser de strings `'embed'`/`'simple'` en dur côté serveur — enum `LinkType`
- **NE PAS** wrapper les props Inertia ; props directes
- **NE PAS** importer `Link` (composant Inertia) — ici on manipule des « liens » métier, attention à ne pas confondre ; `router` depuis `@inertiajs/react` pour les actions

### Tests — patterns à suivre

- Transaction rollback ; helpers `createAdminUser` / `createProduction` (cf. `production_files.spec.ts`).
- POST lien : `.post('/admin/productions/:id/links').form({ url, linkType, label }).loginAs(admin).withCsrfToken().redirects(0)` → 302 + `ProductionLink.query().where('productionId', p.id)`.
- URL invalide : `.form({ url: 'pas-une-url', linkType: 'simple' })` → 302, count = 0.
- DELETE : créer un lien puis DELETE → record null.
- `production_completion.spec.ts` : lecture de source (`fs.readFileSync` + regex/assertions) — le code `inertia/` ne s'importe pas depuis un test serveur (TS6305, cf. `notify.spec.ts`).
- Un seul POST/DELETE par test.

### Sécurité

- Routes sous `AdminMiddleware`. Admin + super_admin.
- Validation URL serveur (protocole http/https requis) — évite `javascript:` / URL malformées.
- `label` borné (255). CSRF automatique.
- L'embed d'URL externes (iframe sandbox) côté public est géré en Epic 6 (Story 6.3) — pas ici.

### Dépendances cross-story

- **Story 1.2** : modèle `ProductionLink`, migration, relation `Production.links`.
- **Story 4.3** : `ProductionForm`, `CompletionIndicator`, `getRequiredFieldStatuses`.
- **Story 4.4** : `FileUploader` + pattern endpoint imbriqué + section Fichiers ; `files` prop de `ProductionForm`.
- **Story 4.6** : validation serveur de publication réutilisera `isAttachmentSatisfied` (logique à porter côté serveur) + champs requis.
- **Story 4.7** : page `Edit` fournira `productionId` + `files` + `links` → `LinkManager` pleinement fonctionnel.
- **Story 6.3** : rendu public des liens (embed iframe / lien simple).

### Previous Story Intelligence

**Story 4.4 (fichiers) :**
- Pattern endpoint imbriqué `/admin/productions/:productionId/{files|links}` + enregistrement contrôleur dans `.adonisjs/server/controllers.ts`.
- `ProductionForm` section Fichiers rend le composant si `productionId`, sinon hint. Ajouter `LinkManager` à côté.
- `redirect().back()` testé via assert 302 (pas la cible).
- Composant `inertia/` non importable en test serveur (TS6305) → test de source pour la logique pure.

**Story 4.3 :**
- `ProductionForm` reçoit `data/setData/errors` + (4.4) `productionId?/files?`. Cette story ajoute `links?` et **retire `hasFileOrLink`** (calcul interne).
- `CompletionIndicator` prend `fields` + `hasFileOrLink` (booléen) — on lui passe désormais le résultat de `isAttachmentSatisfied`.

**Général :**
- Prettier : multi-lignes ; `npx prettier --write` au besoin.
- `Select` shadcn = Radix (`value`/`onValueChange`).

### Project Structure Notes

- `app/controllers/admin/links_controller.ts`, `inertia/components/admin/LinkManager.tsx` → prévus dans l'arborescence architecture.
- `app/enums/link_type.ts` → cohérent avec les 4 enums existants.
- Tests dans `tests/functional/admin/` et `tests/unit/lib/`.

### References

- [Source: epics.md#Story 4.5] — Acceptance criteria
- [Source: epics.md#FR19] — Association de liens externes (embed/simple)
- [Source: epics.md#NFR11] — Lien externe pour contenu sous copyright
- [Source: ux-design-specification.md:786-788] — `LinkManager` (liste + ajout inline)
- [Source: ux-design-specification.md:873-874] — Lien obligatoire si copyright ; fichier OU lien sinon
- [Source: app/models/production_link.ts] — Modèle (url, linkType, label)
- [Source: database/migrations/1775918735161_create_production_links_table.ts] — Table + enum link_type + FK CASCADE
- [Source: inertia/components/admin/ProductionForm.tsx] — Section Fichiers & Liens, props files/productionId
- [Source: inertia/components/admin/FileUploader.tsx] — Pattern composant frère (4.4)
- [Source: inertia/components/admin/CompletionIndicator.tsx] — Indicateur (hasFileOrLink)
- [Source: app/validators/admin/production_validator.ts] — Validateurs production
- [Source: _bmad-output/implementation-artifacts/4-4-upload-fichiers-r2.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/4-3-formulaire-creation-production.md] — ProductionForm / CompletionIndicator

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- `vine.string().url({ require_protocol: true, protocols: ['http','https'] })` rejette les URL sans schéma (`pas-une-url`) → message i18n `invalid_url`.
- `LinkManager` : le formulaire d'ajout n'est PAS un `<form>` imbriqué (la page parente Edit sera déjà un form) — boutons `type="button"` + `handleAdd` appelle `post()` directement. Évite la double soumission de l'outer form.
- Refactor `ProductionForm` : prop `hasFileOrLink` supprimée au profit d'un calcul interne (`isAttachmentSatisfied`) ; `Create.tsx` adapté. Typecheck OK.
- Le test type-invalide envoie `linkType: 'bogus'` → `vine.enum` rejette → 302, 0 enregistrement.

### Completion Notes List

- **AC1 satisfait** : `LinkManager` avec bouton "Ajouter un lien" → formulaire inline (URL, type embed/simple, label).
- **AC2 satisfait** : ajout via `useForm.post` (visite Inertia partielle, pas de full reload) → liste rechargée ; `production_links` créé (`url`, `link_type`, `label`).
- **AC3 satisfait** : URL invalide → validation VineJS serveur → `errors.url` = "URL invalide…", aucun enregistrement.
- **AC4 satisfait** : suppression → `router.delete` → enregistrement supprimé.
- **AC5 satisfait** : helper `isAttachmentSatisfied` — pour `external_link`, seul un lien satisfait la complétude (fichier seul insuffisant) ; sinon fichier OU lien. Intégré au `CompletionIndicator` via `ProductionForm`.
- **Contrainte de flux** : `LinkManager` fonctionnel uniquement avec `productionId` (Edit, Story 4.7) ; page création → hint.
- Tests : 211/211. Lint + typecheck verts.

### File List

**Créés :**
- `app/enums/link_type.ts` — enum `LinkType` (embed/simple)
- `app/controllers/admin/links_controller.ts` — `store` + `destroy`
- `inertia/components/admin/LinkManager.tsx` — gestion inline des liens (UX-DR11)
- `inertia/lib/production_completion.ts` — helper pur `isAttachmentSatisfied` (AC5)
- `tests/functional/admin/production_links.spec.ts` — 5 tests endpoint
- `tests/unit/lib/production_completion.spec.ts` — 2 tests logique AC5

**Modifiés :**
- `app/models/production_link.ts` — `linkType` typé via `LinkType`
- `app/validators/admin/production_validator.ts` — ajout `createLinkValidator`
- `start/routes.ts` — routes liens
- `.adonisjs/server/controllers.ts` — import `Links`
- `inertia/components/admin/ProductionForm.tsx` — prop `links?`, calcul interne attachement, `LinkManager`, suppression prop `hasFileOrLink`
- `inertia/pages/admin/Productions/Create.tsx` — adaptation au nouveau contrat `ProductionForm`
- `inertia/locales/admin/fr.json` — clés `productions.links.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 4.5 (Gestion des liens externes). Enum `LinkType`, `LinksController` (store/destroy), validateur URL, `LinkManager` (ajout inline + suppression), helper `isAttachmentSatisfied` (AC5 — lien requis pour external_link), refactor `ProductionForm`/`Create`, i18n FR/EN. 7 tests. Tests totaux : 211/211.

## Review Findings

- [x] [Review][Patch] Entrée clavier dans un champ de lien soumet le form production parent — RÉSOLU : `handleLinkKeyDown` (Entrée → `preventDefault` + `submitLink`) attaché aux inputs URL et label de `LinkManager` → l'Entrée ajoute le lien au lieu de PUT la production. [inertia/components/admin/LinkManager.tsx]
- [x] [Review][Defer] Liens `embed` sans allowlist d'hôtes (SSRF / iframe arbitraire) — `createLinkValidator` n'impose que http/https. Aucun sink en Epic 4 (l'URL est rendue en texte). Le rendu iframe `embed` (sandbox + allowlist) relève de la Story 6.3 — à traiter là (+ rejet hôtes privés/loopback si fetch serveur). [app/validators/admin/production_validator.ts] (source: blind)
