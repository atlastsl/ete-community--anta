---
baseline_commit: d827fb2
---

# Story 13.2 : Parcours 1 et 2 au clavier et au lecteur d'écran

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur naviguant au clavier ou avec un lecteur d'écran,
Je veux réaliser les parcours 1 (recherche → détail → téléchargement) et 2 (accueil → bannière ou blocs → profil
d'auteur → production → suggestions),
Afin d'accéder aux productions sans souris ni vue (NFR16, D33, D36).

## Décision de périmètre (lire en premier)

- **Site public seulement** (panel d'administration hors périmètre WCAG, NFR16).
- 13.1 (done) a livré la suite Japa `browser` + axe (20 tests, 0 violation). 13.2 l'**étend** : parcours clavier
  automatisés, structure (titres, landmarks), `lang` des contenus, contrastes et états non audités en 13.1
  (reports de la revue 13.1).
- L'audit **manuel** NVDA / VoiceOver est une **porte manuelle** (Aurélien ou un testeur désigné) : l'agent fournit la
  grille (`13-2-grille-audit-lecteurs-ecran.md`) et corrige ce qui est vérifiable automatiquement ; il ne l'exécute pas.
- Les specs de composants consolidées et Lighthouse relèvent de 13.4.

## Acceptance Criteria

1. **Langue des contenus (3.1.1, 3.1.2)** — **Given** les titres et résumés des productions (cartes de listing, de
   blocs, du profil, suggestions ; bannière ; page de détail : `h1`, résumé, fil d'Ariane), **When** la langue de la
   production (`language`) diffère de la langue d'interface, **Then** ils portent un attribut `lang` (code BCP 47
   dérivé de la valeur stockée par un helper pur de `inertia/lib/`, testé ; valeur inconnue → pas d'attribut) ;
   **And** `<html lang>` suit la langue d'interface, y compris après un changement de langue sans rechargement.
2. **Clavier** — **Given** chaque page publique, **When** elle est parcourue au clavier, **Then** l'ordre de tabulation
   suit l'ordre de lecture (carte : titre puis auteurs), aucun piège au clavier, focus visible global (contour 2 px
   `ring`) y compris sur les cartes à lien étiré (contour couvrant la carte : bannière, cartes d'auteurs), lien
   d'évitement fonctionnel (premier arrêt de tabulation, visible au focus, déplace le focus sur `main`).
3. **Structure** — un seul `h1` par page, aucun saut de niveau (blocs et sections en `h2`, titres de cartes en `h3`),
   landmarks `header` / `main` / `footer` uniques.
4. **Lecteurs intégrés et cibles** — les lecteurs (PDF, EPUB, vidéo, audio, `iframe` intégrée) sont atteignables et
   pilotables au clavier ; les contrôles publics nouveaux (Phase 2 : Voir plus, Recherche avancée, Google Scholar,
   pagination, tri, filtres, recherche de facette) font ≥ 44 px.
5. **Contrastes** — texte normal ≥ 4,5:1, texte large et composants d'interface ≥ 3:1 ; la bordure d'input (D33) est
   revérifiée au critère 1.4.11 et corrigée si les champs ne sont pas identifiables autrement.
6. **Tests** — composants par lecture de source (`lang` conditionnel, hiérarchie des titres, focus, cibles) ; suite
   `browser` étendue : parcours clavier automatisés 1 et 2 (Tab jusqu'au téléchargement, focus visible à chaque
   arrêt), lien d'évitement, structure, `lang`, et axe sur les états fermés / ouverts reportés de 13.1 (panneau de
   filtres mobile, groupes dépliés, ligne inerte « 20 auteurs », liste de tri ouverte, chargement des suggestions).
7. **Audit manuel** — la grille NVDA (Windows) / VoiceOver (macOS), FR et EN, parcours 1 (dont filtre auteur au
   clavier, flux 5) et 2 (flux 1) est fournie sous `_bmad-output/implementation-artifacts/`, colonnes de résultat
   vides ; le rapport (date, outils, constats, corrections, points résiduels acceptés) y sera consigné.

## Tasks / Subtasks

- [x] T1 Helper `inertia/lib/content_lang.ts` (AC 1) : `languageTag(value)` (valeurs stockées → BCP 47 : codes
  `fr`/`en`, variantes `fr-CA`/`en_US`, noms « Français », « English », « Anglais »… ; inconnu → `null`),
  `contentLang(language, uiLanguage)` (tag si la langue primaire diffère, sinon `undefined`), `documentLang(ui)`.
  Tests de comportement (import à l'exécution comme `search_query_behavior.spec.ts`).
- [x] T2 `language` sérialisé (AC 1) : `ProductionCardTransformer` (accueil, listing, profil, suggestions) et
  `FeaturedService.bannerItems` ; tests de clés mis à jour.
- [x] T3 `lang` posé (AC 1) : `ProductionCard` (titre, résumé), bannière partagée (`FeaturedBannerCard.lang` sur le
  `h3`), détail (`h1`, résumé, élément courant du fil d'Ariane) ; `app.tsx` synchronise `<html lang>` sur
  `languageChanged` et au démarrage (détection localStorage / navigateur ≠ cookie lu par le serveur).
- [x] T4 Structure et clavier (AC 2, 3) : `h2` masqué « Résultats » du listing (les cartes `h3` tombaient sous le
  `h2` « Filtres ») ; focus 2 px plein sur les champs (fin de `outline-none` + anneau à 20 %/50 %) ; cibles ≥ 44 px
  (résumés des groupes de filtres, lignes de filtre, recherche de facette, bascule mobile, « Effacer les filtres »,
  pagination du listing, « Plein écran » du PDF).
- [x] T5 Contrastes (AC 5) : calcul des paires (script local, non commité) ; correctifs (bordure et placeholder des
  champs publics, icônes des champs, accroche du hero).
- [x] T6 Suite `browser` (AC 6) : seeding partagé extrait dans `tests/browser/helpers/` ; `keyboard.spec.ts`
  (parcours 1, parcours 2, lien d'évitement, structure, `lang`) ; `a11y.spec.ts` étendu (états).
- [x] T7 Grille d'audit manuel (AC 7).
- [x] T8 Suite complète, lint, typecheck, build.

## Dev Notes

### Contexte technique (état au HEAD `d827fb2`, branche `feat/epic-13-wcag`)

- **Suite `browser`** : `tests/browser/a11y.spec.ts` (13.1) — transaction globale par groupe (le serveur HTTP du même
  processus la lit), `drive.fake('r2')`, images WebP réelles (`sharp`), navigateur confiné à l'origine locale,
  cookie `i18n_lang` brut (`addCookies`), gardes de couverture, liste blanche des « incomplete » (D-13.1-10).
  `typecheck` : `document` absent du `lib` serveur → scripts `page.evaluate` passés en **chaîne** ou locators.
- **Langue** : `language` est un texte libre (`maxLength(255)`) ; le formulaire admin propose `fr` / `en`
  (`LANGUAGE_OPTIONS`), mais des valeurs migrées peuvent être des noms. Interface : `i18n.resolvedLanguage`
  (`fr` | `en`). `<html lang>` est rendu par `inertia_layout.edge` depuis `meta.locale` (cookie seulement) et **n'était
  pas mis à jour** par `LanguageSwitcher` (`i18n.changeLanguage` côté client) → défaut 3.1.1 après bascule.
- **Cartes** : `ProductionCard` (grid/list/compact) = titre `h3` lié (pas de lien étiré), byline après le titre ;
  `FeaturedCard` (bannière) et `AuthorCard` = liens étirés, contour de carte (`:has()` / `after:ring`).
- **Focus global** : `app.css` `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px }`.
  Les champs (`SearchBar`, recherche de facette) le supprimaient (`outline-none`) au profit d'un anneau `green-700/20`
  (≈ 1,3:1) ; shadcn `Input` / `SelectTrigger` : `ring-[3px] ring-ring/50`.
- **Titres** : accueil (h1 accroche, h2 bannière masqué + blocs, h3 cartes) ; détail (h1, h2 sections et suggestions,
  h3 cartes) ; profil (h1 nom, h2 productions, h3 cartes) ; auteurs (h1, h2 cartes) ; listing (h1 masqué, h2
  « Filtres », h3 cartes → **à corriger**).

### Garde-fous

- Wrappers atlas (`/tmp/d37/run.sh`, `build.sh`) ; jamais Doppler / Supabase / R2 / Resend ; jamais deux
  `test:local` en parallèle. Aucune migration, aucune dépendance nouvelle.
- Composants testés par lecture de source (TS6305) ; helpers purs importés à l'exécution par URL calculée.
- Corriger plutôt qu'exclure (aucune règle axe désactivée) ; dépôt public : données fictives, aucun hôte.

### Plancher d'accessibilité (UX `EXPERIENCE.md` → Accessibility Floor ; `DESIGN.md` D33 ; D36)

- Un seul h1 ; blocs, « Productions » du profil, suggestions en h2 ; cartes en h3 ; bannière = région nommée sans
  titre visible ; fil d'Ariane `nav` + `aria-current="page"` ; landmarks ; lien d'évitement.
- Clavier : ordre = lecture ; FeaturedCard et ProductionCard : titre puis auteurs ; focus `{colors.ring}` 2 px ; contour
  de carte sur les liens étirés.
- Langue des contenus : `lang` dérivé de `language` quand il diffère de l'interface (3.1.2).
- Cibles ≥ 44 px : Voir plus, Recherche avancée, Google Scholar, pagination, tri, filtres.
- D33 : bordure `{colors.input}` 1,49:1 conservée car « champs identifiables sans elle » — **à recontrôler** (AC 5).

### Parcours (PRD, `EXPERIENCE.md`)

- **Parcours 1 / flux 5** (Kofi, NVDA) : accueil → « Recherche avancée » → `/productions` → recherche → dimension
  « Auteur » dépliée → recherche de facette → bascule d'un auteur (nombre de résultats annoncé) → carte : titre puis
  auteur → détail → téléchargement.
- **Parcours 2 / flux 1** (Amara) : accueil → bannière (titre puis auteurs) → blocs → « Auteurs les plus consultés »
  → profil (Google Scholar « nouvel onglet ») → production → lecteur → téléchargement → suggestions (annonce
  « {n} productions similaires ») → co-auteur → bascule EN (langue conservée).

### Références

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, Story 13.2 ; `prd.md` — Parcours 1 et 2, NFR Accessibilité.
- `ux-designs/ux-anta-2026-11-16/EXPERIENCE.md` — Accessibility Floor, flux 1 et 5 ; `DESIGN.md` — D33, D24.
- Story 13.1 — décisions D-13.1-1…10, reports de revue (états fermés, accroche du hero, `role="button"` des filtres,
  ligne inerte, règles best-practice de landmarks).

### Intelligence de la story précédente (13.1)

- Requêtes parallèles du navigateur partagent la connexion de la transaction (mise en file par `pg`, sans effet).
- Suggestions abandonnées à 2 s sous charge → un rechargement unique avant l'échec.
- Vite en mode middleware : première visite lente (cache froid), pas de rechargement en cours de suite.

## Décisions (D-13.2-n)

- **D-13.2-1** (langue des contenus) : `languageTag` accepte les codes à 2 lettres (avec région éventuelle :
  `fr-CA`, `en_US` → `en-US`, `es-419`), les noms de langue FR / EN (casse et accents ignorés : « Français »,
  « English », « Anglais », « arabe », « Wolof »…) et les codes ISO 639-2 courants (`fra`, `eng`…) ; toute autre
  valeur → **aucun attribut** (mieux qu'un `lang` faux) ; revue : le code de langue (et la région) doit être connu de
  `Intl.DisplayNames` (`xx`, `qq`, `zz-US` → aucun attribut ; `fr-ZZ` → `fr`). `contentLang` compare les **langues primaires**
  (`fr-CA` dans une interface `fr` → pas d'attribut). L'attribut est posé sur le **lien du titre** des cartes (seul
  contenu du `h3`), sur le `h3` de la bannière, sur le `h1`, le résumé et l'élément courant du fil d'Ariane du détail,
  et sur les résumés des cartes ; revue : aussi sur la valeur « Langue » des métadonnées du détail (nom natif,
  `MetaRow` → `<dd lang>`), seulement pour une langue connue de `LANGUAGE_LABELS`. Le champ `language` est ajouté à `ProductionCardTransformer` (accueil, listing,
  profil, suggestions) et aux éléments de la bannière (`FeaturedService.bannerItems`) ; aucun autre champ exposé.
- **D-13.2-2** (`<html lang>`) : `app.tsx` le synchronise au démarrage et sur `languageChanged` (`documentLang`).
  Défaut trouvé : le serveur ne le rendait que depuis le cookie ; après un clic sur « EN », la page restait
  `lang="fr"` jusqu'au rechargement (3.1.1), de même si i18next détectait une autre langue (localStorage, navigateur).
- **D-13.2-3** (titres) : le listing reçoit un `h2` masqué « Résultats » / « Results » avant les cartes (elles
  tombaient sous le `h2` « Filtres » de la barre latérale). Les autres pages étaient déjà conformes (vérifié dans le
  navigateur : un seul `h1`, aucun saut de niveau, un seul `header` / `main` / `footer` de premier niveau). Revue : le `h2` des `AuthorCard` de `/authors` (D-12.3-5)
  suit le `h1` sans saut de niveau → conforme, inchangé.
- **D-13.2-4** (focus) : le contour global 2 px n'est plus supprimé sur les champs (`SearchBar`, recherche de facette :
  `outline-none` + anneau `green-700/20` ≈ 1,3:1 retirés) ; les composants shadcn publics (`SortSelect`, filtres
  de `/authors`, `ShareButton`) passent de l'anneau 3 px à 50 % au **ring 2 px plein + décalage 2 px**
  (`tailwind-merge` remplace les classes de base). Liens étirés inchangés (bannière : `outline` de l'`article` via
  `:has()` ; cartes d'auteurs : `ring` du `::after`), vérifiés dans le navigateur.
- **D-13.2-5** (focus conservé) : `/authors` (filtres, tri) et le profil (tri) visitent désormais avec
  `preserveState` comme le listing (D-12.1-7). Défaut trouvé par le test de la liste de tri : la page se remontait
  et le focus retombait sur `<body>` après chaque choix au clavier.
- **D-13.2-6** (liste de tri ouverte) : Radix `Select` masque le reste de la page (`aria-hidden`) et **garde le
  focus** dans sa liste tant qu'elle est ouverte (`Tab` sans effet, `Échap` rend le focus au déclencheur). axe signale
  `aria-hidden-focus` (les contrôles masqués restent focusables pour lui) : règle **désactivée pour ce seul état**, le
  test prouvant le piège volontaire (`Tab` reste dans la liste) et la sortie (`Échap`). Question PO 1.
- **D-13.2-7** (D33 amendé, 1.4.11) : la bordure `stone-300` (1,49:1 sur blanc, 1,37:1 sur `stone-100`) laissait les
  champs **non identifiables autrement** : la loupe de la barre (`stone-400`, 2,5:1), le placeholder (couleur par
  défaut ≈ 3,4:1) et la recherche de facette (aucune icône) n'atteignent pas 3:1. Champs publics (barre de recherche,
  recherche de facette, champ et listes de `/authors`, « Trier par ») : **bordure `stone-500` (4,8:1)**, placeholder
  et icônes `stone-500`. Les boutons gardent leur bordure (leur texte les identifie). Question PO 2 (rendu visuel).
- **D-13.2-8** (accroche du hero) : `green-700` sur le haut du dégradé (`stone-100`) = 4,6:1 (4,53:1 selon 13.1),
  petit texte → `green-800` (6,5:1).
- **D-13.2-9** (cibles ≥ 44 px) : résumés des groupes de filtres, lignes de filtre (liste portée à `max-h-80` pour
  garder ~7 lignes visibles), recherche de facette (`h-11`), bascule mobile « Filtres », « Effacer les filtres »,
  « Réinitialiser les filtres », pagination du listing (`size="touch"`), « Plein écran » du PDF, « Partager ».
  Liens du fil d'Ariane et du pied de page (texte courant) inchangés : 2.5.5 est de niveau AAA.
- **D-13.2-10** (logo) : nom accessible « Anta — Accueil » codé en dur → traduit (`Anta — Home` en EN : un libellé
  français dans une page anglaise enfreignait 3.1.2).
- **D-13.2-11** (tests navigateur) : seeding et aides extraits dans `tests/browser/helpers/public_fixtures.ts`
  (partagés par `a11y.spec.ts` et `keyboard.spec.ts`). Focus « visible » = `outline` ≥ 2 px, ou anneau
  (`box-shadow 0 0 0 ≥ 2px`, ni transparent ni le blanc du décalage) sur l'élément, son `::after` ou sa carte ; relevé
  avec une courte attente (transition `box-shadow` de shadcn). Les lecteurs intégrés (`iframe`, `video`, `audio`)
  dessinent leur focus dans l'interface du navigateur : comptés comme arrêts, anneau non mesuré. Le passage par
  `<body>` (après le dernier arrêt, ou après une visite Inertia qui retire l'élément focalisé) est toléré : le `Tab`
  suivant repart du début ; le piège est détecté par l'arrêt cible jamais atteint. Revue : contour ou anneau
  **transparent** refusé ; contour **rogné** par un ancêtre à défilement (`overflow` ≠ `visible`, étendue = décalage +
  épaisseur) → échec « outline clipped by … » (prouvé par mutation : `pr-1` remis sur la boîte des filtres).
- **D-13.2-12** (règles « best-practice » de structure, report de 13.1) : le balayage de chaque page lance aussi axe
  sur `region`, `landmark-*`, `page-has-heading-one`, `heading-order`, `empty-heading`, `skip-link`, `iframe`
  exclus (avec le disque factice, l'URL du PDF affiche une page Anta locale dans le cadre : artefact des données de
  test). Défaut trouvé : `<aside>` des métadonnées du détail imbriqué dans l'`<article>` →
  `landmark-complementary-is-top-level` ; remplacé par un conteneur simple (les compteurs et métadonnées font partie
  de la production). Exclusion du cadre : question PO 4.

## Résultats des contrôles

| Contrôle | Constat | Correctif |
|---|---|---|
| 3.1.1 `<html lang>` après bascule FR/EN | restait `fr` sans rechargement | D-13.2-2 |
| 3.1.2 contenus d'une autre langue | aucun attribut `lang` | D-13.2-1 |
| 3.1.2 nom du logo | « Anta — Accueil » en dur en EN | D-13.2-10 |
| Hiérarchie des titres | listing : cartes `h3` sous le `h2` « Filtres » | D-13.2-3 |
| Focus visible | champs : anneau à 20 % (≈ 1,3:1) ; shadcn : 3 px à 50 % (≈ 2:1) | D-13.2-4 |
| Focus perdu | `/authors`, profil : `<body>` après un filtre / tri | D-13.2-5 |
| 1.4.11 bordure des champs (D33) | 1,49:1, pas d'autre indice ≥ 3:1 | D-13.2-7 |
| 1.4.3 accroche du hero | 4,6:1 (limite) | D-13.2-8 |
| 1.4.3 tiret « — » (groupe sans option) | `stone-400` 2,5:1 | `stone-500` |
| Cibles ≥ 44 px | filtres, pagination du listing, plein écran, partage < 44 px | D-13.2-9 |
| Ordre de tabulation | conforme (titre puis auteurs, bannière et cartes) | — |
| Pièges au clavier | aucun (balayage complet des 10 pages × FR/EN jusqu'au dernier lien du pied de page, lecteurs compris) | — |
| Lien d'évitement | conforme (1er arrêt, visible, focus sur `main`) | — |
| Revue : contour rogné | boîte défilante des filtres : contour décalé coupé à droite | `p-1 scroll-p-1` |
| Revue : focus des options de liste | options Radix (tri, filtres `/authors`) : fond seul | contour 2 px `ring` (`OPTION_FOCUS`) |
| Revue : 1.4.11 case des filtres / chevron | `stone-300` 1,49:1 ; chevron `stone-400` 2,5:1 | `stone-500` |
| Landmarks (best-practice axe) | détail : `<aside>` imbriqué dans l'`<article>` | D-13.2-12 |
| axe sur états (panneau mobile ouvert, groupes dépliés, vue grille, ligne inerte « 20 auteurs », liste de tri ouverte, suggestions en chargement) | 0 violation, sauf `aria-hidden-focus` de la liste ouverte | D-13.2-6 |

Contrastes calculés (luminance relative WCAG, couleurs Tailwind) : `green-800`/`stone-100` 6,54:1 ;
`stone-500`/blanc 4,80:1 (bordures, placeholder, icônes) ; `stone-500`/`stone-50` 4,59:1 (sous-titre des blocs) ;
`stone-600`/`stone-50` 7,30:1 (pied de page) ; blanc/`green-700` 5,02:1 (boutons pleins) ; contour de focus
`green-700`/blanc 5,02:1, /`stone-50` 4,80:1. Aucun texte `stone-500` sur `stone-100` (4,40:1) dans les pages
publiques. Ligne inerte (`stone-400`) : composant désactivé, exempté du 1.4.3. Revue : bordure de la case non cochée des filtres
et chevron des groupes `stone-300` (1,49:1) / `stone-400` (2,5:1) → `stone-500` (4,80:1 sur blanc, 4,59:1 sur
`stone-50`) ; contour des options `green-700` 5,02:1.

Preuves d'échec : `languageChanged` retiré de `app.tsx` → « langue des contenus » échoue (FR, EN) ; `outline-none`
remis sur la barre de recherche → parcours 1 et 2 échouent (« no visible focus on <input> ») ; fichiers restaurés.

## Portes manuelles (non exécutées par l'agent)

- Audit NVDA (Windows) / VoiceOver (macOS), FR et EN, parcours 1 (dont filtre auteur, flux 5) et 2 (flux 1) :
  grille `_bmad-output/implementation-artifacts/13-2-grille-audit-lecteurs-ecran.md` (colonnes de résultat vides,
  constats, résiduels acceptés, rapport). Les bloquants relevés seront corrigés dans une passe dédiée.
- Contrôle visuel 375 / 1024 px des bordures de champs renforcées (D-13.2-7).

## Questions ouvertes

1. `[PO]` **Liste de tri ouverte** (D-13.2-6) : on accepte l'exclusion de la règle axe `aria-hidden-focus` pour l'état
   « liste Radix ouverte » (focus piégé volontairement, `Échap` en sort), ou on remplace les listes de tri publiques
   par un `<select>` natif (aucun piège, rendu différent) ?
2. `[PO]` **Bordure des champs** (D-13.2-7, amende D33) : bordure `stone-500` (4,8:1) sur les champs publics ; à
   valider visuellement (alternative : `stone-400` + autre indice ≥ 3:1, plus complexe).
3. `[PO]` **Filtres en « bouton bascule »** (D-13.1-6) : l'annonce « bouton bascule, enfoncé » des lignes de filtre
   est à confirmer à l'audit NVDA / VoiceOver (étape B6 de la grille) ; repli possible : cases à cocher natives.
4. `[PO]` **Cadre du lecteur exclu des règles de structure** (D-13.2-12) : on accepte d'exclure l'`iframe` des règles
   axe best-practice (landmarks, titres) — son contenu est un document tiers (lecteur PDF / vidéo), et avec le disque
   factice il affiche une page Anta locale — ou on exige un audit de structure du cadre réel en staging ?

## Review Findings

Revue de code du 2026-11-25 : 11 correctifs, 3 reports, 1 écarté, 1 question PO.

- [x] [Review][Patch] Suggestions « en chargement » relâchées avant la fin de l'audit [tests/browser/a11y.spec.ts] — réponse retenue jusqu'après l'audit (`try/finally` → `after`), minuteur d'abandon de 2 s repoussé pour cette page, `aria-busy` revérifié après l'audit ; prédicat sur le chemin `/productions/:slug/suggestions` (le glob retenait aussi le module Vite `lib/suggestions.ts`).
- [x] [Review][Patch] Contour de focus rogné par la boîte défilante des filtres [inertia/components/public/FilterSidebar.tsx] — `p-1 scroll-p-1` ; détection du rognage par les ancêtres à défilement dans `FOCUS_SCRIPT`, prouvée par mutation.
- [x] [Review][Patch] Contour / anneau transparent accepté [tests/browser/keyboard.spec.ts] — refusé (couleur `transparent` ou alpha 0).
- [x] [Review][Patch] Options de liste sans indicateur de focus visible [inertia/components/shared/SortSelect.tsx, AuthorFilters.tsx] — `OPTION_FOCUS` (contour 2 px `ring`, `outline-solid` requis car `outline-hidden` annule le style) ; vérifié dans le test de la liste de tri.
- [x] [Review][Patch] Case non cochée `stone-300` et chevron `stone-400` < 3:1 [FilterSidebar.tsx] — `stone-500` ; ajoutés au tableau des contrastes.
- [x] [Review][Patch] Compteur de résultats non vérifié exactement — parcours 1 compare au `results_count` traduit (compte 1).
- [x] [Review][Patch] Boucle d'ouverture des `details` non bornée — plafond de 20 itérations.
- [x] [Review][Patch] Parcours 2 incomplet — étape « Voir plus » des blocs de l'accueil, et arrêt « Télécharger » atteint, visible, ≥ 44 px.
- [x] [Review][Patch] Grille C8 contredisait `SuggestionsGrid` — le statut masqué « Chargement des productions similaires… » peut être lu pendant le chargement, puis une annonce polie unique.
- [x] [Review][Patch] `content_lang` émettait des codes inconnus — liste blanche `Intl.DisplayNames` ; test unitaire (`xx`, `qq`, `zz-US`, `fr-ZZ`, `wo`).
- [x] [Review][Patch] Valeur « Langue » du détail sans `lang` [inertia/pages/production.tsx] — `MetaRow` → `<dd lang>`.
- [ ] [Review][PO] Exclusion de l'`iframe` des règles de structure (D-13.2-12) — question PO 4.
- [ ] [Review][Defer] `admin_layout.edge` : `lang="fr"` codé en dur (administration hors périmètre).
- [ ] [Review][Defer] Fonctionnement réel des lecteurs vidéo / audio / PDF prouvé seulement par la grille manuelle.
- [ ] [Review][Defer] Texte de D33 dans `DESIGN.md` à mettre à jour une fois la bordure `stone-500` acceptée (question PO 2).
- [x] [Review][Dismiss] `h2` des `AuthorCard` sur `/authors` — D-12.3-5, aucun saut de niveau (mentionné dans D-13.2-3).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- 1er passage de `keyboard.spec.ts` : faux négatifs « no visible focus » — le premier `0 0 0 0px` transparent de la
  pile `box-shadow` de Tailwind était lu au lieu de l'anneau → analyse de chaque ombre (D-13.2-11).
- Liste de tri : choix au clavier parfois ignoré quand la flèche était pressée avant que Radix ne refocalise
  l'option sélectionnée (positionnement en deux temps) → attente de l'option sélectionnée focalisée + 300 ms ; le
  même test a révélé le focus perdu après le choix (D-13.2-5).
- Balayage : `politique de confidentialité` sans contrôle dans `main` → l'arrêt après le lien d'évitement peut être
  dans le pied de page (jamais dans l'en-tête).
- Suite complète (1er passage) : `suggestions.spec.ts` attendait les clés de carte sans `language` (corrigé) ; une
  fois « politique de confidentialité (en) » d'`a11y.spec.ts` a échoué sur « Execution context was destroyed »
  pendant qu'un fichier du dépôt était modifié (rechargement Vite) ; non reproduit ensuite (suite `browser` relancée :
  40/40).
- Mutations : `languageChanged` retiré → « langue des contenus » échoue ; `outline-none` remis sur la barre de
  recherche → parcours 1 et 2 échouent ; fichiers restaurés (et le contrôle de l'arrêt suivant le lien d'évitement a
  été ajouté au balayage, qui ne mesurait pas ce premier arrêt).
- Suite complète finale `npm run test:local` : **1525 tests verts** (baseline 1477 ; `browser` 40 dont 20 nouveaux),
  code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration, rien
  contre Supabase ni R2.
- Revue : 1er passage complet → « suggestions en cours de chargement (fr) » échoue (section retirée : le minuteur
  d'abandon de 2 s du client a expiré pendant l'audit, machine chargée) → ce minuteur est repoussé pour la seule page
  de cet état (`addInitScript`) ; suite `browser` verte sous charge CPU forcée (40/40). Suite complète finale
  **1530 tests verts**, code 0 ; `lint` 0 ; `typecheck` 0 ; build 0.

### Completion Notes List

- Langue des contenus : helper pur `inertia/lib/content_lang.ts` (`languageTag`, `contentLang`, `documentLang`),
  `language` sérialisé (cartes, bannière), `lang` posé (cartes, bannière, détail), `<html lang>` synchronisé côté
  client.
- Structure, focus, cibles, contrastes : D-13.2-3 à D-13.2-10, D-13.2-12 ; focus conservé après filtre / tri sur
  `/authors` et le profil.
- Suite `browser` : 40 tests (13.1 : 20 pages ; états : 10 ; clavier : 10) — balayage Tab de 10 pages × FR/EN
  (focus visible à chaque arrêt, aucun piège, lien d'évitement, titres, landmarks, règles best-practice axe),
  `lang`, liste de tri au clavier, parcours 1 et 2 automatisés ; seeding partagé (`helpers/public_fixtures.ts`).
- Tests unitaires : `content_lang_behavior.spec.ts` (11), `keyboard_screen_reader.spec.ts` (source : `lang`,
  titres, landmarks, focus, cibles, contrastes, `preserveState`) ; clés de carte mises à jour (transformer,
  profil, suggestions, bannière).
- Grille d'audit manuel : `13-2-grille-audit-lecteurs-ecran.md` (NVDA / VoiceOver × FR / EN, contrôles
  transverses, parcours 1 et 2, constats, résiduels, rapport) — porte manuelle du PO.
- Aucune migration, aucune dépendance ; rien contre Supabase ni R2. 4 questions PO (dont 1 de la revue).

### File List

- `inertia/lib/content_lang.ts` (nouveau)
- `inertia/app.tsx` (modifié)
- `inertia/components/public/ProductionCard.tsx` (modifié)
- `inertia/components/public/FeaturedBanner.tsx` (modifié)
- `inertia/components/shared/FeaturedBanner.tsx` (modifié)
- `inertia/components/public/FilterSidebar.tsx` (modifié)
- `inertia/components/public/SearchBar.tsx` (modifié)
- `inertia/components/public/AuthorFilters.tsx` (modifié)
- `inertia/components/public/PdfViewer.tsx` (modifié)
- `inertia/components/public/ShareButton.tsx` (modifié)
- `inertia/components/shared/SortSelect.tsx` (modifié)
- `inertia/layouts/PublicLayout.tsx` (modifié)
- `inertia/pages/home.tsx` (modifié)
- `inertia/pages/production.tsx` (modifié)
- `inertia/pages/productions.tsx` (modifié)
- `inertia/pages/authors.tsx` (modifié)
- `inertia/pages/author.tsx` (modifié)
- `inertia/locales/public/fr.json`, `inertia/locales/public/en.json` (modifiés : `productions.results_heading`)
- `app/transformers/production_card_transformer.ts` (modifié)
- `app/services/featured_service.ts` (modifié)
- `tests/browser/helpers/public_fixtures.ts` (nouveau)
- `tests/browser/keyboard.spec.ts` (nouveau)
- `tests/browser/a11y.spec.ts` (modifié : aides partagées, groupe « états »)
- `tests/unit/lib/content_lang_behavior.spec.ts` (nouveau)
- `tests/unit/components/keyboard_screen_reader.spec.ts` (nouveau)
- `tests/unit/transformers/production_card_transformer.spec.ts` (modifié)
- `tests/functional/public/home.spec.ts`, `author_profile.spec.ts`, `suggestions.spec.ts` (modifiés : `language`)
- `tests/unit/components/suggestions_grid.spec.ts` (modifié : colonne des métadonnées sans `aside`)
- `_bmad-output/implementation-artifacts/13-2-grille-audit-lecteurs-ecran.md` (nouveau)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié)
- `_bmad-output/implementation-artifacts/13-2-parcours-1-et-2-au-clavier-et-au-lecteur-d-ecran.md` (nouveau)

## Change Log

- 2026-11-25 : création (bmad-create-story) ; statut ready-for-dev.
- 2026-11-25 : implémentation (bmad-dev-story) : `lang` des contenus et `<html lang>`, titres du listing,
  focus 2 px des champs, focus conservé sur `/authors` et le profil, bordures de champs ≥ 3:1 (D33 amendé),
  accroche du hero, cibles ≥ 44 px, `<aside>` du détail ; suite `browser` étendue (états, clavier, parcours 1 et 2) ;
  grille d'audit NVDA / VoiceOver ; statut review.
- 2026-11-25 : revue de code : 11 correctifs (focus rogné / transparent, focus des options, contrastes case et
  chevron, liste blanche de langues, `lang` de la métadonnée, suggestions retenues tout l'audit, parcours 2 complet,
  grille C8…), 3 reports, question PO 4 ; statut review.
- 2026-11-25 : revue de code vérifiée par l'orchestrateur, 11 correctifs appliqués ; 1530 tests verts ; statut done (audit NVDA/VoiceOver = porte manuelle du PO).
