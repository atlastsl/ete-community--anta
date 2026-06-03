
## Deferred from: code review of Epic 2 (stories 2.1-2.6) (2026-06-01)

- **AC texte vs comportement réel (Stories 2.2)** — les AC4/AC5 disent "422" et AC7 "403/419", mais le code retourne 302+flash (idiome Inertia/Shield, correct et testé). Action : réconcilier le texte des AC + corriger l'over-claim "tous les AC satisfaits" dans les Completion Notes. Pas un défaut de code.
- **Test E2E first_login_flow service-level (Story 2.6)** — le test simule les étapes au niveau modèle et hardcode les cibles de redirection au lieu d'exercer controller+middleware. AC4 l'autorise explicitement. Action Phase 2 : ajouter un vrai test browser (Playwright, suite `browser`) qui clique le flux login → change-password → dashboard.

## Deferred from: code review of Epic 4 (stories 4.1-4.8) (2026-06-01)

- **Liens `embed` sans allowlist d'hôtes (SSRF / iframe) — Story 4.5** : `createLinkValidator` n'impose que http/https. Aucun sink en Epic 4 (URL rendue en texte). Action **Story 6.3** : à l'implémentation du rendu iframe `embed`, ajouter sandbox + allowlist d'hôtes de confiance, et rejeter hôtes privés/loopback si fetch serveur (oEmbed/preview).
- **`mime_type` stocké depuis le type déclaré client — Story 4.4** : `files_controller.store` persiste `${file.type}/${file.subtype}` (déclaré) plutôt que le type vérifié par magic bytes. Pas de sink en Epic 4. Action **Epic 6** (serving) : utiliser le type vérifié pour le `Content-Type` des téléchargements/lecteurs.
- **`Pagination` sans fenêtrage — Story 4.2** : rend tous les numéros de page (`1..lastPage`). Non urgent (catalogue petit). Action : ajouter un fenêtrage (ex. `1 … 4 5 6 … N`) quand le volume de productions croît.

## Deferred from: code review of Epic 5 (stories 5.1-5.7) (2026-06-01)

- **`<title>`/meta non rafraîchis en navigation SPA — Story 5.5** : les meta SEO vivent uniquement dans l'edge (serveur, `ssr:false`). Objectif SEO crawlers (premier chargement) atteint, mais lors d'un `router.visit` client le titre d'onglet et les og:* restent ceux de la page initiale. Action éventuelle : ajouter `<Head>` Inertia côté pages publiques pour synchroniser titre/meta client-side (amélioration, hors AC 5.5).
- **`<title>` de `/privacy-policy` générique « Anta » — Story 5.5** : conforme à la story (meta privacy = bonus). Amélioration mineure : donner un titre/description dédiés à la page de confidentialité.
- **`Pagination` sans fenêtrage (rappel) — Story 5.4** : déjà listé ci-dessus (revue Epic 4). Exposé désormais sur la page publique `/productions` ; ajouter fenêtrage + ellipses (`1 … 4 5 6 … N`) quand le volume croît. Impacte aussi l'admin.

## Deferred from: code review of QA-refinement cycle (2026-06-02)

- **`parseWorkDate` accepte des dates valides au regex mais invalides au calendrier — pré-existant (Epic 4)** : `production_validator` valide `^\d{4}-\d{2}-\d{2}$` ; `2024-02-30`/`2024-13-01` passent puis `DateTime.fromISO(...).isValid` est faux → `parseWorkDate` renvoie `null` silencieusement (date saisie « disparaît » sans erreur). Le `<input type=date>` l'empêche côté client ; seul un POST direct/malformé l'atteint. Action : valider la date réelle dans le validateur (VineJS date rule) plutôt qu'un simple regex.
- **`down()` de la migration subdomain→jsonb est destructif** : `subdomain TYPE varchar USING (subdomain->>0)` ne garde que le 1er élément (perte des sous-domaines multiples au rollback) ; `[]` → NULL. Inhérent à un repli tableau→scalaire ; documenté. Action éventuelle : logguer un avertissement dans `down()`.
- **Sous-domaine requis mais champ masqué quand domaine vide — faible impact** : le champ sous-domaine (ChipField) n'est rendu que si `domain` non vide ; si l'admin vide `domain` après avoir saisi des sous-domaines, les valeurs `data.subdomain` persistent (cachées) et sont comptées « remplies ». Sans gravité (domaine requis → publication bloquée de toute façon), mais données orphelines possibles au save brouillon. Action : vider `subdomain` quand `domain` devient vide, ou afficher le champ toujours.
- **Publier avant Enregistrer (Edit) invite une action qui échoue — pré-existant** : le bouton Publier s'active sur l'état du formulaire client ; cliquer Publier sans Enregistrer envoie un POST sans données → le serveur revalide la ligne persistée (incomplète) et flashe `publish.incomplete`. Sûr (garde serveur) mais UX trompeuse. Action : désactiver Publier tant que le brouillon a des modifications non enregistrées.

## TICKET — Suite fonctionnelle incompatible avec la CI (Postgres propre) → **EPIC 8**

**Planification** : rattaché à l'**Epic 8 (Migration VPS / durcissement CI-CD)**, à traiter APRÈS les epics 6 et 7 et la mise en ligne (décision du 2026-06-02).
**Statut** : step `Run functional tests` marqué `continue-on-error: true` dans `.github/workflows/ci.yml` (non bloquant) le 2026-06-02. À retirer une fois corrigé.

**Symptôme** : en CI (Postgres fraîchement migré) la suite functional échoue à **80/142** ; en local (Supabase) elle passe (26 échecs = pollution données). La suite n'avait **jamais** tourné en CI propre car la commande `node ace test --suite unit` (flag `--suite` inexistant) faisait tourner toutes les suites dans le step « unit » — corrigé en positionnel (`node ace test unit` / `functional`).

**Cause racine probable** : `db.beginGlobalTransaction()` (dans `each.setup` des tests fonctionnels) ne se propage pas à la connexion du **serveur HTTP in-process** (`testUtils.httpServer().start()`) dans l'environnement CI. Conséquence : les enregistrements créés dans la transaction du test (ex. `AdminUser.create()`) sont **invisibles** à la requête HTTP → `auth.authenticateUsing(['web'])` (admin_middleware.ts:17) échoue (user introuvable) → redirect `/admin/login` (ou `/`) → cascade : aucune écriture admin, assertions `null` (`expected null to not equal null`, `Cannot read properties of null (reading 'id')`), redirections inattendues.

**Erreurs dominantes en CI** : `expected '/' to deeply equal '/admin/(productions|users|login)'` (25+), `expected null to not equal null` (7), `Target cannot be null or undefined` (6), `expected '/admin/login' to deeply equal '/admin/productions'` (4), CSRF `E_BAD_CSRF_TOKEN` absents, HTML Inertia sans nom de page.

**Pistes de correction** :
1. Vérifier la propagation de la transaction globale au serveur HTTP : pool de connexions Lucid (`config/database.ts` — `pool.min/max`), forcer `min:1,max:1` en test, ou utiliser `testUtils.db().truncate()` / migrations fraîches par test plutôt que des transactions globales.
2. Reproduire en local avec un Postgres propre (Docker `postgres:16`) pour itérer sans aller-retour CI.
3. Vérifier que `loginAs()` (authApiClient + sessionApiClient, SESSION_DRIVER=cookie) établit bien la session dans ce contexte.

**Fichiers** : `tests/bootstrap.ts` (plugins + configureSuite httpServer), `tests/functional/**` (each.setup beginGlobalTransaction), `config/database.ts`, `app/middleware/admin_middleware.ts`.

## Deferred from: code review Epic 6 (stories 6.1-6.5) (2026-06-02)

- **Course TOCTOU sur l'unicité du slug** : `generateUniqueSlug` (check) puis insert via hook `@beforeCreate`, hors transaction/verrou. Deux créations concurrentes de même titre → la 2e viole `productions_slug_unique` → 500 non géré (`admin/productions_controller.store`). Faible proba (petite équipe admin) ; l'index protège l'intégrité. Action : try/catch sur la unique-violation + régénération du suffixe (ou advisory lock).
- **Compteur de téléchargement optimiste sur-compte en cas d'échec** : `MediaViewer` incrémente le compteur au clic (`<a href>`) sans observer l'issue ; si le serveur renvoie 404 ou si R2 échoue (aucun `recordDownload`), l'UI affiche +1 à tort jusqu'au rechargement. Le compteur de vues, lui, est correctement gated sur `res.ok`. Action : retirer l'incrément optimiste du download, ou le confirmer via une réponse observable.
- **Inflation des vues / dédup / rate-limit** : `POST /stats/view` (exempté CSRF, sans auth ni rate-limit) insère 1 vue par requête, sans dédup par session/IP → compteur trivialement gonflable. Inhérent à un compteur public. Dédup → **Epic 7** (agrégation/métriques) ; rate-limiting → **Epic 8** (infra). Documenté.
- **iframe embed `allow-scripts` + `allow-same-origin`** : combinaison qui affaiblit le sandbox sur une URL externe (curée par l'admin). Risque accepté/documenté (nécessaire pour la plupart des embeds type YouTube). Réévaluer si on autorise des embeds non fiables.
- **Duplication `slugify`** (migration `add_slug_to_productions_table` ↔ `ProductionService.generateSlug`) : identiques aujourd'hui, sans source partagée ni test d'équivalence → risque de divergence si l'une est éditée. Action éventuelle : test d'égalité ou extraction d'un helper partagé importable par la migration.

## Deferred from: code review Epic 7 (stories 7.1-7.4) (2026-06-02)

- **Top-10 / agrégats = sous-requêtes corrélées (perf)** : `StatsService.libraryStats` lance ~7 requêtes par chargement du dashboard (3 `count`, 2 top-10 avec `withAggregate` corrélé par production publiée, 2 scans 30j). Même pattern que `home_controller.publishedWithCounts` — OK à l'échelle communautaire actuelle. Action si le volume croît : index sur `stats_views(production_id)`/`stats_downloads(production_id)`, ou table d'agrégats matérialisée / cache.
- **Seeder démo : pic d'évolution sur un seul jour** : `production_demo_seeder` insère les `stats_views`/`stats_downloads` sans date → la colonne prend `default now()` → toute l'évolution 30j s'affiche en un pic le jour du seed. Artefact démo (pas de données prod). Action éventuelle : répartir `recorded_at`/`downloaded_at` sur les 30-60 derniers jours dans le seeder pour une démo réaliste.
- **Fuseau horaire des stats (robustesse)** : le bucketing 30j repose sur la cohérence de zone Luxon entre `DateTime.now()` (squelette) et `recordedAt` hydraté par Lucid (vérifié cohérent par défaut, même zone process). Action de robustesse (non urgent) : fixer explicitement la zone (ex. UTC) côté Lucid + service pour éviter toute dérive si la config TZ du process change.
- **Dropdown admins non borné (logs)** : `ActivityLogsController` charge tous les admins pour le filtre (borné par l'effectif admin, trivial). Action si l'effectif grandit : recherche/typeahead.
