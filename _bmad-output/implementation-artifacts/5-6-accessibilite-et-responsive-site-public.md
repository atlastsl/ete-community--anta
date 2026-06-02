# Story 5.6 : Accessibilité et responsive site public

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que visiteur utilisant un lecteur d'écran, la navigation clavier ou un mobile,
Je veux accéder à tout le contenu sans friction,
Afin que la bibliothèque soit inclusive et utilisable quel que soit le contexte (UX-DR20, UX-DR21).

> **6ᵉ story de l'Epic 5 — passe de polish transversal a11y + responsive** sur les pages publiques livrées en 5.1→5.5. Touche `PublicLayout`, les composants publics (`SearchBar`, `FilterBar`, `FilterChip`, `ListingToggle`, `LanguageSwitcher`), les pages (`home`, `productions`, `privacy-policy`) et le CSS global (focus visible). **Pas de nouvelle fonctionnalité** — uniquement accessibilité, sémantique HTML, navigation clavier, cibles tactiles et responsive mobile.
>
> ⚠️ **Changement d'attributs sur `FilterChip`** : 5.2/5.3 utilisaient `aria-pressed` ; l'AC3 impose `role="checkbox"` + `aria-checked` + `aria-label="Filtrer par {label}"`. Le test `filter_chip.spec.ts` (5.3) sera mis à jour en conséquence.

## Acceptance Criteria

**AC1 — Skip link + structure sémantique + h1 unique**

- **Given** un utilisateur charge n'importe quelle page publique
- **When** le HTML est rendu
- **Then** un skip link "Aller au contenu principal" est le **premier élément focusable** (`sr-only`, visible au focus) et cible `#main-content`
- **And** la structure sémantique est présente : `<header>`, `<main id="main-content">`, `<nav>`, `<footer>`
- **And** **un seul `<h1>`** est présent par page (accueil, listing, politique de confidentialité)

**AC2 — Navigation clavier + focus visible**

- **Given** un utilisateur navigue au clavier
- **When** il parcourt la page
- **Then** tous les éléments interactifs sont atteignables dans un ordre logique (pas de `tabindex` positif, ordre DOM cohérent)
- **And** chaque élément focusé affiche un anneau de focus `ring-2 ring-green-700 ring-offset-2` (équivalent CSS global `:focus-visible`)

**AC3 — FilterChips en sémantique case à cocher**

- **Given** les FilterChips sont rendus (mode listing)
- **When** un chip est interactif
- **Then** `role="checkbox"`, `aria-checked={isActive}` et `aria-label="Filtrer par {label}"` (i18n `filters.filter_by`) sont présents
- **And** le chip reste activable au clavier (Entrée — navigation Inertia, et Espace coche/décoche)

**AC4 — Responsive mobile (< 768px) + cibles tactiles**

- **Given** un visiteur accède au site depuis un mobile (< 768px)
- **When** la page d'accueil se charge
- **Then** la `SearchBar` occupe toute la largeur disponible
- **And** les FilterChips défilent horizontalement avec **scroll-snap** (`overflow-x-auto`, `snap-x`, `snap-start`)
- **And** toutes les cibles tactiles mesurent **au minimum 44×44px** (chips, boutons du `ListingToggle`, boutons du `LanguageSwitcher`, bouton × de la SearchBar)

**AC5 — Conformité couleurs WCAG 2.1 AA**

- **Given** les couleurs sont utilisées dans l'interface
- **When** un audit **axe DevTools** est effectué (étape **manuelle** — voir Dev Notes : pas de runner axe automatisé installé)
- **Then** aucune violation WCAG 2.1 AA n'est détectée
- **And** toutes les couleurs respectent le ratio minimum WCAG 2.1 AA (4.5:1 pour le texte normal) — `green-700`/`stone-700+`/`amber-900` sur fonds clairs sont conformes ; **corriger** tout texte gris trop clair (ex. `text-stone-400/500` utilisé pour du **texte porteur d'information**, pas seulement décoratif)

**AC6 — Tests automatisés**

- **Given** la suite de tests est exécutée (`node ace test`)
- **When** les specs de cette story tournent
- **Then** au minimum :
  - `GET /` (HTML brut) : le skip link (`href="#main-content"`) est le **premier élément focusable** (avant le header) ; `<main id="main-content"` présent
  - Chaque page publique a **exactement un** `<h1>` (assertion sur le rendu / source des pages)
  - `FilterChip` (source) : `role="checkbox"`, `aria-checked`, `aria-label` via `filters.filter_by`
  - `app.css` (source) : règle `:focus-visible` avec l'anneau vert
  - Cibles tactiles (source) : classes ≥ 44px (`h-11`/`min-h-11`/`size-11`) sur chips, toggle, language switcher
  - `FilterBar` (source) : `snap-x` + `overflow-x-auto`
  - Parité i18n FR/EN (`translations.spec.ts` vert) avec les nouvelles clés

## Tasks / Subtasks

- [x] **Tâche 1 — Skip link + `<main id="main-content">` dans `PublicLayout`** (AC1)
  - [x] 1.1 Skip link `<a href="#main-content">` premier enfant, `sr-only focus:not-sr-only ...`, libellé `a11y.skip_to_content`.
  - [x] 1.2 `<main id="main-content" tabIndex={-1} ... outline-none>`.
  - [x] 1.3 Sémantique header/main/footer + `<nav>` (LanguageSwitcher) en place.

- [x] **Tâche 2 — Focus visible global** (AC2)
  - [x] 2.1 `app.css` `@layer base` : `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px }`.
  - [x] 2.2 Pas d'`outline:none` global ; l'input SearchBar garde son `focus:ring` vert.
  - [x] 2.3 Aucun `tabindex` positif ; ordre DOM logique.

- [x] **Tâche 3 — `FilterChip` en case à cocher accessible** (AC3)
  - [x] 3.1 `role="checkbox"` + `aria-checked={active}` + `aria-label={t('filters.filter_by', { label })}`.
  - [x] 3.2 `<Link>` conservé ; `onKeyDown` Espace → `router.visit(href)`.
  - [x] 3.3 `min-h-11` (44px) + `snap-start`.
  - [x] 3.4 `ListingToggle` reste en `aria-pressed` (toggles).

- [x] **Tâche 4 — `<h1>` unique par page** (AC1)
  - [x] 4.1/4.2 home & privacy : h1 déjà présents.
  - [x] 4.3 `productions.tsx` : `<h1 className="sr-only">{t('productions.heading')}</h1>` ajouté.

- [x] **Tâche 5 — Cibles tactiles ≥ 44px + responsive** (AC4)
  - [x] 5.1 `FilterChip` `min-h-11`.
  - [x] 5.2 `ListingToggle` `size-11`.
  - [x] 5.3 `LanguageSwitcher` `min-h-11 inline-flex items-center px-2`.
  - [x] 5.4 `SearchBar` × → `size-11` centré, input `pr-12 w-full`.
  - [x] 5.5 `FilterBar` homepage `snap-x overflow-x-auto` + chips `snap-start`.
  - [x] 5.6 Cibles publiques ≥ 44px.

- [x] **Tâche 6 — i18n** (AC1, AC3)
  - [x] 6.1 `a11y.skip_to_content`, `filters.filter_by`, `productions.heading` ajoutés FR/EN.
  - [x] 6.2 `translations.spec.ts` vert.

- [x] **Tâche 7 — Revue contraste WCAG** (AC5)
  - [x] 7.1 Texte informatif `text-stone-400` → `text-stone-600` (méta `ProductionCard`, libellé dimension `FilterBar`) ; × SearchBar `stone-400`→`stone-500`. `stone-500` informatif conservé (~4.7:1 ✓). Séparateur switcher `stone-300` (décoratif, `aria-hidden`) conservé.
  - [x] 7.2 États actifs (chip `bg-green-700 text-white`, liens `green-700`) inchangés (conformes).

- [x] **Tâche 8 — Tests** (AC6)
  - [x] 8.1 **Révision** : pas de test fonctionnel HTML pour skip link/`main`/h1 — ils sont **rendus client-side** (`ssr:false`), absents du shell serveur. Vérification par **source** à la place.
  - [x] 8.2 `filter_chip.spec.ts` mis à jour (role=checkbox / aria-checked / filters.filter_by / Espace / min-h-11).
  - [x] 8.3 `tests/unit/components/a11y_components.spec.ts` créé : PublicLayout (skip link avant header, `#main-content`, `tabIndex`), cibles 44px (toggle/switcher/searchbar), FilterBar snap-x, `app.css :focus-visible`, **un seul `<h1>`** par page (compte regex).
  - [x] 8.4 `:focus-visible` + `var(--color-primary)` asserté dans `a11y_components.spec.ts`.
  - [x] 8.5 Compte de `<h1>` = 1 vérifié pour home/productions/privacy.

- [x] **Tâche 9 — Validation finale**
  - [x] 9.1 `node ace test` → 325/325 verts.
  - [x] 9.2 `npm run lint` → 0 erreur.
  - [x] 9.3 `npm run typecheck` → 0 erreur.
  - [ ] 9.4 **Test manuel a11y (utilisateur)** : (a) axe DevTools `/`, `/productions`, `/privacy-policy` → 0 violation WCAG 2.1 AA ; (b) clavier seul (Tab) : skip link en premier, ordre logique, focus visible ; (c) mobile < 768px : SearchBar pleine largeur, chips scroll-snap, cibles ≥ 44px ; (d) lecteur d'écran : chips annoncés « case à cocher ».

## Dev Notes

### Architecture cible (synthèse)

- **Story de polish transversal** : aucune route/contrôleur/modèle nouveau. Modifications front (composants/pages/CSS) + i18n + tests. Le backend (5.2–5.5) n'est pas touché.
- **Focus visible global** : centraliser dans `app.css` (`:focus-visible`) plutôt que répéter des classes `focus:ring-...` sur chaque élément — plus maintenable et garantit l'AC2 partout (UX-DR20). L'AC mentionne les classes `ring-2 ring-green-700 ring-offset-2` ; un équivalent CSS global (outline/box-shadow vert, offset 2px) est conforme et plus robuste.
- **Skip link** : premier nœud focusable du DOM, `sr-only` puis visible au focus (`focus:not-sr-only`), cible `#main-content` (le `<main>` reçoit l'`id` + `tabindex={-1}`).
- **FilterChip checkbox** : l'AC impose la sémantique case à cocher sur un composant qui est techniquement un lien de navigation (URL-driven, multi-select). On applique `role="checkbox"` + `aria-checked` + `aria-label`, en gardant la navigation Inertia et en ajoutant la touche Espace. _Voir question 1 (tension UX-DR vs nature « lien »)._

### État existant à RESPECTER (5.1–5.5)

- `inertia/layouts/PublicLayout.tsx` — `<header>` sticky (logo + `<LanguageSwitcher>`), `<main className="flex-1 ...">{children}</main>` (**pas d'`id`**), `<footer>` (copyright + lien privacy), `<Toaster>`. **Ajouter** skip link + `id="main-content"`.
- `inertia/components/public/FilterChip.tsx` — actuellement `<Link aria-pressed={active}>`. **Changer** en `role="checkbox"` + `aria-checked` + `aria-label`.
- `inertia/components/public/FilterBar.tsx` — mode listing (chips groupés par dimension, `flex flex-wrap`) + mode homepage (`flex gap-2 overflow-x-auto`). **Ajouter** `snap-x` + `snap-start` (chips) ; garder le bouton "Effacer filtres".
- `inertia/components/public/ListingToggle.tsx` — boutons `h-9 w-9` (36px) `aria-pressed` (**garder** aria-pressed — ce sont des toggles). **Bumper** à `size-11`.
- `inertia/components/public/SearchBar.tsx` — `<form role="search" className="... w-full">`, input `h-12 w-full` (OK), bouton × petit (**bumper** zone tactile).
- `inertia/components/shared/LanguageSwitcher.tsx` — boutons FR/EN `<button>` + séparateur `|` (`text-stone-300` décoratif, OK). **Bumper** zone tactile ≥ 44px.
- `inertia/pages/{home,productions,privacy-policy}.tsx` — home/privacy ont déjà un `<h1>` ; **productions n'en a pas** → ajouter (sr-only).
- `inertia/css/app.css` — tokens couleurs (green-700 primaire, doc WCAG AAA pour amber-900), `h1,h2` Playfair, `.font-display`. **Ajouter** `:focus-visible`.
- `inertia/locales/public/{fr,en}.json` — déjà `filters.label`, `filters.dimensions.*`, `actions.clear_filters`, `language_switcher.*`, `nav.*`, `footer.*`. **Ajouter** `a11y.skip_to_content`, `filters.filter_by`, `productions.heading`.

### Pas de runner axe automatisé (AC5 = manuel)

- **`@axe-core/playwright` / `axe-core` ne sont PAS installés** (cf. `package.json`). Un audit WCAG automatisé nécessiterait une nouvelle dépendance (→ **approbation utilisateur**). L'AC5 parle explicitement d'« un audit **axe DevTools** » → **étape manuelle** (extension navigateur). Cette story garantit la conformité **par conception** (sémantique, focus, contraste des tokens documentés) et **teste les attributs** via assertions source/HTML ; l'audit axe final est une tâche manuelle (Tâche 9.4). _Voir question 3 si tu veux automatiser via une dépendance._
- `@japa/browser-client` (Playwright) est présent et configuré (`suite 'browser'`), mais **aucun test browser n'existe** dans ce projet. On reste sur le pattern établi : **assertions source Node-pur** (composants) + **assertions HTML fonctionnelles** (skip link/`main`).

### Conventions et patterns

- **i18n** : 100% via `t()`, parité FR/EN. `filters.filter_by` avec interpolation `{{label}}`.
- **a11y** : `sr-only`/`focus:not-sr-only` (utilitaires Tailwind), `role`/`aria-checked`/`aria-label`, un seul `<h1>` (puis `<h2>` sections, `<h3>` cartes), `<main id="main-content" tabindex={-1}>`.
- **Tailwind 44px** : `h-11`/`w-11`/`size-11` = 2.75rem = **44px**. `min-h-11` pour garantir le minimum.
- **scroll-snap** : `snap-x` (conteneur) + `snap-start` (items) + `overflow-x-auto`.
- **Tests** : Node-pur source (`readFileSync` + `assert.include`) pour les composants/CSS — cf. `notify.spec.ts`, `design_system.spec.ts`, `filter_chip.spec.ts`. Fonctionnel pour le HTML serveur (skip link/`main`).

### Anti-patterns à éviter

- ❌ `outline: none` sans anneau de remplacement (casse AC2).
- ❌ `tabindex` positif (casse l'ordre naturel).
- ❌ Garder `aria-pressed` sur `FilterChip` (l'AC3 veut `role="checkbox"`/`aria-checked`).
- ❌ Mettre `role="checkbox"` sur le `ListingToggle` (ce sont des toggles → `aria-pressed`).
- ❌ Plusieurs `<h1>` sur une page (cartes en `<h3>`, sections en `<h2>`).
- ❌ Cibles tactiles < 44px sur mobile (chips, toggle, switcher, ×).
- ❌ Ajouter une dépendance axe sans approbation (HALT).
- ❌ Texte porteur d'info en `text-stone-400` (< 4.5:1) — réserver le gris très clair au décoratif.
- ❌ Toucher au backend / aux routes / à la logique de recherche (hors périmètre).
- ❌ Texte en dur (skip link, aria-label) — via i18n.

### Sécurité / conformité

- Lecture seule, aucune donnée. RGPD/sécurité inchangés.
- Accessibilité = exigence produit (UX-DR20 WCAG 2.1 AA, UX-DR21 responsive mobile-first).

### Project Structure Notes

**Fichiers créés :**

- `tests/functional/public/a11y.spec.ts`
- `tests/unit/components/a11y_components.spec.ts`

**Fichiers modifiés :**

- `inertia/layouts/PublicLayout.tsx` — skip link + `<main id="main-content" tabindex={-1}>`
- `inertia/css/app.css` — `:focus-visible` (anneau vert)
- `inertia/components/public/FilterChip.tsx` — `role="checkbox"` + `aria-checked` + `aria-label` + Espace + 44px
- `inertia/components/public/FilterBar.tsx` — `snap-x`/`snap-start`/`overflow-x-auto`
- `inertia/components/public/ListingToggle.tsx` — boutons `size-11`
- `inertia/components/public/SearchBar.tsx` — bouton × ≥ 44px
- `inertia/components/shared/LanguageSwitcher.tsx` — zones tactiles ≥ 44px
- `inertia/pages/productions.tsx` — `<h1 sr-only>`
- `inertia/locales/public/fr.json` / `en.json` — `a11y.skip_to_content`, `filters.filter_by`, `productions.heading`
- `tests/unit/components/filter_chip.spec.ts` — MAJ (aria-pressed → role=checkbox/aria-checked)
- (éventuellement) corrections ponctuelles `text-stone-400→600` sur du texte informatif

**Pas de migration, pas de backend, pas de modèle.**

### Previous Story Intelligence (5.1–5.5)

- **5.1** : `PublicLayout` (header/footer/LanguageSwitcher) — base du skip link + `main`. Tests Node-pur source.
- **5.2** : `SearchBar` (`role="search"`, `w-full`), `ProductionCard` (titres `<h3>`), `FilterChip`/`FilterBar` (homepage). `font-display` ajouté.
- **5.3** : `FilterChip` `aria-pressed` + `FilterBar` listing multi-dimension (toggle URL). **`filter_chip.spec.ts` asserte `aria-pressed`** → à mettre à jour.
- **5.4** : `ListingToggle` (`aria-pressed`, `h-9 w-9` → à bumper), variante `list` de `ProductionCard`, `Pagination` (`aria-current="page"` déjà a11y).
- **5.5** : `<html lang>` dynamique (a11y langue), edge SEO. Le test `design_system.spec.ts` a été ajusté (lang dynamique) — attention en le retouchant pour `:focus-visible`.
- **Pattern test composant** : `readFileSync(source)` + `assert.include`. Frontière TS `inertia/` (TS6305) → pas d'import direct des composants/CSS dans les tests serveur ; on lit la **source**.
- **Flaky connu** : `production.spec.ts` GIN — isolé.

### Latest Tech Information

- **Tailwind v4** : utilitaires `sr-only`/`not-sr-only`, `snap-x`/`snap-start`, `size-11` (44px), `focus:` variants. `:focus-visible` global via `@layer base`.
- **WCAG 2.1 AA** : contraste texte normal ≥ 4.5:1 ; cibles tactiles (2.5.5/2.5.8) ≥ 44×44px (AAA strict 44, AA « target size minimum » 24 — l'AC exige 44).
- **ARIA checkbox** : `role="checkbox"` + `aria-checked` ; clavier Espace pour basculer (Entrée navigue sur un lien). Annoncé « case à cocher » par les lecteurs d'écran.
- **axe DevTools** : extension navigateur (manuel). Alternative automatisée : `@axe-core/playwright` (non installé).

### Questions / clarifications (pour l'utilisateur)

1. **FilterChip `role="checkbox"`** : la spec UX-DR le demande, mais nos chips sont des **liens de navigation** (URL = source de vérité). Mettre `role="checkbox"` sur un `<a>` est valide ARIA mais peut dérouter (un lecteur d'écran annonce « case à cocher » alors que l'action navigue). On applique la spec (checkbox + Espace). Confirmes-tu, ou préfères-tu conserver `aria-pressed` (sémantique « bouton bascule », souvent plus juste pour un filtre-lien) ?
2. **Cibles 44px sur desktop** : appliquer 44px **partout** (simple, cohérent) ou uniquement < 768px (chips/toggle plus compacts sur desktop) ? *Reco : 44px partout (plus simple, accessible).* 
3. **Audit WCAG automatisé** : ajouter `@axe-core/playwright` (+ un test browser axe sur les pages publiques) — **nouvelle dépendance** ? Sinon l'audit axe reste **manuel** (DevTools). *Reco : manuel pour le MVP, automatiser plus tard.*

### References

- [Source: epics.md#Story 5.6] — Acceptance Criteria d'origine (UX-DR20, UX-DR21)
- [Source: ux-design-specification.md#Accessibilité] — `aria-current`, skip link, HTML sémantique, focus
- [Source: ux-design-specification.md#FilterChip] — `aria-checked`/case à cocher, multi-select
- [Source: ux-design-specification.md#responsive mobile-first] — SearchBar pleine largeur, chips scroll, 44px
- [Source: inertia/layouts/PublicLayout.tsx] — structure à enrichir (skip link, main#main-content)
- [Source: inertia/components/public/FilterChip.tsx] — aria-pressed → role=checkbox
- [Source: inertia/components/public/{FilterBar,ListingToggle,SearchBar}.tsx] — scroll-snap + 44px
- [Source: inertia/components/shared/LanguageSwitcher.tsx] — zones tactiles
- [Source: inertia/css/app.css] — tokens WCAG, ajout `:focus-visible`
- [Source: package.json] — pas d'axe-core ; `@japa/browser-client` présent
- [Source: Story 5.3] — `filter_chip.spec.ts` (aria-pressed) à mettre à jour
- [Source: Story 5.5] — `<html lang>` dynamique, prudence sur `design_system.spec.ts`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **Tests a11y = source, pas HTML serveur** : skip link, `<main id="main-content">` et les `<h1>` sont dans les composants/pages React rendus **client-side** (`ssr: false`) → absents de `response.text()` (shell serveur). La story prévoyait un test fonctionnel sur le HTML brut ; remplacé par des **assertions source** (Node-pur), conformes à la réalité de rendu et au pattern du repo. L'audit live (axe/clavier/mobile) reste manuel.
- **`FilterChip` role="checkbox"** : appliqué selon la spec UX-DR (recommandation Q1) — `role="checkbox"` + `aria-checked` + `aria-label` + Espace pour basculer, tout en gardant le `<Link>` (Entrée/clic naviguent). Le test 5.3 `filter_chip.spec.ts` (qui assertait `aria-pressed`) a été mis à jour.
- **Focus visible** : implémenté en CSS global `:focus-visible` (outline vert + offset) plutôt qu'en classes répétées — couvre tous les éléments focusables (équivalent `ring-2 ring-green-700 ring-offset-2`).
- **Décisions sur les 3 questions ouvertes (recommandations appliquées)** : (1) `FilterChip` en `role="checkbox"` (spec) ; (2) cibles 44px **partout** (simple/cohérent) ; (3) audit WCAG **manuel** (pas de dépendance axe ajoutée). À confirmer en review.

### Completion Notes List

- AC1–AC4 satisfaits ; AC5 (contraste) traité par conception + revue (audit axe final = manuel, Tâche 9.4) ; AC6 (tests) vert (325/325)
- Skip link "Aller au contenu principal" + `<main id="main-content" tabIndex={-1}>` dans `PublicLayout`
- Focus visible global (`:focus-visible`, anneau vert) dans `app.css`
- `FilterChip` : sémantique case à cocher (role/aria-checked/aria-label + Espace) + 44px + snap-start
- Cibles tactiles ≥ 44px : `ListingToggle` (size-11), `LanguageSwitcher` (min-h-11), `SearchBar` × (size-11)
- Scroll-snap horizontal des chips (homepage) ; `<h1>` sr-only ajouté au listing
- Contraste : texte informatif `stone-400`→`stone-600` (carte/filtres) ; gris décoratifs conservés
- i18n FR/EN : `a11y.skip_to_content`, `filters.filter_by`, `productions.heading` (parité)
- Aucune dépendance ajoutée, aucun backend touché, aucune migration
- Tests : 325/325, lint 0, typecheck 0
- Tâche 9.4 (audit axe DevTools + clavier + mobile + lecteur d'écran) restante — **utilisateur**

### File List

**Créés :**
- `tests/unit/components/a11y_components.spec.ts`

**Modifiés :**
- `inertia/layouts/PublicLayout.tsx` — skip link + `<main id="main-content" tabIndex={-1}>`
- `inertia/css/app.css` — `:focus-visible` (anneau vert global)
- `inertia/components/public/FilterChip.tsx` — role=checkbox + aria-checked + aria-label + Espace + min-h-11 + snap-start
- `inertia/components/public/FilterBar.tsx` — `snap-x` (homepage) + libellé dimension `stone-600`
- `inertia/components/public/ListingToggle.tsx` — boutons `size-11`
- `inertia/components/public/SearchBar.tsx` — bouton × `size-11` + input `pr-12`
- `inertia/components/shared/LanguageSwitcher.tsx` — boutons `min-h-11`
- `inertia/components/public/ProductionCard.tsx` — méta `stone-400`→`stone-600`
- `inertia/pages/productions.tsx` — `<h1 sr-only>`
- `inertia/locales/public/fr.json` / `en.json` — `a11y.*`, `filters.filter_by`, `productions.heading`
- `tests/unit/components/filter_chip.spec.ts` — MAJ (aria-pressed → role=checkbox)

### Change Log

- 2026-06-01 : Implémentation Story 5.6 (Accessibilité & responsive site public). Skip link + `main#main-content`, focus visible global (`:focus-visible`), `FilterChip` en case à cocher (role/aria-checked/aria-label/Espace), cibles tactiles ≥ 44px (chips/toggle/switcher/×), scroll-snap chips, `<h1>` listing, corrections de contraste, i18n a11y. Aucune dépendance/backend/migration. 1 fichier créé, 11 modifiés. Tests : 325/325 verts, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [ ] [Review][Decision] `role="checkbox"` sur un `<Link>` de navigation (`FilterChip`) [inertia/components/public/FilterChip.tsx] — conforme à la spec UX-DR (case à cocher), mais sémantiquement discutable : un lecteur d'écran annonce « case à cocher » alors que l'activation **navigue** (Inertia). Décision requise : (A) conserver `role="checkbox"`+`aria-checked` (spec littérale) ; (B) revenir à `aria-pressed` (bouton bascule, plus honnête pour un lien-filtre). Tension déjà signalée en Q1 de la story. (blind)
