---
baseline_commit: 54129ff
---

# Story 13.4 : Tests et recette accessibilité Phase 2

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que développeur,
Je veux une recette d'accessibilité et de performance consolidée pour la Phase 2,
Afin de livrer la Phase 2 avec la preuve du respect des NFR (NFR16 à NFR20).

## Décision de périmètre (lire en premier)

- Dernière story de l'Epic 13 et de la Phase 2. **Combler les trous seulement** : 13.1 (axe, 20 tests navigateur),
  13.2 (états, clavier, `lang`, structure, 20 tests navigateur + specs de source) et les stories 9.x à 12.x couvrent
  déjà l'essentiel des scénarios de l'AC 1. Commencer par l'**inventaire** (tableau « Inventaire » ci-dessous), puis
  n'ajouter que ce qui manque.
- Site public seulement pour WCAG (NFR16) ; les `aria-describedby` des actions indisponibles cités par l'AC sont
  surtout dans l'admin (suppression d'une fiche, consentement, enregistrement de la une) : déjà testés, simplement
  rattachés à la recette.
- Les mesures distantes (Lighthouse, test de charge sur le staging, audit NVDA / VoiceOver, commandes sur la base
  partagée) sont des **portes manuelles du PO**, documentées dans `recette-phase-2.md`, jamais exécutées par l'agent.

## Acceptance Criteria

1. **Specs unitaires** — **Given** les specs de composants (`tests/unit/components/*.spec.ts`, lecture de source) et
   `tests/unit/i18n/translations.spec.ts`, **When** `npm run test:local -- unit` est exécuté, **Then** passent :
   attributs ARIA des composants Phase 2 (`aria-busy`, `aria-live`, `aria-current`, `aria-label` de la bannière,
   `aria-describedby` des actions indisponibles) ; `alt=""` des images adjacentes à un texte, `alt="Photo de {Prénom
   NOM}"` du profil ; aucun lien imbriqué dans les cartes ; toutes les clés Phase 2 présentes en FR et en EN
   (contrôle **générique** : toute clé utilisée par une source existe dans les deux langues).
2. **Suite `browser`** — **Given** la suite `browser`, **When** elle est exécutée en CI, **Then** 0 violation A/AA sur
   toutes les pages couvertes, dans les deux langues (déjà livré en 13.1 / 13.2 : vérifier qu'il ne manque rien) ;
   **And** aucun lien ni contrôle imbriqué dans un lien ou un bouton, et les contrôles des cartes à lien étiré restent
   cliquables, sur toutes les pages auditées.
3. **Recette consolidée** — `_bmad-output/implementation-artifacts/recette-phase-2.md` : tableau des NFR (NFR16 a11y,
   NFR17 LCP, NFR18 suggestions, NFR19 images, NFR20 charge — définition PO 2026-11-25 : 50 visiteurs **avec** temps
   de réflexion), preuves automatisées (fichiers, nombres de tests), portes manuelles avec étapes exactes et colonnes
   de résultat vides : Lighthouse mobile 4G sur le staging (accueil, `/authors`, un profil, un détail : LCP < 3 s et
   score Accessibilité consigné), grille NVDA / VoiceOver de 13.2 validée par Aurélien, test de charge staging, portes
   post-merge (migrations, conversion des auteurs 9.6 / 9.7, extraction des images 11.3, `ROBOTS_DISALLOW_ALL` sur le
   staging, soumission du sitemap) ; liste unique des questions `[PO]` ouvertes (Epic 13 et restes des Epics 9–12).
4. `npm run test:local` (toutes les suites), lint, typecheck et build passent.

## Tasks / Subtasks

- [x] T1 Inventaire de la couverture existante (AC 1, 2) — tableau ci-dessous.
- [x] T2 Correctif : ligne inerte du filtre auteur reliée au texte d'aide (`aria-describedby`) (AC 1)
- [x] T3 `tests/unit/components/phase2_a11y.spec.ts` (AC 1) : actions indisponibles publiques, pagination, règle
  générique des textes alternatifs, règle générique « aucun lien imbriqué » sur les sources publiques.
- [x] T4 `tests/unit/i18n/translations.spec.ts` (AC 1) : clés utilisées par toutes les sources publiques et admin en
  FR et EN (littérales, clés passées en données / props ; gabarits par motif), contrôle du détecteur.
- [x] T5 `tests/browser/a11y.spec.ts` (AC 2) : structure interactive (contrôles imbriqués, test de pointage des cartes
  à lien étiré, garde de couverture), ligne inerte décrite.
- [x] T6 `recette-phase-2.md` (AC 3).
- [x] T7 Suite complète, lint, typecheck, build (AC 4).

## Dev Notes

### Inventaire (état au HEAD `54129ff`)

| Scénario de l'AC 1 | Déjà couvert par | Trou → 13.4 |
|---|---|---|
| `aria-busy` | `suggestions_grid.spec.ts` (conteneur, squelettes `aria-hidden`) | — |
| `aria-live` | `suggestions_grid.spec.ts`, `filter_sidebar.spec.ts` (listing), `authors_list.spec.ts` | — |
| `aria-current` | fil d'Ariane (`keyboard_screen_reader`, `author_profile`), `language_switcher` | **pagination partagée** non testée |
| bannière nommée | `home_featured_banner.spec.ts` (`section aria-labelledby` vers un `h2` masqué) | — |
| `aria-describedby` des actions indisponibles | admin : `authors_index_page`, `author_form`, `featured_page` | **public** : ligne inerte « 20 auteurs » sans `aria-describedby` (défaut de code) |
| `alt=""` adjacent | bannière, `AuthorCard`, `Avatar`, emplacements « À la une » (specs dédiées) | **règle générique** (toute nouvelle image) ; combobox et sélecteur admin non vérifiés |
| photo du profil | `author_profile.spec.ts` | — (repris dans la règle générique) |
| aucun lien imbriqué | `author_byline`, `home_featured_banner`, `authors_list` (par composant) | **règle générique** source + **navigateur** (axe `nested-interactive` ignore les liens) |
| clés FR / EN | parité (`translations`), Epic 10 (`public_authors_keys`), Epic 11 (`featured_keys`) | Epic 12 / 13 et toute source future : **contrôle générique d'usage** |
| Suite `browser` en CI | `ci.yml` : Chromium + `node ace test browser`, sans `continue-on-error` (`deployment.spec.ts`) ; 10 pages × FR / EN | rien (vérifié) |

### Garde-fous

- Wrappers atlas (`/tmp/d37/run.sh`, `build.sh`) ; jamais Doppler / Supabase / R2 / Resend ; jamais deux `test:local`
  en parallèle. Aucune migration, aucune dépendance nouvelle.
- Composants testés par lecture de source (TS6305) ; scripts navigateur passés en chaîne (`lib` serveur sans DOM).
- Dépôt public : `<URL du staging>` dans les documents, aucun hôte, aucun nom réel.

### Références

- `_bmad-output/planning-artifacts/epics.md` — Story 13.4 ; NFR16–NFR20 (l.188–192), carte de couverture (l.319).
- `ux-designs/ux-anta-2026-11-16/EXPERIENCE.md` — Accessibility Floor (structure, textes alternatifs, suggestions).
- Stories 13.1, 13.2 (décisions, revues, questions), 13.3 (`ROBOTS_DISALLOW_ALL`, soumission), 12.5 (charge,
  Lighthouse), 9.5 / 9.6 / 9.7 (conversion), 11.3 (extraction) ; `deferred-work.md`.

## Décisions (D-13.4-n)

- **D-13.4-1** (ligne inerte) : la ligne non cochée inerte (limite de 20 auteurs) porte
  `aria-describedby="author-filter-limit"`, comme le champ de recherche de facette : en mode lecture, le lecteur d'écran
  annonce pourquoi elle est indisponible (règle « actions indisponibles expliquées », EXPERIENCE.md). Identifiant
  factorisé (`AUTHOR_LIMIT_ID`) ; le texte référencé est rendu dans la même branche que les lignes inertes.
- **D-13.4-2** (clés i18n) : contrôle **générique** dans `translations.spec.ts` plutôt qu'une nouvelle liste par epic :
  toute clé littérale `t('a.b')` de toute source du bundle public (`app.tsx`, `PublicLayout`, pages publiques,
  `errors/`, `components/public`, `components/shared`) et du bundle admin (layouts admin, `pages/admin`, `pages/auth`,
  `components/admin`, plus les composants partagés importés par l'admin — lus depuis les imports — et la 404) existe
  en FR et en EN, de même que les clés passées en données / props (`labelKey: 'nav.x'`, `saveLabelKey="a.b"`…) ; une
  clé gabarit `t(`a.${x}.b`)` est convertie en motif (`${…}` → un segment `[^.]+`, formes plurielles admises) qui
  doit correspondre à au moins une clé dans chaque langue (revue : d'abord seul le préfixe était contrôlé). Hors de
  portée d'une lecture de source : `t(variable)`, gabarits commençant par un placeholder (`${key}_slot`) et clés
  envoyées par le serveur (flash : `featured_keys.spec.ts` pour l'Epic 11). Gardes de couverture (≥ 100 clés publiques,
  ≥ 200 admin, nombre minimal de fichiers, `Avatar` / `FeaturedBanner` / `Pagination` parmi les partagés de l'admin). Prouvé par mutation (`productions.results_heading` retirée
  des deux langues → échec nommant la clé et le fichier ; la parité seule ne le voyait pas).
- **D-13.4-3** (liens imbriqués, source) : chaque contenu `<Link>…</Link>` / `<a>…</a>` des sources publiques (hors
  commentaires) ne contient ni lien, ni bouton, ni champ, ni `AuthorByline`, ni `Pagination` ; un seul lien étiré
  (`after:inset-0`) par carte (bannière, `AuthorCard`). Contrôle du détecteur inclus.
- **D-13.4-4** (structure interactive, navigateur) : axe `nested-interactive` ne traite pas les liens ; après l'audit de
  chaque page et largeur, un script vérifie (a) aucun contrôle (`a[href]`, bouton, champ, `summary`, `iframe`,
  lecteurs, `[role=button|link]`, `tabindex ≥ 0`) dans un lien ou un bouton, (b) sur chaque carte à lien étiré
  (`::after` en `position: absolute`), chaque autre contrôle est atteint par un pointage en son centre
  (`elementFromPoint`, après `scrollIntoView`) — un nom d'auteur recouvert par le calque serait inaccessible à la
  souris et au toucher. Garde sur l'accueil : ≥ 3 cartes étirées et ≥ 1 contrôle réellement pointé (les auteurs
  de la bannière) ; les cartes d'auteurs (`/authors`, bloc de l'accueil) n'ont qu'un lien, rien à y pointer (seul le
  contrôle (a) s'y applique). États : contrôle (a) sur tout le document dans **chaque** état, test de pointage omis
  (une liste ou un panneau ouvert recouvre légitimement les cartes). Prouvé par mutation : `relative z-10` retiré de la
  byline de la bannière → « control covered by the stretched link » ; bouton ajouté dans le lien d'`AuthorCard` →
  « nested control » (fichiers restaurés).
- **D-13.4-5** (NFR19) : ajouté au tableau des NFR de la recette (preuve automatisée des stories 9.3 / 11.1), bien que
  l'AC ne le cite pas, pour que la recette couvre NFR16–NFR20 sans trou.
- **D-13.4-6** (Lighthouse) : les portes Lighthouse des stories 10.8, 11.7 et 12.5 sont regroupées dans la recette
  (4 pages, 3 passages, médiane du LCP) ; un score Accessibilité < 100 est consigné et ouvert en question, pas un échec
  automatique (question PO 1).

## Portes manuelles (non exécutées par l'agent)

Toutes dans `recette-phase-2.md` § 3 : Lighthouse mobile 4G (4 pages), audit NVDA / VoiceOver (grille 13.2) et
contrôle visuel 375 / 1024 px, test de charge staging (accord d'Aurélien), portes de mise en service (migrations,
conversion des auteurs 9.5–9.7, extraction des images 11.3, `ROBOTS_DISALLOW_ALL`, premier passage CI), soumission du
sitemap après la mise en production.

## Questions ouvertes

1. `[PO]` **Score Accessibilité Lighthouse** : exige-t-on 100 sur les 4 pages, ou seulement 0 violation A/AA axe (déjà
   tenue en CI) avec consignation du score Lighthouse ? Recommandation : la seconde (Lighthouse n'exécute qu'un
   sous-ensemble d'axe).
2. Toutes les autres questions ouvertes (Epic 13 et restes des Epics 9–12) sont regroupées dans `recette-phase-2.md`
   § 4 ; la seule bloquante pour la mise en production est le texte de confidentialité des auteurs (10.1 Q1).

## Review Findings

Revue de code du 2026-11-25 (vérifiée par l'orchestrateur) : 7 correctifs, 3 reports, 3 écartés.

- [x] [Review][Patch] Gabarits i18n contrôlés par leur seul préfixe (`privacy.${s}.heading` → `privacy.`) [tests/unit/i18n/translations.spec.ts] — gabarit converti en motif ancré (`${…}` → `[^.]+`, formes plurielles admises), ≥ 1 clé correspondante par langue ; test unitaire du convertisseur (suffixe, segment unique, points littéraux).
- [x] [Review][Patch] Composants partagés rendus par l'admin absents d'`ADMIN_SOURCES` — composants partagés importés par les sources admin, lus depuis les imports (`Avatar`, `FeaturedBanner`, `Pagination`, garde), et 404 ; `SortSelect` (public seulement) n'y entre pas.
- [x] [Review][Patch] Clés passées en données / props non lues (`labelKey: 'nav.x'`, `saveLabelKey="…"`) — motif `\w*Key\s*[:=]\s*\{?'ns.key'` ajouté ; limites restantes (`t(variable)`, gabarits sans préfixe, clés envoyées par le serveur) écrites dans D-13.4-2 et la recette.
- [x] [Review][Patch] Test de pointage sans preuve de couverture, garde `/authors` trompeuse [tests/browser/a11y.spec.ts] — le script renvoie le nombre de contrôles réellement pointés ; garde sur l'accueil (3 cartes étirées, ≥ 1 contrôle pointé) ; `/authors` retiré de la garde (cartes à lien unique), commentaire ajusté.
- [x] [Review][Patch] États avec `include` sans contrôle des contrôles imbriqués — contrôle (a) dans chaque état, sur tout le document ; seul le pointage est omis (`structureScript(false)`).
- [x] [Review][Patch] Spec de recette incomplète [tests/unit/components/phase2_a11y.spec.ts] — `tabIndex` des bornes de la pagination vérifié ; test renommé (« un seul lien étiré par composant ») ; garde de nombre minimal de fichiers dans `sourcesUnder`.
- [x] [Review][Patch] Recette : migrations appliquées par le conteneur au démarrage (`migration:run --force`) → avertissement « ne rien pousser sur `staging` avant la conversion validée » (§ 3, porte 1) ; contrôles visuels 375 / 1024 px de 12.1–12.4 ajoutés au § 3.2 ; ligne « tests fonctionnels d'Aurélien des Epics 9–12 » au § 5 ; bannière décrite par `aria-labelledby` + `h2` masqué (story et recette) ; questions 9.3 Q3 / Q4, 9.4 Q3, 9.5 Q3, 9.7 Q3 (toujours ouvertes dans leurs stories) ajoutées au § 4.
- [ ] [Review][Defer] Liste fermée `INTERACTIVE` de la règle source — le contrôle navigateur couvre le reste (deferred-work.md).
- [ ] [Review][Defer] `sourcesUnder` non récursif au-delà de la garde (deferred-work.md).
- [ ] [Review][Defer] Liens de pagination désactivés gardant leur `href` (deferred-work.md).
- [x] [Review][Dismiss] `openingTags` et un `>` dans un attribut — aucun cas dans les fichiers lus.
- [x] [Review][Dismiss] Prénom réel dans les documents — déjà présent dans 36 fichiers commités (PO du projet).
- [x] [Review][Dismiss] `aria-describedby` de la ligne inerte — vérifié correct (id rendu dans la même branche).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Contrôle i18n : 1er passage, garde « ≥ 150 clés publiques » trop haute (125 trouvées) → 100.
- Règle « aucun lien imbriqué » : faux positifs sur des commentaires citant `<a>` (`MediaViewer`, `not_found`) →
  commentaires retirés avant l'analyse.
- Mutations (fichiers restaurés) : clé retirée des deux locales → échec i18n ; `aria-describedby` retiré de la ligne
  inerte → échec unitaire ; byline sans `relative z-10` et bouton dans le lien d'`AuthorCard` → échecs navigateur.
- `a11y.spec.ts` seul : 30 / 30 verts (2 min 27 s).
- Suite complète `npm run test:local` : **1597 tests verts** (unit 940, functional 617, browser 40 ; baseline 1548,
  +49 unitaires : 44 `phase2_a11y`, 5 `translations`), code 0, ~7 min. `npm run lint` : 0. `npm run typecheck` : 0.
  Build (`/tmp/d37/build.sh`) : 0. Aucune migration, rien contre Supabase ni R2.

### Completion Notes List

- Inventaire : la plupart des scénarios de l'AC 1 étaient déjà couverts ; trous comblés sans dupliquer.
- Correctif d'accessibilité : ligne inerte du filtre auteur décrite par le texte d'aide (D-13.4-1).
- Tests : `phase2_a11y.spec.ts` (nouveau), contrôle générique des clés FR / EN (`translations.spec.ts`), structure
  interactive dans la suite `browser` (`a11y.spec.ts`).
- CI : suite `browser` déjà bloquante (13.1), vérifiée, rien à changer.
- Recette consolidée `recette-phase-2.md` : NFR16–NFR20, preuves, portes manuelles (colonnes vides), questions PO.

### File List

- `inertia/components/public/FilterSidebar.tsx` (modifié)
- `tests/unit/components/phase2_a11y.spec.ts` (nouveau)
- `tests/unit/i18n/translations.spec.ts` (modifié)
- `tests/browser/a11y.spec.ts` (modifié)
- `_bmad-output/implementation-artifacts/recette-phase-2.md` (nouveau)
- `_bmad-output/implementation-artifacts/13-4-tests-et-recette-accessibilite-phase-2.md` (nouveau)

## Change Log

- 2026-11-25 : création (bmad-create-story) ; statut ready-for-dev.
- 2026-11-25 : implémentation (bmad-dev-story) : inventaire, ligne inerte décrite, specs de recette (ARIA, textes
  alternatifs, liens imbriqués, clés FR / EN génériques), structure interactive dans la suite `browser`, recette
  Phase 2 ; 1597 tests verts, lint, typecheck, build ; statut review.
- 2026-11-25 : revue de code vérifiée par l'orchestrateur — 7 correctifs (gabarits i18n par motif, partagés de
  l'admin, clés en données / props, couverture du pointage, contrôle imbriqué dans chaque état, pagination et gardes,
  recette : migrations au démarrage du conteneur, contrôles visuels 12.x, tests fonctionnels d'Aurélien, questions
  9.x), 3 reports, 3 écartés ; **1599 tests verts** (unit 942, functional 617, browser 40), lint 0, typecheck 0,
  build 0 ; statut done.
