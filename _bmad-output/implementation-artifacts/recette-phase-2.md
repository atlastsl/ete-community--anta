# Recette Phase 2 (Epics 9 à 13) — accessibilité, performance, portes manuelles

Document de recette consolidé de la Phase 2 (Story 13.4). Il réunit en un seul endroit : la preuve automatisée du
respect des NFR16 à NFR20, les **portes manuelles** à exécuter par le PO (Aurélien) après merge et déploiement, et la
liste des **questions `[PO]` encore ouvertes**. Les colonnes « Résultat » sont **vides** : elles sont remplies par la
personne qui exécute la porte (date, valeur mesurée, OK / KO, commentaire). Aucun hôte ni adresse n'est écrit ici
(dépôt public) : `<URL du staging>` désigne l'URL publique du staging.

État au 2026-11-25, branche `feat/epic-13-wcag` (PR empilées #21 → #25, puis Epic 13).

## 1. Synthèse des NFR

| NFR | Exigence (epics.md) | Preuve automatisée (CI à chaque PR) | Porte manuelle | Statut |
|---|---|---|---|---|
| NFR16 — Accessibilité | Site public WCAG 2.1 AA ; accueil, listing/recherche, détail (lecteurs inclus), auteurs, profil, confidentialité, FR et EN ; 0 violation A/AA (axe) ; parcours 1 et 2 au clavier et au lecteur d'écran ; contrastes ≥ 4,5:1 / 3:1 ; alternatives des images | Suite `browser` (§ 2.1) : axe A/AA sur 10 pages × FR/EN × 2 largeurs + 5 états, structure interactive, parcours clavier ; specs de source (§ 2.2) | Audit NVDA / VoiceOver (§ 3.2) ; score Accessibilité Lighthouse (§ 3.1) | Automatisé : **tenu** (0 violation). Manuel : à faire |
| NFR17 — LCP | LCP < 3 s, mobile 4G simulé (Lighthouse) : accueil complet, liste des auteurs, profils, détail | Indirecte : `srcset` + dimensions (11.2), image LCP prioritaire (11.6), cache des classements (12.2), `EXPLAIN ANALYZE` (12.5) | Lighthouse sur le staging (§ 3.1) | À mesurer |
| NFR18 — Suggestions | Détail affiché sans attendre les suggestions ; suggestions < 2 s | Chargement différé + abandon à 2 s (`suggestions_behavior.spec.ts`, `suggestions_grid.spec.ts`, `suggestions.spec.ts`) ; local : p95 329 ms (50 visiteurs), 533 ms en rafales (12.5) | Lighthouse / onglet Performance sur le staging (§ 3.1) | Local : tenu. Staging : à mesurer |
| NFR19 — Images | JPEG, PNG ou WebP ≤ 5 Mo | Validateurs et services (`author_validator.spec.ts`, `authors_photo.spec.ts`, `production_thumbnail.spec.ts`, `image_service.spec.ts`) | — | **Tenu** |
| NFR20 — Charge | 50 visiteurs simultanés ; recherche et filtres p95 < 1 s. **Définition PO (2026-11-25) : visiteurs avec temps de réflexion** | Script `scripts/perf/load.mjs` ; mesure locale (12.5) : recherche p95 321 ms, filtres p95 463 ms | Test de charge sur le staging (§ 3.3) | Local : tenu. Staging : à mesurer |

## 2. Preuve automatisée

Commande : `npm run test:local` (toutes les suites) ; en CI (`.github/workflows/ci.yml`, PR vers `development`,
`staging`, `master`) : `node ace test unit`, `functional`, puis installation de Chromium Playwright et
`node ace test browser`, **sans `continue-on-error`** (test d'infrastructure `tests/unit/infrastructure/deployment.spec.ts`).

Dernière exécution complète (2026-11-25, Story 13.4, `npm run test:local`) : **1599 tests verts** — unit 942,
functional 617, browser 40 — code 0 ; lint, typecheck et build : 0.

### 2.1 Suite `browser` (Chromium headless, axe-core 4.14 via `@axe-core/playwright`)

| Fichier | Tests | Couverture |
|---|---|---|
| `tests/browser/a11y.spec.ts` — groupe 13.1 | 20 | axe `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` sur accueil (bannière 3 + 4 blocs), listing avec 3 filtres actifs, détail PDF / EPUB / vidéo (+ `iframe` et lien) / audio avec suggestions, liste des auteurs, profil, confidentialité, 404 ; FR et EN ; 1280 px puis 375 px ; résultats « à vérifier » en échec hors liste blanche (`color-contrast`, `video-caption`) ; **13.4** : aucun contrôle imbriqué dans un lien / bouton, contrôles des cartes à lien étiré cliquables au-dessus du calque (test de pointage), garde sur l'accueil : 3 cartes étirées et ≥ 1 contrôle pointé (auteurs de la bannière ; les cartes d'auteurs n'ont qu'un lien) |
| `tests/browser/a11y.spec.ts` — groupe 13.2 (états) | 10 | panneau de filtres mobile ouvert et groupes dépliés, vue grille, ligne inerte « 20 auteurs » (**13.4** : reliée au texte d'aide par `aria-describedby`), liste de tri ouverte (`aria-hidden-focus` exclue, D-13.2-6), suggestions en chargement ; **13.4** : aucun contrôle imbriqué dans chaque état |
| `tests/browser/keyboard.spec.ts` | 10 | balayage Tab des 10 pages × FR/EN (focus visible à chaque arrêt, non rogné, aucun piège, lien d'évitement, un seul `h1`, aucun saut de titre, landmarks uniques, règles best-practice axe de structure), `lang` des contenus, liste de tri au clavier, parcours 1 et 2 automatisés |

Aucune règle axe désactivée sur les pages ; exclusions limitées et justifiées : `aria-hidden-focus` dans l'état
« liste de tri ouverte » (D-13.2-6, question PO), `iframe` hors des règles best-practice de structure (D-13.2-12,
question PO).

### 2.2 Specs unitaires de source (`tests/unit/components/*.spec.ts`, `tests/unit/i18n/*.spec.ts`)

Correspondance entre les scénarios de l'AC 1 de la Story 13.4 et les specs qui les vérifient :

| Scénario | Specs |
|---|---|
| `aria-busy` (suggestions en chargement, squelettes `aria-hidden`) | `suggestions_grid.spec.ts` |
| `aria-live` (annonce unique des suggestions ; nombre de résultats du listing et de `/authors`) | `suggestions_grid.spec.ts`, `filter_sidebar.spec.ts`, `authors_list.spec.ts` |
| `aria-current` (fil d'Ariane du détail et du profil, langue active, pagination) | `keyboard_screen_reader.spec.ts`, `author_profile.spec.ts`, `language_switcher.spec.ts`, `phase2_a11y.spec.ts` (pagination, 13.4) |
| Région de la bannière nommée (`aria-labelledby` vers un `h2` masqué) | `home_featured_banner.spec.ts` |
| `aria-describedby` des actions indisponibles | admin : `authors_index_page.spec.ts` (suppression), `author_form.spec.ts` (consentement), `featured_page.spec.ts` (enregistrement de la une) ; public : `phase2_a11y.spec.ts` (ligne inerte « 20 auteurs », 13.4) |
| `alt=""` des images adjacentes à un texte (bannière, cartes d'auteurs, combobox, emplacements « À la une », sélecteur, vignette) ; aucune image sans `alt` | `phase2_a11y.spec.ts` (règle générique, 13.4), `home_featured_banner.spec.ts`, `authors_list.spec.ts`, `avatar.spec.ts`, `featured_page.spec.ts` |
| `alt="Photo de {Prénom NOM}"` du profil | `author_profile.spec.ts`, `phase2_a11y.spec.ts` |
| Aucun lien imbriqué dans les cartes | `phase2_a11y.spec.ts` (toutes les sources publiques, 13.4), `author_byline.spec.ts`, `home_featured_banner.spec.ts`, `authors_list.spec.ts` ; dans le navigateur : `a11y.spec.ts` (13.4) |
| Clés Phase 2 en FR et en EN | `translations.spec.ts` (parité des clés ; **13.4** : toute clé littérale ou passée en donnée / prop (`labelKey`…) des sources publiques et admin existe en FR et en EN, gabarits contrôlés par motif ; hors de portée : `t(variable)` et clés envoyées par le serveur), `public_authors_keys.spec.ts` (Epic 10), `featured_keys.spec.ts` (Epic 11) |
| `lang` des contenus, titres, focus, cibles ≥ 44 px, contrastes | `keyboard_screen_reader.spec.ts`, `content_lang_behavior.spec.ts` (13.2) |

### 2.3 Autres preuves Phase 2 (rappel)

- Auteurs (Epics 9, 10) : `tests/functional/admin/authors_*.spec.ts`, `productions_authors.spec.ts`,
  `tests/functional/public/author_profile.spec.ts`, `authors_list.spec.ts`, `authors_privacy_matrix.spec.ts`,
  `bylines.spec.ts`, `media.spec.ts`, `not_found.spec.ts`.
- Vignettes et à la une (Epic 11) : `production_thumbnail.spec.ts`, `production_files_poster.spec.ts`,
  `thumbnails_extract_video_frames.spec.ts`, `featured.spec.ts`, `featured_auto_remove.spec.ts`,
  `featured_flows.spec.ts`.
- Accueil, classements, suggestions (Epic 12) : `ranking_service.spec.ts`, `ranking_invalidation.spec.ts`,
  `suggestions.spec.ts`, `home.spec.ts` ; mesures `EXPLAIN ANALYZE` et charge locale consignées dans la story 12.5.
- Plan du site (13.3) : `sitemap.spec.ts`, `robots_txt.spec.ts`, `sitemap_service.spec.ts`.

## 3. Portes manuelles du PO

**Attention** : l'image Docker lance `node ace migration:run --force` à **chaque démarrage** du conteneur
(`Dockerfile`, `CMD`) ; tout déploiement sur le staging applique donc les migrations Phase 2 à la base Supabase
**partagée**. Ne rien pousser sur `staging` (ni déclencher `Deploy staging`) avant que la conversion des auteurs soit
validée et prête à être appliquée dans l'ordre 9.5 → 9.6 → 9.7 (§ 3.4).

Ordre conseillé : § 3.4 (après merge, avant tout usage du staging) → déploiement staging → § 3.1, § 3.2, § 3.3 →
§ 3.5. Rien de ce qui suit n'est exécuté par les agents (services distants, base partagée).

### 3.1 Lighthouse mobile 4G sur le staging (NFR16 score, NFR17, NFR18)

Prérequis : Epics 9 à 13 déployés sur le staging ; conversion des auteurs faite (§ 3.4) ; au moins 3 productions à la
une avec vignette, des vues et téléchargements récents (blocs remplis), un auteur visible avec photo.

Procédure (Chrome, fenêtre de navigation privée, sans extension) : DevTools → onglet **Lighthouse** → Mode
« Navigation », Appareil **« Mobile »** (limitation simulée par défaut = 4G lente), catégories **Performance** et
**Accessibilité** → « Analyser le chargement de la page ». **3 passages par page**, consigner la **médiane** du LCP.
Équivalent en ligne de commande (Node ≥ 18, depuis un poste hors du serveur) :
`npx lighthouse <URL> --only-categories=performance,accessibility --output=html --output-path=./lh.html`
(profil mobile et limitation simulée par défaut).

NFR18 : sur la page de détail, onglet **Performance** (limitation « Fast 4G », processeur ×4) → enregistrer le
chargement ; les métadonnées et le lecteur s'affichent avant la section « Productions similaires », qui apparaît en
moins de 2 s après la fin du chargement de la page.

| Page | URL | LCP médian (< 3 s) | Score Performance | Score Accessibilité | Suggestions < 2 s (détail) | Date / testeur | OK / KO |
|---|---|---|---|---|---|---|---|
| Accueil complet (bannière + 4 blocs) | `<URL du staging>/` | | | | — | | |
| Liste des auteurs | `<URL du staging>/authors` | | | | — | | |
| Profil d'un auteur (avec photo) | `<URL du staging>/authors/<slug>` | | | | — | | |
| Détail d'une production (avec suggestions) | `<URL du staging>/productions/<slug>` | | | | | | |

Remplace les portes Lighthouse des stories 10.8 (AC 3), 11.7 (AC 7) et 12.5 (AC 5) : reporter les résultats ici
suffit. Un score Accessibilité < 100 n'est pas un échec en soi (Lighthouse n'exécute qu'une partie d'axe) : noter les
audits signalés et les ouvrir en question.

### 3.2 Audit NVDA / VoiceOver (NFR16, Story 13.2)

Grille : `_bmad-output/implementation-artifacts/13-2-grille-audit-lecteurs-ecran.md` (NVDA + Firefox ou Chrome sous
Windows, VoiceOver + Safari sous macOS ; FR et EN ; contrôles transverses, parcours 1 dont filtre auteur au clavier,
parcours 2 ; constats, résiduels acceptés, rapport). Les bloquants relevés sont corrigés dans une passe dédiée.

| Étape | Résultat | Date / testeur |
|---|---|---|
| Grille remplie (NVDA, FR et EN) | | |
| Grille remplie (VoiceOver, FR et EN) | | |
| Bloquants corrigés (référence de la PR) | | |
| Rapport validé par Aurélien (signature / date dans la grille) | | |
| Contrôle visuel 375 / 1024 px des bordures de champs renforcées (D-13.2-7) | | |
| Contrôle visuel 375 / 1024 px du hero et de « Recherche avancée » (12.1) | | |
| Contrôle visuel 375 / 1024 px des blocs de l'accueil et nom accessible complet de « Voir plus » (« Voir plus : Les plus consultées », lecteur d'écran) (12.2) | | |
| Contrôle visuel 375 / 1024 px du bloc « Auteurs les plus consultés » (12.3) | | |
| Suggestions (12.4) : squelette pendant le chargement (375 / 1024 px), section retirée sans message si la réponse dépasse 2 s (limitation réseau « Slow 3G » dans les DevTools) | | |

### 3.3 Test de charge sur le staging (NFR20) — avec l'accord d'Aurélien

Staging partagé : prévenir avant, lancer hors des heures d'usage, depuis un poste **hors du serveur** (Node ≥ 18, sans
dépendance ; usage et URLs en tête de `scripts/perf/load.mjs`).

| Scénario | Commande | Attendu | p50 | p95 | Erreurs | Date | OK / KO |
|---|---|---|---|---|---|---|---|
| Recherche, 50 visiteurs avec pauses (définition PO) | `node scripts/perf/load.mjs <URL du staging> 50 20 search 1000 3000` | p95 < 1 s | | | | | |
| Filtres, 50 visiteurs avec pauses (définition PO) | `node scripts/perf/load.mjs <URL du staging> 50 20 filters 1000 3000` | p95 < 1 s | | | | | |
| Suggestions en rafales (information NFR18) | `SLUGS=<slug-a>,<slug-b> node scripts/perf/load.mjs <URL du staging> 50 10 suggestions 0 0 1` | p95 < 2 s | | | | | |
| Saturation (information seulement, non exigée) | `node scripts/perf/load.mjs <URL du staging> 50 40 mix` | — | | | | | |

### 3.4 Portes de mise en service (après merge sur `development`, avant / pendant le déploiement staging)

Base Supabase partagée : jamais de `rollback` / `fresh` / `reset` / `wipe` ; commandes en utilisateur `atlas` sur le
VPS de dev, `doppler run -- …` (ou dans le conteneur du staging selon `docs/staging-vps.md`).

| # | Porte | Étapes exactes | Attendu | Résultat / date |
|---|---|---|---|---|
| 1 | Migrations Phase 2 (jamais appliquées sur Supabase) | appliquées **automatiquement** au premier démarrage du conteneur du staging (`migration:run --force`) : ne déployer qu'au moment choisi pour la conversion ; contrôle préalable depuis le VPS de dev : `doppler run -- node ace migration:status` (ou `migration:run` explicite si on veut les appliquer avant le déploiement) ; migrations : `1775918745000_create_authors_table`, `…746000_create_author_affiliations_table`, `…747000_create_production_authors_table` (9.1, 9.2), `…748000_add_thumbnail_and_poster_columns` (11.1), `…749000_create_featured_productions_table` (11.4), `…750000_add_metadata_to_admin_activity_logs` (9.1), `…751000_add_stats_window_indexes` (10.5) | toutes « completed », additives | |
| 2 | Proposition de la table de conversion des auteurs (9.5) | `doppler run -- node ace authors:propose --out tmp/authors-conversion.csv` ; le CSV (sous `tmp/`, jamais commité) est relu et corrigé par Aurélien (fusions par `author_key`, `existing_author_slug`) | CSV produit | |
| 3 | Validation **écrite** du CSV par Aurélien | `doppler run -- node ace authors:validate --file tmp/authors-conversion.csv` | code 0 | |
| 4 | Conversion (9.6) | `doppler run -- node ace authors:apply --file tmp/authors-conversion.csv --dry-run` (lire le rapport SIMULATION `tmp/authors-conversion-report-….txt`), puis sans `--dry-run` | rapport APPLICATION ; comptages consignés dans la story 9.6 (aucun nom) | |
| 5 | Vérification (9.6) | `doppler run -- node ace authors:verify` | code 0, « 100 % » | |
| 6 | Déploiement staging de 9.7 et suivants (porte bloquante 9.7, AC 12) | seulement après l'étape 5 ; relancer `authors:verify` après le déploiement ; redémarrer l'application ou attendre 10 min (cache des classements, D-12.2-4) | `verify` 100 % après déploiement | |
| 7 | Images extraites des vidéos hébergées (11.3) | `doppler run -- node ace thumbnails:extract-video-frames --dry-run`, puis sans `--dry-run` ; comptages à consigner dans la story 11.3 | comptages cohérents avec le dry-run | |
| 8 | Staging non indexé (13.3, D-13.3-7) | `ROBOTS_DISALLOW_ALL=true` dans le `.env` du staging (`docs/staging-vps.md`), redéploiement ; `curl <URL du staging>/robots.txt` | `Disallow: /`, aucune ligne `Sitemap:` ; absente / `false` en production | |
| 9 | Premier passage de la CI avec la suite `browser` | PR vers `development` : étape « Install Playwright Chromium » puis `node ace test browser` | verte ; durée de l'étape notée | |
| 10 | Variables du staging (rappel Epic 8) | supprimer le keep-alive cron-job.org, vérifier le CORS R2 et le lien « Website » du dépôt | fait | |

### 3.5 Après la mise en production (Story 8.6, en attente d'un serveur)

| Porte | Étapes | Résultat / date |
|---|---|---|
| Même séquence que § 3.4 (1 à 7) sur la production, à la release « bascule » | idem, sans `ROBOTS_DISALLOW_ALL` | |
| Déclaration du plan du site aux moteurs (13.3, question PO 3) | Google Search Console et Bing Webmaster Tools (compte d'Aurélien) → soumettre `https://<domaine>/sitemap.xml` ; vérifier l'absence d'erreurs après exploration | |
| Lighthouse (§ 3.1) sur la production | idem § 3.1 | |

## 4. Questions `[PO]` ouvertes

Questions encore sans réponse au 2026-11-25. Celles marquées « défaut appliqué » sont livrées avec le choix indiqué :
une réponse « d'accord » suffit pour les clore.

### Epic 13 (accessibilité, plan du site)

| # | Origine | Question | Défaut / recommandation |
|---|---|---|---|
| 13-1 | 13.1 Q1 | Sous-titres des vidéos hébergées (WCAG 1.2.2, niveau A) : nouvelle story (dépôt d'un `.vtt` + `<track kind="captions">`) ou exception documentée (contenus fournis par les auteurs) ? | recommandation : story Phase 3 |
| 13-2 | 13.1 Q2 | Contenu **à l'intérieur** des lecteurs (PDF, EPUB, médias déposés) hors périmètre de NFR16, seul le lecteur devant être pilotable au clavier ? | défaut appliqué : hors périmètre |
| 13-3 | 13.2 Q1 | Liste de tri ouverte : exclusion de `aria-hidden-focus` acceptée (focus piégé volontairement, Échap en sort), ou `<select>` natif ? | défaut appliqué : exclusion |
| 13-4 | 13.2 Q2 | Bordure des champs publics `stone-500` (4,8:1, amende D33) à valider visuellement ; `DESIGN.md` D33 à mettre à jour ensuite | défaut appliqué : `stone-500` |
| 13-5 | 13.2 Q3 | Lignes de filtre annoncées « bouton bascule, enfoncé » : à confirmer à l'audit NVDA / VoiceOver (étape B6) ; repli : cases à cocher natives | à trancher après § 3.2 |
| 13-6 | 13.2 Q4 | `iframe` du lecteur exclue des règles best-practice de structure, ou audit de structure du cadre réel en staging ? | défaut appliqué : exclusion |
| 13-7 | 13.3 Q1 | Index de sitemaps au-delà de 50 000 URL, ou troncature journalisée (hors d'atteinte à court terme) ? | défaut appliqué : troncature |
| 13-8 | 13.3 Q2 | Ajouter `/privacy-policy` au plan du site ? | défaut appliqué : non |
| 13-9 | 13.3 Q3, Q4 | Soumission du sitemap aux moteurs ; `ROBOTS_DISALLOW_ALL=true` sur le staging | portes § 3.4 (8) et § 3.5 |
| 13-10 | 13.4 | Score Accessibilité Lighthouse : exige-t-on 100 sur les 4 pages, ou seulement l'absence de violation A/AA (axe, déjà tenue) avec consignation du score ? | recommandation : consigner le score, exiger 0 violation axe |

### Epics 9 à 12 (encore ouvertes)

| # | Origine | Question | Défaut appliqué |
|---|---|---|---|
| 9-a | 9.2 Q1–Q3 | Compteurs des filtres rapides globaux ou contextuels ; filtre Institution sur toutes les affiliations ou la principale ; textes du dialog de suppression | globaux ; toutes ; textes proposés |
| 9-b | 9.2 Q4 | Specs antérieures contenant des noms de personnes réelles : planifier un nettoyage ? | non planifié |
| 9-c | 9.3 Q1–Q4, 9.4 Q1–Q3 | Message dédié au plafond de 40 Mpx ; positions des sections Photo et Consentement dans le formulaire ; qualité d'encodage (WebP 80, JPEG 82 mozjpeg) ; photo restée sélectionnée côté client quand la création échoue pour une autre erreur (rien n'est envoyé sur R2) ; flash sur action sans effet ; bouton de retrait du consentement `destructive` dans le dialog, déclencheur `outline` | clé dédiée ; après Identité ; WebP 80 / JPEG 82 ; conservée ; en dernier ; aucun flash ; `destructive` / `outline` |
| 9-d | 9.5 Q1–Q3, 9.6 | Nom d'un seul mot : avertissement ou erreur ; colonne `productions` en slugs ; apostrophes et tirets assimilés pour le regroupement (`grouped`, D-9.5-a) ; fiche existante sans `migration_key` ; noms non écrasés à l'upsert ; renommage d'une fiche liée à une production partiellement rattachée (ancien nom jusqu'au prochain `apply`) | avertissement ; slugs ; comme décrit (D-9.6-a, b, f) |
| 9-e | 9.7 Q1–Q3, 9.8 | Pas de dépublication automatique d'une production non convertie ; réécriture depuis le pivot ; recherche d'auteurs non indexée conservée (D-9.7-b) ; avertissement d'homonyme avant création ; clic extérieur ignoré | comme décrit ; pas d'avertissement |
| 10-a | 10.1 Q1 | ~~Texte de la section confidentialité des auteurs (`privacy.authors.*`)~~ | **validé par le PO le 2026-11-25** (texte tel quel) |
| 10-b | 10.1 Q2, Q3 | Traduire `errors/server_error.tsx` ; 404 sous `/admin/*` avec le layout admin | non ; page publique |
| 10-c | 10.2 Q1, 10.8 Q1 | `/media` sert la photo d'un auteur consentant **sans** production publiée : aligner sur « visible sur le site » ? | conservé (clé jamais exposée) |
| 10-d | 10.2 Q2 | Avatars de l'admin via `/media` pour les profils publics ? | non (URL signées) |
| 10-e | 10.3 | Séparateur du fil d'Ariane « / » ou « › » ; tri `title` sans `unaccent` ; productions sans date en dernier ; titre d'onglet non rafraîchi en navigation SPA | « / » ; sans `unaccent` ; en dernier ; report |
| 10-f | 10.4 | Noms jsonb non rattachés après le pivot ; noms « Prénom NOM » partout ; « A, B, C et 1 autre » dès 4 auteurs | comme décrit |
| 10-g | 10.5 | Tri par pertinence quand `q` est renseigné sur `/authors` ; `institution` lisible dans l'URL ; barre de filtres masquée sans auteur ; pagination admin à 44 px | non ; lisible ; masquée ; non |
| 10-h | 10.6, 10.7 | Lien « Toutes ses productions » sur le profil ; JSON-LD `Person`, `canonical`, `noindex` des variantes filtrées | non prévus |
| 11-a | 11.1, 11.4 | « Retirer » la vignette sans dialog de confirmation | sans dialog |
| 11-b | 11.4 Q2, 11.5 Q1, 11.6, 11.7 Q2 | Supprimer la vidéo d'une production à la une sans vignette : bloquer comme le retrait de vignette ? (aujourd'hui écartée de la bannière et signalée) | non bloqué |
| 11-c | 11.5 Q2 | Confirmation systématique de « Dépublier » dans le formulaire | comme livré (D-11.5-4) |
| 11-d | 11.6 | Production à la une sans image affichable écartée de la bannière ; compteurs annoncés « Vues : 1 214 » (maquette) | écartée ; forme de la maquette |
| 11-e | 11.7 Q1 | Republication après retrait automatique : pas de retour à la une | pas de retour |
| 11-f | 11.2 | Cache `immutable` d'un an des vignettes (image dépubliée visible chez qui l'a chargée) | accepté (information) |

Epic 12 : toutes les questions sont tranchées (PO, 2026-11-25 : pertinence masquée sans `q`, textes du hero, départage
des ex æquo, D-12.4-5, cache des classements vs commandes Ace, NFR20 avec pauses, seq scan, ordre des props).

Hors epic, signalé : supprimer le dernier fichier d'une production publiée la laisse publiée sans fichier
(préexistant, Epic 4, 11.7 Q3) ; `files_controller` utilise `flashErrors` (erreurs jamais affichées).

## 5. Validation finale

| Élément | Résultat | Date / signature |
|---|---|---|
| § 2 : CI verte sur la PR finale (unit, functional, browser) | | |
| § 3.1 : LCP < 3 s sur les 4 pages, scores consignés | | |
| § 3.2 : rapport NVDA / VoiceOver validé par Aurélien | | |
| § 3.3 : NFR20 tenue sur le staging | | |
| § 3.4 : portes de mise en service franchies | | |
| § 4 : questions bloquantes tranchées (10-a au minimum) | | |
| Tests fonctionnels d'Aurélien des Epics 9 à 12 (en attente : Epics 9 et 10 au moins ; puis 11 et 12) | | |
| **Phase 2 acceptée** | | |
