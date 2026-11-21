
## Deferred from: code review of Epic 2 (stories 2.1-2.6) (2026-06-01)

- **AC texte vs comportement réel (Stories 2.2)** — les AC4/AC5 disent "422" et AC7 "403/419", mais le code retourne 302+flash (idiome Inertia/Shield, correct et testé). Action : réconcilier le texte des AC + corriger l'over-claim "tous les AC satisfaits" dans les Completion Notes. Pas un défaut de code.
- **Test E2E first_login_flow service-level (Story 2.6)** — le test simule les étapes au niveau modèle et hardcode les cibles de redirection au lieu d'exercer controller+middleware. AC4 l'autorise explicitement. Action Phase 2 : ajouter un vrai test browser (Playwright, suite `browser`) qui clique le flux login → change-password → dashboard.

## Deferred from: code review of Epic 4 (stories 4.1-4.8) (2026-06-01)

- **Liens `embed` sans allowlist d'hôtes (SSRF / iframe) — Story 4.5** : `createLinkValidator` n'impose que http/https. Aucun sink en Epic 4 (URL rendue en texte). Action **Story 6.3** : à l'implémentation du rendu iframe `embed`, ajouter sandbox + allowlist d'hôtes de confiance, et rejeter hôtes privés/loopback si fetch serveur (oEmbed/preview).
- **`mime_type` stocké depuis le type déclaré client — Story 4.4** : `files_controller.store` persiste `${file.type}/${file.subtype}` (déclaré) plutôt que le type vérifié par magic bytes. Pas de sink en Epic 4. Action **Epic 6** (serving) : utiliser le type vérifié pour le `Content-Type` des téléchargements/lecteurs.
- **`Pagination` sans fenêtrage — Story 4.2** : rend tous les numéros de page (`1..lastPage`). Non urgent (catalogue petit). Action : ajouter un fenêtrage (ex. `1 … 4 5 6 … N`) quand le volume de productions croît.

## Deferred from: code review of Epic 5 (stories 5.1-5.7) (2026-06-01)

- **`<title>`/meta non rafraîchis en navigation SPA — Story 5.5** — *titre traité en 10.4 (2026-11-19) : `<Head>` de `PublicLayout` ; og:* client non synchronisés (sans effet pour les robots)* : les meta SEO vivent uniquement dans l'edge (serveur, `ssr:false`). Objectif SEO crawlers (premier chargement) atteint, mais lors d'un `router.visit` client le titre d'onglet et les og:* restent ceux de la page initiale. Action éventuelle : ajouter `<Head>` Inertia côté pages publiques pour synchroniser titre/meta client-side (amélioration, hors AC 5.5).
- **`<title>` de `/privacy-policy` générique « Anta » — Story 5.5** : conforme à la story (meta privacy = bonus). Amélioration mineure : donner un titre/description dédiés à la page de confidentialité.
- **`Pagination` sans fenêtrage (rappel) — Story 5.4** : déjà listé ci-dessus (revue Epic 4). Exposé désormais sur la page publique `/productions` ; ajouter fenêtrage + ellipses (`1 … 4 5 6 … N`) quand le volume croît. Impacte aussi l'admin.

## Deferred from: code review of QA-refinement cycle (2026-06-02)

- **`parseWorkDate` accepte des dates valides au regex mais invalides au calendrier — pré-existant (Epic 4)** : `production_validator` valide `^\d{4}-\d{2}-\d{2}$` ; `2024-02-30`/`2024-13-01` passent puis `DateTime.fromISO(...).isValid` est faux → `parseWorkDate` renvoie `null` silencieusement (date saisie « disparaît » sans erreur). Le `<input type=date>` l'empêche côté client ; seul un POST direct/malformé l'atteint. Action : valider la date réelle dans le validateur (VineJS date rule) plutôt qu'un simple regex.
- **`down()` de la migration subdomain→jsonb est destructif** : `subdomain TYPE varchar USING (subdomain->>0)` ne garde que le 1er élément (perte des sous-domaines multiples au rollback) ; `[]` → NULL. Inhérent à un repli tableau→scalaire ; documenté. Action éventuelle : logguer un avertissement dans `down()`.
- **Sous-domaine requis mais champ masqué quand domaine vide — faible impact** : le champ sous-domaine (ChipField) n'est rendu que si `domain` non vide ; si l'admin vide `domain` après avoir saisi des sous-domaines, les valeurs `data.subdomain` persistent (cachées) et sont comptées « remplies ». Sans gravité (domaine requis → publication bloquée de toute façon), mais données orphelines possibles au save brouillon. Action : vider `subdomain` quand `domain` devient vide, ou afficher le champ toujours.
- **Publier avant Enregistrer (Edit) invite une action qui échoue — pré-existant** : le bouton Publier s'active sur l'état du formulaire client ; cliquer Publier sans Enregistrer envoie un POST sans données → le serveur revalide la ligne persistée (incomplète) et flashe `publish.incomplete`. Sûr (garde serveur) mais UX trompeuse. Action : désactiver Publier tant que le brouillon a des modifications non enregistrées.

## ~~TICKET — Suite fonctionnelle incompatible avec la CI (Postgres propre)~~ → **résolu en Story 8.4 (2026-11-16)**

**Cause réelle** (pas la transaction globale) : le client de test `sessionApiClient` écrit la session dans le store `memory` ; la CI exportait `SESSION_DRIVER=cookie`, qui prime sur `.env.test` (`memory`). Le serveur ne voyait jamais la session (CSRF invalide, `loginAs` sans effet). Correctif : `SESSION_DRIVER: memory` dans `ci.yml` et `scripts/test-local.sh`, 2 tests périmés de `home.spec.ts` alignés sur la taxonomie fixe, `continue-on-error` retiré. Historique ci-dessous.


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

## Deferred from: Quick Dev spec-unified-form-taxonomy (2026-06-12)

- ~~**Bouton Partager (site public)**~~ — livré (ShareButton + og:url). Voir `inertia/components/public/ShareButton.tsx`.

## Deferred from: Quick Dev spec-fix-upload-limit-100mb (2026-06-30)

- **Gestion gracieuse du 413 >110 Mo** : `app/exceptions/handler.ts` ne couvre que `404` et `500..599` ; un upload >110 Mo déclenche `E_REQUEST_ENTITY_TOO_LARGE` (413) → fallback framework default (pas de flash/redirect Inertia). Le fix a rétréci la fenêtre opaque (>20 Mo → >110 Mo) sans l'éliminer. Action : ajouter une `413` status page ou une branche `handle()` convertissant `E_REQUEST_ENTITY_TOO_LARGE` en redirect-back + flash pour les requêtes Inertia.
- ~~**Vérification timeout / body-cap Render (Free tier)**~~ — obsolète : Render décommissionné (8.5) ; sur le VPS, nginx `client_max_body_size 110m` (8.3). Ancien texte : `render.yaml` `plan: free` (512 Mo RAM, 0.1 vCPU). Un upload 100 Mo sur connexion lente peut dépasser le timeout de requête plateforme Render (et un éventuel cap body proxy) → 5xx avant le bodyparser. Le fix Adonis est nécessaire mais peut être insuffisant sur Free tier. Action : vérifier le timeout requête et le body-size limit du plan Render déployé ; envisager presigned upload direct-to-R2 si bloqué.
- **Pre-check `Content-Length` + cap concurrence (durcissement)** : `autoProcess: true` stream le body vers tmp disque avant la validation par-fichier ; un body hostile de 500 Mo stream ~110 Mo avant abort. La route est admin-only (exposition bornée) mais sans rate-limit ni cap de concurrence. Action (défense en profondeur) : rejeter tôt si `Content-Length > MAX_FILE_SIZE_BYTES + headroom`, et/ou cap le nombre d'uploads multipart concurrents.
- **Scopage de la limite multipart à la route d'upload** : `config/bodyparser.ts` `multipart.limit: '110mb'` est global ; aujourd'hui seule `/admin/productions/:id/files` accepte du multipart, donc inoffensif. Le prochain endpoint multipart (CSV import, avatar…) héritera silencieusement du plafond 110 Mo. Action : config bodyparser par-route ou middleware nommé pour l'upload, plutôt qu'un relèvement global.
- **Constante partagée pour le contrat « 100 Mo max »** : la limite 100 Mo vit en 4 valeurs non liées (`file_storage_service.ts:12` `100*1024*1024`, `inertia/lib/file_constraints.ts:7` idem, `files_controller.ts:25` `'100mb'`, `config/bodyparser.ts` `'110mb'`). Un relèvement futur de la limite par-fichier sans MAJ du bodyparser = bug silencieux. Action : dériver la limite bodyparser d'une constante serveur partagée (`MAX_FILE_SIZE_BYTES + ENVELOPE_HEADROOM`).
- **Message `FileStorageService.validate` sur taille nulle + formatage** : `file_storage_service.ts:30-34` affiche `0 Mo (max 100 Mo)` pour `file.size` nul/indéfini et arrondit à l'entier tandis que le client utilise `toFixed(1)`. Pré-existant mais désormais atteignable pour de vrais oversize. Action : garer le cas zéro et aligner le formatage sur le client.
- **Vérification cleanup tmp sur chemin de rejet** (Render décommissionné en 8.5 : à vérifier désormais dans le conteneur du VPS, dont le tmp n'est purgé qu'à la recréation) : sur rejet (>100 Mo), le tmp file est laissé au cleanup fin-de-requête AdonisJS ; confirmer qu'il est bien purgé sur le disque éphémère Render (une fuite coûte 5,5× plus cher qu'à 20 Mo). Action : vérifier le comportement sur disque éphémère Render, ou purge explicite.

## Deferred from: code review Epic 7 (stories 7.1-7.4) (2026-06-02)

- **Top-10 / agrégats = sous-requêtes corrélées (perf)** : `StatsService.libraryStats` lance ~7 requêtes par chargement du dashboard (3 `count`, 2 top-10 avec `withAggregate` corrélé par production publiée, 2 scans 30j). Même pattern que `home_controller.publishedWithCounts` — OK à l'échelle communautaire actuelle. Action si le volume croît : index sur `stats_views(production_id)`/`stats_downloads(production_id)`, ou table d'agrégats matérialisée / cache.
- **Seeder démo : pic d'évolution sur un seul jour** : `production_demo_seeder` insère les `stats_views`/`stats_downloads` sans date → la colonne prend `default now()` → toute l'évolution 30j s'affiche en un pic le jour du seed. Artefact démo (pas de données prod). Action éventuelle : répartir `recorded_at`/`downloaded_at` sur les 30-60 derniers jours dans le seeder pour une démo réaliste.
- **Fuseau horaire des stats (robustesse)** : le bucketing 30j repose sur la cohérence de zone Luxon entre `DateTime.now()` (squelette) et `recordedAt` hydraté par Lucid (vérifié cohérent par défaut, même zone process). Action de robustesse (non urgent) : fixer explicitement la zone (ex. UTC) côté Lucid + service pour éviter toute dérive si la config TZ du process change.
- **Dropdown admins non borné (logs)** : `ActivityLogsController` charge tous les admins pour le filtre (borné par l'effectif admin, trivial). Action si l'effectif grandit : recherche/typeahead.

## Deferred from: code review of 9-1-creer-et-modifier-une-fiche-auteur (2026-11-18)

- **Paramètre `page` non borné** : `Math.max(1, Number(page) || 1)` laisse passer `Infinity`, `1.5`, `1e21` (offset incohérent). Même patron dans les contrôleurs admin productions, activity_logs, authors et public productions. Action : helper commun `Number.isSafeInteger` + `Math.floor`.
- **Bouton dans un lien** : `<Link><Button/></Link>` produit `<a><button>` (HTML invalide, deux arrêts de tabulation). Patron de toutes les pages admin. Action : `Button asChild` autour du `Link`.
- **Normalisation des clés** : `normalizeKey` (NFD) n'unifie pas `'`/`’`/`ʼ`, trait d'union/espace, ni `ł`, `ø`, `æ`, `đ`. Conforme à P2.1 ; à reconsidérer avant le dédoublonnage des auteurs/institutions (9.5/9.6). **Auteurs : traité en 9.5** pour la proposition de conversion (`AuthorConversionService.groupKey` assimile apostrophes et tirets ; `normalizeKey` inchangé). Reste ouvert pour les institutions (`institution_key`).

## Deferred from: code review of 9-2-liste-des-auteurs-filtres-et-suppression (2026-11-18)

- **Dialogs de confirmation** : `role="alertdialog"` posé sur un `Dialog` Radix (fermeture au clic extérieur et Échap, focus initial sur le premier bouton). Même patron dans Users/Productions. Action : ajouter la primitive shadcn `alert-dialog` et migrer les dialogs de suppression.
- **Performance de la recherche d'auteurs** : `search_name LIKE '%t%' OR similarity(...) > 0.3` n'utilise pas l'index GIN trigram (seuls les opérateurs `%`/`LIKE` seuls le peuvent) ; `quickFilterCounts` et `institutionOptions` balaient les tables à chaque page. Action pour 9.7 (autocomplétion) : `LIKE` seul ou opérateur `%` avec `pg_trgm.similarity_threshold`, cache léger des compteurs. *9.7 (2026-11-18)* : `GET /admin/authors/search` réutilise la même logique avec `limit(10)` (quelques centaines de fiches) ; report maintenu jusqu'à un volume qui le justifie (D-9.7-b).

## Deferred from: code review of 9-3-photo-d-un-auteur (2026-11-18)

- **Objets R2 orphelins** : variantes envoyées avant le commit ; un arrêt du processus entre les deux, ou l'échec de la suppression best-effort de l'ancien préfixe, laisse des objets sous `authors/<id>/<token>/` sans référence. Action : commande planifiée qui liste `authors/` et supprime les préfixes absents de `authors.photo_key` et âgés de plus d'une heure.
- **Limites d'envoi** : limite multipart globale 110 Mo (pour les PDF) ; une photo au-delà donne un 413 (modal Inertia) au lieu de `photo_size`, et le fichier est écrit sur disque avant le refus. Action : limite multipart par route pour `/admin/authors`.
- **Envoi R2 sans délai d'expiration** : un `putObject` bloqué fige la requête. Action : `AbortSignal.timeout` ou course avec délai.
- **URLs signées des avatars** : nouvelles à chaque rendu, donc jamais en cache navigateur ; pas de `loading="lazy"` dans la liste. Action : durée de signature arrondie ou diffusion publique (Epic 10, `/media`).
- **Constantes dupliquées** : 5 Mo et 40 Mpx répétés dans `image_service`, le validateur, `author_form.ts` et les libellés FR/EN.

## Deferred from: code review of 9-4-confirmer-et-retirer-le-consentement-d-un-auteur (2026-11-18)

- **Noms accessibles des actions de ligne** : « Modifier », « Supprimer », « Confirmer / Retirer le consentement » identiques sur chaque ligne de la liste des auteurs (WCAG 2.4.6). Action : `aria-label` avec le nom de l'auteur (« Supprimer Jean FICTIF »), à appliquer aussi aux listes Productions et Utilisateurs.
- **Case de consentement désactivée** : `disabled` natif retire la case de l'ordre de tabulation ; la raison (« Complétez d'abord une affiliation. ») n'est lue qu'en mode lecture. Action : `aria-disabled` focusable comme les actions de la liste.

## Deferred from: code review of 9-5-proposition-et-validation-de-la-table-de-conversion-des-auteurs (2026-11-18)

- ~~**Liens comptés approximativement dans le rapport de `authors:validate`**~~ — traité en 9.6 : le rapport d'`authors:apply` (et son `--dry-run`) compte les liens réellement insérés ; le plan de `validate` reste indicatif. Ancien texte : quand la fiche cible est déjà liée à la production (par un autre nom), le plan compte quand même un lien. Exact en 9.6 (`ON CONFLICT DO NOTHING`, rapport d'`apply` sur les lignes réellement insérées).

## Deferred from: code review of 9-6-application-idempotente-et-verification-de-la-conversion (2026-11-18)

- **Interblocage possible entre `authors:apply` et un renommage concurrent** — `apply` verrouille toutes les productions puis insère des liens (verrou `KEY SHARE` sur les fiches) ; un renommage verrouille la fiche puis ses productions. Postgres annule l'une des deux (l'`apply` renvoie « modification concurrente », rien d'écrit). Procédure : geler les modifications admin pendant `apply`, relancer `authors:verify` juste après.
- **Renommage d'une fiche liée à une production partiellement rattachée** — la production garde l'ancien nom dans `productions.authors` jusqu'au prochain `propose` / `apply` (D-9.6-f). Question ouverte à Aurélien : acceptable jusqu'à la bascule 9.7 ?

## Revue de code de la Story 9.7 (2026-11-18)

- **Surlignage de la correspondance** dans les options d'`AuthorCombobox` (`<mark>`, `components.author-combobox.match-highlight` de DESIGN.md) : non livré (correspondance insensible aux accents à reporter sur le texte affiché).
- **Auteur supprimé entre-temps** : l'erreur `productions.form.errors.author_unknown` ne nomme pas la fiche disparue ; l'admin doit retirer lui-même l'auteur concerné (la suppression est déjà refusée pour une fiche liée, cas limite d'une fiche ajoutée à la sélection non enregistrée).
- **Index trigram de la recherche d'auteurs** : `LIKE '%t%' OR similarity` non indexé (voir plus haut), conservé pour `GET /admin/authors/search` (D-9.7-b).

## Deferred from: code review of 9-8-creer-un-auteur-sans-quitter-le-formulaire-de-production (2026-11-18)

- **Fichiers temporaires multipart non supprimés avant le contrôleur** : quand Shield (CSRF) ou l'authentification refusent une requête multipart, le bodyparser a déjà écrit le fichier dans `tmpdir()` et aucun `finally` de contrôleur ne s'exécute. Préexistant, toutes les routes multipart (auteurs, fichiers de production). Action : middleware de nettoyage après réponse, ou `tmpFileName` dans un dossier purgé périodiquement.
- **Clé d'idempotence pour `POST /admin/authors/quick`** : une perte de réseau après le commit fait renvoyer la fenêtre par l'admin → seconde fiche. Action : en-tête `Idempotency-Key` généré à l'ouverture de la fenêtre, mémorisé quelques minutes côté serveur.
- **Avertissement d'homonyme avant création** (question PO) : la fenêtre ne signale pas une fiche existante au nom proche ; la liste de résultats du combobox reste la seule aide.

## Deferred from: code review of 10-1-politique-de-confidentialite-des-auteurs-et-page-404-traduite (2026-11-19)

- **Langue serveur / client divergente à la première visite** (préexistant) : sans cookie `i18n_lang`, le serveur rend les meta et `<html lang>` en français alors qu'i18next peut détecter l'anglais du navigateur et afficher la page en anglais (titre de la 404 et de la politique compris). Action : poser le cookie côté serveur depuis `Accept-Language`, ou aligner la détection client sur le cookie seul.
- **Youch perdu sur les 404 en développement** (décision acceptée) : la NotFoundPage est rendue dans tous les environnements ; une 404 inattendue (`findOrFail`) n'affiche plus la pile en dev, seul l'avertissement journalisé par `report` subsiste.

## Deferred from: dev of 10-2-photos-d-auteurs-publiques-et-composant-avatar (2026-11-19)

- **Avatars de l'admin toujours en URL signées** (suite de « URLs signées des avatars », 9.3) : non mis en cache navigateur ; les profils publics pourraient utiliser `/media` (question PO 10.2), les non publics doivent rester signés.

## Deferred from: code review of 10-3-page-de-profil-d-un-auteur (2026-11-19)

- **Tri « Titre (A → Z) » sensible aux accents** : `lower(title)` suit la collation de la base (un titre en « É » peut se ranger après « Z »). L'extension `unaccent` n'est pas installée (aucune migration) et n'est pas ajoutée (base partagée, P2.1 « normalisation applicative ») : à traiter avec le tri par titre de la liste (12.1), par une clé normalisée (`normalizeKey`) ou une collation ICU.
- ~~**Titre d'onglet non rafraîchi en navigation interne**~~ — traité en 10.4 (le titre devenait même « Anta » après hydratation sur toutes les pages publiques). Ancien texte (rappel du report Epic 5) : pas de `<Head>` public, le titre du profil n'est juste qu'au premier chargement ; une navigation Inertia vers ou depuis un profil garde l'ancien titre. À traiter avec 10.4 (liens d'auteurs) / 10.7 (SEO).
- **Slug en majuscules → 404** : `/authors/Jeanne-Exemple` ne retrouve pas `jeanne-exemple` (comparaison exacte), comme `/productions/:slug`. Accepté (slugs générés en minuscules) ; une redirection 301 vers le slug canonique reste possible.

## Deferred from: code review of 10-6-filtre-auteur-du-listing-par-profil-public (2026-11-19)

- **Facette auteur non bornée** : `facets.author` liste tous les auteurs visibles à chaque `GET /productions` (une requête, toutes les lignes dans les props Inertia). Acceptable à quelques centaines d'auteurs ; au-delà, plafonner (auteurs les plus productifs + auteurs cochés) ou charger la facette à la demande (endpoint JSON paresseux à l'ouverture du groupe « Auteur »).

## Deferred from: dev of 10-8-tests-auteurs-sur-le-site-public (2026-11-19)

- **Lighthouse mobile 4G sur le staging (AC 3 de 10.8, NFR17)** : `/authors` et un profil, LCP < 3 s, à lancer par Aurélien après déploiement de l'Epic 10 et à consigner dans la story 10.8 (services distants hors des sessions de dev).
- ~~**Suite `browser` + axe (architecture P2.8)**~~ — **refusée par Aurélien le 2026-11-21** : pas de dépendance `@axe-core/playwright` ni de suite `browser` ; accessibilité couverte par les tests de source et l'audit Lighthouse manuel.
- **`/media` sert la photo d'un auteur consentant sans production publiée** (question PO 10.8) : conforme à 10.2 (public = consentement), clé jamais exposée tant que le profil n'est pas visible ; aligner sur `visibleOnSite` si le PO le souhaite (le test de matrice l'indique).

## Deferred from: code review of 11-1-vignette-d-une-production-dans-le-panel-admin (2026-11-21)

- **Erreurs serveur de `FileUploader` jamais affichées** : `files_controller.ts` utilise `session.flashErrors` (sac `errorsBag`), or seul `inputErrorsBag` devient la prop Inertia `errors` (`@adonisjs/inertia`, `getValidationErrors`) → `props.errors.file` reste vide (MIME falsifié, fichier absent). Corriger comme `thumbnails_controller.ts` (`flashValidationErrors`) dans une story de l'Epic 4/11.
- **Envois simultanés de vignettes (11.4)** : Inertia annule la visite synchrone en cours ; `FeaturedSlot` doit utiliser `async: true` ou un verrou « occupé » au niveau de la page.
- **Aperçu du poster vidéo dans `ThumbnailField` (11.3)** : prop poster + mention « Image extraite de la vidéo » (DESIGN.md).

## Deferred from: dev of 11-2-diffusion-publique-des-images-de-la-banniere (2026-11-21)

- ~~**Test « ratios extrêmes » d'`image_service.spec.ts` (11.1) instable sous charge**~~ — **résolu** à la revue de 11.2 : budgets 15 s + `.timeout(30_000)`.
- **Cache `immutable` des vignettes** : une image dépubliée reste affichée depuis le cache navigateur (jusqu'à un an) chez qui l'a chargée — accepté (P2-10), information PO ; évolution possible : `max-age` plus court sans `immutable`.
- **`sizes` de l'emplacement `lead` (11.6)** : l'image étirée de la bannière à 3 éléments (`lg:aspect-auto lg:flex-1`) n'est pas prise en compte → recalculer dans `FeaturedBanner`.
