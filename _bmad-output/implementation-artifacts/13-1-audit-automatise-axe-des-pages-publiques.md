---
baseline_commit: 3cdfb94
---

# Story 13.1 : Audit automatisé axe des pages publiques

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur en situation de handicap,
Je veux que les pages publiques ne présentent aucune violation WCAG 2.1 A/AA détectable automatiquement,
Afin d'utiliser Anta avec mes technologies d'assistance (NFR16, P2-16).

## Décision de périmètre (lire en premier)

- **Site public seulement** (le panel d'administration est hors périmètre WCAG, NFR16).
- La décision PO « pas de suite `browser` ni d'axe » (2026-11-21, `deferred-work.md`) visait l'Epic 10 / 11.7 / 12.5 ;
  l'Epic 13 introduit **explicitement** la suite Japa `browser` et `@axe-core/playwright` (P2.8, P2-16).
- 13.1 = audit **automatisé** (axe) + correction des violations détectées. Le parcours clavier automatisé, l'attribut
  `lang` des contenus (3.1.2), la hiérarchie des titres et la grille d'audit manuel NVDA / VoiceOver relèvent de 13.2 ;
  la recette consolidée (specs de composants, Lighthouse) de 13.4. Rien de distant n'est exécuté par l'agent.

## Acceptance Criteria

1. **Given** la suite Japa `browser` (déclarée dans `adonisrc.ts`, `browserClient({ runInSuites: ['browser'] })`
   dans `tests/bootstrap.ts`) et `@axe-core/playwright` en devDependency, **When** `npm run test:local -- browser`
   est exécuté sur des données de test créées par la suite (bannière à 3 productions, blocs remplis, auteurs
   visibles), **Then** axe (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) est lancé sur : l'accueil, le listing
   avec filtres actifs, la page de détail (variantes PDF, EPUB, vidéo, audio, avec suggestions), la liste des auteurs,
   un profil, la politique de confidentialité et la page 404, en FR **et** en EN (cookie `i18n_lang`) ;
   **And** chaque page présente 0 violation A/AA.
2. **Given** des violations détectées lors de la mise en place, **When** la story est terminée, **Then** elles sont
   toutes corrigées dans le code (noms accessibles, contrastes, landmarks, identifiants dupliqués, rôles ARIA) ;
   toute règle ou tout élément exclu est justifié par écrit ici et posé en question `[PO]`.
3. **Given** `.github/workflows/ci.yml`, **When** une PR vers `development` ou `staging` est ouverte, **Then** la
   suite `browser` s'exécute (installation de Chromium Playwright) et bloque le merge en cas de violation (pas de
   `continue-on-error`).
4. `npm run test:local` (sans argument) exécute toujours toutes les suites (unit, functional, browser) ;
   `npm run test:local -- browser` fonctionne seul.

## Tasks / Subtasks

- [x] T1 Dépendances (AC 1) : `@axe-core/playwright` et `playwright` épinglés (exacts, compatibles avec
  `playwright-core` 1.59.x déjà présent via `@japa/browser-client`) ; Chromium installé en local par
  `npx playwright install chromium` (utilisateur atlas, sans `--with-deps`).
- [x] T2 `tests/browser/a11y.spec.ts` (AC 1, 4)
  - [x] Données dans une transaction globale (le serveur HTTP tourne dans le même processus → il lit la
    transaction ; à vérifier empiriquement) ; `drive.fake('r2')` ; rollback à la fin.
  - [x] Une entrée par page × langue (20 tests) ; cookie `i18n_lang` posé tel quel (`addCookies`, pas le
    `setCookie` décoré d'Adonis qui chiffre) ; `<html lang>` vérifié.
  - [x] Navigateur confiné au serveur local (Google Fonts, URL signées… → `route.abort()`).
  - [x] Garde de couverture : la page contient bien les éléments audités (bannière à 3 cartes, 4 blocs, résultats,
    cartes d'auteurs, photo du profil, suggestions chargées), sinon l'audit rétrécirait en silence.
  - [x] Message d'échec lisible (règle, impact, cibles).
- [x] T3 Corriger chaque violation dans le code (AC 2), avec un test de source quand le correctif est vérifiable
  par lecture.
- [x] T4 CI (AC 3) : étapes « Install Playwright Chromium » (`npx playwright install --with-deps chromium`) puis
  `node ace test browser`, sans `continue-on-error` ; test d'infrastructure.
- [x] T5 Suite complète, lint, typecheck, build.

## Dev Notes

### Contexte technique (état au HEAD `3cdfb94`)

- **Suite `browser`** : `adonisrc.ts` → `tests/browser/**/*.spec.{ts,js}`, timeout 300 s. `tests/bootstrap.ts` :
  `browserClient({ runInSuites: ['browser'] })`, `sessionBrowserClient`, `authBrowserClient` ; `configureSuite`
  démarre le serveur HTTP (`testUtils.httpServer().start()`) et vide le cache des classements avant chaque test
  pour `browser` comme pour `functional` (D-12.2-8). Le contexte navigateur a `baseURL = http://HOST:PORT`
  (`localhost:3333`, `scripts/test-local.sh`).
- **Assets** : en environnement `test`, `@adonisjs/vite` démarre le serveur Vite en mode middleware (aucun build
  requis) ; la première visite transforme les modules (quelques secondes).
- **Pages** (`start/routes.ts`) : `/`, `/productions`, `/productions/:slug`, `/authors`, `/authors/:slug`,
  `/privacy-policy` ; 404 = `errors/not_found` rendu par `app/exceptions/handler.ts` (statut 404, meta traduits
  depuis `i18n_lang`). Layout public `inertia/layouts/PublicLayout.tsx` (lien d'évitement, `header` / `main` /
  `footer`). `ssr: false` : le `<html lang>` et les meta viennent de `resources/views/inertia_layout.edge`
  (`page.props.meta.locale`).
- **Langue** : `SeoService.localeFromCookieHeader` (serveur) et i18next (`inertia/lib/i18n/shared.ts`, ordre
  cookie → localStorage → navigateur) lisent le cookie brut `i18n_lang=fr|en`.
- **Médias du détail** (`MediaViewer`, `PdfViewer`) : PDF → `iframe` titré ; MP4 → `<video controls>` (poster
  éventuel) ; MP3/AAC → `<audio controls>` ; EPUB → bouton « Ouvrir le document ». URL signées par
  `FileStorageService.signedUrl` (fausses avec `drive.fake('r2')`).
- **Suggestions** (`SuggestionsGrid`) : chargées après le rendu (fetch, abandon à 2 s), conteneur `aria-busy`
  pendant le chargement → attendre la fin avant l'audit ; candidates = productions partageant auteur / tag /
  sous-domaine / domaine.
- **Bannière** : `featured_productions` (3 emplacements) ; vignette requise (D37), variantes `w400/w800/w1600.webp`
  servies par `/media/thumbnails/<id>/<token20>/…` (`MediaService`) ; photos d'auteurs `w128/w384.webp`.
- **Visibilité d'un auteur** = `Author.visibleOnSite` (consentement + ≥ 1 production publiée).

### Garde-fous

- Wrappers atlas (`/tmp/d37/run.sh`, `build.sh`, `gen.sh`) ; jamais Doppler, jamais Supabase / R2 / Resend ; jamais
  deux `test:local` en parallèle (port 3333 et base `anta_test` partagés).
- Aucune migration. Seules dépendances permises : `@axe-core/playwright` et `playwright` (devDependencies).
- Composants testés par lecture de source (frontière TS6305) ; données fictives ; aucun hôte ni IP dans le dépôt.
- Corriger plutôt qu'exclure : aucune règle axe désactivée sans justification écrite et question PO.

### Plancher d'accessibilité (UX `EXPERIENCE.md` → Accessibility Floor, D33, D36)

- Un seul `h1`, blocs en `h2`, cartes en `h3` ; bannière = région nommée par un `h2` masqué ; landmarks
  `header` / `main` / `footer` ; lien d'évitement conservé.
- Compteurs : icônes `aria-hidden` + libellé complet (« 1 234 vues »).
- Alternatives : vignette / photo adjacente au texte → `alt=""` ; photo du profil → `alt="Photo de {Prénom NOM}"`.
- Contrastes ≥ 4,5:1 (texte), ≥ 3:1 (texte large, composants) ; bordure d'input conservée (D33, à recontrôler en 13.2).

### Références

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, Story 13.1 ; NFR16.
- `_bmad-output/planning-artifacts/architecture.md` — P2.8 « Stratégie de test » (Accessibilité), P2-16.
- `_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/EXPERIENCE.md` — Accessibility Floor ; `DESIGN.md` (D33).
- `deferred-work.md` (refus du 2026-11-21 limité aux Epics 10–12) ; stories `10-8`, `11-7`, `12-5`.

### Intelligence des stories précédentes

- 12.5 : transaction globale par groupe, cache des classements vidé par `tests/bootstrap.ts` ; tests sensibles à
  l'horloge à éviter ; deux `test:local` simultanés = échecs parasites.
- 11.7 / 12.4 : bannière et suggestions sont des cartes texte (D37) hors bannière ; liens étirés (`after:inset-0`),
  pas de lien imbriqué.
- 10.6 : filtres du listing rendus comme **liens** (l'URL est la source de vérité), Espace simple bascule
  (`spaceToggle`).

## Décisions (D-13.1-n)

- **D-13.1-1** : une entrée par page × langue (10 pages × FR/EN = 20 tests) ; chaque test audite **deux
  largeurs** (1280 px puis 375 px, D35) sur la même page, l'échec liste les violations par largeur.
- **D-13.1-2** : données créées dans **une transaction globale par groupe** (`group.setup`), rollback à la fin.
  Vérifié empiriquement : le serveur HTTP, dans le même processus, lit la transaction (les gardes de couverture
  passent : bannière à 3 cartes, blocs, résultats, cartes d'auteurs, photo, suggestions). Les requêtes parallèles du
  navigateur (beacon de vue, suggestions, `/media`) partagent la connexion de la transaction : `pg` les met en file
  (avertissement de dépréciation `client.query()` sans effet).
- **D-13.1-3** : navigateur **confiné au serveur local** (`context.route` → `abort` pour toute autre origine :
  Google Fonts, URL signées). Les polices de repli ne changent ni les tailles ni les couleurs : contrastes inchangés.
- **D-13.1-4** : `drive.fake('r2')` ; vignettes (`w400/w800/w1600.webp`) et photo d'auteur (`w128/w384.webp`) =
  vraies images WebP générées par `sharp` et écrites sur le disque factice, servies par `/media` comme en production.
- **D-13.1-5** : cookie `i18n_lang` posé brut par `addCookies` (le `setCookie` décoré d'Adonis le chiffrerait ;
  serveur et i18next lisent la valeur brute) ; `<html lang>` vérifié à chaque test.
- **D-13.1-6** : lignes du panneau de filtres (et `FilterChip`, non utilisé aujourd'hui) = **liens `role="button"`
  + `aria-pressed`** : `aria-pressed` est interdit sur un lien nu (violation `aria-allowed-attr`, critique, 4.1.2).
  La sémantique « bouton bascule » de 10.6 est conservée (le filtre navigue, ce n'est pas une case de formulaire) ;
  Entrée et clic suivent le lien natif, Espace bascule (`spaceToggle`). Ligne inerte (limite de 20 auteurs) :
  même rôle, `aria-pressed=false`, `aria-disabled`.
- **D-13.1-7** : compteurs des cartes (vues, téléchargements, date) et du détail : le libellé complet passe d'un
  `aria-label` sur `span`/`div` (rôle générique : attribut interdit, ignoré par les lecteurs d'écran, axe
  `aria-prohibited-attr` « à vérifier ») à un texte `sr-only`, la valeur visible courte étant `aria-hidden`.
  Pas une violation pour axe, mais un vrai défaut (le lecteur d'écran n'annonçait que « 12 ») : corrigé.
- **D-13.1-8** : **aucune règle ni aucun élément exclu** de l'audit.
- **D-13.1-10** (revue) : les résultats axe « incomplete » (« à vérifier ») échouent aussi, sauf une liste blanche
  explicite justifiée dans « Résultats de l'audit » : `color-contrast` (contrastes calculés à la main) et
  `video-caption` (question PO 1). Toute nouvelle règle « à vérifier » doit être traitée ou ajoutée ici.
- **D-13.1-9** : CI : `npx playwright install --with-deps chromium` (le runner GitHub a `sudo`) puis
  `node ace test browser`, après la suite functional, sans `continue-on-error` ; Chromium = celui de la version
  épinglée de `playwright` (même navigateur en local et en CI). En local : `npx playwright install chromium` (atlas,
  sans `--with-deps`).

## Résultats de l'audit

| Constat | Pages | Correctif |
|---|---|---|
| `aria-allowed-attr` (critique) : `aria-pressed` sur `<a>` | listing avec filtres (FR, EN) | D-13.1-6 |
| `aria-prohibited-attr` (« à vérifier ») : `aria-label` sur `span`/`div` génériques | accueil, listing, détail ×4, profil | D-13.1-7 |
| `color-contrast` (« à vérifier ») : fond en dégradé (hero), `dt` partiellement recouvert à 375 px | accueil, profil | calcul manuel : accroche `green-700`/`stone-100` 4,53:1, sous-titre 7,0:1, `h1` 16:1 ; `stone-500`/blanc 4,81:1 → conformes ; à recontrôler en 13.2 |
| `video-caption` (« à vérifier ») : `<video>` sans piste de sous-titres | détail vidéo | contenu : aucun moyen de déposer des sous-titres → question PO |

Aucune autre violation à 1280 px ni à 375 px, en FR comme en EN. Preuve d'échec : `role="button"` retiré
temporairement du panneau de filtres → « listing avec filtres actifs (fr) » échoue sur `aria-allowed-attr`
(fichier restauré).

## Review Findings

Revue de code du 2026-11-25 : 5 correctifs, 5 reports, 4 écartés, 2 questions PO.

- [x] [Review][Patch] Langue non prouvée au-delà de `<html lang>` [tests/browser/a11y.spec.ts] — chaque test vérifie le lien d'évitement et le titre « Explorer / Explore » du pied de page, lus dans `inertia/locales/public/{fr,en}.json`.
- [x] [Review][Patch] Section « liens » du détail jamais auditée (aucun `production.links`) — la vidéo reçoit un lecteur intégré (`iframe`, titre de repli) et un lien externe sans libellé ; la garde exige l'`iframe[sandbox][title]`, le lien et le `<video>`. Hôtes jamais atteints (requêtes interrompues).
- [x] [Review][Patch] Listing « avec filtres actifs » non garanti — garde : exactement les 3 filtres actifs (catégorie, domaine, auteur) rendus `a[role="button"][aria-pressed="true"]` ; vérifié par mutation (seuil 4 → échec « found 3 »).
- [x] [Review][Patch] Instabilité CI / charge — (a) ré-optimisation Vite sur cache froid : `node_modules/.vite` supprimé, suite `browser` relancée deux fois (dont `DEBUG=vite:deps`) : un seul passage d'optimisation au démarrage, « the scanner found every used dependency », aucun rechargement sur les 20 pages → aucune modification de `vite.config.ts` (le scan suit déjà les pages chargées par `import.meta.glob`) ; (b) suggestions abandonnées à 2 s sous charge : si la section est absente une fois le chargement fini, la page est rechargée une fois avant l'échec (délai de production inchangé).
- [x] [Review][Patch] Résultats « incomplete » ignorés — échec sur toute règle hors liste blanche (D-13.1-10) ; vérifié par mutation (`video-caption` retiré de la liste → « détail vidéo (fr) » échoue).
- [ ] [Review][Defer] CI : cache des navigateurs Playwright absent, `--with-deps` (apt) à chaque exécution, et durée ajoutée au gate de `deploy-staging.yml` (qui appelle `ci.yml`).
- [ ] [Review][Defer] États fermés non audités (`details` repliés, menus, ligne inerte « 20 auteurs ») → parcours clavier de 13.2.
- [ ] [Review][Defer] Contraste de l'accroche du hero (4,53:1) à recontrôler en 13.2.
- [ ] [Review][Defer] Règles « best-practice » de landmarks (`region`, `landmark-*`) hors des tags de l'AC → suivi possible en 13.2 / 13.4.
- [ ] [Review][Defer] Photo du profil : vérifier `naturalWidth > 0` (image réellement chargée), pas seulement l'attribut `alt`.
- [x] [Review][Dismiss] Abandon en cascade de la transaction partagée : aucune route visitée ne provoque d'erreur SQL.
- [x] [Review][Dismiss] Nettoyage si le seed échoue : le groupe échoue, le rollback de la transaction globale n'a rien de persistant à défaire hors transaction (disque factice temporaire).
- [x] [Review][Dismiss] Duplication des textes `sr-only` / valeurs visibles : voulue (D-13.1-7).
- [x] [Review][Dismiss] Compromis `role="button"` sur les liens de filtre (D-13.1-6) : conservé, à confirmer à l'audit NVDA de 13.2.
- [x] [Review][PO] Sous-titres des vidéos (WCAG 1.2.2) — question ouverte 1. — PO 2026-11-25 : story Phase 3 (dépôt `.vtt` + `<track kind="captions">`), consignée dans deferred-work.md.
- [x] [Review][PO] Contenu à l'intérieur des lecteurs non audité — question ouverte 2. — PO 2026-11-25 : défaut accepté.

## Portes manuelles (non exécutées par l'agent)

- Audit manuel NVDA / VoiceOver, parcours 1 et 2, FR et EN : Story 13.2 (grille d'audit).
- Lighthouse mobile 4G (score Accessibilité) sur le staging : Story 13.4.
- Premier passage de la CI : vérifier que l'étape « Install Playwright Chromium » réussit sur le runner GitHub
  (téléchargement de Chromium + `apt`) et noter sa durée.

## Questions ouvertes

1. `[PO]` **Sous-titres des vidéos** (WCAG 1.2.2, niveau A) : axe signale « à vérifier » sur toute vidéo hébergée
   (aucune piste `<track>`). Anta ne permet pas de déposer un fichier WebVTT. Nouvelle story (upload `.vtt` à côté du
   MP4 + `<track kind="captions">`) ou exception documentée (contenus fournis par les auteurs) ?
2. `[PO]` Le contenu **à l'intérieur** des lecteurs (PDF dans l'`iframe`, fichiers EPUB, médias) n'est pas audité :
   fichiers déposés, hors du code d'Anta. On le considère hors périmètre de NFR16 (seul le lecteur doit être
   pilotable au clavier, vérifié en 13.2) ?

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Chromium 1217 (Playwright 1.59.1) installé dans le cache d'atlas ; lancement headless vérifié (aucune bibliothèque
  système manquante).
- 1er passage de la suite : 18 / 20 verts, `aria-allowed-attr` sur le listing (FR, EN) → D-13.1-6.
- Passage de diagnostic (temporaire, retiré) à 375 px avec la liste des résultats « incomplete » d'axe : constats
  `aria-prohibited-attr`, `color-contrast` (dégradé), `video-caption` → D-13.1-7, calculs de contraste, question PO.
- `typecheck` : `document` absent du `lib` serveur dans `waitForFunction` → attente par locator
  (`[aria-busy="true"]` détaché).
- Suite complète `npm run test:local` : **1477 tests verts** (baseline 1454 + 20 browser + 3 unit), code 0 ; la
  suite `browser` tourne après `functional` sans conflit de port. `npm run test:local -- browser` : 20 verts, code 0
  (~2 min). `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration,
  rien contre Supabase ni R2.

### Completion Notes List

- Suite `browser` livrée : `tests/browser/a11y.spec.ts`, 20 tests (10 pages × FR/EN, deux largeurs chacun), axe
  `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, 0 violation ; gardes de couverture des données.
- Corrections : filtres du listing (`role="button"`), compteurs en texte `sr-only` (cartes et détail).
- Tests de source : `filter_sidebar.spec.ts` (rôle bouton), `production_card.spec.ts` (compteurs), test
  d'infrastructure CI (`deployment.spec.ts` : étapes Chromium + browser, ordre, sans `continue-on-error`, versions
  épinglées).
- CI : installation de Chromium Playwright puis suite `browser`, bloquante.
- Dépendances : `@axe-core/playwright` 4.14.1 et `playwright` 1.59.1 (devDependencies, versions exactes).
- Aucune règle exclue ; 2 questions PO.

### File List

- `tests/browser/a11y.spec.ts` (nouveau)
- `inertia/components/public/FilterSidebar.tsx` (modifié)
- `inertia/components/public/FilterChip.tsx` (modifié)
- `inertia/components/public/ProductionCard.tsx` (modifié)
- `inertia/pages/production.tsx` (modifié)
- `tests/unit/components/filter_sidebar.spec.ts` (modifié)
- `tests/unit/components/production_card.spec.ts` (modifié)
- `tests/unit/infrastructure/deployment.spec.ts` (modifié)
- `.github/workflows/ci.yml` (modifié)
- `package.json`, `package-lock.json` (modifiés : devDependencies)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié)
- `_bmad-output/implementation-artifacts/13-1-audit-automatise-axe-des-pages-publiques.md` (nouveau)

## Change Log

- 2026-11-25 : création (bmad-create-story) ; statut ready-for-dev.
- 2026-11-25 : implémentation (bmad-dev-story) : suite `browser` axe (20 tests, deux largeurs), correctifs ARIA
  (filtres, compteurs), CI Chromium + browser bloquante ; 1477 tests verts, lint, typecheck, build ; statut review.
- 2026-11-25 : revue de code — 5 correctifs (langue prouvée par des textes traduits, section liens + `iframe`
  auditées, garde des filtres actifs, rechargement unique des suggestions, liste blanche des « incomplete »),
  cache Vite froid vérifié sans modification, 5 reports, 2 questions PO ; 1477 tests verts, lint, typecheck,
  build ; statut review.
- 2026-11-25 : revue de code vérifiée par l'orchestrateur, correctifs appliqués ; 1477 tests verts ; statut done.
