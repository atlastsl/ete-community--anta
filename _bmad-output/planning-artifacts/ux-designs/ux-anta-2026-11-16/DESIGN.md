---
name: Anta
description: Bibliothèque numérique académique d'ETEC Community. shadcn/ui (new-york, base stone) + Tailwind v4 sur Inertia React ; identité MVP héritée du code, ce fichier ajoute les deltas visuels de la Phase 2.
status: final
updated: 2026-11-18
sources:
  - ../../prd.md                      # FR44–FR61, FR5/FR9/FR17/FR21/FR36 modifiés, NFR Accessibilité (amendé 2026-11-16 : FR46, FR50, FR53)
  - ../../validation-report-2026-11-15.md
  - .decision-log.md                  # D1–D37 (canonique)
  - mockups/                          # 7 maquettes HTML + index (références, les spines priment)
  - code:inertia/css/app.css          # tokens @theme (valeurs exactes)
  - code:inertia/components/          # ProductionCard, SearchBar, FilterChip, Pagination, shadcn ui
  - code:resources/views/inertia_layout.edge  # polices
colors:
  # Valeurs = inertia/css/app.css (@theme) + classes Tailwind brutes utilisées dans le code.
  # Mode clair uniquement : pas de dark mode, donc pas de paires -dark.
  primary: '#15803d'              # green-700, seul accent de marque
  primary-hover: '#166534'        # green-800 (hover des aplats verts)
  primary-foreground: '#ffffff'
  background: '#fafaf9'           # stone-50, fond de page
  foreground: '#1c1917'           # stone-900
  text-body: '#44403c'            # stone-700, corps et résumés
  text-secondary: '#57534e'       # stone-600, bylines, compteurs de résultats
  muted-foreground: '#78716c'     # stone-500, méta, compteurs de cartes
  card: '#ffffff'
  card-foreground: '#1c1917'
  popover: '#ffffff'
  popover-foreground: '#1c1917'
  secondary: '#f5f5f4'            # stone-100
  muted: '#f5f5f4'
  accent: '#f5f5f4'               # neutre exprès (hover), pas une couleur de marque
  accent-foreground: '#1c1917'
  border: '#e7e5e4'               # stone-200, bordure par défaut globale
  border-subtle: '#f5f5f4'        # stone-100, séparateurs de lignes (dl, tableaux)
  input: '#d6d3d1'                # stone-300
  link-decoration: '#d6d3d1'      # stone-300, soulignement des noms d'auteurs liés (D24)
  ring: '#15803d'
  destructive: '#dc2626'          # red-600
  destructive-hover: '#b91c1c'    # red-700
  error-surface: '#fef2f2'        # red-50
  success-surface: '#f0fdf4'      # green-50
  success-subtle: '#dcfce7'       # green-100 (nav admin active, chips)
  success-border: '#86efac'       # green-300
  success-text: '#166534'         # green-800
  warning-surface: '#fffbeb'      # amber-50
  warning-border: '#fde68a'       # amber-200
  warning-border-strong: '#fcd34d' # amber-300
  warning-accent: '#b45309'       # amber-700
  warning-text: '#92400e'         # amber-800
  warning-text-strong: '#78350f'  # amber-900
  avatar-initials-bg: '#dcfce7'   # green-100 (D25)
  avatar-initials-fg: '#166534'   # green-800 (D25), 6,49:1
  skeleton: '#f5f5f4'             # stone-100
typography:
  display-hero:
    fontFamily: 'Playfair Display'
    fontSize: 36px                # text-4xl ≥ sm ; 30px (text-3xl) < sm
    fontWeight: '600'
    lineHeight: '1.25'
  heading-page:
    fontFamily: 'Playfair Display'  # h1 détail, profil d'auteur, liste des auteurs
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.25'
  heading-section:
    fontFamily: 'Playfair Display'  # h2 des blocs d'accueil, « Productions » du profil
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.333'
  heading-section-sm:
    fontFamily: 'Playfair Display'  # h2 de la page de détail (Résumé, Fichiers, Productions similaires)
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  heading-admin:
    fontFamily: 'Playfair Display'  # h1/h2 admin (serif automatique via @layer base)
    fontSize: 24px
    fontWeight: '600'
  featured-title-lg:
    fontFamily: 'Playfair Display'  # titre de l'emplacement 1 de la bannière
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  card-title:
    fontFamily: 'Playfair Display'  # h3 des cartes (production, bannière 2/3, auteur)
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.375'
  body:
    fontFamily: 'Inter'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.625'
  body-sm:
    fontFamily: 'Inter'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.43'
  label:
    fontFamily: 'Inter'             # libellés de formulaire admin
    fontSize: 14px
    fontWeight: '500'
  meta:
    fontFamily: 'Inter'             # méta de carte, dt, libellés de stats
    fontSize: 12px
    fontWeight: '400'
    letterSpacing: 0.025em          # + uppercase
  eyebrow:
    fontFamily: 'Inter'
    fontSize: 14px
    fontWeight: '500'
    letterSpacing: 0.1em            # + uppercase, couleur primary
  stat-value:
    fontFamily: 'Inter'
    fontSize: 18px                  # compteurs de l'aside du détail et du profil ; 30px pour les KPI admin
    fontWeight: '600'
  initials:
    fontFamily: 'Inter'             # initiales de l'avatar
    fontWeight: '600'
rounded:
  # Pas de --radius : rayons Tailwind par défaut, utilisés directement.
  md: 6px       # boutons, inputs, pagination, toggles, squelettes
  lg: 8px       # cartes, panneaux, tableaux, fieldsets, dropzone, bannière, emplacements à la une
  2xl: 16px     # hero de l'accueil uniquement
  full: 9999px  # barre de recherche, chips, badges, avatars
spacing:
  # Échelle Tailwind (base 4 px) héritée. Jetons nommés = conventions du code.
  page-x: 24px            # px-6 public
  page-y: 32px            # py-8
  admin-main: 32px        # px-8 py-8
  card-padding: 20px      # p-5
  fieldset-padding: 24px  # p-6
  grid-gap: 20px          # gap-5
  grid-gap-compact: 12px  # gap-3, suggestions < sm
  section-gap: 48px       # mt-12 entre sections d'accueil, avant les suggestions
  touch-target: 44px      # min-h-11 / size-11 (public)
  container-public: 1280px   # max-w-7xl (accueil, listing, liste des auteurs, détail)
  container-profile: 1152px  # max-w-6xl (profil d'auteur)
  container-admin: 1024px    # max-w-5xl (page « À la une », statistiques)
  container-form: 768px      # max-w-3xl (formulaires, politique de confidentialité)
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    hover: '{colors.primary-hover}'
    radius: '{rounded.md}'
  button-outline:
    background: '{colors.card}'
    foreground: '{colors.foreground}'
    border: '{colors.input}'
    hover-border: '{colors.primary}'
    hover-foreground: '{colors.primary}'
    radius: '{rounded.md}'
  search-bar:
    background: '{colors.card}'
    border: '{colors.input}'
    radius: '{rounded.full}'
    height: 48px
    submit: '{components.button-primary}'
  advanced-search-button:
    base: '{components.button-outline}'
    height: 48px
    radius: '{rounded.full}'
  production-card:
    background: '{colors.card}'
    border: '{colors.border}'
    border-hover: '{colors.primary}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
    title: '{typography.card-title}'
  production-thumbnail:
    aspect-ratio: '16 / 9'
    fit: 'cover'
    background: '{colors.muted}'
    radius: '{rounded.lg} {rounded.lg} 0 0'
  featured-banner-card:
    background: '{colors.card}'
    border: '{colors.border}'
    border-hover: '{colors.primary}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
    title-primary-slot: '{typography.featured-title-lg}'
    title-secondary-slot: '{typography.card-title}'
    thumbnail: '{components.production-thumbnail}'
    focus-outline: '{colors.ring}'
  author-card:
    background: '{colors.card}'
    border: '{colors.border}'
    border-hover: '{colors.primary}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
    title: '{typography.card-title}'
    avatar: '{components.avatar.size-md}'
  avatar:
    radius: '{rounded.full}'
    border: '{colors.border}'       # photos uniquement
    size-sm: 32px
    size-md: 56px
    size-lg: 96px                   # 112px ≥ sm (profil)
    initials-background: '{colors.avatar-initials-bg}'
    initials-foreground: '{colors.avatar-initials-fg}'
    initials-type: '{typography.initials}'
  author-link:
    foreground: 'inherit'
    decoration: '{colors.link-decoration}'
    underline-offset: 2px
    hover-foreground: '{colors.primary}'
    hover-decoration: '{colors.primary}'
  scholar-link:
    base: '{components.button-outline}'
    height: '{spacing.touch-target}'
  skeleton:
    background: '{colors.skeleton}'
    radius: '{rounded.md}'
  home-block-header:
    title: '{typography.heading-section}'
    subtitle-color: '{colors.muted-foreground}'
    see-more-color: '{colors.primary}'
  pagination-item-active:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  filter-chip-active:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.full}'
  badge-incomplete:
    background: '{colors.warning-surface}'
    border: '{colors.warning-border-strong}'
    foreground: '{colors.warning-text}'
    radius: '{rounded.full}'
  badge-public:
    background: '{colors.card}'
    border: '{colors.primary}'
    foreground: '{colors.primary}'
    radius: '{rounded.full}'
  badge-not-public:
    background: '{colors.secondary}'
    foreground: '{colors.text-body}'
    radius: '{rounded.full}'
  author-combobox:
    input: '{colors.input}'
    popover: '{colors.popover}'
    option-active: '{colors.accent}'
    match-highlight: '{colors.success-text}'   # <mark> sans fond, semi-gras
    radius: '{rounded.md}'
  selected-author-row:
    background: '{colors.card}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  consent-box:
    background: '{colors.background}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  featured-slot-admin:
    background: '{colors.card}'
    border: '{colors.border}'
    border-empty: '{colors.input}'   # pointillé, comme la dropzone
    radius: '{rounded.lg}'
    padding: '{spacing.fieldset-padding}'
  thumbnail-field:
    dropzone-border: '{colors.input}'
    dropzone-active: '{colors.primary}'
    dropzone-active-bg: '{colors.success-surface}'
    preview: '{components.production-thumbnail}'
  warning-notice:
    background: '{colors.warning-surface}'
    border: '{colors.warning-border}'
    foreground: '{colors.warning-text-strong}'
    radius: '{rounded.md}'
  admin-nav-item-active:
    background: '{colors.success-subtle}'
    foreground: '{colors.primary}'
    indicator: '{colors.primary}'
---

## Brand & Style

Anta est une bibliothèque académique associative : sobre, lisible, sérieuse sans être austère. L'esthétique est celle d'un **papier chaud** (neutres stone) relevé d'**un seul vert** (`{colors.primary}`, le vert du logo) et d'un **serif de titre** (Playfair Display) sur un corps Inter. La profondeur vient des bordures, pas des ombres.

**L'identité visuelle du MVP est héritée telle qu'implémentée dans le code** (`inertia/css/app.css`, composants shadcn passés en classes stone). Ce fichier la consigne ; la Phase 2 l'**étend** seulement : vignettes 16:9 réservées à la bannière (D37), bannière à la une (D9), cartes et avatars d'auteurs (D3), squelettes (D22), composants admin des auteurs et de la une. Les anciens `ux-design-specification.md` et `ux-design-directions.html` sont obsolètes et sans autorité.

Images : jusqu'ici aucune image de contenu ; la Phase 2 introduit la **vignette**, réservée aux productions à la une et affichée **uniquement dans la bannière** (D37, FR50). Toutes les autres cartes restent la carte texte actuelle, sans image.

**Références visuelles** : [index des maquettes](mockups/index.html). Elles utilisent Tailwind CDN et Google Fonts (D29) et des dégradés à la place des vignettes et des photos. En cas de conflit, les spines priment sur les maquettes.

## Colors

Un accent, des neutres, trois couleurs d'état. Ratios mesurés (WCAG 2.1) :

| Rôle | Jeton | Usage | Contraste |
|---|---|---|---|
| Marque | `{colors.primary}` | boutons principaux, état actif (chips, pagination, toggle, nav admin), liens au survol, « Voir plus », icônes de compteurs du détail, focus | 5,02:1 sur blanc, 4,8:1 sur `{colors.background}` ; blanc dessus 5,02:1 |
| Texte | `{colors.foreground}` | titres, texte fort | 16,7:1 |
| Corps | `{colors.text-body}` | résumés, paragraphes | > 9:1 |
| Secondaire | `{colors.text-secondary}` | bylines, nombre de résultats, institution des cartes auteur | 7,6:1 |
| Méta | `{colors.muted-foreground}` | méta xs, compteurs des cartes, sous-titre « sur les 12 derniers mois » | 4,8:1 blanc, 4,59:1 stone-50 ; **4,4:1 sur `{colors.muted}` : interdit** |
| Surfaces | `{colors.background}` / `{colors.card}` | page stone-50, surfaces blanches bordées `{colors.border}` | — |
| Avertissement | `{colors.warning-surface}`, `{colors.warning-border}`, `{colors.warning-text}`, `{colors.warning-accent}` | « À compléter », vignette manquante, production à la une dépubliée, résultats approchants | `{colors.warning-text}` sur `{colors.warning-surface}` 6,8:1 |
| Succès | `{colors.success-surface}`, `{colors.success-subtle}`, `{colors.success-text}` | complétude OK, nav admin active, avatars à initiales | `{colors.success-text}` sur `{colors.success-subtle}` 6,49:1 |
| Destructif | `{colors.destructive}` | suppression, erreurs de champ | 4,83:1 |

`{colors.accent}` est volontairement neutre (stone-100) : un accent ambré rendait les survols marron. Aucune seconde couleur de marque.

**Avatars à initiales** (D25) : `{colors.avatar-initials-fg}` sur `{colors.avatar-initials-bg}` (green-800 sur green-100), **6,49:1**, conforme AA pour le texte normal. Ce vert pâle reste une teinte de la marque, pas une seconde couleur.

**Noms d'auteurs liés** (D24) : soulignement `{colors.link-decoration}` (stone-300) sous un texte qui garde sa couleur (`{colors.text-secondary}` ou `{colors.text-body}`, ≥ 7:1) ; au survol, texte et soulignement passent en `{colors.primary}`. Le lien se distingue par la présence du soulignement, pas par la couleur (critère 1.4.1).

**Bordure des champs** : sur le site public, les champs (recherche, filtres, tris) ont une bordure `stone-500` (4,8:1 sur blanc), comme la case non cochée des filtres et le chevron des groupes, pour satisfaire le critère 1.4.11 (D33 amendée par la Story 13.2, validée par le PO le 2026-11-25). `{colors.input}` (1,49:1) reste la bordure de l'administration.

## Typography

Deux familles chargées depuis Google Fonts dans les deux layouts edge : **Inter** 400/500/600/700 et **Playfair Display** 600/700.

- `h1` et `h2` passent automatiquement en Playfair 600 (`@layer base`), y compris dans l'admin (`{typography.heading-admin}`). Ailleurs, la classe `.font-display` applique Playfair (titres de cartes `{typography.card-title}`).
- Rampe publique : `{typography.display-hero}` (accueil) → `{typography.heading-page}` (détail, profil, liste des auteurs) → `{typography.heading-section}` (blocs d'accueil, « Productions » du profil) → `{typography.heading-section-sm}` (sections du détail) → `{typography.card-title}`.
- Bannière : titre de l'emplacement 1 en `{typography.featured-title-lg}` ; emplacements 2–3 et cartes en `{typography.card-title}`.
- Méta récurrente : `{typography.meta}` en capitales, `{colors.muted-foreground}` ou `{colors.text-secondary}` (méta de carte, `dt`, libellés de filtres et de stats).
- Noms d'auteurs : « Prénom NOM », nom de famille en capitales à l'affichage (D13, D34).
- Chiffres : `tabular-nums` dans les tableaux et compteurs ; formatage localisé (`Intl.NumberFormat` FR/EN).
- Initiales d'avatar : `{typography.initials}`, capitales, taille ≈ 40 % du diamètre (`text-xs` en sm, `text-base` en md).

## Layout & Spacing

Échelle Tailwind en base 4 héritée. Conteneurs : `{spacing.container-public}` pour l'accueil, le listing, la liste des auteurs et le détail ; `{spacing.container-profile}` pour le profil d'auteur ; `{spacing.container-admin}` pour la page « À la une » ; `{spacing.container-form}` pour les formulaires admin. Marges `{spacing.page-x}`, sections d'accueil espacées de `{spacing.section-gap}`, grilles en `{spacing.grid-gap}`.

| Surface (Phase 2) | < sm | sm | md | lg | xl |
|---|---|---|---|---|---|
| Recherche + « Recherche avancée » | bouton sous la barre, pleine largeur | côte à côte | idem | idem | idem |
| Bannière (1, 2 ou 3 éléments) | empilés dans l'ordre | idem | idem | 1 : pleine largeur ; 2 : 2 colonnes égales ; 3 : grille 3 × 2, élément 1 sur 2 colonnes et 2 lignes, éléments 2–3 empilés dans la 3e | idem |
| Blocs d'accueil (3 cartes) | 1 colonne | 1 | 3 colonnes | 3 | 3 |
| Liste des auteurs (24/page) | 1 colonne | 2 | 2 | 3 | 4 |
| Filtres de la liste des auteurs | empilés | 2 colonnes | 2 | 4 colonnes alignées en bas (Nom, Institution, Domaine, Tri) | idem |
| Profil : en-tête + statistiques | empilés, stats sur 3 colonnes | idem | idem | en-tête sur 2/3, aside stats sur 1/3 (stats en colonne) | idem |
| Productions du profil (12/page) | 1 colonne | 2 | 2 | 3 | 3 |
| Suggestions (4 cartes) | 2 colonnes, `{spacing.grid-gap-compact}` | 2, `{spacing.grid-gap}` | 2 | 4 | 4 |

Bannière à 3 éléments : les petits emplacements gardent une vignette 16:9 ; l'emplacement 1 étire sa vignette (`object-cover`) pour égaler la hauteur des deux petits empilés plus l'espacement. La disposition en colonnes commence à `lg` (D35).

Cibles tactiles publiques ≥ `{spacing.touch-target}`. Admin desktop-first (`lg`), message « utilisez un ordinateur » en dessous (inchangé).

## Elevation & Depth

Pas de hiérarchie par ombres : surfaces `{colors.card}` bordées `{colors.border}` sur `{colors.background}`. Ombres tolérées : `shadow-xs`/`shadow-sm` sur inputs et boutons outline, `shadow-sm` sur la carte de connexion admin. Survol d'une carte cliquable = bordure `{colors.primary}`, sans ombre ni translation. Le header public est le seul élément translucide (`bg-background/95 backdrop-blur`). Popovers (combobox) et dialogs gardent les ombres shadcn (`shadow-lg`).

## Shapes

`{rounded.md}` pour les contrôles (boutons, inputs, pagination, squelettes, encadré de consentement), `{rounded.lg}` pour les conteneurs (cartes, bannière, emplacements à la une, fieldsets, dropzones, dialogs), `{rounded.full}` pour la recherche, les chips, les badges et les avatars, `{rounded.2xl}` uniquement pour le hero de l'accueil. Une vignette en tête de carte reprend les coins supérieurs de la carte (`overflow-hidden`), coins inférieurs carrés.

## Components

Composants shadcn utilisés tels quels (classes stone) : `Button`, `Badge`, `Dialog`, `Input`, `Select`. Existants inchangés : `SearchBar`, `FilterChip`, `FilterSidebar`, `ListingToggle`, `Pagination`, `MediaViewer`, `ShareButton`, `StatusBadge`, `CompletionIndicator`, `FileUploader`.

Maquettes : [accueil](mockups/home.html) · [liste des auteurs](mockups/authors-list.html) · [profil d'auteur](mockups/author-profile.html) · [détail et suggestions](mockups/production-detail-suggestions.html) · [admin : à la une](mockups/admin-featured.html) · [admin : sélecteur d'auteurs](mockups/admin-author-picker.html) · [admin : liste des auteurs](mockups/admin-authors-list.html).

| Composant | Spec visuelle |
|---|---|
| **SearchBar + Recherche avancée** (modifié, D8, [maquette](mockups/home.html)) | `{components.search-bar}` inchangé ; bouton `{components.advanced-search-button}` (outline pilule 48 px, icône `SlidersHorizontal` size-4, survol bordure et texte `{colors.primary}`) accolé à droite ≥ sm, sous la barre en pleine largeur < sm. Puces de catégories du hero supprimées. |
| **ProductionCard** (inchangé visuellement, D2/D37) | `{components.production-card}`. Carte texte actuelle, sans vignette ni placeholder : titre → byline → méta → résumé (`line-clamp-3`) → compteurs `Eye`/`Download`/`Calendar`. Noms d'auteurs liés en `{components.author-link}`. |
| **FeaturedBanner / FeaturedCard** (nouveau, D9, [maquette](mockups/home.html)) | `{components.featured-banner-card}` : vignette 16:9 en haut, texte **sous** l'image sur fond blanc : titre, byline, compteurs totaux `Eye`/`Download` en `{typography.body-sm}` `{colors.muted-foreground}`. Rien d'autre (FR49). Titre : 3 lignes max (emplacement 1), 2 lignes (emplacements 2–3). Focus clavier du titre → contour 2 px `{colors.ring}` sur toute la carte (`:has(:focus-visible)`). Pas de titre de section visible. |
| **HomeBlock** (nouveau) | En-tête : h2 `{components.home-block-header}` + sous-titre `{typography.body-sm}` `{colors.muted-foreground}` « sur les 12 derniers mois » (blocs classés, D4) ; lien « Voir plus » `{colors.primary}` medium + `ArrowRight` size-4, aligné à droite, hauteur `{spacing.touch-target}`, souligné au survol. Grille de cartes en dessous. |
| **AuthorCard** (nouveau, D3, [maquette](mockups/authors-list.html)) | `{components.author-card}` : rangée avatar `{components.avatar.size-md}` + colonne texte : nom `{typography.card-title}`, institution principale `{typography.body-sm}` `{colors.text-secondary}` (1 ligne tronquée), ligne de stats `{typography.body-sm}` `{colors.muted-foreground}` : `BookOpen` n productions · `Eye` n vues. |
| **Avatar** (nouveau, D25) | Cercle `{rounded.full}`, tailles sm 32 / md 56 / lg 96 px (112 px ≥ sm) ; photo `object-cover` bordée `{colors.border}` ; sinon initiales `{components.avatar.initials-background}` / `{components.avatar.initials-foreground}`. |
| **AuthorByline** (nouveau, D12/D24) | « Par A, B » : noms à profil public en `{components.author-link}` (soulignés `{colors.link-decoration}`, décalage 2 px, survol texte et soulignement `{colors.primary}`) ; noms sans profil en texte simple, sans style distinctif. |
| **AuthorProfileHeader** (nouveau, [maquette](mockups/author-profile.html)) | Fil d'Ariane (Accueil / Auteurs / Nom) `{typography.body-sm}` `{colors.muted-foreground}` ; avatar lg ; h1 `{typography.heading-page}` ; affiliations en liste `{typography.body-sm}` (« Institution — Département », icône `Building2`) ; lien `{components.scholar-link}` : bouton outline `GraduationCap` + « Google Scholar » + `ExternalLink` size-4. Aside « Statistiques de l'auteur » en carte blanche bordée : Vues, Téléchargements, Productions (icône size-5 `{colors.primary}` + `{typography.meta}` + `{typography.stat-value}`), mention « Totaux des productions publiées. » en `{colors.muted-foreground}`. |
| **SuggestionsGrid** (nouveau, D22, [maquette](mockups/production-detail-suggestions.html)) | h2 `{typography.heading-section-sm}`, `{spacing.section-gap}` au-dessus, grille de 4 `ProductionCard` sans date ; < sm variante compacte (résumé masqué, `{spacing.grid-gap-compact}`), ≥ sm résumé `line-clamp-2`. |
| **Skeleton** (nouveau) | Blocs `{components.skeleton}` reproduisant l'anatomie d'une carte (ligne titre, 2 lignes texte, ligne compteurs) ; `motion-safe:animate-pulse`. |
| **AuthorFilters** (nouveau, D31, [maquette](mockups/authors-list.html)) | Barre de filtres horizontale au-dessus de la grille : `Input` de recherche « Nom » avec icône `Search`, `Select` Institution, `Select` Domaine des productions, `Select` Tri ; libellés visibles `{typography.label}`. Sous la barre, compteur `{colors.text-secondary}` « 86 auteurs · 1–24 ». |
| **SortSelect** (existant) | `Select` shadcn `w-44` (`w-52` ou plus si libellés longs) précédé du libellé visible « Trier par ». |
| **Pagination** (existant) | Carrés `h-9 min-w-9 {rounded.md}` bordés, actif `{components.pagination-item-active}` ; ≥ 44 px de cible sur le site public. |
| **NotFoundPage** (repris) | Dans `PublicLayout` : h1 `{typography.heading-page}`, phrase `{colors.text-secondary}`, liens Accueil / Auteurs / Recherche avancée. Remplace le placeholder brut actuel (`errors/not_found.tsx`). |
| **AuthorCombobox** (admin, nouveau, D18, [maquette](mockups/admin-author-picker.html)) | Libellé « Ajouter un auteur », input `{components.author-combobox}` avec icône `Search` ; popover blanc bordé ; option : avatar sm + « Prénom NOM » (correspondance en `<mark>` `{components.author-combobox.match-highlight}`) + 1re affiliation « Institution — Département » `{colors.muted-foreground}` + `{components.badge-incomplete}` éventuel ; option active `{colors.accent}` ; dernière option « Créer un auteur « {saisie} » » en `{colors.primary}` avec `Plus`. Bouton outline « Créer un auteur » à côté du champ. |
| **SelectedAuthorList** (admin, nouveau) | Liste ordonnée de `{components.selected-author-row}` : rang (tabular-nums), avatar sm, nom + 1re affiliation `{colors.muted-foreground}`, boutons icône ghost `ChevronUp`/`ChevronDown`/`X` taille `icon-sm` (32 px). |
| **AuthorFormDialog / AuthorForm** (admin, nouveau) | `Dialog` shadcn `max-w-lg` titré « Créer un auteur » ; champs Nom(s)*, Prénom(s)* ; affiliations répétables en sous-cartes bordées `{rounded.md}` (institution*, département) avec ↑ ↓ ×, bouton ghost « Ajouter une affiliation » ; lien Google Scholar ; photo : dropzone compacte + avatar lg en aperçu ; case de consentement dans `{components.consent-box}`, case `accent-green-700`, aide `{typography.body-sm}` `{colors.text-secondary}`. Fiche pleine page : même grille dans `{spacing.container-form}`. |
| **Badges auteurs** (admin, nouveau, D32) | `{components.badge-incomplete}` « À compléter » ; `{components.badge-public}` « Public » ; `{components.badge-not-public}` « Non public ». |
| **AdminAuthorsTable** (admin, nouveau, D32, [maquette](mockups/admin-authors-list.html)) | Barre : recherche, `Select` Institution, groupe « Filtres rapides » de toggles outline avec compteur (« Consentement en attente 37 », « À compléter 12 »), actif `{components.filter-chip-active}`. Tableau shadcn : Auteur (avatar sm + nom lien), Affiliation principale (« Aucune affiliation » en `{colors.muted-foreground}`), Productions (tabular-nums), Statut (badges), Mise à jour, Actions (boutons outline `h-8 text-xs` : Modifier, Confirmer / Retirer le consentement, Supprimer). Action indisponible : `opacity-50` + infobulle. |
| **FeaturedSlot** (admin, nouveau, D20/D26, [maquette](mockups/admin-featured.html)) | `{components.featured-slot-admin}` numéroté 1–3 (pastille de rang) ; vide : bordure pointillée `{colors.input}` + ProductionPicker ; rempli : vignette 16:9 (160 px), titre, auteurs, « Catégorie · Domaine », badge « Affichée » (`{components.badge-public}`) ou « Vignette manquante » (`{components.badge-incomplete}` sur blanc), boutons ↑ ↓ et « Retirer » ; vignette manquante : `{components.warning-notice}` + bouton outline « Téléverser une vignette » et aide `{typography.meta}`. Compteur « n / 3 emplacements » (`{components.badge-not-public}`) à droite du h1. Barre d'enregistrement sous les emplacements : explication `{colors.warning-text-strong}` + bouton primaire « Enregistrer » (désactivé à `opacity-50`). |
| **ProductionPicker** (admin, nouveau, D30) | Combobox dans l'emplacement libre (même apparence que AuthorCombobox) : option = vignette miniature 16:9 ou icône `ImageOff` `{colors.warning-accent}`, titre, auteurs · catégorie, état de vignette (« Vignette », « Vidéo hébergée — image extraite », « Sans vignette — à téléverser »). |
| **BannerPreview** (admin, nouveau) | Rendu réel de `FeaturedBanner` (disposition `lg`) à échelle réduite dans un cadre `{colors.background}` bordé, titré « Aperçu de la bannière », avec ligne d'état `{typography.meta}` (« 2 productions affichées — l'emplacement 3 attend sa vignette ») et rappel des dispositions. |
| **ThumbnailField** (admin, nouveau, D1/D10) | `{components.thumbnail-field}` : dropzone pointillée (comme `FileUploader`), aperçu recadré 16:9 tel qu'affiché, boutons Remplacer / Retirer ; vidéo hébergée sans vignette : aperçu de l'image extraite + mention `{typography.meta}` « Image extraite de la vidéo ». |
| **Admin sidebar** (étendu) | Deux entrées `{components.admin-nav-item-active}` (bordure gauche 3 px `{colors.primary}`) : « Auteurs » (`BookUser`) et « À la une » (`Star`), après « Productions ». |
| **ConfirmDialog (dépublier / supprimer)** (étendu, D21) | Si la production est à la une : `{components.warning-notice}` avec `AlertTriangle` dans le corps du dialog. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Neutres stone + `{colors.primary}` comme seul accent ; aplats verts survolés en `{colors.primary-hover}` | Ajouter une seconde couleur de marque, des dégradés (hors hero existant) ou un dark mode |
| Séparer les surfaces par `{colors.border}` sur fond `{colors.background}` | Hiérarchiser par ombres ; animer les cartes au survol (translation, échelle) |
| Playfair uniquement pour les titres (h1/h2, `.font-display`) ; Inter partout ailleurs | Mettre du corps ou des boutons en Playfair |
| Vignette 16:9 `object-cover` uniquement dans la bannière à la une (et ses aperçus admin) | Vignette, placeholder, image générique ou icône dans les cartes des blocs, du listing, des profils ou des suggestions (D37) |
| Texte de bannière **sous** l'image, sur blanc (D9) | Texte superposé à une image (contraste non garanti) |
| Noms d'auteurs liés soulignés stone-300 ; non liés en texte simple (D24) | Distinguer les liens par la seule couleur |
| Initiales green-800 sur green-100 (D25) | Initiales sur un fond saturé ou en blanc sur vert |
| `{colors.muted-foreground}` sur blanc ou stone-50 | `{colors.muted-foreground}` sur `{colors.muted}` (4,4:1) |
| Pilules pour recherche, chips, badges, avatars ; `{rounded.md}` boutons ; `{rounded.lg}` cartes | `{rounded.2xl}` ailleurs que sur le hero |
| Ambre pour avertir (à compléter, vignette manquante, retrait de la une) ; rouge pour détruire | Ambre ou rouge décoratifs |
| Icônes lucide `size-4` en ligne, `size-5` en emphase, `aria-hidden` | Autre bibliothèque d'icônes |
| Préférer les jetons sémantiques (`bg-primary`, `text-muted-foreground`) dans le nouveau code | Introduire des valeurs de palette absentes de ce fichier |
