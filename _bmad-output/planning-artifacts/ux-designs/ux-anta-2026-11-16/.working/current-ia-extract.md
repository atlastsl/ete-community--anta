# Extraction de l'architecture d'information actuelle (Anta, branche `development`, 2026-11-16)

Analyse en lecture seule du code. Chemins relatifs à la racine du dépôt.

## 1. Routes (`start/routes.ts`)

### Public (layout `PublicLayout`, entrée `inertia/app.tsx`, vue edge `inertia_layout`)
| Méthode / URL | Contrôleur | Page Inertia / réponse |
|---|---|---|
| GET `/` (home) | `public/home_controller.ts#index` | `home` (`inertia/pages/home.tsx`) |
| GET `/productions` | `public/productions_controller.ts#index` | `productions` (listing + recherche + filtres) |
| GET `/productions/:slug` | `#show` | `production` (détail) ; 404 → `errors/not_found` |
| GET `/productions/:slug/files/:fileId/download` | `#download` | 302 vers URL signée R2 (+ enregistre le téléchargement) ; échec R2 → flash `productions.download_unavailable` |
| GET `/privacy-policy` | `public/pages_controller.ts#privacy` | `privacy-policy` |
| POST `/stats/view` | `public/stats_controller.ts#view` | 204 (beacon, sans CSRF) |
| GET `/health` | closure | JSON `{status, revision}` |
| GET/POST `/signup`, `/login`, POST `/logout` | legacy starter (`new_account_controller`, `session_controller`) | `auth/signup`, `auth/login` (hérités, non utilisés par le produit) |

### Admin (préfixe `/admin`, layout `AdminLayout`, entrée `inertia/admin.tsx`, vue `admin_layout`)
| URL | Contrôleur | Page |
|---|---|---|
| GET/POST `login` | `admin/auth_controller` | `admin/Auth/Login` |
| POST `logout` | idem | - |
| GET/POST `auth/change-password` | idem | `admin/Auth/ChangePassword` (forcé tant que `passwordChanged=false`) |
| GET `productions` | `admin/productions_controller#index` | `admin/Productions/Index` (filtres q, status, category, domain, language) |
| GET `productions/create`, POST `productions` | `#create/#store` | `admin/Productions/Create` |
| GET `productions/:id/edit`, PUT `productions/:id`, DELETE | `#edit/#update/#destroy` | `admin/Productions/Edit` |
| POST `productions/:id/publish` / `unpublish` | idem | - |
| POST/DELETE `productions/:productionId/files[/:fileId]` | `admin/files_controller` | - |
| POST/DELETE `productions/:productionId/links[/:linkId]` | `admin/links_controller` | - |
| GET `stats` | `admin/dashboard_controller#stats` | `admin/Stats/Index` |
| super_admin : GET `users`, `users/create`, POST `users`, PATCH `users/:id/toggle-active`, POST `users/:id/reset-password`, DELETE `users/:id` | `admin/users_controller` | `admin/Users/Index`, `admin/Users/Create` |
| super_admin : GET `activity` | `admin/activity_logs_controller` | `admin/ActivityLogs/Index` |

Middleware : `middleware.admin()` (auth + isActive + rôle + redirection change-password), `middleware.superAdmin()`.
Pas de route publique « auteur », « catégorie » ni « recherche avancée » dédiée : tout passe par `/productions?…`.

## 2. Navigation publique et changement de langue

`inertia/layouts/PublicLayout.tsx` :
- **Header** (sticky) : logo (lien `/`, `aria-label="Anta — Accueil"`) + `LanguageSwitcher`. **Aucun lien de navigation ni barre de recherche dans le header.**
- **Footer** (3 colonnes) : logo + `footer.about` ; nav « Explorer » : Accueil (`/`), Rechercher (`/productions`, clé `nav.search`), Politique de confidentialité ; Contact `mailto:contact@anta.community` ; ligne copyright.
- Lien « skip to content » ; `<Toaster position="top-center" richColors />` (sonner).
- Pas de lien « recherche avancée » : le listing `/productions` (barre de recherche + `FilterSidebar` à facettes + tri + toggle liste/grille + pagination) en tient lieu. Sur l'accueil, `FilterBar` (mode catégories) affiche des puces → `/productions?category=X`.
- Fil d'Ariane sur le détail : Accueil / Productions (`inertia/pages/production.tsx` l.91-99).
- `LanguageSwitcher` (`inertia/components/shared/LanguageSwitcher.tsx`) : boutons FR | EN, `i18n.changeLanguage()` côté client (pas d'URL localisée, pas de préfixe `/en`).

## 3. Auteurs : stockage et affichage

- **Stockage** : `productions.authors` = `jsonb NOT NULL DEFAULT '[]'` (tableau de chaînes libres) — `database/migrations/1775918733547_create_productions_table.ts` ; modèle `app/models/production.ts` (`authors: string[]`). Aucune table `authors`, aucun identifiant, aucun lien avec `admin_users`, pas de profil, pas d'ordre/rôle (co-auteur, directeur…). Indexé dans `search_vector` (`authors::text`).
- **Saisie admin** : `inertia/components/admin/ProductionForm.tsx` → `ChipInput` (`inertia/components/admin/ChipInput.tsx`) avec auto-complétion `<datalist>` alimentée par `ProductionService.distinctSuggestions()` (valeurs distinctes existantes, aussi pour tags/sous-domaines). Validation : `app/validators/admin/production_validator.ts` (`vine.array(vine.string().trim()).optional()`). Obligatoire à la publication (`app/services/production_service.ts` l.120, liste des champs manquants). Compté dans `CompletionIndicator`.
- **Affichage public** : `ProductionCard` (« Par A, B ») et détail (`production.tsx` l.115-117) en texte brut `authors.join(', ')` — **non cliquable** (pas de lien vers un filtre ou un profil).
- **Filtre public** : `?author=X` (répétable, OR intra-dimension) → `SearchService.applyJsonbFilter('authors', …)` = `authors @> '["X"]'::jsonb` (`app/services/search_service.ts` l.68-84). Facette = `select distinct jsonb_array_elements_text(authors)` (l.154-175). Dans `FilterSidebar.tsx` (l.51-76), la dimension auteur a un champ de recherche local (filtre `includes` insensible à la casse). Correspondance exacte de chaîne : variantes orthographiques = auteurs distincts.

## 4. Vignettes / couvertures et types de médias

- **Aucun champ vignette/couverture** sur `productions` (ni migration, ni modèle, ni `og:image` dans `resources/views/inertia_layout.edge`). Les cartes sont purement textuelles.
- `category` (string, liste `app/constants/production_taxonomy.ts` : book, article, video, music, podcast, thesis, report, memoir, note, conference_proceedings, working_paper…) indique le genre, pas le mode d'hébergement.
- **Fichiers hébergés** : `production_files` (`file_key`, `original_name`, `mime_type`, `size_bytes`, `storage_provider` défaut `r2`) — `1775918734339_create_production_files_table.ts`. Formats autorisés (`inertia/lib/file_constraints.ts`, revalidés serveur) : PDF, EPUB, MP4, MP3, AAC ; 100 Mo max. Rendu `MediaViewer.tsx` : PDF → iframe, MP4 → `<video>`, MP3/AAC → `<audio>`, EPUB/autre → bouton « Ouvrir » ; URL signée R2 1 h, `url=null` → « aperçu indisponible ».
- **Liens externes** : `production_links` (`url`, `label`, `link_type` enum `embed | simple`) — `1775918735161_create_production_links_table.ts`. `embed` → iframe sandboxée aspect-video (YouTube, etc.) ; `simple` → bouton « Accéder à la source » (`production.tsx` l.149-175).
- `license_status` enum `member | free_license | external_link` : uniquement affiché comme métadonnée (libellé `production_detail.license.*`), ne conditionne pas l'accès côté public.

## 5. Suivi des vues / téléchargements et statistiques

- `stats_views` (`production_id`, `recorded_at` indexé, `ip_hash`, `session_id`) — `1775918736010_…`. Enregistré par `ViewTracker.tsx` après 10 s sur le détail → POST `/stats/view` → `StatsService.recordView` (IP hachée SHA-256 + APP_KEY). Pas de dédoublonnage.
- `stats_downloads` (`production_id`, `downloaded_at` **non indexé**, `ip_hash`) — `1775918736820_…`. Enregistré par la route download.
- `app/services/stats_service.ts` : `productionStats` (totaux + vues/jour sur 30 j, panneau `ProductionStats` de l'admin) ; `libraryStats` (total publiés, totaux vues/téléchargements, top 10 vues et top 10 téléchargements **tous temps**, évolution 30 j). Fenêtre `STATS_WINDOW_DAYS = 30` en dur.
- Pas d'agrégat/vue matérialisée ; les compteurs sont calculés par `withAggregate(count)` à chaque requête. Pour un classement 365 j glissants : filtrer `recorded_at >= now() - 365 days` / `downloaded_at` (prévoir un index sur `downloaded_at`). Aucune notion de stats par auteur (auteurs = chaînes, agrégation via `jsonb_array_elements_text`).

## 6. Accueil actuel

`app/controllers/public/home_controller.ts` (`SECTION_SIZE = 6`) → `inertia/pages/home.tsx` :
1. Hero : eyebrow « Bibliothèque numérique », tagline, sous-titre, `SearchBar` (→ `/productions?q=`), `FilterBar` des catégories (puces → `/productions?category=`).
2. « Les plus consultées » : 6 publiées triées par nombre de vues **tous temps**.
3. « Récemment ajoutées » : 6 triées par `anta_published_at desc`.
Chaque section : grille de `ProductionCard` ; vide → `home.empty`. Pas de lien « voir tout », pas de bloc mis en avant/éditorial, pas de suggestions, pas de bloc auteurs, pas de compteurs globaux. Aucun champ `featured` en base.
Détail : pas de bloc « productions similaires ». Actions : `ShareButton`, téléchargement par fichier.

## 7. Navigation admin et rôles

`inertia/layouts/AdminLayout.tsx` (sidebar, desktop seulement : avertissement `layout.mobile_warning` sur mobile) :
- Productions (`/admin/productions`), Statistiques (`/admin/stats`) ; super admin seulement : Utilisateurs (`/admin/users`), Journal d'activité (`/admin/activity`).
- Pied de sidebar : badge rôle (`role.super_admin` / `role.admin`), Déconnexion. Toast ambre persistant pour le mot de passe temporaire après reset.
- Rôles : `app/enums/admin_role.ts` = `admin | super_admin` (`admin_users.role`, `is_active`, `password_changed`, `session_version`). Journal : `admin_activity_logs`, `app/enums/action_type.ts` (login, create, update, publish, unpublish, delete, password_reset).
- Statuts de production : `draft | published | unpublished` (`StatusBadge`).

## 8. i18n

- react-i18next, deux instances isolées (`inertia/lib/i18n/shared.ts`, `public.ts`, `admin.ts`) ; locales `fr` (fallback) et `en`.
- Fichiers : `inertia/locales/public/{fr,en}.json` (clés : a11y, pagination, nav, actions, language_switcher, footer, home, search, filters, production_card, production_detail, media, productions, sort, listing, privacy, taxonomy) ; `inertia/locales/admin/{fr,en}.json`.
- Détection : cookie `i18n_lang` → localStorage → navigateur → `fr`. Le serveur lit le cookie (`SeoService.localeFromCookieHeader`) pour les meta SEO (`ssr: false`). Libellés de taxonomie via `taxonomyLabel()` (`inertia/lib/taxonomy.ts`). Les contenus (titres, résumés, auteurs) ne sont pas traduits.

## 9. États vides / chargement / erreur, toasts

- **Vides** : accueil `home.empty` (texte gris centré par section) ; listing `productions.no_results[_for]` + lien `productions.reset_filters` si filtres actifs ; résultats approchants (`pg_trgm`) avec bandeau `productions.approximate_notice` ; admin `productions.empty_title/description` (`admin/Productions/Index.tsx` l.211), `stats.empty`.
- **Chargement** : pas de skeleton ni `animate-pulse` ; états `processing` (boutons désactivés / `Loader2`) dans les formulaires admin (`Login`, `ChangePassword`, `Productions/Create|Edit`, `Users/Create`, `FileUploader`, `LinkManager`, `ProductionFormActions`). Navigation publique Inertia sans indicateur dédié.
- **Erreurs** : `inertia/pages/errors/not_found.tsx` et `server_error.tsx` = placeholders bruts (« Page not found », non traduits, sans layout soigné) ; status pages actives seulement en production (`app/exceptions/handler.ts`). Média : `media.unavailable`. Beacon de vue : échec silencieux.
- **Toasts** : sonner. Public : flash serveur `error`/`success` = clés i18n traduites, `top-center`, fermés à chaque navigation. Admin : helper `inertia/lib/notify.ts` (+ `notify_options.ts`) — succès vert 3 s, erreur rouge persistante avec bouton Fermer, info 3 s, bas-droite, 3 max.

## Écarts notables pour la Phase 2
- Auteurs = chaînes libres sans identité → profils/pages auteurs exigent une entité `authors` + table de conversion.
- Pas de vignette, pas de `featured`, pas de bloc éditorial, pas de suggestions/similaires.
- Classements actuels = tous temps ; 365 j demande filtre temporel (+ index `downloaded_at`).
- Header sans navigation ni recherche ; pages 404/500 à concevoir.
