# Story 4.3 : Formulaire de création de production

Status: done

## Story

En tant qu'administrateur,
Je veux créer une nouvelle production en renseignant ses métadonnées via un formulaire guidant,
Afin d'enrichir la bibliothèque avec du contenu structuré et complet (FR17, FR20).

## Acceptance Criteria

**AC1 — Formulaire organisé en sections + sous-domaine conditionnel**

- **Given** un admin clique sur "Créer une production"
- **When** la page `/admin/productions/create` se charge
- **Then** le formulaire affiche les champs de métadonnées organisés en sections : **Informations générales** (titre, auteur(s), catégorie, domaine, langue, pays), **Contenu** (résumé, date de l'œuvre, tags), **Droits & Licence** (licence) — plus les champs optionnels (journal, éditeur, ISBN/DOI/ISSN, institution)
- **And** le champ **sous-domaine** est masqué tant qu'aucun domaine n'est saisi, puis affiché en champ conditionnel

**AC2 — CompletionIndicator sticky temps réel (UX-DR6)**

- **Given** le formulaire est affiché
- **When** `CompletionIndicator` se rend en sticky en haut du formulaire
- **Then** il affiche "{N}/{total} champs — {missing} requis pour publier" avec la liste des champs manquants **cliquables** (focus du champ au clic)
- **And** il se met à jour en temps réel à chaque `onChange` sans soumission du formulaire
- **And** son état est : **orange** si incomplet, **vert** si tous les champs obligatoires sont remplis ET au moins un fichier ou lien associé
- **And** le conteneur porte `aria-live="polite"` (UX-DR20)

**AC3 — Validation inline onBlur (UX-DR17)**

- **Given** l'admin quitte un champ obligatoire sans le remplir
- **When** le focus passe à un autre champ (`onBlur`)
- **Then** un message d'erreur s'affiche sous le champ en `text-red-600 text-sm`, lié via `aria-describedby`

**AC4 — Enregistrement brouillon (FR20, FR35)**

- **Given** l'admin clique sur "Enregistrer brouillon"
- **When** le formulaire est soumis
- **Then** la production est créée avec `status = 'draft'` même si des champs obligatoires pour publier sont vides
- **And** `created_by_id` est défini avec l'id de l'admin connecté
- **And** `created_at` et `updated_at` sont générés automatiquement (FR35)
- **And** un toast succès s'affiche : "Brouillon enregistré."
- **And** l'action est loguée via `ActivityLogService.log({ actionType: 'create', resourceType: 'production' })`

**AC5 — Hiérarchie des boutons (UX-DR16)**

- **Given** le `CompletionIndicator` est orange (champs manquants OU aucun fichier/lien)
- **When** le formulaire est affiché
- **Then** le bouton "Publier" est désactivé (`disabled`, opacité 40%, `cursor-not-allowed`)
- **And** "Enregistrer brouillon" reste le bouton primaire (vert)
- **Note** : l'action de publication réelle (endpoint + bascule du primaire vers "Publier") est implémentée en **Story 4.6**. Cette story rend le bouton "Publier" présent mais désactivé.

## Tasks / Subtasks

- [x] **Tâche 1 — Créer le validateur VineJS brouillon** (AC4)
  - [x] 1.1–1.4 `production_validator.ts` : `draftProductionValidator` (title requis min1/max255, reste optionnel ; `authors`/`tags` arrays optionnels ; `licenseStatus` enum optionnel ; `workPublishedAt` string optionnel) + `messagesProvider` → clés i18n

- [x] **Tâche 2 — Ajouter `create` et `store` au `ProductionsController`** (AC1, AC4)
  - [x] 2.1 `create()` → render `admin/Productions/Create`
  - [x] 2.2 `store()` : valide, crée draft (`status=DRAFT`, `createdById`, `licenseStatus ?? MEMBER`, `authors/tags ?? []`, `workPublishedAt` via `DateTime.fromISO`), log create/production, flash `draft_saved`, redirect liste

- [x] **Tâche 3 — Routes + enregistrement page** (AC1)
  - [x] 3.1 `GET /admin/productions/create` + `POST /admin/productions` (groupe admin, create avant index)
  - [x] 3.2 Page `admin/Productions/Create` enregistrée dans `.adonisjs/server/pages.d.ts`

- [x] **Tâche 4 — Composant `CompletionIndicator`** (AC2, AC5)
  - [x] 4.1–4.7 `CompletionIndicator.tsx` : sticky, `role="status"` + `aria-live="polite"`, "{filled}/{total} champs — {missing} requis", champs manquants cliquables (focus par id), ligne fichier/lien, états orange/vert, tout via `t()`

- [x] **Tâche 5 — Composant `ProductionForm`** (AC1, AC3)
  - [x] 5.1–5.10 `ProductionForm.tsx` : sections fieldset (général/contenu/droits/optionnel/fichiers), Input/textarea/date/Select, authors/tags multi-valeurs (état local + parse array), sous-domaine conditionnel, validation onBlur non bloquante (`aria-describedby`), id=key pour focus, CompletionIndicator intégré, export `getRequiredFieldStatuses` + `EMPTY_PRODUCTION_FORM`, section Fichiers réservée, tout via `t()`

- [x] **Tâche 6 — Page `Create.tsx`** (AC4, AC5)
  - [x] 6.1–6.5 `Create.tsx` : `useForm<ProductionFormData>`, `<ProductionForm>`, bouton "Enregistrer brouillon" primaire (loading), "Publier" désactivé (`!isComplete`, hasFileOrLink=false), "Annuler", erreurs serveur via `errors`

- [x] **Tâche 7 — Clés i18n** (AC1, AC2, AC3, AC4)
  - [x] 7.1 `productions.create_title/draft_saved/form.*/completion.*` ajoutés FR + EN
  - [x] 7.2 Parité FR/EN OK (`translations.spec.ts` passe)

- [x] **Tâche 8 — Tests fonctionnels** (AC4)
  - [x] 8.1–8.7 `productions_create.spec.ts` : 6 tests (GET page, non-auth, POST minimal+défauts, POST complet+arrays, POST sans title→aucune création, log create/production)

- [x] **Tâche 9 — Validation finale**
  - [x] 9.1 `node ace test` → 200 tests passent (194 + 6)
  - [x] 9.2 `npm run lint` → 0 erreur
  - [x] 9.3 `npm run typecheck` → 0 erreur

## Dev Notes

### Décision : Inertia `useForm` (pas React Hook Form / Zod)

L'architecture mentionne « React Hook Form + Zod », mais **aucune des deux libs n'est installée** et la Story 3.3 (`Users/Create.tsx`) a établi le pattern projet : **Inertia `useForm` + validation manuelle onBlur**. On s'y conforme — pas de nouvelle dépendance, cohérence du codebase. La validation serveur reste VineJS (la « double validation » de l'archi se réduit ici à : VineJS serveur + checks manuels légers côté client). Déviation assumée et documentée.

### Périmètre — ce qui N'EST PAS dans cette story

- **Upload de fichiers** (`FileUploader`) → Story 4.4
- **Liens externes** (`LinkManager`) → Story 4.5
- **Publication réelle** (endpoint publish, bascule bouton primaire, revalidation complétude serveur) → Story 4.6
- **Édition** (`Edit.tsx`, route `:id/edit`) → Story 4.7

Conséquence : la section "Fichiers & Liens" du formulaire est un **emplacement réservé** ; `hasFileOrLink` vaut `false` → le `CompletionIndicator` ne peut pas atteindre le vert et "Publier" reste désactivé tant que 4.4-4.6 ne sont pas livrées. C'est cohérent et attendu.

### Champs de la production (FR17) et obligation de publication (FR21)

| Champ (modèle) | Type form | Requis pour PUBLIER (FR21) | Notes |
|---|---|---|---|
| `title` | Input texte | ✅ (+ requis même en brouillon — DB NOT NULL) | max 255 |
| `authors` | texte multi (virgules) → `string[]` | ✅ (≥ 1) | jsonb |
| `category` | Input texte | ✅ | string libre (pas d'enum en BDD) |
| `domain` | Input texte | ✅ | string libre |
| `subdomain` | Input texte (conditionnel) | ✅ | affiché si `domain` rempli |
| `language` | Input texte | ✅ | string libre |
| `publicationCountry` | Input texte | ✅ | "Pays" |
| `summary` | textarea | ✅ | |
| `tags` | texte multi (virgules) → `string[]` | ✅ (≥ 1) | jsonb |
| `workPublishedAt` | `input type=date` | ✅ | date de l'œuvre (FR35, publique) |
| `licenseStatus` | Select (member/free_license/external_link) | ✅ | **DB NOT NULL** → défaut `member` en brouillon |
| `journal` | Input texte | ❌ optionnel | |
| `publisher` | Input texte | ❌ optionnel | |
| `isbnDoiIssn` | Input texte | ❌ optionnel | |
| `institution` | Input texte | ❌ optionnel | |
| `status` | — | géré par l'action (draft/publish) | pas un champ saisi |

> Les **champs requis pour publier** (à suivre dans `CompletionIndicator`) sont les 11 marqués ✅ ci-dessus (hors `status`). Le « 12ᵉ » critère est **au moins un fichier ou lien** (`hasFileOrLink`). Définir une constante `PUBLISH_REQUIRED_FIELDS` partagée (clé + labelKey) pour le `CompletionIndicator`.

### Contraintes BDD à respecter (migration `create_productions_table`)

- `title` : `notNullable()` sans défaut → **requis en brouillon** (validateur exige `title`).
- `license_status` : `notNullable()` **sans défaut** → si l'admin ne choisit pas, le `store()` force `LicenseStatus.MEMBER`. (Alternative : le form pré-sélectionne `member`.)
- `authors` / `tags` : `notNullable().defaultTo('[]')` → toujours passer un array (`?? []`) ; le modèle a `prepare: JSON.stringify` / `consume: JSON.parse`.
- `status` : `defaultTo('draft')` → on passe explicitement `ProductionStatus.DRAFT`.
- `created_at` auto (`now()`), `updated_at` nullable (auto via `autoUpdate` du modèle).
- Le trigger `tsvector` se met à jour automatiquement à l'INSERT — rien à faire côté app.

### `workPublishedAt` — type

Colonne `date` (Lucid `@column.date()` → `DateTime | null`). Le champ HTML `type="date"` renvoie une string `YYYY-MM-DD`. Validateur : `vine.string().optional()` (format date léger) OU `vine.date({ formats: ['YYYY-MM-DD'] }).optional()`. À l'insertion, convertir en `DateTime.fromISO(value)` si présent, sinon `null`. Documenter le choix retenu dans Debug Log.

### Pattern contrôleur `store` (brouillon) — cible

```ts
async store({ request, auth, response, session }: HttpContext) {
  const data = await request.validateUsing(draftProductionValidator)

  const production = await Production.create({
    title: data.title,
    summary: data.summary ?? null,
    authors: data.authors ?? [],
    tags: data.tags ?? [],
    category: data.category ?? null,
    domain: data.domain ?? null,
    subdomain: data.subdomain ?? null,
    language: data.language ?? null,
    publicationCountry: data.publicationCountry ?? null,
    journal: data.journal ?? null,
    publisher: data.publisher ?? null,
    isbnDoiIssn: data.isbnDoiIssn ?? null,
    institution: data.institution ?? null,
    licenseStatus: data.licenseStatus ?? LicenseStatus.MEMBER,
    status: ProductionStatus.DRAFT,
    workPublishedAt: data.workPublishedAt ? DateTime.fromISO(data.workPublishedAt) : null,
    createdById: auth.user!.id,
  })

  await ActivityLogService.log({
    adminUserId: auth.user!.id,
    actionType: ActionType.CREATE,
    resourceType: 'production',
    resourceId: production.id,
  })

  session.flash('success', 'productions.draft_saved')
  return response.redirect('/admin/productions')
}
```

### CompletionIndicator — contrat cible

```tsx
type FieldStatus = { key: string; labelKey: string; filled: boolean }
type Props = { fields: FieldStatus[]; hasFileOrLink: boolean }
```
- `filledCount = fields.filter(f => f.filled).length`, `total = fields.length`
- `missing = fields.filter(f => !f.filled)`
- `isComplete = missing.length === 0 && hasFileOrLink`
- Sticky en haut du form ; `aria-live="polite"` ; libellé via `t('productions.completion.summary', { filled, total, missing: missing.length })`
- Champs manquants : `<button type="button" onClick={() => document.getElementById(f.key)?.focus()}>{t(f.labelKey)}</button>`
- La logique de "rempli" pour un champ array (authors/tags) = `value.length > 0` ; pour string = `value.trim() !== ''`.

### Réutilisabilité ProductionForm (création + édition)

`ProductionForm.tsx` doit être conçu pour être réutilisé par `Edit.tsx` (Story 4.7). Pour 4.3, l'état du formulaire est porté par le `useForm` de `Create.tsx` (passé en props : `data`, `setData`, `errors`, plus la liste des champs requis). Garder le composant agnostique du mode create/edit (pas de logique de soumission dedans — la page parente gère `post`/`put`).

### Hiérarchie boutons (UX-DR16)

- "Enregistrer brouillon" = **primaire** (`bg-green-700 text-white`) tant que non publiable.
- "Publier" = présent mais **désactivé** (`disabled`, opacité 40%, `cursor-not-allowed`) en 4.3. En 4.6, quand `CompletionIndicator` vert, "Publier" devient primaire et "Enregistrer brouillon" passe secondaire (règle : jamais deux primaires).
- "Annuler" = secondaire/lien vers `/admin/productions`.
- Bouton primaire en loading pendant `processing` (anti double-submit).

### Clés i18n à ajouter (sous `productions.*`)

FR (extrait) :
```json
"create_title": "Créer une production",
"draft_saved": "Brouillon enregistré.",
"form": {
  "sections": { "general": "Informations générales", "content": "Contenu", "rights": "Droits & Licence", "optional": "Informations complémentaires", "files": "Fichiers & Liens" },
  "fields": {
    "title": "Titre", "authors": "Auteur(s)", "authors_hint": "Séparez par des virgules",
    "category": "Catégorie", "domain": "Domaine", "subdomain": "Sous-domaine",
    "language": "Langue", "country": "Pays de publication", "summary": "Résumé",
    "tags": "Tags", "tags_hint": "Séparez par des virgules", "work_published_at": "Date de publication de l'œuvre",
    "license": "Statut de licence", "journal": "Journal / Revue", "publisher": "Éditeur",
    "isbn": "ISBN / DOI / ISSN", "institution": "Institution d'affiliation"
  },
  "license": { "member": "Production membre", "free_license": "Licence libre", "external_link": "Lien externe (copyright)" },
  "errors": { "title_required": "Le titre est requis." },
  "save_draft": "Enregistrer brouillon",
  "publish": "Publier"
},
"completion": {
  "summary": "{{filled}}/{{total}} champs — {{missing}} requis pour publier",
  "complete": "Tous les champs requis sont remplis",
  "missing_label": "Champs manquants :"
}
```
EN : équivalents (Create a production / Draft saved. / General information / Content / Rights & Licence / Additional information / Files & Links / Title / Author(s) / Separate with commas / ... / Member production / Free licence / External link (copyright) / Title is required. / Save draft / Publish / "{{filled}}/{{total}} fields — {{missing}} required to publish" / All required fields are filled / Missing fields:).

> Interpolation i18next : `t('productions.completion.summary', { filled, total, missing })`.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/validators/admin/production_validator.ts` | `draftProductionValidator` (title requis, reste optionnel) |
| `inertia/components/admin/CompletionIndicator.tsx` | Indicateur de complétion sticky (UX-DR6) |
| `inertia/components/admin/ProductionForm.tsx` | Formulaire de production réutilisable (create + edit) |
| `inertia/pages/admin/Productions/Create.tsx` | Page de création (useForm + actions) |
| `tests/functional/admin/productions_create.spec.ts` | Tests fonctionnels |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `app/controllers/admin/productions_controller.ts` | Ajouter `create()` et `store()` |
| `start/routes.ts` | Ajouter `GET /admin/productions/create` + `POST /admin/productions` (groupe admin) |
| `.adonisjs/server/pages.d.ts` | Enregistrer la page `admin/Productions/Create` |
| `inertia/locales/admin/fr.json` | Ajouter `productions.create_title`, `draft_saved`, `form.*`, `completion.*` |
| `inertia/locales/admin/en.json` | Mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** rendre les champs obligatoires-pour-publier requis à l'enregistrement brouillon — seul `title` (DB) est requis (FR20)
- **NE PAS** oublier le défaut `licenseStatus = 'member'` en brouillon (colonne NOT NULL sans défaut)
- **NE PAS** passer `authors`/`tags` undefined à `Production.create` — toujours un array (le `prepare` JSON.stringify casse sinon)
- **NE PAS** installer react-hook-form / zod — utiliser Inertia `useForm` (pattern projet, cf. Story 3.3)
- **NE PAS** valider onBlur de façon bloquante — l'erreur inline est indicative ; l'enregistrement brouillon reste possible
- **NE PAS** implémenter upload/liens/publication ici (4.4/4.5/4.6)
- **NE PAS** utiliser de strings de statut/licence en dur — enums `ProductionStatus` / `LicenseStatus`
- **NE PAS** wrapper les props Inertia dans `{ data: ... }`
- **NE PAS** importer `Link` depuis `@inertiajs/react` — `@adonisjs/inertia/react`

### Tests — patterns à suivre

- Transaction rollback ; helper `createAdminUser`.
- POST brouillon : `.post('/admin/productions').form({ title: '...' }).loginAs(admin).withCsrfToken().redirects(0)` → 302 + vérifier `Production.findBy('title', ...)` avec `status='draft'`, `licenseStatus='member'`, `createdById`.
- Arrays : envoyer `authors[]`/`tags[]` via `.form({ authors: ['A','B'], tags: ['x'] })` (api-client sérialise) ; vérifier l'array reconstitué.
- Validation : POST sans title → 302 (redirect back), `Production.query().count()` inchangé.
- Log : vérifier `AdminActivityLog` `actionType='create'`, `resourceType='production'`.
- Un seul POST par test (gotcha `sessionApiClient`).
- Page render testée via lecture de la page Inertia (composant `admin/Productions/Create`) — le rendu fin du form n'est pas testable sans suite browser.

### Sécurité

- Routes sous `AdminMiddleware` (auth + isActive + rôle + sessionVersion). Admin et super_admin peuvent créer.
- Validation serveur VineJS (titre requis, licence ∈ enum). Le statut est forcé à `draft` côté serveur — l'admin ne peut pas créer directement en `published` via ce endpoint (la publication = Story 4.6, avec revalidation).
- `createdById` issu de `auth.user!.id` (jamais du payload — pas de mass-assignment du créateur).

### Dépendances cross-story

- **Story 4.1** (toasts) : `notify` / flash success → toast "Brouillon enregistré.".
- **Story 4.2** (liste) : le bouton "Créer une production" (déjà rendu) pointera vers cette page ; après save, redirect vers la liste.
- **Story 4.4 / 4.5** : ajouteront `FileUploader` / `LinkManager` dans `ProductionForm` (section réservée) et alimenteront `hasFileOrLink`.
- **Story 4.6** : endpoint publish + activation du bouton "Publier" + revalidation complétude serveur.
- **Story 4.7** : `Edit.tsx` réutilisera `ProductionForm`.
- **Story 1.2** : modèle `Production`, enums, migration en place.

### Previous Story Intelligence

**Story 3.3 (Users/Create) — modèle direct :**
- Inertia `useForm({ ... })` + validation onBlur manuelle (regex/checks) + affichage erreurs via `errors`.
- Validateur VineJS avec `SimpleMessagesProvider` mappant vers des clés i18n.
- `Link` depuis `@adonisjs/inertia/react`.
- Page à enregistrer manuellement dans `.adonisjs/server/pages.d.ts`.

**Story 4.2 (liste) :**
- `ProductionsController` créé (méthode `index`), enregistré dans `.adonisjs/server/controllers.ts`. Ajouter `create`/`store` au même contrôleur.
- Enum `ProductionStatus` : import combiné valeur + type si besoin de caster (TS2749).
- `Select` shadcn = Radix (`value`/`onValueChange`).

**Revue Epic 3 :**
- Durcir `DateTime.toISO()` → `?.toISO() ?? null`.
- Prettier : multi-lignes sur longues chaînes ; lancer `npx prettier --write` au besoin.

### Project Structure Notes

- `app/validators/admin/production_validator.ts`, `inertia/components/admin/ProductionForm.tsx`, `inertia/components/admin/CompletionIndicator.tsx`, `inertia/pages/admin/Productions/Create.tsx` → tous prévus/alignés dans l'arborescence architecture.
- Tests dans `tests/functional/admin/`.

### References

- [Source: epics.md#Story 4.3] — Acceptance criteria
- [Source: epics.md#FR17] — Liste complète des métadonnées
- [Source: epics.md#FR21] — Champs obligatoires pour publier + fichier/lien
- [Source: epics.md#FR20] — Enregistrement brouillon sans tous les champs
- [Source: epics.md#FR35] — Dates système automatiques
- [Source: ux-design-specification.md:774-776] — `CompletionIndicator` (sticky, temps réel, états)
- [Source: ux-design-specification.md:806-817] — Hiérarchie et états des boutons (UX-DR16)
- [Source: ux-design-specification.md:834-836] — Validation onBlur (UX-DR17)
- [Source: ux-design-specification.md:842-874] — Structure visuelle du formulaire + champs conditionnels
- [Source: architecture.md#Validation — Double Couche] — VineJS serveur (Zod client non installé → useForm)
- [Source: architecture.md#Patterns de Communication] — Enums source unique, ActivityLogService
- [Source: database/migrations/1775918733547_create_productions_table.ts] — Contraintes (title/license NOT NULL, jsonb defaults, trigger tsvector)
- [Source: app/models/production.ts] — Champs, prepare/consume authors/tags, relations
- [Source: app/enums/production_status.ts] — `ProductionStatus`
- [Source: app/enums/license_status.ts] — `LicenseStatus`
- [Source: app/controllers/admin/productions_controller.ts] — Contrôleur (méthode `index` existante)
- [Source: inertia/pages/admin/Users/Create.tsx] — Pattern useForm + onBlur
- [Source: _bmad-output/implementation-artifacts/4-2-liste-des-productions.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/3-3-creation-dun-compte-admin.md] — Pattern formulaire/validateur

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- `workPublishedAt` : validateur en `vine.string().optional()` (le champ HTML `type="date"` renvoie `YYYY-MM-DD`) ; conversion en `DateTime.fromISO(value)` à l'insertion, sinon `null`.
- Inertia `useForm<ProductionFormData>().setData` est assignable au type `Setter` de `ProductionForm` sans cast — typecheck OK.
- `authors`/`tags` : la page envoie des arrays ; le test « champs complets » confirme que le bodyparser AdonisJS reconstitue bien les arrays depuis le form-encoding `.form({ authors: [...] })`, et que le `prepare: JSON.stringify` / `consume: JSON.parse` du modèle round-trip correctement.
- Aucun email envoyé par cette story (les EmailTransportException dans les logs de test viennent des suites users/auth).

### Completion Notes List

- **AC1 satisfait** : formulaire en sections (fieldsets), sous-domaine conditionnel (rendu si `domain` non vide).
- **AC2 satisfait** : `CompletionIndicator` sticky, temps réel (recalcul à chaque `onChange` via `getRequiredFieldStatuses(data)`), champs manquants cliquables (focus par id), `aria-live="polite"`, états orange/vert.
- **AC3 satisfait** : validation onBlur non bloquante — message `text-red-600 text-sm` + `aria-describedby` sur les champs requis-pour-publier vides après blur ; erreur serveur (title) prioritaire.
- **AC4 satisfait** : brouillon créé `status=draft` avec champs partiels, `createdById`, `licenseStatus` défaut `member`, timestamps auto, toast `draft_saved`, log `create/production`.
- **AC5 satisfait** : "Enregistrer brouillon" primaire (vert) ; "Publier" désactivé (`!isComplete`). `isComplete` requiert tous les champs + `hasFileOrLink` (false en 4.3) → Publier reste désactivé jusqu'à 4.4-4.6 (attendu).
- `ProductionForm` + `getRequiredFieldStatuses` conçus pour réutilisation par `Edit.tsx` (Story 4.7).
- Tests : 200/200. Lint + typecheck verts.

### File List

**Créés :**
- `app/validators/admin/production_validator.ts` — `draftProductionValidator`
- `inertia/components/admin/CompletionIndicator.tsx` — indicateur de complétion sticky (UX-DR6)
- `inertia/components/admin/ProductionForm.tsx` — formulaire réutilisable + helper `getRequiredFieldStatuses`
- `inertia/pages/admin/Productions/Create.tsx` — page de création (useForm + actions)
- `tests/functional/admin/productions_create.spec.ts` — 6 tests fonctionnels

**Modifiés :**
- `app/controllers/admin/productions_controller.ts` — ajout `create()` et `store()`
- `start/routes.ts` — routes create + store
- `.adonisjs/server/pages.d.ts` — enregistrement page `admin/Productions/Create`
- `inertia/locales/admin/fr.json` — clés `productions.create_title/draft_saved/form.*/completion.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 4.3 (Formulaire de création de production). Validateur brouillon, `create`/`store` (draft + log), composants `CompletionIndicator` (UX-DR6) et `ProductionForm` réutilisable (15 champs, sections, sous-domaine conditionnel, onBlur UX-DR17), page Create avec useForm + hiérarchie boutons UX-DR16, i18n FR/EN. 6 tests fonctionnels. Tests totaux : 200/200.

## Review Findings

- [x] [Review][Patch] `workPublishedAt` non validé comme date — RÉSOLU : validateur `regex(/^\d{4}-\d{2}-\d{2}$/)` + helper `parseWorkDate` (garde `.isValid`, null sinon) dans store/update. [app/validators/admin/production_validator.ts, app/controllers/admin/productions_controller.ts]
- [x] [Review][Patch] `CompletionIndicator` dénominateur incohérent — RÉSOLU : le critère fichier/lien est compté dans `total` (= `fields.length + 1`) ET dans `filledCount` ; `missingForPublish = total - filledCount`. Affichage « {filled}/{total} — {missing} requis » cohérent. [inertia/components/admin/CompletionIndicator.tsx]
- [x] [Review][Patch] Chip « Sous-domaine » focalise un input non rendu — RÉSOLU : fallback `(el ?? document.getElementById('domain'))?.focus()`. [inertia/components/admin/CompletionIndicator.tsx]
