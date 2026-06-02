# Story 4.2 : Liste des productions (panel admin)

Status: done

## Story

En tant qu'administrateur,
Je veux consulter la liste de toutes les productions avec leur statut et accéder aux actions disponibles,
Afin de gérer le catalogue de la bibliothèque efficacement.

## Acceptance Criteria

**AC1 — Liste paginée avec métadonnées clés**

- **Given** un admin est connecté et accède à `/admin/productions`
- **When** la page se charge
- **Then** la liste paginée des productions est affichée avec : titre, auteur(s), catégorie, statut (badge Brouillon/Publié/Dépublié), date de dernière modification
- **And** des boutons d'action sont disponibles pour chaque production : "Modifier", "Supprimer" (et "Dépublier" si publiée)

**AC2 — Filtre par statut**

- **Given** des productions existent
- **When** l'admin filtre par statut (Brouillon / Publié / Dépublié)
- **Then** seules les productions du statut sélectionné sont affichées
- **And** le filtre actif est reflété dans l'URL (`?status=draft|published|unpublished`)

**AC3 — État vide**

- **Given** aucune production n'existe encore
- **When** la page se charge
- **Then** un état vide s'affiche : "Aucune production. Commencez par en créer une." avec un bouton "Créer une production" (UX-DR19)

**AC4 — Pagination numérotée**

- **Given** la liste contient plus de 20 productions
- **When** la page se charge
- **Then** une pagination numérotée est affichée et le paramètre de page est reflété dans l'URL (`?page=N`)
- **And** le filtre de statut éventuel est préservé lors du changement de page

## Tasks / Subtasks

- [x] **Tâche 1 — Créer le `ProductionsController` admin (backend)** (AC1, AC2, AC4)
  - [x] 1.1–1.6 `productions_controller.ts` : `index()` lit `page`/`status`, valide `status` contre l'enum, `orderBy('updatedAt','desc')`, `.paginate(page, 20)`, sérialise 6 champs (`updatedAt` durci `?.toISO() ?? null`), props directes `{ productions, pagination, currentStatus }`

- [x] **Tâche 2 — Mettre à jour le routage** (AC1)
  - [x] 2.1 `GET /admin/productions` → `[controllers.admin.Productions, 'index']` (nom `admin.productions`, sous `middleware.admin()`)
  - [x] 2.2 Méthode `productions()` supprimée du `DashboardController` (`stats()` conservé)
  - [x] 2.3 Import `Productions` ajouté dans `.adonisjs/server/controllers.ts`

- [x] **Tâche 3 — Créer le composant `StatusBadge`** (AC1)
  - [x] 3.1–3.3 `inertia/components/admin/StatusBadge.tsx` : map statut → variante + clé i18n `productions.status.*`, libellés via `t()`

- [x] **Tâche 4 — Créer le composant partagé `Pagination`** (AC4)
  - [x] 4.1–4.5 `inertia/components/shared/Pagination.tsx` : props `{ currentPage, lastPage, queryParams }`, liens `<Link>` préservant les params, Précédent/Suivant désactivés aux bornes, rien si `lastPage <= 1`, `<nav aria-label>` + `aria-current="page"`

- [x] **Tâche 5 — Implémenter la page React `Productions/Index.tsx`** (AC1, AC2, AC3, AC4)
  - [x] 5.1–5.8 Header + bouton créer, filtre `Select` (navigation via `router.get`), état vide UX-DR19 (icône `Library`), tableau (titre/auteurs/catégorie/statut/modifié/actions), actions (Modifier=Link, Dépublier si publié=disabled, Supprimer=disabled), `<Pagination>`, tout via `t()`

- [x] **Tâche 6 — Ajouter les clés i18n** (AC1, AC2, AC3)
  - [x] 6.1 `productions.*` + `pagination.*` ajoutés en FR et EN
  - [x] 6.2 Parité FR/EN respectée (`translations.spec.ts` passe)

- [x] **Tâche 7 — Tests fonctionnels** (AC1, AC2, AC3, AC4)
  - [x] 7.1–7.8 `productions_list.spec.ts` : 9 tests (accès admin/super_admin/non-auth, champs, filtre published, status invalide ignoré, vide, pagination 21→2 pages + page 2)

- [x] **Tâche 8 — Validation finale**
  - [x] 8.1 `node ace test` → 194 tests passent (185 + 9)
  - [x] 8.2 `npm run lint` → 0 erreur
  - [x] 8.3 `npm run typecheck` → 0 erreur

## Dev Notes

### Architecture cible

La page liste est une page Inertia classique : `ProductionsController.index` requête + pagine les productions et passe les props à la page React. Elle remplace le stub `DashboardController.productions()` (même mécanique que Story 3.2 qui a remplacé `DashboardController.users()` par `UsersController.index`).

Deux composants réutilisables sont introduits ici car ils serviront aussi à l'Epic 5 (listing public) et 4.7 (edit) :
- `inertia/components/shared/Pagination.tsx` (UX-DR12) — pagination numérotée avec params URL
- `inertia/components/admin/StatusBadge.tsx` — badge de statut production

### Code existant à réutiliser

- **Route** : `GET /admin/productions` existe dans `start/routes.ts` (sous `middleware.admin()`, nom `admin.productions`), pointe sur le stub `Dashboard.productions`. Seul le handler change.
- **`DashboardController`** (`app/controllers/admin/dashboard_controller.ts`) : méthode `productions()` stub à supprimer ; `stats()` conservé (Epic 7).
- **Page stub** : `inertia/pages/admin/Productions/Index.tsx` existe (placeholder), déjà enregistrée dans `.adonisjs/server/pages.d.ts`. À remplacer.
- **Modèle `Production`** (`app/models/production.ts`) : champs `id`, `title`, `summary`, `authors` (string[] jsonb), `tags` (string[] jsonb), `category`, `domain`, `subdomain`, `language`, `publicationCountry`, `journal`, `publisher`, `isbnDoiIssn`, `institution`, `licenseStatus`, `status`, `workPublishedAt`, `antaPublishedAt`, `createdById`, `createdAt`, `updatedAt`. Relations `createdBy`, `files`, `links`.
- **Enum `ProductionStatus`** (`app/enums/production_status.ts`) : `draft | published | unpublished`. Utiliser pour valider le filtre et typer le badge — jamais de strings en dur.
- **Composants UI** : `Badge`, `Button`, `Select` (shadcn) disponibles dans `inertia/components/ui/`.
- **`Link`** : depuis `@adonisjs/inertia/react` (règle ESLint `@adonisjs/prefer-adonisjs-inertia-link`).
- **`router`** : depuis `@inertiajs/react` pour la navigation programmatique (changement de filtre).
- **Pattern liste admin** : `inertia/pages/admin/Users/Index.tsx` (tableau, état vide UX-DR19, badges, `formatDate`) est le modèle direct à suivre.
- **Pattern contrôleur liste** : `UsersController.index` (sérialisation explicite via `.map()`, props directes).

### Pagination Lucid — pattern cible

```ts
async index({ request, inertia }: HttpContext) {
  const page = request.input('page', 1)
  const statusInput = request.input('status')
  const status = Object.values(ProductionStatus).includes(statusInput) ? statusInput : null

  const query = Production.query().orderBy('updatedAt', 'desc')
  if (status) query.where('status', status)

  const paginator = await query.paginate(page, 20)
  const meta = paginator.getMeta() // { total, perPage, currentPage, lastPage, ... }

  return inertia.render('admin/Productions/Index', {
    productions: paginator.all().map((p) => ({
      id: p.id,
      title: p.title,
      authors: p.authors ?? [],
      category: p.category,
      status: p.status,
      updatedAt: p.updatedAt?.toISO() ?? null,
    })),
    pagination: {
      currentPage: meta.currentPage,
      lastPage: meta.lastPage,
      total: meta.total,
      perPage: meta.perPage,
    },
    currentStatus: status,
  })
}
```

> Note `updatedAt` : durci en `?.toISO() ?? null` (cf. finding review Story 3.2 — éviter le non-null assertion fragile).

### Pagination component — contrat cible

```tsx
type PaginationProps = {
  currentPage: number
  lastPage: number
  queryParams?: Record<string, string | undefined>
}
```
Construit les hrefs `?page=N` en fusionnant `queryParams` (valeurs `undefined` omises). Utilise `<Link>` Inertia (navigation SPA, préserve le scroll si souhaité). `aria-current="page"` sur la page active, `<nav aria-label={t('pagination.label')}>`.

### Boutons d'action — état dans cette story

Les **actions destructrices** (Modifier/Dépublier/Supprimer) sont fonctionnellement câblées plus tard :
- "Modifier" → Link vers `/admin/productions/:id/edit` (route ajoutée en **Story 4.7**)
- "Dépublier" / "Supprimer" → rendus comme **boutons désactivés** ici ; les handlers + modaux de confirmation (UX-DR14) arrivent en **Story 4.7**
- "Créer une production" → Link vers `/admin/productions/create` (route ajoutée en **Story 4.3**)

C'est le même pattern de livraison séquentielle que Story 3.2 (boutons rendus, activés par les stories suivantes). Les liens create/edit pointeront vers des routes existantes une fois 4.3/4.7 livrées.

### Clés i18n à ajouter

**FR (`inertia/locales/admin/fr.json`)** — nouvel objet `productions` + `pagination` :
```json
"productions": {
  "title": "Productions",
  "create_button": "Créer une production",
  "empty_title": "Aucune production",
  "empty_description": "Commencez par en créer une.",
  "filter": {
    "label": "Filtrer par statut",
    "all": "Tous les statuts"
  },
  "table": {
    "title": "Titre",
    "authors": "Auteur(s)",
    "category": "Catégorie",
    "status": "Statut",
    "updated_at": "Modifié le",
    "actions": "Actions"
  },
  "status": {
    "draft": "Brouillon",
    "published": "Publié",
    "unpublished": "Dépublié"
  },
  "actions": {
    "edit": "Modifier",
    "unpublish": "Dépublier",
    "delete": "Supprimer"
  }
},
"pagination": {
  "label": "Pagination",
  "previous": "Précédent",
  "next": "Suivant"
}
```

**EN** — mêmes clés : Productions / Create a production / No productions / Start by creating one. / Filter by status / All statuses / Title / Author(s) / Category / Status / Updated / Actions / Draft / Published / Unpublished / Edit / Unpublish / Delete / Pagination / Previous / Next.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/controllers/admin/productions_controller.ts` | Contrôleur avec `index()` (pagination + filtre statut) |
| `inertia/components/shared/Pagination.tsx` | Pagination numérotée réutilisable (UX-DR12) |
| `inertia/components/admin/StatusBadge.tsx` | Badge de statut production |
| `tests/functional/admin/productions_list.spec.ts` | Tests fonctionnels |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `start/routes.ts` | Handler `/admin/productions` → `Productions.index` |
| `app/controllers/admin/dashboard_controller.ts` | Supprimer `productions()` (garder `stats()`) |
| `inertia/pages/admin/Productions/Index.tsx` | Remplacer le stub par la vraie page |
| `inertia/locales/admin/fr.json` | Ajouter `productions.*` + `pagination.*` |
| `inertia/locales/admin/en.json` | Mêmes clés traduites |
| `.adonisjs/server/controllers.ts` | Import `Productions` si non auto-détecté |

### Anti-patterns à éviter

- **NE PAS** paginer côté client — `paginate(page, 20)` côté serveur, reflété dans l'URL
- **NE PAS** utiliser de strings de statut en dur — passer par l'enum `ProductionStatus`
- **NE PAS** wrapper les props Inertia dans `{ data: ... }` — props directes
- **NE PAS** implémenter les actions destructrices (dépublier/supprimer) ici — Story 4.7 (rendre désactivées)
- **NE PAS** créer une route `:slug` admin — l'admin utilise `:id` (le slug public est Epic 5/6)
- **NE PAS** exposer de champs inutiles dans les props — sérialiser explicitement les 6 champs nécessaires
- **NE PAS** importer `Link` depuis `@inertiajs/react` — utiliser `@adonisjs/inertia/react`
- **NE PAS** réutiliser un composant Pagination tiers — créer le composant partagé du projet (UX-DR12)

### Tests — patterns à suivre

- **Transaction rollback** : `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()`
- **Fixtures** : helper `createProduction({ status, title, authors, ... })` — champs obligatoires du modèle : `title`, `status`, `authors: []`, `tags: []`, `licenseStatus: 'member'` (cf. test Story 3.7 `users_delete.spec.ts`). `createdById` nullable.
- **Auth** : `.loginAs(admin)` (rôle `admin` suffit — route sous `middleware.admin()`, pas superAdmin)
- **Props Inertia** : extraire via `data-page` (pattern `users_list.spec.ts`) pour vérifier `props.productions` / `props.pagination`
- **Pagination** : créer 21 productions, vérifier `props.productions.length === 20` et `props.pagination.lastPage === 2`
- Un seul GET par test (gotcha `sessionApiClient`)

### Sécurité

- Route sous `AdminMiddleware` (auth + isActive + rôle admin/super_admin + redirect change-password). Les deux rôles peuvent gérer les productions (cf. matrice de rôles architecture).
- Aucune donnée sensible exposée (métadonnées publiques de production).
- Filtre `status` validé contre l'enum côté serveur (pas d'injection via query param).

### Dépendances cross-story

- **Story 4.1** (toasts) : terminée — `notify.*` disponible si besoin (pas requis ici, page read-only).
- **Story 4.3** (création) : activera le lien "Créer une production".
- **Story 4.7** (edit/dépublier/supprimer) : activera les actions de la colonne Actions + ajoutera la route edit.
- **Story 5.4** (listing public) : réutilisera `Pagination.tsx`.
- **Story 1.2** : modèle `Production` + enum `ProductionStatus` déjà en place.

### Previous Story Intelligence

**Story 3.2 (liste admins) — modèle direct :**
- Remplacement d'un stub `DashboardController` par un contrôleur dédié + mise à jour du handler de route.
- Sérialisation explicite des props via `.map()`.
- État vide UX-DR19 : icône `text-stone-300`, texte i18n, bouton d'action.
- Le registre `.adonisjs/server/controllers.ts` peut nécessiter un ajout manuel de l'import du nouveau contrôleur.

**Revue Epic 3 :**
- Durcir les `DateTime.toISO()` en `?.toISO() ?? null` (pas de non-null assertion).
- `Link` depuis `@adonisjs/inertia/react` ; `router` depuis `@inertiajs/react`.
- Prettier exige le multi-lignes sur les longues chaînes d'appels/args.

### Project Structure Notes

- `app/controllers/admin/productions_controller.ts` → prévu dans l'architecture.
- `inertia/components/shared/Pagination.tsx` et `inertia/components/admin/StatusBadge.tsx` → tous deux listés dans l'arborescence architecture.
- Tests dans `tests/functional/admin/` → aligné.

### References

- [Source: epics.md#Story 4.2] — Acceptance criteria
- [Source: epics.md#UX-DR12] — Pagination numérotée avec params URL
- [Source: epics.md#UX-DR19] — États vides (ton factuel, icône picto, bouton d'action)
- [Source: architecture.md#Composants React] — `admin/StatusBadge.tsx`, `shared/Pagination.tsx`, `admin/Productions/Index.tsx`
- [Source: architecture.md#Patterns de Communication] — Enum `ProductionStatus` source unique
- [Source: architecture.md#Formats d'Échange] — Props Inertia directes (pas de wrapper)
- [Source: app/controllers/admin/dashboard_controller.ts] — Stub `productions()` à remplacer
- [Source: start/routes.ts] — Route `admin.productions` sous `middleware.admin()`
- [Source: app/models/production.ts] — Modèle et champs
- [Source: app/enums/production_status.ts] — Enum statut
- [Source: inertia/pages/admin/Users/Index.tsx] — Pattern liste (tableau, état vide, badges)
- [Source: tests/functional/admin/users_list.spec.ts] — Pattern test liste + extraction props via data-page
- [Source: _bmad-output/implementation-artifacts/3-2-page-de-liste-des-administrateurs.md] — Intelligence remplacement stub
- [Source: _bmad-output/implementation-artifacts/4-1-systeme-de-toasts.md] — Helper notify disponible

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- L'enum `production_status.ts` exporte la valeur (default) ET le type (named). Pour caster le filtre validé en union de statuts, import combiné : `import ProductionStatus, { type ProductionStatus as ProductionStatusType } from '#enums/production_status'` (sinon TS2749 — valeur utilisée comme type). Sans ce cast, `currentStatus: string | null` ne correspondait pas au prop `ProductionStatus | null` de la page (inférence Inertia).
- `paginator.getMeta()` fournit `{ currentPage, lastPage, total, perPage }` ; `paginator.all()` les lignes. Sérialisation explicite des 6 champs nécessaires.

### Completion Notes List

- **AC1 satisfait** : liste paginée (titre, auteurs, catégorie, `<StatusBadge>`, date modif) + boutons d'action (Modifier=Link vers edit, Dépublier si publié, Supprimer).
- **AC2 satisfait** : filtre `Select` → `?status=` validé serveur contre l'enum (valeur invalide ignorée), reflété dans l'URL et dans `currentStatus`.
- **AC3 satisfait** : état vide UX-DR19 (icône `Library` stone-300, texte i18n, bouton Créer).
- **AC4 satisfait** : `paginate(page, 20)`, composant `Pagination` partagé avec `?page=N` + préservation du filtre `status` via `queryParams`.
- **Livraison séquentielle** : "Créer"/"Modifier" sont des Links vers les routes des Stories 4.3/4.7 ; "Dépublier"/"Supprimer" rendus désactivés (modaux + handlers en 4.7).
- 2 composants réutilisables créés (`Pagination`, `StatusBadge`) — disponibles pour Epic 5/6.
- Tests : 194/194. Lint + typecheck verts.

### File List

**Créés :**
- `app/controllers/admin/productions_controller.ts` — `index()` (pagination + filtre statut)
- `inertia/components/shared/Pagination.tsx` — pagination numérotée réutilisable (UX-DR12)
- `inertia/components/admin/StatusBadge.tsx` — badge statut production
- `tests/functional/admin/productions_list.spec.ts` — 9 tests fonctionnels

**Modifiés :**
- `start/routes.ts` — handler `/admin/productions` → `Productions.index`
- `app/controllers/admin/dashboard_controller.ts` — suppression de `productions()` (garde `stats()`)
- `inertia/pages/admin/Productions/Index.tsx` — remplacement du stub par la page complète
- `inertia/locales/admin/fr.json` — ajout `productions.*` + `pagination.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites
- `.adonisjs/server/controllers.ts` — ajout import `Productions`

### Change Log

- 2026-06-01 : Implémentation Story 4.2 (Liste des productions, panel admin). `ProductionsController.index` (pagination 20/page + filtre statut), composants partagés `Pagination` (UX-DR12) et `StatusBadge`, page liste avec filtre Select + état vide UX-DR19, remplacement du stub Dashboard, i18n FR/EN. 9 tests fonctionnels. Tests totaux : 194/194.

## Review Findings

- [x] [Review][Patch] `index()` ne borne pas `page` → `?page=-1` 500 Postgres — RÉSOLU : `const page = Math.max(1, Number(...) || 1)`. [app/controllers/admin/productions_controller.ts:index]
- [x] [Review][Defer] `Pagination` rend tous les numéros de page (pas de fenêtrage) — `Array.from({ length: lastPage })` → nav non bornée pour un grand `lastPage`. Scalabilité/UX, non urgent (catalogue petit). Reporté (fenêtrage à ajouter quand le volume croît). [inertia/components/shared/Pagination.tsx] (source: blind)
