---
stepsCompleted:
  [
    step-01-validate-prerequisites,
    step-02-design-epics,
    step-03-create-stories,
    step-04-final-validation,
  ]
status: complete
completedAt: 2026-04-04
lastEdited: '2026-11-16'
inputDocuments:
  [
    '_bmad-output/planning-artifacts/prd.md',
    '_bmad-output/planning-artifacts/architecture.md',
    '_bmad-output/planning-artifacts/ux-design-specification.md',
    '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/EXPERIENCE.md',
    '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/DESIGN.md',
    '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/.decision-log.md',
  ]
editHistory:
  - date: '2026-11-15'
    changes: 'Epic 8 (Infrastructure VPS) révisé par sprint-change-proposal-2026-11-15.md.'
  - date: '2026-11-16'
    changes: 'Epic 8 amendé (staging sur le VPS partagé avec Coffee Chat, Story 8.3).'
  - date: '2026-11-16'
    changes: 'Phase 2 (Growth) ajoutée : inventaire FR5/FR9/FR17/FR21/FR36 modifiés, FR44–FR61, NFR16–NFR20, exigences d architecture P2.x/P2-xx et décisions UX D1–D36 ; carte de couverture étendue ; Epics 9 (Référentiel d auteurs), 10 (Auteurs sur le site public), 11 (Vignettes et à la une), 12 (Accueil refondu et suggestions), 13 (WCAG 2.1 AA) — 33 stories. Portes manuelles : conversion des auteurs (Story 9.6) et bascule (Story 9.7) sur validation du CSV par Aurélien ; rattrapage des images extraites (Story 11.3) sur accord d Aurélien. ux-design-specification.md obsolète pour la Phase 2.'
  - date: '2026-11-16'
    changes: 'Corrections du rapport implementation-readiness-report-2026-11-16.md : 9.7 (colonne authors plus écrite depuis la requête, seeder de démo avec auteurs et pivot, photoUrl du combobox), 9.6 (COALESCE, doublons dans une production), 9.1 (alias #helpers), 11.3 (poster après création de la ligne), 11.5 (recompactage DELETE + INSERT, journal après commit), 12.5 (stats de démo datées), FR5 précisée (D12).'
---

# anta - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for anta, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

Epics 1–7 couvrent le MVP (livré), l'Epic 8 l'infrastructure VPS. Les Epics 9–13 couvrent la Phase 2 (Growth, ajoutée le 2026-11-16) à partir du PRD amendé, de la section « Phase 2 — Growth » d'`architecture.md` et de la révision UX `ux-designs/ux-anta-2026-11-16/`.

## Requirements Inventory

### Functional Requirements

FR1: Un visiteur peut effectuer une recherche textuelle sur l'ensemble des métadonnées des productions
FR2: Un visiteur peut filtrer les résultats par catégorie (livre, article, vidéo, musique, podcast...)
FR3: Un visiteur peut filtrer les résultats par domaine
FR4: Un visiteur peut filtrer les résultats par sous-domaine
FR5: Un visiteur peut filtrer les résultats par auteur
FR6: Un visiteur peut filtrer les résultats par langue
FR7: Un visiteur peut filtrer les résultats par pays de publication
FR8: Un visiteur peut filtrer les résultats par statut de licence (production membre / licence libre / lien externe)
FR9: La page d'accueil affiche deux sections (productions les plus consultées + productions récemment ajoutées) — la barre de recherche et les filtres sont visibles et utilisables dès l'arrivée, sans recherche active par défaut
FR10: Un visiteur peut consulter la page de détail d'une production avec l'intégralité de ses métadonnées publiques
FR11: Un visiteur peut lire un document PDF ou EPUB directement dans le navigateur via un lecteur intégré
FR12: Un visiteur peut visionner une vidéo MP4 directement dans le navigateur via un lecteur intégré
FR13: Un visiteur peut écouter un fichier audio MP3 ou AAC directement dans le navigateur via un lecteur intégré
FR14: Un visiteur peut télécharger une production hébergée (PDF, EPUB, MP4, MP3, AAC)
FR15: Un visiteur peut accéder à la source externe d'une production sous copyright (lien embed ou lien simple)
FR16: Un visiteur peut consulter le nombre de vues et de téléchargements d'une production sur la page de listing et sur la page de détail
FR17: Un administrateur peut créer une production en renseignant ses métadonnées : titre, auteur(s), catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, journal/revue, éditeur, ISBN/DOI/ISSN, institution d'affiliation, licence, statut
FR18: Un administrateur peut associer à une production un ou plusieurs fichiers hébergés (PDF, EPUB, MP4, MP3, AAC)
FR19: Un administrateur peut associer à une production un ou plusieurs liens externes (embed ou lien simple)
FR20: Un administrateur peut enregistrer une production en tant que brouillon sans remplir tous les champs ni la publier
FR21: Un administrateur peut publier un brouillon — la publication requiert que toutes les métadonnées soient renseignées (titre, auteur(s), catégorie, domaine, sous-domaine, langue, date de publication, résumé, tags, pays, licence, statut) et qu'au moins un fichier ou lien soit associé ; le système valide ces conditions avant autorisation
FR22: Un administrateur peut modifier une production (brouillon ou publiée) et enregistrer les modifications sans déclencher de republication automatique
FR23: Un administrateur peut dépublier une production publiée, qui repasse en état brouillon
FR24: Un administrateur peut supprimer une production du système
FR25: Le système enregistre une vue 10 secondes après l'ouverture de la page de détail d'une production
FR26: Le système enregistre un téléchargement à chaque téléchargement d'une production
FR27: Un administrateur peut consulter les statistiques (vues, téléchargements) par production dans le panel admin
FR28: Un administrateur peut consulter une vue agrégée des statistiques de l'ensemble de la bibliothèque
FR29: Le super administrateur peut consulter les statistiques d'activité des administrateurs : productions enregistrées par admin, productions modifiées par admin, logs de connexion
FR30: Un administrateur peut s'authentifier sur le panel admin avec son email et son mot de passe
FR32: Le super administrateur peut créer un compte administrateur
FR33: Le super administrateur peut désactiver un compte administrateur
FR34: Le super administrateur dispose d'un compte unique, initialisé à la création du site (via seeder)
FR35: Le système gère trois niveaux de dates par production : date de publication de l'œuvre (saisie admin, publique) / dates de création et modification système (automatiques, internes) / date de publication sur Anta (première publication, interne)
FR36: Le système génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production du site public
FR37: Le panel d'administration est exclu de l'indexation par les moteurs de recherche (robots.txt + noindex)
FR38: Le site public affiche une politique de confidentialité accessible depuis toutes les pages
FR39: Le système permet la suppression d'un compte administrateur et de ses données de connexion associées
FR40: Le site public et le panel admin affichent l'intégralité de leur interface en français et en anglais — l'utilisateur bascule via un sélecteur de langue visible sur toutes les pages
FR41: La langue sélectionnée est mémorisée (cookie i18n_lang) et restaurée automatiquement lors des visites suivantes
FR42: Un administrateur doit définir un nouveau mot de passe lors de sa première connexion, avant d'accéder au panel (le mot de passe provisoire est à usage unique)
FR43: Le super administrateur peut réinitialiser le mot de passe d'un compte administrateur (génération d'un nouveau mot de passe provisoire envoyé par email)

### NonFunctional Requirements

NFR1: Chargement initial du site public < 3 secondes sur connexion standard
NFR2: Réponse aux recherches et filtres < 1 seconde pour le 95e percentile sous charge normale
NFR3: Téléversement : taille maximale 100 Mo par fichier ; formats acceptés : PDF, EPUB, MP4, MP3, AAC
NFR4: Toutes les communications chiffrées via HTTPS (site public et panel admin)
NFR5: Mots de passe hashés en base de données (scrypt — défaut AdonisJS)
NFR6: Sessions admin avec expiration automatique après 2 heures d'inactivité (configurable via variable d'environnement)
NFR7: Protection CSRF activée sur toutes les actions du panel admin
NFR9: Logs de connexion et d'activité admin conservés dans le système
NFR10: Fichiers hébergés : PDF, EPUB, MP4, MP3, AAC ≤ 100 Mo
NFR11: Fichiers > 100 Mo ou contenus sous copyright : lien externe uniquement, aucun hébergement
NFR12: Intégrité des fichiers hébergés garantie — zéro perte acceptable
NFR13: Disponibilité 99% — site public et panel admin (≤ 7 heures d'indisponibilité par mois)
NFR14: L'architecture supporte une charge communautaire moyenne sans interruption de service
NFR15: Priorité stabilité sous usage normal ; pas de montée en charge extrême requise

### Additional Requirements

- **Init projet** : Initialisation via `npm init adonisjs@latest anta -- --kit=inertia --adapter=react --install` (AdonisJS 6 + Inertia.js + React + TypeScript + Vite)
- **Migrations PostgreSQL** : 7 tables à créer — `admin_users`, `productions`, `production_files`, `production_links`, `stats_views`, `stats_downloads`, `admin_activity_logs`
- **Trigger tsvector** : Trigger PostgreSQL sur `productions` mettant à jour `search_vector` (GIN index) sur INSERT/UPDATE — couverture : title, summary, authors, tags, category, domain, subdomain, language
- **Seeder super admin** : `SuperAdminSeeder.ts` — initialise le compte super_admin unique (FR34)
- **Variables d'environnement** : `.env.example` documentant toutes les variables requises (DB, R2, mail, session)
- **Configuration R2** : `config/drive.ts` avec driver S3 Cloudflare R2 (endpoint, bucket, credentials) ; `FileStorageService` gère upload, suppression et URL signées (TTL 1h)
- **Configuration mail** : `config/mail.ts` avec Resend (principal) + Mailgun (fallback) via `@adonisjs/mail`
- **Branches Git** : `master` (production), `development` (centralisation des updates), `staging` (test/démo, connectée à Render, puis au VPS de staging `anta.peraha.com` — Epic 8) — chaque story part d'une branche depuis `development`, merge sur `development` après validation locale, PR `development → staging` pour déploiement test
- **Hébergement phase initiale** : Render Free Tier (auto-deploy depuis `staging`) — keep-alive via cron externe (14 min)
- **Hébergement phase finale (Epic 8, révisé 2026-11-15)** : dev sur VPS via Tailscale + Doppler ; staging en Docker Compose sur le VPS partagé avec Coffee Chat, derrière son nginx (révisé 2026-11-16) ; production sur VPS dédié en Docker Compose + Caddy (TLS Let's Encrypt automatique) ; Doppler pour le dev seulement, `.env` sur les VPS de staging et de production
- **CI/CD** : Phase initiale — `ci.yml` (lint + tests sur PR vers `development` et `staging`) ; Phase finale (Epic 8) — `deploy-staging.yml` (image GHCR depuis `staging`) et `deploy-production.yml` (promotion de l'image depuis `master`)
- **Session timeout** : 2 heures d'inactivité (configurable)
- **Enum ProductionStatus** : Source de vérité unique — `'draft' | 'published' | 'unpublished'` — jamais de strings en dur
- **ActivityLogService** : Service centralisé pour tous les logs admin — actions : `login | create | update | publish | unpublish | delete | password_reset`
- **Double validation** : VineJS côté serveur + Zod côté client (mêmes règles, duplication intentionnelle)
- **Internationalisation** : Structure `inertia/locales/{public,admin}/{fr,en}.json` — tous les textes via `react-i18next`, jamais de strings en dur dans les composants
- **Bouncer policies** : `admin` (role admin OU super_admin), `superAdmin` (super_admin uniquement)
- **Middleware auth** : `AdminMiddleware` (auth + redirect change-password si `password_changed = false`) + `SuperAdminMiddleware`
- **Flux première connexion** : Mot de passe provisoire → changement obligatoire (`password_changed = false`) → dashboard
- **Tests** : `tests/unit/` (services, validators) et `tests/functional/` (contrôleurs) via Japa
- **Vite double entry point** : `inertia/app/app.tsx` (public) + `inertia/app/admin.tsx` (admin)

### UX Design Requirements

UX-DR1: Implémenter le composant `SearchBar` — champ texte full-width sur homepage (style hero centré), compact sur la page listing ; déclenche la recherche au submit (Enter ou bouton)
UX-DR2: Implémenter le composant `FilterBar` avec `FilterChip` multi-select — chips cliquables pour catégorie, domaine, sous-domaine, auteur, langue, pays, licence ; bouton "Effacer filtres" visible uniquement quand au moins un filtre est actif
UX-DR3: Implémenter le composant `ProductionCard` avec deux variantes : liste (horizontal, compact) et grille (vertical, image cover optionnelle) — afficher vues et téléchargements sur les deux variantes
UX-DR4: Implémenter le composant `ListingToggle` (icônes ☰ liste / ⊞ grille) — état persisté en localStorage ; liste par défaut
UX-DR5: Implémenter l'affichage du nombre de résultats ("{N} résultats") et le dropdown "Trier par" (pertinence / date / vues / téléchargements) sur la page listing
UX-DR6: Implémenter le composant `CompletionIndicator` sticky en haut du formulaire admin — affiche "{N}/{total} champs — {missing} requis pour publier" avec liste des champs manquants cliquables ; états : incomplet (orange) / complet (vert → bouton Publier actif) ; mis à jour en temps réel via onChange
UX-DR7: Implémenter le composant `FileUploader` avec drag-and-drop — états : vide / drag-over (bordure green-700 animée) / en cours (barre de progression) / succès / erreur (format ou taille) ; validation MIME + 100Mo côté client avant upload
UX-DR8: Implémenter le composant `MediaViewer` — lecteur PDF/EPUB (à décider dans l'epic : iframe, react-pdf ou autre), lecteur vidéo MP4 (HTML5 `<video>`), lecteur audio MP3/AAC (HTML5 `<audio>`) ; tous avec contrôles natifs
UX-DR9: Implémenter le composant `LanguageSwitcher` dans le header — bascule FR/EN via react-i18next + sauvegarde cookie `i18n_lang` ; `aria-current="true"` sur la langue active
UX-DR10: Implémenter le composant `ViewTracker` (invisible) — mount → setTimeout(10 000ms) → POST `/stats/view` → cleanup au unmount
UX-DR11: Implémenter le composant `LinkManager` dans le formulaire admin — liste des liens existants + formulaire "Ajouter un lien" (URL + type embed/simple + label) ; ajout inline sans rechargement
UX-DR12: Implémenter la pagination numérotée (`Pagination.tsx`) — avec paramètres URL persistants (?page=N) ; visible sur la page listing
UX-DR13: Implémenter le système de toasts — 4 types : succès (vert, 3s), erreur (rouge, persistant + bouton fermer), avertissement (ambre, bannière), info (gris, 3s) ; max 3 simultanés ; `role="status"` + `aria-live="polite"`
UX-DR14: Implémenter les modaux de confirmation pour actions destructrices (suppression production, dépublication, désactivation admin, reset MDP) — `role="alertdialog"`, focus piégé, fermeture par Échap ; bouton destructeur rouge à droite
UX-DR15: Appliquer le design system : palette green-700 (primary), amber-900 (accent — utilisable en texte et fond décoratif), stone-50 (background), stone-600 (texte secondaire) ; typographie Playfair Display (titres h1–h2) + Inter (corps) ; via variables CSS Tailwind v4 + shadcn/ui
UX-DR16: Implémenter la hiérarchie des boutons (4 niveaux) + 5 états (default, hover, focus avec ring green-700, disabled, loading avec spinner) ; jamais deux boutons primaires simultanément dans la même zone
UX-DR17: Implémenter la validation de formulaire `onBlur` — messages d'erreur en `text-red-600 text-sm` sous chaque champ, liés via `aria-describedby`
UX-DR18: Implémenter la navigation sidebar admin — état actif : fond `green-100`, texte `green-700`, bordure gauche green-700 3px ; section "Utilisateurs" absente (non grisée) pour les comptes `admin`, visible uniquement pour `super_admin`
UX-DR19: Implémenter les états vides pour chaque surface : résultats de recherche vides, liste admin vide, statistiques vides, fichiers production vides — ton factuel, icône picto `text-stone-300`
UX-DR20: Implémenter l'accessibilité WCAG 2.1 AA : skip link "Aller au contenu principal" (sr-only focus:not-sr-only), focus visible `ring-2 ring-green-700 ring-offset-2` sur tous les éléments interactifs, cibles tactiles ≥ 44×44px, HTML sémantique (`<main>`, `<nav>`, `<header>`, `<aside>`), `aria-expanded` sur dropdowns, `aria-current="page"` sur navigation active
UX-DR21: Implémenter le responsive site public mobile-first — SearchBar pleine largeur mobile, FilterChips en scroll horizontal (scroll-snap), grille 1→2→3 colonnes selon breakpoint, page détail 2 colonnes sur desktop
UX-DR22: Implémenter le responsive panel admin desktop-first — sidebar fixe sur `lg:`, collapsible sur tablette ; message d'avertissement pour accès mobile ("Veuillez utiliser le panel admin sur un ordinateur")
UX-DR23: Implémenter la homepage avec deux sections distinctes ("Les plus consultées" + "Récemment ajoutées") et la SearchBar + FilterBar visibles dès l'arrivée sans recherche active

### Functional Requirements — Phase 2 (Growth)

_Source : `prd.md` amendé les 2026-11-15 et 2026-11-16 (arbitrages UX D1, D5, D16, D17). Pour la Phase 2, les FR modifiées remplacent la version MVP listée ci-dessus._

FR5 (modifié Phase 2, précisé 2026-11-16) : Un visiteur peut filtrer les résultats par auteur, parmi les auteurs enregistrés à profil public (FR52, FR53, D12)
FR9 (modifié Phase 2) : La page d'accueil affiche, dans cet ordre : la barre de recherche et son bouton « Recherche avancée » (FR44), la bannière des productions à la une (FR48), puis quatre blocs titrés — « Récemment publiées », « Les plus consultées », « Les plus téléchargées », « Auteurs les plus consultés » (FR45–FR46). Aucune recherche n'est active par défaut
FR17 (modifié Phase 2) : Un administrateur peut créer une production en renseignant ses métadonnées : titre, auteur(s) choisis parmi les auteurs enregistrés (FR54), catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, journal/revue, éditeur, ISBN/DOI/ISSN, institution d'affiliation, licence, statut
FR21 (modifié Phase 2) : La publication d'un brouillon requiert toutes les métadonnées (titre, au moins un auteur enregistré, catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, licence, statut) et au moins un fichier ou lien associé ; le système valide ces conditions avant autorisation
FR36 (modifié Phase 2) : Le système génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production et chaque page de profil d'auteur du site public
FR44 : Un visiteur accède à la recherche avancée (listing complet avec filtres, même destination que le lien du pied de page) via un bouton « Recherche avancée » placé à côté de la barre de recherche
FR45 : Chaque bloc titré de l'accueil affiche 3 éléments et un bouton « Voir plus » : Récemment publiées (date de publication sur Anta ↓ → listing trié par date), Les plus consultées (→ listing trié par vues), Les plus téléchargées (→ listing trié par téléchargements), Auteurs les plus consultés (3 auteurs à profil public dont les productions publiées cumulent le plus de vues → liste des auteurs, tri par défaut)
FR46 (amendé 2026-11-16) : Les classements « consultées », « téléchargées » et « auteurs » portent sur les 365 derniers jours glissants ; un élément à 0 sur la période n'y figure pas ; à égalité, la production la plus récemment publiée sur Anta passe en premier ; les nombres affichés restent les totaux ; un bloc vide n'est pas affiché
FR47 : Un administrateur sélectionne de 0 à 3 productions publiées à mettre à la une et définit leur ordre ; la sélection reste affichée jusqu'à sa modification
FR48 : La bannière à la une s'affiche en tête de l'accueil, sans titre de section, absente si aucune sélection ; écran large : 1 = pleine largeur, 2 = deux colonnes égales, 3 = la 1re en 2/3, les deux suivantes empilées dans le tiers restant ; mobile : empilées dans l'ordre
FR49 : Chaque production à la une affiche uniquement sa vignette, son titre, son ou ses auteurs et ses totaux de vues et de téléchargements ; un clic ouvre sa page de détail
FR50 (amendé 2026-11-16) : La vignette est un attribut facultatif de la production (formulaire ou écran « À la une ») ; quand elle existe, elle illustre la production sur le site public (bannière, cartes, suggestions, Open Graph) ; obligatoire pour la une, sauf vidéo hébergée (image extraite à défaut) ; une vidéo en lien externe seulement requiert une vignette
FR51 : Une production dépubliée ou supprimée est retirée automatiquement de la sélection à la une
FR52 : Un administrateur crée et modifie une fiche auteur : nom(s) et prénom(s) obligatoires, au moins une affiliation (institution obligatoire, département facultatif ; seules les fiches migrées peuvent n'en avoir aucune, signalées « à compléter »), lien Google Scholar facultatif (URL valide), photo facultative
FR53 (amendé 2026-11-16) : Un profil n'est public qu'après confirmation par un administrateur du consentement de l'auteur (à la création ou plus tard) ; une fiche créée sans elle reste non publique ; le consentement peut être retiré (profil repassé non public) ; confirmation et retrait sont journalisés ; sans consentement, l'auteur n'apparaît ni dans la liste ni dans le bloc auteurs et son nom s'affiche sans lien
FR54 : Dans le formulaire de production, l'administrateur sélectionne les auteurs parmi les auteurs enregistrés, dans un ordre qu'il définit ; plus de saisie libre ; il peut créer un auteur via une fenêtre sans quitter le formulaire, l'auteur créé étant sélectionné automatiquement
FR55 : Une fiche auteur n'est supprimable que si elle n'est associée à aucune production (brouillon ou publiée)
FR56 : Les noms d'auteurs saisis avant la Phase 2 sont rattachés aux fiches selon une table de conversion proposée puis validée par le product owner avant exécution ; chaque production conserve tous ses auteurs et leur ordre ; les fiches migrées sont créées sans consentement
FR57 : Un visiteur consulte la liste paginée des auteurs à profil public ayant au moins une production publiée (photo ou initiales, nom complet, institution principale, nb de productions publiées, total des vues) ; tri par défaut vues 365 j ↓, alternatifs nom (A → Z) et nb de productions ; filtres institution et domaine ; recherche par nom
FR58 : Un visiteur consulte le profil d'un auteur : photo, nom, affiliations, lien Google Scholar, totaux de vues et téléchargements de ses productions publiées, liste paginée de ses productions publiées (date de publication de l'œuvre ↓ ; alternatifs plus consultées, plus téléchargées, titre A → Z)
FR59 : Sur le site public, chaque nom d'auteur à profil public affiché (détail, cartes, bannière) est un lien vers son profil
FR60 : Le pied de page de toutes les pages publiques contient un lien « Auteurs » vers la liste des auteurs
FR61 : La page de détail affiche jusqu'à 4 productions publiées similaires (auteur, tag, sous-domaine ou domaine commun) classées par critère le plus fort, puis nombre de critères partagés, puis date de publication sur Anta ↓ ; production consultée exclue ; section absente sans candidate

### NonFunctional Requirements — Phase 2

NFR16 : Accessibilité — le site public est conforme WCAG 2.1 AA (panel admin hors périmètre) ; pages couvertes : accueil, listing/recherche, détail (lecteurs inclus), liste des auteurs, profil, politique de confidentialité, en FR et EN ; 0 violation A/AA à l'audit automatisé (axe) à chaque livraison ; parcours 1 et 2 réalisables au clavier, focus visible, avec NVDA et VoiceOver ; contrastes ≥ 4,5:1 (texte) et ≥ 3:1 (texte large, composants) ; texte alternatif pour toute image porteuse d'information ; lecteurs pilotables au clavier
NFR17 : Performance — LCP < 3 s sur profil mobile 4G simulé (Lighthouse), y compris l'accueil complet (bannière + 4 blocs), la liste des auteurs et les profils (précise NFR1)
NFR18 : Performance — les métadonnées et le lecteur de la page de détail s'affichent sans attendre les suggestions ; les suggestions apparaissent en moins de 2 s
NFR19 : Stockage — images (vignettes, photos d'auteurs) : JPEG, PNG ou WebP, ≤ 5 Mo par image
NFR20 : Charge — 50 visiteurs simultanés en respectant les seuils de performance ; recherche et filtres < 1 s au 95e percentile, mesuré par test de charge (précise NFR2, NFR14)
NFR9 (précisée Phase 2) : logs de connexion et d'activité admin conservés au moins 12 mois — les nouveaux types d'événements Phase 2 suivent la même règle (aucune purge introduite)

### Additional Requirements — Phase 2 (`architecture.md`, « Phase 2 — Growth (2026-11-16) »)

- **Base partagée dev/staging (non négociable)** : migrations additives uniquement (expand/contract), `down()` écrits mais jamais exécutés, jamais de `rollback`/`fresh`/`reset`/`db:wipe` ; le staging exécute `migration:run --force` au démarrage. Tests sur Postgres local (`npm run test:local`). Dépôt public : aucun nom d'auteur réel, CSV de conversion ou donnée personnelle commité (`tmp/` ignoré)
- **P2.1 Modèle** : tables `authors` (slug figé, `search_name` normalisé, `consent_confirmed_at`/`_by_id`, `migration_key`, `photo_key`), `author_affiliations` (ordonnées, `institution_key`), pivot ordonné `production_authors` (FK auteur `RESTRICT`), `featured_productions` (position PK 1–3, production UNIQUE) ; colonnes `productions.thumbnail_key`, `production_files.poster_key`, `admin_activity_logs.metadata` ; index stats 365 j ; migrations 1–7 (`1775918745000` → `1775918751000`) ; « à compléter » et visibilité dérivées, jamais stockées (P2-03)
- **P2.1 Recherche sans accents** : `app/helpers/normalize.ts` (`normalizeKey`) + `pg_trgm`, sans `unaccent` (P2-04) ; slug via `app/helpers/slug.ts` (extrait de `ProductionService.generateSlug`)
- **P2.1 `productions.authors` expand/contract** : colonne jsonb conservée comme dénormalisation dérivée (`authorNames`), écrite seulement par `ProductionAuthorService` ; trigger `search_vector` inchangé (P2-02) ; « contract » (retrait des chemins texte libre) dans une release ultérieure, après la conversion en production
- **P2.2 Conversion FR56** : commandes Ace `authors:propose|validate|apply|verify` (`commands/`, `app/services/author_conversion_service.ts`), CSV hors dépôt, `apply` transactionnel et idempotent, exécution sur la base partagée **uniquement après validation explicite du CSV par Aurélien** (P2-05)
- **P2.3 Classements** : `app/services/ranking_service.ts`, SQL direct fenêtre 365 j, jointure interne (exclusion des 0), totaux affichés ; cache mémoire TTL 10 min invalidé explicitement ; une et « récentes » non cachées (P2-06)
- **P2.4 Suggestions** : `GET /productions/:slug/suggestions` (JSON, ≤ 4, `Cache-Control: public, max-age=300`), `app/services/suggestion_service.ts`, abandon client à 2 s (P2-07)
- **P2.5 Images** : `sharp` (variantes WebP fixes + `og.jpg`, EXIF retiré, recadrage centré, P2-08) ; image extraite à t = 1 s par `ffmpeg` (apt dans l'image et la CI, synchrone et non bloquant, `poster_key`, rattrapage `thumbnails:extract-video-frames`, P2-09) ; diffusion par `GET /media/*` (clés immuables, contrôle de visibilité, P2-10)
- **P2.6 Routes et contrôleurs** : publics `/authors`, `/authors/:slug`, `/media/*`, suggestions, filtre `author=<slug>` ; admin `/admin/authors` (CRUD, consentement, `search`, `quick`), `/admin/productions/:id/thumbnail`, `/admin/featured` (+ `candidates`) ; transformer unique `app/transformers/production_card_transformer.ts` ; fenêtre « Créer un auteur » en JSON avec `X-XSRF-TOKEN` (P2-14) ; à la une en table + enregistrement transactionnel (P2-11) ; retrait automatique dans `ProductionService` (P2-12)
- **P2.6 Journal** : `ActionType` gagne `consent_confirm`, `consent_withdraw`, `featured_update`, `featured_auto_remove` ; `ActivityLogService.log(..., metadata?)` (P2-13)
- **P2.6 i18n** : `inertia/locales/public/{fr,en}.json` (`home.blocks.*`, `featured.*`, `authors.list.*`, `authors.profile.*`, `suggestions.*`, `not_found.*`) et `inertia/locales/admin/{fr,en}.json` (`authors.*`, `featured.*`, `thumbnail.*`, `activity.action.*`, `activity.resource.*`) ; meta serveur dans `SeoService`
- **P2.7 Permissions** : toutes les routes admin Phase 2 dans `middleware.admin()` (admin et super admin), aucune nouvelle route `superAdmin()` (P2-15) ; commandes non exposées dans le produit ; SEO profil `SeoService.forAuthor` ; `sitemap.xml` facultatif
- **P2.8 Tests** : unit + functional Japa sur Postgres local, `drive.fake('r2')`, images générées par `sharp`, MP4 de test généré par `ffmpeg` ; composants par lecture de source (TS6305) ; suite `browser` + `@axe-core/playwright` (P2-16) ; `EXPLAIN ANALYZE` en local, Lighthouse sur le staging
- **P2.9 Séquence** : schéma → admin auteurs → conversion → **bascule** (porte : `apply` + `verify` 100 %) → site public auteurs → vignettes → à la une → accueil → suggestions → WCAG

### UX Design Requirements — Phase 2 (`ux-designs/ux-anta-2026-11-16/`)

_Sources : `EXPERIENCE.md` (comportement), `DESIGN.md` (visuel), `.decision-log.md` (D1–D36), maquettes `mockups/` : `home.html`, `authors-list.html`, `author-profile.html`, `production-detail-suggestions.html`, `admin-authors-list.html`, `admin-author-picker.html`, `admin-featured.html`. Les spines priment sur les maquettes. `ux-design-specification.md` et `ux-design-directions.html` sont obsolètes pour la Phase 2._

D1 : Vignette = attribut facultatif de la production, affichée partout où présente (bannière, cartes, suggestions, og:image) ; sans vignette : carte texte actuelle
D2 : Cartes des blocs et des suggestions = carte du listing (+ vignette) ; blocs en grille 3 colonnes desktop, 1 colonne mobile
D3 : Carte auteur : photo ou initiales, nom, institution principale, nb de productions publiées, total des vues
D4 : Blocs classés sous-titrés « sur les 12 derniers mois » ; chiffres = totaux
D5 : Bloc à 1–2 éléments affiché avec « Voir plus » ; éléments à 0 sur 365 j exclus ; ex æquo : la plus récemment publiée sur Anta d'abord
D6 : Pas de dédoublonnage bannière / blocs
D7 : Tris vues / téléchargements du listing sur les totaux, exposés dans le sélecteur de tri
D8 : Barre de recherche de l'accueil → listing ; « Recherche avancée » = bouton outline accolé ; puces de catégories supprimées
D9 : Bannière : texte sous la vignette, titre en stretched link, auteurs = liens distincts au-dessus, vignette 16:9 `alt=""`, 3 éléments en 2/3 + 1/3 empilé
D10 : Vidéo hébergée sans vignette : image extraite à t = 1 s au téléversement ; aperçu dans le panel
D11 : Profil sans production publiée ou non public → 404, y compris après dépublication de la dernière production
D12 : Nom sans profil public : texte simple ; filtre auteur limité aux profils publics
D13 : Affichage « Prénom NOM », tri A → Z sur le nom de famille, initiales = 1re lettre du prénom + 1re du nom
D14 : Liste des auteurs 24/page, profil 12/page, tri et filtres dans l'URL ; filtre institution sur toutes les affiliations, dédoublonné sans tenir compte de la casse
D15 : Lien Google Scholar : icône + libellé, nouvel onglet signalé
D16 : Consentement facultatif à la création (fenêtre et fiche) ; sans lui fiche non publique ; la saisie d'une production n'est jamais bloquée
D17 : Action « Retirer le consentement » (journalisée)
D18 : Sélecteur d'auteurs = combobox avec affiliation et badge « à compléter », ordre par ↑ ↓, retrait par ×, pas de glisser-déposer
D19 : Table de conversion FR56 hors produit (CSV validé par Aurélien, script) ; filtres admin « consentement en attente » et « à compléter »
D20 : Page admin « À la une » : 3 emplacements, sélecteur de productions publiées, aperçu, vignette téléversable sur place
D21 : Avertissement dans la confirmation de dépublication/suppression d'une production à la une ; retrait journalisé
D22 : Suggestions : 4 cartes sans raison affichée, 2 colonnes mobile / 4 desktop, squelette, erreur ou > 2 s → section masquée
D23 : Libellés EN (Recently published, Most viewed, Most downloaded, Most viewed authors, See more, Advanced search, Authors, Incomplete)
D24 : Noms d'auteurs liés soulignés stone-300 (2 px), green-700 au survol ; noms sans profil en texte simple
D25 : Avatar à initiales green-100 / green-800 (6,49:1)
D26 : Emplacement sans vignette requise → « Enregistrer » désactivé avec explication ; aperçu limité aux emplacements valides ; enregistrement explicite
D27 : « Confirmer le consentement » indisponible sans affiliation ; « Retirer le consentement » pour les profils publics ; les deux journalisés
D28 : URL `/authors`, `/authors/:slug`, `/admin/authors`, `/admin/featured` ; slug `prenom-nom` (-2…) figé à la création ; `?author=<slug>` ; « Voir plus » → `sort=date|views|downloads`
D29 : Maquettes en Tailwind CDN : artefacts de référence uniquement
D30 : Sélecteur « À la une » = combobox dans l'emplacement libre ; ↑ ↓ et « Retirer » (les suivants remontent) ; confirmation avant de quitter avec des changements non enregistrés
D31 : Liste des auteurs : max-w-7xl, barre de filtres horizontale (Nom, Institution, Domaine, Tri), grille 1/2/3/4 colonnes ; tri par défaut « Les plus consultés (12 derniers mois) »
D32 : Admin auteurs : badges « Public » / « Non public » / « À compléter », tableau (Auteur, Affiliation principale, Productions, Statut, Mise à jour, Actions), filtres rapides avec compteurs, suppression indisponible = `aria-disabled` + infobulle au survol et au focus
D33 : Bordure d'input (1,49:1) conservée, à recontrôler à l'audit manuel (critère 1.4.11)
D34 : NOM en capitales à l'affichage seulement ; pied de page « Recherche avancée » ; région « Productions à la une » ; tris du listing = titres des blocs ; « Créer un auteur » ; champs Nom puis Prénom
D35 : Bannière en colonnes dès `lg`, blocs 3 colonnes dès `md`, suggestions compactes < sm, profil max-w-6xl avec aside statistiques
D36 : Propre nom en texte simple sur son profil ; byline des cartes limitée à 3 + « et {n} autres » ; `alt=""` des photos adjacentes au nom, `alt="Photo de {Prénom NOM}"` sur le profil ; attribut `lang` des contenus ; page hors limites → dernière page ; combobox dès 2 caractères (250 ms), découpage prénom/nom au dernier espace ; ThumbnailField dans « Fichiers » ; NotFoundPage traduite ; départage des auteurs par dernière publication puis nom

### FR Coverage Map

FR1: Epic 5 — Recherche textuelle full-text (tsvector)
FR2: Epic 5 — Filtre par catégorie
FR3: Epic 5 — Filtre par domaine
FR4: Epic 5 — Filtre par sous-domaine
FR5: Epic 5 — Filtre par auteur ; Phase 2 : Epic 10 — filtre parmi les auteurs enregistrés à profil public (Story 10.6)
FR6: Epic 5 — Filtre par langue
FR7: Epic 5 — Filtre par pays
FR8: Epic 5 — Filtre par statut de licence
FR9: Epic 5 — Homepage : 2 sections + search/filters visibles dès l'arrivée ; Phase 2 : Epic 11 (bannière, Story 11.6) + Epic 12 — accueil refondu (Stories 12.1–12.3)
FR10: Epic 6 — Page détail avec métadonnées complètes
FR11: Epic 6 — Lecteur PDF/EPUB intégré
FR12: Epic 6 — Lecteur vidéo MP4 intégré
FR13: Epic 6 — Lecteur audio MP3/AAC intégré
FR14: Epic 6 — Téléchargement de fichiers hébergés
FR15: Epic 6 — Accès à la source externe (lien embed ou simple)
FR16: Epic 5 (listing) + Epic 6 (détail) — Compteurs de vues et téléchargements
FR17: Epic 4 — Création de production avec toutes les métadonnées ; Phase 2 : Epic 9 — auteurs choisis dans le référentiel (Stories 9.7, 9.8)
FR18: Epic 4 — Association de fichiers hébergés (upload R2)
FR19: Epic 4 — Association de liens externes
FR20: Epic 4 — Enregistrement en brouillon
FR21: Epic 4 — Publication avec validation de complétude ; Phase 2 : Epic 9 — au moins un auteur enregistré (Story 9.7)
FR22: Epic 4 — Modification d'une production
FR23: Epic 4 — Dépublication (retour brouillon)
FR24: Epic 4 — Suppression d'une production
FR25: Epic 6 — Enregistrement d'une vue après 10 secondes
FR26: Epic 6 — Enregistrement d'un téléchargement
FR27: Epic 7 — Statistiques par production (panel admin)
FR28: Epic 7 — Vue agrégée des statistiques
FR29: Epic 7 — Statistiques d'activité des admins (super admin)
FR30: Epic 2 — Authentification email + mot de passe
FR32: Epic 3 — Création d'un compte admin (super admin)
FR33: Epic 3 — Désactivation d'un compte admin (super admin)
FR34: Epic 1 — Super admin initial via seeder
FR35: Epic 4 — Gestion des trois niveaux de dates par production
FR36: Epic 5 — Meta tags SSR côté serveur pour pages publiques ; Phase 2 : Epic 10 — profils et liste des auteurs (Story 10.7), Epic 11 — og:image des productions (Story 11.2), Epic 13 — sitemap facultatif (Story 13.3)
FR37: Epic 2 — Panel admin exclu de l'indexation (noindex + robots.txt)
FR38: Epic 5 — Politique de confidentialité accessible depuis toutes les pages
FR39: Epic 3 — Suppression d'un compte admin et de ses données (RGPD)
FR40: Epic 5 — Interface bilingue FR/EN avec sélecteur de langue
FR41: Epic 5 — Persistance de la langue (cookie i18n_lang)
FR42: Epic 2 — Changement de mot de passe obligatoire à la première connexion
FR43: Epic 3 — Réinitialisation du mot de passe admin (super admin)
FR44: Epic 12 — Bouton « Recherche avancée » à côté de la barre de recherche (Story 12.1) ; lien de pied de page renommé (Story 10.5)
FR45: Epic 12 — Blocs titrés de 3 éléments + « Voir plus » (Stories 12.2, 12.3)
FR46: Epic 12 — Classements 365 j glissants, exclusion des 0, départage, totaux affichés, bloc vide absent (Stories 12.2, 12.3)
FR47: Epic 11 — Sélection ordonnée de 0 à 3 productions à la une (Story 11.4)
FR48: Epic 11 — Bannière en tête de l'accueil, dispositions 1/2/3 (Story 11.6)
FR49: Epic 11 — Contenu strict d'une production à la une (Story 11.6)
FR50: Epic 11 — Vignette facultative, réutilisée sur le site, obligatoire pour la une sauf vidéo hébergée (Stories 11.1, 11.2, 11.3, 11.4)
FR51: Epic 11 — Retrait automatique à la dépublication / suppression (Story 11.5)
FR52: Epic 9 — Création et modification d'une fiche auteur, « à compléter » (Stories 9.1, 9.2, 9.3)
FR53: Epic 9 (confirmation / retrait, Story 9.4) + Epic 10 (effets publics : liste, profil, liens, Stories 10.2–10.6) + Epic 12 (bloc auteurs, Story 12.3)
FR54: Epic 9 — Sélection ordonnée depuis le référentiel, création sans quitter le formulaire (Stories 9.7, 9.8)
FR55: Epic 9 — Suppression conditionnelle d'une fiche auteur (Story 9.2)
FR56: Epic 9 — Table de conversion proposée, validée par Aurélien, appliquée et vérifiée (Stories 9.5, 9.6)
FR57: Epic 10 — Liste publique des auteurs (Story 10.5)
FR58: Epic 10 — Profil public d'un auteur (Story 10.3)
FR59: Epic 10 — Noms d'auteurs liés vers leur profil (Story 10.4 ; bannière : Story 11.6)
FR60: Epic 10 — Lien « Auteurs » dans le pied de page (Story 10.5)
FR61: Epic 12 — Suggestions de productions similaires (Story 12.4)

### Couverture Phase 2 — NFR et exigences UX

NFR16 (WCAG 2.1 AA) : Epic 13 (Stories 13.1–13.4) ; critères intégrés aux stories publiques (10.1–10.7, 11.2, 11.6, 12.1–12.4)
NFR17 (LCP < 3 s) : Stories 11.2 (`srcset`, dimensions), 11.6 (image LCP prioritaire), 12.2 (cache des classements), 12.5 et 13.4 (Lighthouse)
NFR18 (suggestions non bloquantes, < 2 s) : Stories 12.4, 12.5
NFR19 (images JPEG/PNG/WebP ≤ 5 Mo) : Stories 9.3, 11.1
NFR20 (50 visiteurs simultanés, recherche p95 < 1 s) : Story 12.5
NFR9 (logs ≥ 12 mois) : Stories 9.1, 9.4, 11.1, 11.4, 11.5 (nouveaux événements, aucune purge)
D1, D2 : 11.1, 11.2, 12.2 · D3 : 10.5, 12.3 · D4, D5 : 12.2, 12.3 · D6 : 12.2 · D7 : 12.1 · D8 : 12.1 · D9 : 11.6 · D10 : 11.3 · D11 : 10.3 · D12 : 10.4, 10.6 · D13 : 9.1, 10.2, 10.5 · D14 : 10.3, 10.5 · D15 : 10.3 · D16 : 9.4, 9.8 · D17 : 9.4, 10.3 · D18 : 9.7 · D19 : 9.2, 9.5, 9.6 · D20 : 11.4 · D21 : 11.5 · D22 : 12.4 · D23 : toutes les stories à libellés (clés EN) · D24 : 10.4 · D25 : 10.2 · D26 : 11.4 · D27 : 9.4 · D28 : 9.1, 10.3, 10.6, 12.2 · D29 : sans objet (maquettes) · D30 : 11.4 · D31 : 10.5 · D32 : 9.2 · D33 : 13.2 · D34 : 10.5, 12.1 · D35 : 10.3, 11.6, 12.2, 12.4 · D36 : 9.8, 10.1, 10.3, 10.4, 10.5, 11.1, 12.3, 13.2

## Epic List

### Epic 1 : Fondations Techniques

L'équipe peut démarrer le développement sur une base de projet cohérente, configurée et déployable — stack initialisée, base de données migrée, branches Git configurées, environnement de test Render opérationnel.
**FRs couverts :** FR34 (seeder super admin)
**NFRs :** NFR4 (HTTPS via Render)
**UX-DRs :** UX-DR15 (design system tokens Tailwind v4 + shadcn/ui)

### Epic 2 : Authentification Admin & Sécurité des Accès

Un administrateur peut se connecter de façon sécurisée et définir son mot de passe permanent à la première connexion avant d'accéder au panel. _Note : 2FA TOTP retiré du MVP (2026-05-31) — réintroduction possible en Phase 2._
**FRs couverts :** FR30, FR37, FR42
**NFRs :** NFR5 (scrypt), NFR6 (session timeout 2h), NFR7 (CSRF)
**UX-DRs :** UX-DR18 (sidebar admin + badge rôle), UX-DR22 (responsive admin + warning mobile)

### Epic 3 : Gestion des Comptes Admin — Super Admin

Le super administrateur peut créer des comptes admin, les désactiver, supprimer leurs données, et réinitialiser leurs mots de passe — permettant de constituer l'équipe administrative avant toute création de contenu.
**FRs couverts :** FR32, FR33, FR39, FR43
**NFRs :** NFR9 (logs d'activité conservés — setup ActivityLogService)

### Epic 4 : Gestion des Productions — Panel Admin

Un administrateur peut créer, modifier, publier, dépublier et supprimer des productions. L'upload de fichiers vers R2 et la gestion des liens externes sont opérationnels. La validation guide la publication.
**FRs couverts :** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR35
**NFRs :** NFR3 (100Mo max), NFR10 (formats hébergés), NFR11 (lien externe si > 100Mo ou copyright), NFR12 (intégrité fichiers)
**UX-DRs :** UX-DR6 (CompletionIndicator), UX-DR7 (FileUploader), UX-DR11 (LinkManager), UX-DR13 (toasts), UX-DR14 (modals confirmation), UX-DR16 (hiérarchie boutons), UX-DR17 (validation formulaire onBlur), UX-DR19 (empty states admin)

### Epic 5 : Site Public — Découverte et Recherche

Un visiteur peut trouver une production via la recherche full-text et les filtres multi-critères, parcourir les sections "Plus consultées" et "Récemment ajoutées" sur la page d'accueil, et changer la langue de l'interface.
**FRs couverts :** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR16 (listing), FR36, FR38, FR40, FR41
**NFRs :** NFR1 (chargement < 3s), NFR2 (recherche < 1s)
**UX-DRs :** UX-DR1 (SearchBar), UX-DR2 (FilterBar + FilterChip multi-select), UX-DR4 (ListingToggle), UX-DR5 (result count + sort), UX-DR9 (LanguageSwitcher), UX-DR12 (Pagination numérotée), UX-DR19 (empty states search), UX-DR20 (accessibilité WCAG 2.1 AA), UX-DR21 (responsive mobile-first), UX-DR23 (homepage 2 sections)

### Epic 6 : Consultation et Téléchargement

Un visiteur peut consulter la page de détail d'une production, lire ou visionner un fichier intégré, télécharger un fichier hébergé ou accéder à une source externe. Les vues et téléchargements sont enregistrés automatiquement.
**FRs couverts :** FR10, FR11, FR12, FR13, FR14, FR15, FR16 (détail), FR25, FR26
**NFRs :** NFR12 (intégrité fichiers)
**UX-DRs :** UX-DR3 (ProductionCard — variante détail), UX-DR8 (MediaViewer PDF/EPUB/MP4/MP3/AAC), UX-DR10 (ViewTracker — setTimeout 10s)

### Epic 7 : Statistiques et Métriques

Un administrateur peut consulter les statistiques par production et en vue agrégée. Le super administrateur peut consulter les logs d'activité des admins.
**FRs couverts :** FR27, FR28, FR29
**Dépend de :** Epic 4 (productions créées), Epic 6 (vues et téléchargements enregistrés)

### Epic 8 : Infrastructure VPS (dev, staging, production)

Le développement, le staging et la production quittent le PC et Render pour des VPS maîtrisés : dev sur VPS via Tailscale, staging public sur `anta.peraha.com`, production en Docker Compose + Caddy, secrets Doppler pour le dev et `.env` sur les VPS, mêmes services externes partout (Supabase, R2, Mailgun). Révisé par `sprint-change-proposal-2026-11-15.md`, puis le 2026-11-16 (staging sur le VPS partagé avec Coffee Chat, Story 8.3).
**NFRs :** NFR4 (HTTPS), NFR13 (disponibilité 99%)
**Dépend de :** 8.1–8.5 aucun epic fonctionnel ; 8.6 (mise en production) après validation des epics fonctionnels sur le staging VPS

**Durcissement CI/CD inclus dans cet epic (Story 8.4) :**
- **Réparer la suite de tests fonctionnels en CI** (actuellement `continue-on-error`, ~80/142 échecs en CI propre). Cause racine probable : `db.beginGlobalTransaction()` non propagé au serveur HTTP in-process → `loginAs()` KO → cascade. Détail complet et pistes dans `_bmad-output/implementation-artifacts/deferred-work.md` (section « TICKET — Suite fonctionnelle incompatible avec la CI »). Une fois corrigé : retirer `continue-on-error` du step `Run functional tests` dans `.github/workflows/ci.yml`.

### Epic 9 : Référentiel d'auteurs — Panel Admin (Phase 2)

Les administrateurs gèrent un référentiel d'auteurs (fiches, affiliations, photo, consentement) et choisissent les auteurs d'une production dans ce référentiel au lieu de les saisir en texte libre ; les noms existants y sont rattachés par une conversion validée par Aurélien. Le site public est inchangé (il lit la colonne dénormalisée `productions.authors`, tenue à jour).
**FRs couverts :** FR17 (modifié), FR21 (modifié), FR52, FR53 (confirmation / retrait), FR54, FR55, FR56
**NFRs :** NFR19 (photos ≤ 5 Mo), NFR9 (journal)
**UX :** D13, D16, D17, D18, D19, D27, D28, D32, D36 — maquettes `admin-authors-list.html`, `admin-author-picker.html`
**Architecture :** P2.1, P2.2, P2.5 (photo), P2.6, P2-01 à P2-05, P2-13 à P2-15
**Porte manuelle :** la bascule du formulaire (Story 9.7) n'est déployée en staging qu'après `authors:apply` + `authors:verify` à 100 % sur la base partagée, sur CSV validé par Aurélien (Story 9.6)

### Epic 10 : Auteurs sur le site public (Phase 2)

Un visiteur découvre les auteurs de la bibliothèque : liste des auteurs à profil public, pages de profil, noms d'auteurs cliquables partout, filtre auteur du listing, pages auteurs référencées. La politique de confidentialité décrit le traitement des données des auteurs avant toute publication de profil.
**FRs couverts :** FR5 (modifié), FR36 (modifié — profils), FR53 (effets publics), FR57, FR58, FR59, FR60, FR44 (lien de pied de page)
**NFRs :** NFR16 (critères intégrés), NFR17
**UX :** D3, D11, D12, D13, D14, D15, D24, D25, D28, D31, D34, D35, D36 — maquettes `authors-list.html`, `author-profile.html`, `production-detail-suggestions.html`
**Architecture :** P2.3 (expression 365 j de la liste), P2.5 (`/media`, photos), P2.6, P2.7
**Dépend de :** Epic 9 (pivot rempli par la conversion)

### Epic 11 : Vignettes et productions à la une (Phase 2)

Les administrateurs illustrent les productions par une vignette (ou l'image extraite d'une vidéo hébergée) et mettent jusqu'à 3 productions à la une ; les visiteurs voient les vignettes dans les cartes et les partages, et la bannière à la une en tête de l'accueil.
**FRs couverts :** FR47, FR48, FR49, FR50, FR51, FR36 (og:image des productions)
**NFRs :** NFR17, NFR19, NFR9 (journal)
**UX :** D1, D2, D9, D10, D20, D21, D26, D30, D35, D36 — maquettes `admin-featured.html`, `home.html`
**Architecture :** P2.5, P2.6 (thumbnails, featured), P2-08 à P2-12
**Dépend de :** Epic 10 (byline liée et `/media` réutilisés)

### Epic 12 : Accueil refondu, recherche avancée et suggestions (Phase 2)

Un visiteur trouve dès l'accueil la recherche avancée, la bannière à la une et quatre blocs titrés (récentes, plus consultées, plus téléchargées, auteurs les plus consultés), et découvre sur chaque page de détail des productions similaires.
**FRs couverts :** FR9 (modifié), FR44, FR45, FR46, FR61
**NFRs :** NFR17, NFR18, NFR20
**UX :** D2, D4, D5, D6, D7, D8, D22, D28, D34, D35 — maquettes `home.html`, `production-detail-suggestions.html`
**Architecture :** P2.3, P2.4, P2-06, P2-07
**Dépend de :** Epic 10 (cartes auteur), Epic 11 (bannière, vignettes)

### Epic 13 : Conformité WCAG 2.1 AA du site public (Phase 2)

Tout visiteur, y compris au clavier ou avec un lecteur d'écran, peut réaliser les parcours 1 et 2 sur le site public ; l'absence de violation A/AA est vérifiée automatiquement à chaque livraison.
**NFRs :** NFR16 (accessibilité), NFR17 (Lighthouse)
**UX :** Accessibility Floor d'`EXPERIENCE.md`, D33, D36 (attribut `lang`)
**Architecture :** P2.7 (`sitemap.xml` facultatif), P2.8 (suite `browser` + axe), P2-16
**Dépend de :** Epics 10–12 (pages Phase 2 livrées)

**Hors épiques Phase 2 :** le « contract » de P2.1 (retrait des chemins de code « texte libre » des auteurs) vient dans une release ultérieure, après la conversion en production (Story 8.6 en attente).

**Total Phase 2 :** 5 epics, 33 stories (Epic 9 : 9, Epic 10 : 8, Epic 11 : 7, Epic 12 : 5, Epic 13 : 4).

---

## Epic 1 : Fondations Techniques

L'équipe peut démarrer le développement sur une base de projet cohérente, configurée et déployable — stack initialisée, base de données migrée, branches Git configurées, environnement de test Render opérationnel.

### Story 1.1 : Initialisation du projet AdonisJS + Inertia + React

En tant que développeur,
Je veux un projet AdonisJS 6 initialisé avec Inertia.js, React, TypeScript et Vite configurés,
Afin que l'équipe puisse démarrer le développement sur une base cohérente et typée.

**Acceptance Criteria:**

**Given** aucun projet n'existe dans le répertoire cible
**When** la commande `npm init adonisjs@latest anta -- --kit=inertia --adapter=react --install` est exécutée
**Then** la structure de répertoires correspond à l'architecture documentée (`app/`, `inertia/`, `config/`, `database/`, `start/`, `tests/`)
**And** TypeScript est configuré (`tsconfig.json`) avec le mode strict activé

**Given** le projet est initialisé
**When** Vite est configuré dans `vite.config.ts`
**Then** deux entry points distincts existent : `inertia/app/app.tsx` (site public) et `inertia/app/admin.tsx` (panel admin)

**Given** le projet est configuré
**When** `node ace serve --watch` est exécuté
**Then** le serveur démarre sans erreur sur le port configuré
**And** le HMR Vite est fonctionnel en développement

**Given** le projet est initialisé
**When** ESLint et Prettier sont configurés
**Then** `npm run lint` et `npm run format` s'exécutent sans erreur sur le code de base
**And** un fichier `.env.example` documente toutes les variables d'environnement requises

---

### Story 1.2 : Migrations PostgreSQL et modèles Lucid

En tant que développeur,
Je veux toutes les tables PostgreSQL créées avec leurs index et les modèles Lucid ORM correspondants,
Afin que les epics suivants puissent stocker et interroger les données sans travail de migration supplémentaire.

**Acceptance Criteria:**

**Given** la connexion PostgreSQL est configurée dans `.env`
**When** `node ace migration:run` est exécuté
**Then** les 7 tables sont créées : `admin_users`, `productions`, `production_files`, `production_links`, `stats_views`, `stats_downloads`, `admin_activity_logs`
**And** toutes les colonnes correspondent au modèle de données de l'architecture (snake_case, types corrects, clés étrangères)

**Given** la table `productions` existe
**When** le trigger PostgreSQL tsvector est installé
**Then** la colonne `search_vector` est mise à jour automatiquement sur INSERT et UPDATE, en couvrant : `title`, `summary`, `authors`, `tags`, `category`, `domain`, `subdomain`, `language`

**Given** le trigger tsvector est actif
**When** un index GIN est créé sur `search_vector`
**Then** `EXPLAIN ANALYZE` confirme l'utilisation de l'index GIN sur les requêtes `@@ to_tsquery`

**Given** les migrations sont exécutées
**When** les modèles Lucid sont créés
**Then** chaque table dispose d'un modèle TypeScript correspondant (`Production`, `AdminUser`, `ProductionFile`, `ProductionLink`, `StatsView`, `StatsDownload`, `AdminActivityLog`) avec les relations déclarées et les types corrects

**Given** les modèles sont créés
**When** les enums TypeScript sont définis
**Then** les fichiers `app/enums/ProductionStatus.ts` (`draft | published | unpublished`), `app/enums/LicenseStatus.ts` (`member | free_license | external_link`) et `app/enums/AdminRole.ts` (`admin | super_admin`) existent et sont utilisés dans les modèles

---

### Story 1.3 : Configuration stockage fichiers Cloudflare R2

En tant que développeur,
Je veux Cloudflare R2 configuré avec un `FileStorageService` centralisé,
Afin que les fichiers puissent être uploadés, servis et supprimés de façon sécurisée dans toute l'application.

**Acceptance Criteria:**

**Given** les credentials R2 (`R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) sont dans `.env`
**When** `config/drive.ts` est chargé au démarrage
**Then** le driver S3 se connecte à R2 sans erreur et le disque `r2` est disponible via `Drive.use('r2')`

**Given** `FileStorageService` est implémenté
**When** `FileStorageService.upload(file, key)` est appelé avec un fichier valide
**Then** le fichier est stocké dans R2 sous la clé fournie et la clé (`file_key`) est retournée — jamais l'URL complète

**Given** une clé R2 existe
**When** `FileStorageService.signedUrl(fileKey)` est appelé
**Then** une URL signée avec TTL de 1 heure est retournée, permettant l'accès temporaire au fichier

**Given** un fichier est soumis à l'upload
**When** `FileStorageService.validate(file)` est appelé
**Then** les fichiers > 100 Mo sont rejetés avec une erreur explicite
**And** les MIME types non autorisés (hors `pdf`, `epub`, `mp4`, `mp3`, `aac`) sont rejetés
**And** les fichiers valides passent la validation sans erreur

**Given** une clé R2 existe
**When** `FileStorageService.delete(fileKey)` est appelé
**Then** le fichier est supprimé de R2 et la suppression est confirmée

---

### Story 1.4 : Configuration service email

En tant que développeur,
Je veux le service email configuré avec Resend (principal) et Mailgun (fallback),
Afin que les emails transactionnels (invitation admin, reset mot de passe) puissent être envoyés de façon fiable.

**Acceptance Criteria:**

**Given** les credentials Resend (`RESEND_API_KEY`) sont dans `.env`
**When** `config/mail.ts` est chargé
**Then** `@adonisjs/mail` est configuré avec Resend comme mailer par défaut

**Given** Mailgun est configuré comme fallback
**When** Resend n'est pas disponible
**Then** Mailgun prend le relais sans modification du code appelant

**Given** la configuration email est en place
**When** un email de test est envoyé via `Mail.send()`
**Then** l'email est reçu avec le bon expéditeur, destinataire et contenu
**And** les templates d'email sont stockés dans `resources/views/emails/`

---

### Story 1.5 : Seeder super administrateur

En tant que développeur,
Je veux un `SuperAdminSeeder` qui initialise le compte super admin unique,
Afin que l'application soit amorçable sans intervention manuelle en base de données (FR34).

**Acceptance Criteria:**

**Given** la base de données est migrée
**When** `node ace db:seed --files SuperAdminSeeder` est exécuté
**Then** un enregistrement existe dans `admin_users` avec `role = 'super_admin'`, `is_active = true`, `password_changed = false`, `password_hash` généré via scrypt

**Given** le seeder a déjà été exécuté
**When** il est exécuté à nouveau
**Then** aucun doublon n'est créé (idempotent — upsert sur l'email)

**Given** les variables `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` sont définies dans `.env`
**When** le seeder s'exécute
**Then** le compte super admin est créé avec ces valeurs
**And** ces variables sont documentées dans `.env.example`

---

### Story 1.6 : Setup internationalisation (react-i18next)

En tant que développeur,
Je veux `react-i18next` configuré avec la structure de fichiers de traduction en place,
Afin que tous les textes d'interface soient internationalisables dès le début du développement, sans refactoring ultérieur.

**Acceptance Criteria:**

**Given** `react-i18next` est installé et configuré
**When** un composant utilise `const { t } = useTranslation()` et `t('nav.search')`
**Then** la chaîne française est retournée si la langue active est `fr`, l'anglaise si `en`

**Given** la structure de fichiers est en place
**When** on inspecte `inertia/locales/`
**Then** les fichiers suivants existent : `public/fr.json`, `public/en.json`, `admin/fr.json`, `admin/en.json` avec des clés de démonstration fonctionnelles

**Given** aucun cookie `i18n_lang` n'est présent
**When** un visiteur charge l'application
**Then** la langue détectée suit l'ordre : cookie `i18n_lang` → localStorage → langue navigateur → français par défaut

**Given** la configuration i18n est en place
**When** un développeur ajoute un texte dans un composant
**Then** l'utilisation d'une string en dur sans passer par `t()` est signalée par ESLint (règle `i18next/no-literal-string`)

---

### Story 1.7 : Design system — Tailwind CSS v4 + shadcn/ui

En tant que développeur,
Je veux Tailwind CSS v4 configuré avec les tokens de design et shadcn/ui installé,
Afin que tous les composants utilisent une palette cohérente, une typographie unifiée et des composants de base prêts à l'emploi (UX-DR15).

**Acceptance Criteria:**

**Given** Tailwind CSS v4 est configuré
**When** les variables CSS sont définies
**Then** les tokens suivants sont disponibles : `--color-primary` (green-700 `#15803d`), `--color-accent` (amber-900 `#78350f`), `--color-background` (stone-50 `#fafaf9`), `--color-text-secondary` (stone-600)

**Given** les tokens sont en place
**When** la palette est documentée dans un commentaire CSS et dans le README de design
**Then** il est explicitement indiqué qu'amber-900 (brun chocolat) peut être utilisé en texte ET fond décoratif (ratio 8.1:1, AAA)

**Given** shadcn/ui est installé
**When** les composants de base sont initialisés (`Button`, `Input`, `Select`, `Dialog`, `Badge`)
**Then** ils sont personnalisés avec la palette green-700 et fonctionnels dans les deux layouts

**Given** les polices sont configurées
**When** l'application charge
**Then** Playfair Display est appliquée aux balises `h1` et `h2`, Inter au corps de texte
**And** les polices sont chargées via Google Fonts avec `display=swap`

**Given** le fichier `_docs/logo_anta_512.png` est présent dans le dépôt
**When** le setup du design system est effectué
**Then** le fichier est copié vers `public/images/logo_anta.png`
**And** `public/favicon.png` pointe vers ce même fichier (ou une copie)
**And** `<link rel="icon" href="/favicon.png">` est présent dans le layout Edge/HTML
**And** le logo est rendu dans `PublicLayout.tsx` via `<img src="/images/logo_anta.png" alt="Anta" className="h-10 w-auto" />` lié à `/`
**And** le logo est rendu dans `AdminLayout.tsx` via `<img src="/images/logo_anta.png" alt="Anta" className="h-8 w-auto" />` lié à `/admin/productions`

---

### Story 1.8 : Configuration des branches Git et déploiement Render

En tant que développeur,
Je veux un dépôt Git configuré avec trois branches (master, development, staging) et un environnement de test/démo déployé automatiquement sur Render depuis staging,
Afin que l'équipe puisse développer par story, tester localement, puis déployer en un clic vers un environnement partagé.

**Acceptance Criteria:**

**Given** le projet est initialisé sur le dépôt Git
**When** les branches sont créées
**Then** trois branches existent : `master` (production), `development` (centralisation des updates), `staging` (test/démo connectée à Render)
**And** `development` est la branche par défaut du dépôt

**Given** les branches sont configurées
**When** un développeur démarre une nouvelle story
**Then** il crée une branche depuis `development` (ex. `feat/1.2-migrations`)
**And** après validation locale, il merge sa branche vers `development`

**Given** du code est prêt à être testé en ligne
**When** une PR `development → staging` est créée et mergée
**Then** Render détecte le push sur `staging` et déclenche un auto-deploy
**And** l'application est accessible via HTTPS sur l'URL Render (TLS automatique — NFR4)

**Given** un service Web Render est créé
**When** la configuration est définie
**Then** le build command est : `npm install && node ace build`
**And** le start command est : `node ace migration:run --force && node build/bin/server.js`
**And** les variables d'environnement sont configurées (DB Supabase, R2, mail, session)
**And** la branche surveillée est `staging`

**Given** Render Free Tier endort l'app après 15 min d'inactivité
**When** un service de monitoring externe (cron-job.org) est configuré
**Then** un ping HTTP est envoyé toutes les 14 minutes vers l'URL Render
**And** l'application reste active sans cold starts

**Given** le workflow `ci.yml` est créé dans `.github/workflows/`
**When** une PR est ouverte vers `development` ou `staging`
**Then** les étapes lint + tests (`node ace test`) sont exécutées
**And** la PR ne peut être mergée que si le workflow CI passe (gate CI)

---

## Epic 2 : Authentification Admin & Sécurité des Accès

Un administrateur peut se connecter de façon sécurisée et définir son mot de passe permanent à la première connexion avant d'accéder au panel.

> **Note — 2FA retiré du MVP (2026-05-31)** : le 2FA TOTP a été jugé trop contraignant pour le MVP. Le périmètre Epic 2 ne couvre plus que login + changement mot de passe première connexion. Le 2FA pourra être réintroduit en Phase 2.

### Story 2.1 : Middleware d'authentification et layouts admin

En tant que développeur,
Je veux les guards d'authentification, les middlewares de rôle et les layouts admin en place,
Afin que toutes les routes admin soient protégées et que l'interface reflète correctement le rôle de l'utilisateur connecté (UX-DR18, UX-DR22).

**Acceptance Criteria:**

**Given** un utilisateur non authentifié tente d'accéder à `/admin/*`
**When** `AdminMiddleware` s'exécute
**Then** il est redirigé vers `/admin/login`

**Given** un utilisateur authentifié avec `password_changed = false` tente d'accéder au dashboard
**When** `AdminMiddleware` s'exécute
**Then** il est redirigé vers la page de changement de mot de passe

**Given** un admin (rôle `admin`) est connecté
**When** `AdminLayout.tsx` est rendu
**Then** la sidebar affiche : Productions, Statistiques — l'entrée "Utilisateurs" est absente (non grisée)
**And** le badge de rôle affiche "Admin"

**Given** un super admin (rôle `super_admin`) est connecté
**When** `AdminLayout.tsx` est rendu
**Then** la sidebar affiche : Productions, Statistiques, Utilisateurs
**And** le badge de rôle affiche "Super Admin" avec une distinction visuelle

**Given** un utilisateur accède au panel admin depuis un écran < 1024px
**When** `AdminLayout.tsx` est rendu
**Then** un message d'avertissement s'affiche : "Veuillez utiliser le panel admin sur un ordinateur"
**And** le contenu du panel est masqué sur mobile

**Given** une route `/admin/users/*` est accédée par un compte `admin`
**When** `SuperAdminMiddleware` s'exécute
**Then** l'accès est refusé (403) et l'utilisateur est redirigé vers le dashboard

---

### Story 2.2 : Page de connexion admin

En tant qu'administrateur,
Je veux me connecter avec mon email et mon mot de passe,
Afin d'accéder au panel admin de façon sécurisée (FR30, NFR5, NFR7).

**Acceptance Criteria:**

**Given** un administrateur accède à `/admin/login`
**When** la page se charge
**Then** un formulaire avec les champs email et mot de passe est affiché
**And** le token CSRF est présent dans le formulaire

**Given** l'administrateur saisit un email et un mot de passe valides
**When** le formulaire est soumis
**Then** les credentials sont vérifiés en base (scrypt verify)
**And** si `password_changed = false`, redirection vers `/admin/auth/change-password`
**And** si `password_changed = true`, redirection vers `/admin/productions` (dashboard)

**Given** l'administrateur saisit des credentials invalides
**When** le formulaire est soumis
**Then** un message d'erreur générique s'affiche : "Email ou mot de passe incorrect"
**And** aucun détail sur l'existence du compte n'est révélé

**Given** le compte admin est désactivé (`is_active = false`)
**When** le formulaire est soumis avec des credentials valides
**Then** la connexion est refusée avec un message : "Ce compte est désactivé"

**Given** le formulaire est soumis sans token CSRF valide
**When** le middleware CSRF s'exécute
**Then** la requête est rejetée (419)

---

### Story 2.3 : Changement de mot de passe à la première connexion

En tant qu'administrateur se connectant pour la première fois,
Je veux définir un mot de passe permanent en remplacement du mot de passe provisoire,
Afin de sécuriser mon compte avant d'accéder au panel (FR42, NFR5).

**Acceptance Criteria:**

**Given** un admin avec `password_changed = false` est authentifié
**When** il accède à n'importe quelle route `/admin/*` (hors `/admin/auth/*`)
**Then** il est automatiquement redirigé vers `/admin/auth/change-password`

**Given** l'admin est sur la page de changement de mot de passe
**When** il saisit un nouveau mot de passe et une confirmation identique
**Then** le nouveau mot de passe est hashé (scrypt) et sauvegardé
**And** `password_changed` passe à `true` en base de données
**And** il est redirigé vers le dashboard `/admin/productions`

**Given** l'admin saisit deux mots de passe différents
**When** le formulaire est soumis
**Then** une erreur de validation s'affiche : "Les mots de passe ne correspondent pas"

**Given** l'admin saisit un mot de passe trop court (< 12 caractères)
**When** le formulaire est soumis
**Then** une erreur de validation s'affiche avec les critères requis

**Given** `password_changed = true` sur le compte
**When** l'admin tente d'accéder à `/admin/auth/change-password`
**Then** il est redirigé vers le dashboard `/admin/productions`

---

### Story 2.4 : Gestion de session (expiration et déconnexion)

En tant qu'administrateur connecté,
Je veux que ma session expire automatiquement après inactivité et que je puisse me déconnecter manuellement,
Afin de réduire le risque d'accès non autorisé à un poste laissé sans surveillance (NFR6).

**Acceptance Criteria:**

**Given** une session admin est active
**When** 2 heures d'inactivité s'écoulent (NFR6)
**Then** la session expire automatiquement
**And** la prochaine requête redirige vers `/admin/login`

**Given** un admin est connecté
**When** il clique sur "Se déconnecter" (POST `/admin/logout` avec CSRF)
**Then** la session est détruite côté serveur et il est redirigé vers `/admin/login`

**Given** un admin se reconnecte après une expiration de session
**When** il fournit des credentials valides (et `password_changed = true`)
**Then** il accède directement au dashboard sans flux d'onboarding

---

### Story 2.5 : Exclusion du panel admin de l'indexation

En tant que responsable SEO,
Je veux que le panel admin soit invisible pour les moteurs de recherche,
Afin que les pages d'administration n'apparaissent jamais dans les résultats de recherche (FR37).

**Acceptance Criteria:**

**Given** l'application est déployée
**When** un robot d'indexation accède à `/robots.txt`
**Then** le fichier contient `Disallow: /admin/`

**Given** un moteur de recherche indexe une page admin
**When** `AdminLayout.tsx` est rendu
**Then** la balise `<meta name="robots" content="noindex, nofollow">` est présente dans le `<head>`

---

### Story 2.6 : Tests fonctionnels authentification

En tant que développeur,
Je veux une suite de tests fonctionnels couvrant tous les flux d'authentification,
Afin de garantir la sécurité des accès à chaque modification du code.

**Acceptance Criteria:**

**Given** `tests/functional/admin/AuthController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Login avec credentials valides + `password_changed = true` → redirection dashboard
- Login avec credentials valides + `password_changed = false` → redirection change-password
- Login avec credentials invalides → message d'erreur générique
- Login avec compte désactivé → accès refusé
- Changement de mot de passe : nouveau MDP valide → `password_changed = true` + redirection dashboard
- Changement de mot de passe : MDP < 12 caractères → erreur de validation
- Changement de mot de passe : confirmation différente → erreur de validation
- Accès route admin sans authentification → redirection login
- Accès route super admin avec rôle admin → 403
- Expiration de session → redirection login
- Logout → session détruite + redirection login
- Protection CSRF → rejet si token absent

---

## Epic 3 : Gestion des Comptes Admin — Super Admin

Le super administrateur peut créer des comptes admin, les désactiver, supprimer leurs données, et réinitialiser leurs mots de passe — permettant de constituer l'équipe administrative avant toute création de contenu.

### Story 3.1 : Service centralisé ActivityLogService

En tant que développeur,
Je veux un `ActivityLogService` centralisé pour tous les logs d'activité admin,
Afin que chaque action significative soit tracée de façon cohérente dans `admin_activity_logs` (NFR9).

**Acceptance Criteria:**

**Given** `app/services/ActivityLogService.ts` est implémenté
**When** `ActivityLogService.log({ adminUserId, actionType, resourceType, resourceId })` est appelé
**Then** un enregistrement est inséré dans `admin_activity_logs` avec les champs : `admin_user_id`, `action_type`, `resource_type`, `resource_id`, `created_at`

**Given** les `actionType` sont définis
**When** on inspecte `ActivityLogService`
**Then** les valeurs suivantes sont supportées : `'login' | 'create' | 'update' | 'publish' | 'unpublish' | 'delete' | 'password_reset'`
**And** toute valeur hors de cet ensemble lève une erreur TypeScript à la compilation

**Given** `ActivityLogService.log()` est appelé
**When** une erreur survient lors de l'insertion en base
**Then** l'erreur est loguée dans les logs serveur mais ne bloque pas l'action principale (fail silently)

**Given** le service est en place
**When** les contrôleurs admin effectuent des actions modifiant des données
**Then** chaque contrôleur appelle `ActivityLogService.log()` — aucun log ad hoc dans les contrôleurs

---

### Story 3.2 : Page de liste des administrateurs

En tant que super administrateur,
Je veux consulter la liste de tous les comptes administrateurs avec leur statut,
Afin d'avoir une vue d'ensemble des accès au panel et de pouvoir agir sur chaque compte.

**Acceptance Criteria:**

**Given** un super admin est connecté et accède à `/admin/users`
**When** la page se charge
**Then** la liste de tous les comptes `admin_users` est affichée (hors le super admin lui-même)
**And** chaque entrée affiche : email, rôle, statut (actif/inactif), date de création, créateur

**Given** aucun compte admin n'existe encore
**When** la page se charge
**Then** un état vide s'affiche : "Aucun administrateur. Créez le premier compte." avec un bouton "Créer un administrateur"

**Given** un compte admin est inactif
**When** il apparaît dans la liste
**Then** il est visuellement distinct (badge "Inactif", opacité réduite) des comptes actifs

**Given** un admin (rôle `admin`) tente d'accéder à `/admin/users`
**When** `SuperAdminMiddleware` s'exécute
**Then** l'accès est refusé et il est redirigé vers le dashboard (403)

---

### Story 3.3 : Création d'un compte admin

En tant que super administrateur,
Je veux créer un nouveau compte administrateur en saisissant son email,
Afin qu'il puisse se connecter et gérer les productions après avoir configuré son accès (FR32).

**Acceptance Criteria:**

**Given** le super admin clique sur "Créer un administrateur"
**When** le formulaire s'affiche
**Then** seul le champ email est requis (le mot de passe provisoire est généré automatiquement)

**Given** le super admin saisit un email valide et soumet
**When** le formulaire est traité
**Then** un enregistrement `admin_users` est créé avec `role = 'admin'`, `is_active = true`, `password_changed = false`, `created_by_id` = id du super admin
**And** un mot de passe provisoire sécurisé (16 caractères aléatoires) est généré et hashé (scrypt)
**And** un email d'invitation est envoyé à l'adresse avec le mot de passe provisoire en clair
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'create', resourceType: 'admin_user' })`

**Given** l'email saisi est déjà utilisé par un compte existant
**When** le formulaire est soumis
**Then** une erreur de validation s'affiche : "Cette adresse email est déjà utilisée"

**Given** le compte est créé avec succès
**When** la redirection s'effectue
**Then** un toast succès s'affiche : "Compte créé. Un email d'invitation a été envoyé."

---

### Story 3.4 : Désactivation d'un compte admin

En tant que super administrateur,
Je veux désactiver un compte administrateur,
Afin d'en bloquer immédiatement l'accès sans supprimer ses données (FR33).

**Acceptance Criteria:**

**Given** le super admin clique sur "Désactiver" sur un compte actif
**When** le modal de confirmation s'affiche
**Then** il indique clairement : "Cet administrateur ne pourra plus se connecter. Ses productions seront conservées."
**And** un bouton "Désactiver" (rouge) et un bouton "Annuler" sont présents

**Given** le super admin confirme la désactivation
**When** l'action est traitée
**Then** `is_active` passe à `false` en base de données
**And** toutes les sessions actives de ce compte sont invalidées immédiatement
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'update', resourceType: 'admin_user' })`
**And** un toast succès s'affiche : "Compte désactivé."

**Given** un compte est désactivé
**When** le super admin clique sur "Réactiver"
**Then** `is_active` repasse à `true` sans modal de confirmation (action réversible)
**And** un toast succès s'affiche : "Compte réactivé."

**Given** un compte désactivé tente de se connecter
**When** les credentials sont soumis
**Then** la connexion est refusée (voir Story 2.2)

---

### Story 3.5 : Réinitialisation du mot de passe d'un admin

En tant que super administrateur,
Je veux réinitialiser le mot de passe d'un administrateur,
Afin qu'il puisse récupérer l'accès à son compte si nécessaire (FR43).

**Acceptance Criteria:**

**Given** le super admin clique sur "Réinitialiser le mot de passe" sur un compte admin
**When** le modal de confirmation s'affiche
**Then** il indique : "Un nouveau mot de passe provisoire sera généré et envoyé par email. L'administrateur devra le changer à sa prochaine connexion."

**Given** le super admin confirme la réinitialisation
**When** l'action est traitée
**Then** un nouveau mot de passe provisoire (16 caractères aléatoires) est généré et hashé (bcrypt)
**And** `password_changed` passe à `false` en base de données
**And** toutes les sessions actives du compte sont invalidées
**And** un email est envoyé à l'admin avec le nouveau mot de passe provisoire en clair
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'password_reset', resourceType: 'admin_user' })`
**And** un toast succès s'affiche : "Mot de passe réinitialisé. Un email a été envoyé."

**Given** l'admin réinitialise son accès
**When** il se connecte avec le nouveau mot de passe provisoire
**Then** il est redirigé vers la page de changement de mot de passe (flux Story 2.3)

---

### Story 3.6 : Suppression d'un compte admin

En tant que super administrateur,
Je veux supprimer définitivement un compte administrateur et ses données personnelles,
Afin de respecter le droit à l'effacement (RGPD) — FR39.

**Acceptance Criteria:**

**Given** le super admin clique sur "Supprimer" sur un compte admin
**When** le modal de confirmation s'affiche
**Then** il indique explicitement : "Cette action est irréversible. Le compte et les logs d'activité associés seront supprimés. Les productions créées par cet administrateur seront conservées."
**And** le bouton de confirmation est rouge et libellé "Supprimer définitivement"

**Given** le super admin confirme la suppression
**When** l'action est traitée
**Then** l'enregistrement `admin_users` est supprimé de la base de données
**And** tous les enregistrements `admin_activity_logs` liés à ce compte sont supprimés
**And** les enregistrements `productions` créés par ce compte voient leur `created_by_id` mis à `null` (conservation des productions)
**And** toutes les sessions actives du compte sont invalidées
**And** un toast succès s'affiche : "Compte supprimé définitivement."

**Given** le compte supprimé tente de se connecter (session expirée non encore nettoyée)
**When** la session est vérifiée
**Then** l'utilisateur est déconnecté et redirigé vers `/admin/login`

---

### Story 3.7 : Tests fonctionnels gestion des comptes

En tant que développeur,
Je veux une suite de tests couvrant toutes les actions de gestion des comptes admin,
Afin de garantir l'intégrité des accès et la conformité RGPD à chaque modification.

**Acceptance Criteria:**

**Given** `tests/functional/admin/UsersController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Accès liste admins en tant que super_admin → succès
- Accès liste admins en tant qu'admin → 403
- Création compte admin valide → enregistrement créé + email envoyé
- Création avec email existant → erreur validation
- Désactivation compte → is_active = false + sessions invalidées
- Réactivation compte → is_active = true
- Réinitialisation MDP → password_changed = false + email envoyé
- Suppression compte → enregistrement supprimé + productions conservées
- Suppression compte → logs d'activité supprimés

**Given** `tests/unit/services/ActivityLogService.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Log créé correctement pour chaque actionType valide
- Erreur DB lors du log → action principale non bloquée

---

### Story 4.1 : Système de toasts (notifications admin)

En tant qu'administrateur,
Je veux recevoir des notifications visuelles claires après chaque action,
Afin de savoir immédiatement si une opération a réussi ou échoué (UX-DR13).

**Acceptance Criteria:**

**Given** le système de toasts est implémenté
**When** une action réussit (création, enregistrement, publication...)
**Then** un toast vert s'affiche en bas à droite pendant 3 secondes avec le message de succès

**Given** une erreur système survient (erreur réseau, upload échoué...)
**When** l'erreur est catchée
**Then** un toast rouge persistant s'affiche avec un bouton "Fermer" et ne disparaît pas automatiquement

**Given** plusieurs toasts sont déclenchés simultanément
**When** ils s'affichent
**Then** ils se superposent verticalement (max 3 simultanés)
**And** les plus anciens disparaissent en premier si la limite est atteinte

**Given** le système de toasts utilise `aria-live`
**When** un toast apparaît
**Then** `role="status"` et `aria-live="polite"` sont présents sur le conteneur (UX-DR20)

---

### Story 4.2 : Liste des productions (panel admin)

En tant qu'administrateur,
Je veux consulter la liste de toutes les productions avec leur statut et accéder aux actions disponibles,
Afin de gérer le catalogue de la bibliothèque efficacement.

**Acceptance Criteria:**

**Given** un admin est connecté et accède à `/admin/productions`
**When** la page se charge
**Then** la liste paginée des productions est affichée avec : titre, auteur(s), catégorie, statut (badge Brouillon/Publié/Dépublié), date de dernière modification
**And** des boutons d'action sont disponibles pour chaque production : "Modifier", "Supprimer" (et "Dépublier" si publiée)

**Given** des productions existent
**When** l'admin filtre par statut (Brouillon / Publié / Dépublié)
**Then** seules les productions du statut sélectionné sont affichées

**Given** aucune production n'existe encore
**When** la page se charge
**Then** un état vide s'affiche : "Aucune production. Commencez par en créer une." avec un bouton "Créer une production" (UX-DR19)

**Given** la liste contient plus de 20 productions
**When** la page se charge
**Then** une pagination numérotée est affichée et les paramètres de page sont reflétés dans l'URL

---

### Story 4.3 : Formulaire de création de production

En tant qu'administrateur,
Je veux créer une nouvelle production en renseignant ses métadonnées via un formulaire guidant,
Afin d'enrichir la bibliothèque avec du contenu structuré et complet (FR17, FR20).

**Acceptance Criteria:**

**Given** un admin clique sur "Créer une production"
**When** la page `/admin/productions/create` se charge
**Then** le formulaire affiche tous les champs de métadonnées organisés en sections : Informations générales (titre, auteur(s), catégorie, domaine, langue, pays), Contenu (résumé, date de l'œuvre), Droits (licence, statut)
**And** le champ sous-domaine est masqué jusqu'à la sélection d'un domaine, puis affiché en tant que champ conditionnel

**Given** le formulaire est affiché
**When** `CompletionIndicator` se rend en sticky en haut du formulaire (UX-DR6)
**Then** il affiche "{N}/{total} champs — {missing} requis pour publier" avec la liste des champs manquants cliquables
**And** il se met à jour en temps réel à chaque `onChange` sans soumission du formulaire
**And** son état est : orange si incomplet, vert si tous les champs obligatoires sont remplis et au moins un fichier ou lien associé

**Given** l'admin quitte un champ sans le remplir
**When** le focus passe à un autre champ (`onBlur`)
**Then** un message d'erreur s'affiche sous le champ en `text-red-600 text-sm`, lié via `aria-describedby` (UX-DR17)

**Given** l'admin clique sur "Enregistrer brouillon"
**When** le formulaire est soumis
**Then** la production est créée avec `status = 'draft'` même si des champs obligatoires sont vides
**And** `created_by_id` est défini avec l'id de l'admin connecté
**And** `created_at` et `updated_at` sont générés automatiquement (FR35)
**And** un toast succès s'affiche : "Brouillon enregistré."
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'create' })`

**Given** le bouton "Publier" est affiché
**When** `CompletionIndicator` est orange (champs manquants)
**Then** le bouton "Publier" est désactivé (`disabled`, opacité 40%, cursor-not-allowed) (UX-DR16)
**And** "Enregistrer brouillon" reste le bouton primaire

---

### Story 4.4 : Upload de fichiers hébergés vers R2

En tant qu'administrateur,
Je veux uploader des fichiers (PDF, EPUB, MP4, MP3, AAC) directement dans le formulaire de production,
Afin d'associer le contenu hébergé à la production pour le rendre accessible aux visiteurs (FR18, NFR3, NFR10, NFR12).

**Acceptance Criteria:**

**Given** le composant `FileUploader` est affiché dans le formulaire (UX-DR7)
**When** l'admin fait glisser un fichier dans la zone de dépôt
**Then** la bordure devient green-700 animée (état drag-over)
**And** le nom du fichier et sa taille sont affichés en prévisualisation

**Given** l'admin sélectionne ou dépose un fichier valide (≤ 100 Mo, MIME autorisé)
**When** l'upload démarre
**Then** une barre de progression s'affiche avec le pourcentage d'avancement
**And** après succès, le fichier apparaît dans la liste des fichiers associés avec son nom et sa taille
**And** un enregistrement `production_files` est créé avec `file_key` (jamais l'URL complète)

**Given** l'admin tente d'uploader un fichier > 100 Mo
**When** la validation côté client s'exécute (avant l'envoi réseau)
**Then** un message d'erreur s'affiche : "Fichier trop volumineux. Maximum 100 Mo."
**And** aucune requête réseau n'est envoyée (NFR3)

**Given** l'admin tente d'uploader un fichier d'un format non supporté (ex. `.docx`)
**When** la validation côté client s'exécute
**Then** un message d'erreur s'affiche : "Format non supporté. Formats acceptés : PDF, EPUB, MP4, MP3, AAC."

**Given** la validation serveur échoue (MIME falsifié côté client)
**When** `FilesController` traite la requête
**Then** le fichier est rejeté (422) et aucun upload vers R2 n'est effectué (NFR10)

**Given** un fichier est uploadé avec succès
**When** l'admin clique sur "Supprimer" sur ce fichier
**Then** le fichier est supprimé de R2 via `FileStorageService.delete(fileKey)`
**And** l'enregistrement `production_files` est supprimé

---

### Story 4.5 : Gestion des liens externes

En tant qu'administrateur,
Je veux associer des liens externes (embed ou lien simple) à une production,
Afin de référencer du contenu sous copyright ou hébergé sur des plateformes tierces (FR19, NFR11).

**Acceptance Criteria:**

**Given** le composant `LinkManager` est affiché dans le formulaire (UX-DR11)
**When** l'admin clique sur "Ajouter un lien"
**Then** un formulaire inline apparaît avec les champs : URL, type (embed / lien simple), label

**Given** l'admin remplit les champs et confirme
**When** le lien est ajouté
**Then** il apparaît dans la liste des liens associés sans rechargement de page
**And** un enregistrement `production_links` est créé avec `url`, `link_type`, `label`

**Given** l'URL saisie n'est pas valide
**When** l'admin tente de confirmer l'ajout
**Then** une erreur de validation s'affiche : "URL invalide. Veuillez saisir une URL complète (https://...)"

**Given** un lien existe dans la liste
**When** l'admin clique sur "Supprimer" sur ce lien
**Then** le lien est retiré de la liste et l'enregistrement `production_links` est supprimé

**Given** la production a `license_status = 'external_link'`
**When** `CompletionIndicator` se met à jour
**Then** au moins un lien externe est requis pour que l'indicateur passe au vert (un fichier hébergé seul ne suffit pas)

---

### Story 4.6 : Publication et workflow brouillon → publié

En tant qu'administrateur,
Je veux publier une production brouillon complète,
Afin qu'elle devienne immédiatement visible sur le site public (FR21, FR35).

**Acceptance Criteria:**

**Given** `CompletionIndicator` est vert (tous les champs obligatoires remplis + au moins un fichier ou lien)
**When** le formulaire est affiché
**Then** le bouton "Publier" est actif et devient le bouton primaire
**And** "Enregistrer brouillon" passe en bouton secondaire (UX-DR16)

**Given** l'admin clique sur "Publier"
**When** `ProductionService.publish(productionId)` est appelé
**Then** le serveur revalide les conditions de publication (VineJS) — champs obligatoires + fichier ou lien présent
**And** `status` passe à `'published'` (via `ProductionStatus.PUBLISHED`)
**And** `anta_published_at` est défini avec le timestamp actuel si c'est la première publication (FR35)
**And** la production est immédiatement visible sur le site public
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'publish' })`
**And** un toast succès s'affiche : "Production publiée."

**Given** les conditions de publication ne sont pas remplies côté serveur (tentative de contournement)
**When** `POST /admin/productions/:id/publish` est appelé
**Then** la requête est rejetée (422) avec les champs manquants listés

**Given** une production est publiée
**When** l'admin la modifie et enregistre
**Then** `status` reste `'published'` — aucune republication automatique n'est déclenchée (FR22)
**And** `updated_at` est mis à jour (FR35)

---

### Story 4.7 : Modification, dépublication et suppression

En tant qu'administrateur,
Je veux modifier, dépublier ou supprimer une production existante,
Afin de maintenir le catalogue à jour et de gérer le cycle de vie des productions (FR22, FR23, FR24).

**Acceptance Criteria:**

**Given** un admin clique sur "Modifier" sur une production
**When** la page `/admin/productions/:id/edit` se charge
**Then** le formulaire est pré-rempli avec toutes les métadonnées existantes
**And** les fichiers et liens déjà associés sont affichés dans leurs composants respectifs

**Given** l'admin modifie des champs et clique sur "Enregistrer"
**When** la requête `PUT /admin/productions/:id` est traitée
**Then** les métadonnées sont mises à jour en base
**And** `updated_at` est mis à jour automatiquement
**And** `status` reste inchangé (pas de republication automatique — FR22)
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'update' })`
**And** un toast succès s'affiche : "Modifications enregistrées."

**Given** un admin clique sur "Dépublier" sur une production publiée
**When** le modal de confirmation s'affiche (UX-DR14)
**Then** il indique : "La production ne sera plus visible sur le site public. Elle repassera en brouillon."

**Given** l'admin confirme la dépublication
**When** `ProductionService.unpublish(productionId)` est appelé
**Then** `status` passe à `'draft'` (via `ProductionStatus.DRAFT`)
**And** la production disparaît immédiatement du site public
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'unpublish' })`
**And** un toast succès s'affiche : "Production dépubliée."

**Given** un admin clique sur "Supprimer" sur une production
**When** le modal de confirmation s'affiche (UX-DR14)
**Then** il indique : "Cette action est irréversible. La production et ses fichiers associés seront supprimés définitivement."

**Given** l'admin confirme la suppression
**When** `ProductionService.delete(productionId)` est appelé
**Then** tous les fichiers R2 associés sont supprimés via `FileStorageService.delete()`
**And** les enregistrements `production_files` et `production_links` sont supprimés
**And** l'enregistrement `productions` est supprimé
**And** l'action est loguée via `ActivityLogService.log({ actionType: 'delete' })`
**And** un toast succès s'affiche : "Production supprimée."

---

### Story 4.8 : Tests productions panel admin

En tant que développeur,
Je veux une suite de tests couvrant toutes les opérations CRUD et le workflow de publication,
Afin de garantir l'intégrité du catalogue à chaque modification du code.

**Acceptance Criteria:**

**Given** `tests/functional/admin/ProductionsController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Création production brouillon → enregistrement créé, log activityLog
- Publication avec tous les champs → status = published, anta_published_at défini
- Tentative de publication avec champs manquants → 422
- Modification production publiée → status inchangé, updated_at mis à jour
- Dépublication → status = draft
- Suppression → enregistrement supprimé + fichiers R2 supprimés

**Given** `tests/functional/admin/FilesController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Upload fichier valide → production_files créé, file_key stocké
- Upload fichier > 100 Mo → rejet 422
- Upload MIME non autorisé → rejet 422
- Suppression fichier → suppression R2 + production_files

**Given** `tests/unit/services/ProductionService.spec.ts` et `tests/unit/validators/ProductionValidator.spec.ts` existent
**When** `node ace test` est exécuté
**Then** la logique de validation de publication et les règles métier sont testées unitairement

---

### Story 5.1 : Layout public et page Politique de confidentialité

En tant que visiteur,
Je veux naviguer sur un site avec un header clair et accéder à la politique de confidentialité,
Afin de comprendre comment mes données sont traitées et de naviguer dans un cadre de confiance (FR38, FR40, FR41).

**Acceptance Criteria:**

**Given** un visiteur charge n'importe quelle page du site public
**When** `PublicLayout.tsx` se rend
**Then** un header sticky est affiché avec le logo Anta et le composant `LanguageSwitcher` (FR/EN) visible sur toutes les pages
**And** un footer est affiché avec un lien vers la politique de confidentialité

**Given** un visiteur clique sur "FR" ou "EN" dans le `LanguageSwitcher`
**When** la langue change
**Then** toute l'interface bascule immédiatement dans la langue sélectionnée via `react-i18next`
**And** la sélection est sauvegardée dans le cookie `i18n_lang` (FR40, FR41)
**And** `aria-current="true"` est appliqué sur la langue active

**Given** un visiteur revient sur le site lors d'une visite suivante
**When** l'application se charge
**Then** la langue précédemment choisie est restaurée depuis le cookie `i18n_lang`

**Given** un visiteur accède à `/privacy-policy`
**When** la page se charge
**Then** la politique de confidentialité est affichée dans la langue active
**And** la page est accessible depuis le footer de toutes les pages publiques (FR38)

---

### Story 5.2 : Page d'accueil avec deux sections et filtres visibles

En tant que visiteur,
Je veux voir sur la page d'accueil les productions les plus consultées et les plus récentes, avec la barre de recherche et les filtres immédiatement disponibles,
Afin de commencer à explorer la bibliothèque sans friction dès mon arrivée (FR9, UX-DR23).

**Acceptance Criteria:**

**Given** un visiteur accède à `/`
**When** la page se charge
**Then** une `SearchBar` hero centrée est affichée avec le placeholder "Rechercher une production..."
**And** une `FilterBar` avec les FilterChips de catégories est visible sous la SearchBar, sans qu'aucune recherche active ne soit requise

**Given** la page d'accueil se charge
**When** `HomeController` interroge la base de données
**Then** une section "Les plus consultées" affiche les 6 productions avec le plus de vues, triées par ordre décroissant
**And** une section "Récemment ajoutées" affiche les 6 dernières productions publiées, triées par `anta_published_at` décroissant

**Given** aucune production n'a encore été publiée
**When** la page d'accueil se charge
**Then** les deux sections affichent un état vide factuel

**Given** un visiteur saisit du texte dans la SearchBar ou clique sur un FilterChip
**When** la recherche ou le filtre est appliqué
**Then** il est redirigé vers `/productions` avec les paramètres correspondants dans l'URL

---

### Story 5.3 : Recherche full-text et filtres multi-critères

En tant que visiteur,
Je veux rechercher des productions par mot-clé et affiner les résultats avec des filtres combinables,
Afin de trouver précisément ce que je cherche dans le catalogue (FR1–FR8, NFR2).

**Acceptance Criteria:**

**Given** un visiteur saisit un terme dans la SearchBar et soumet
**When** `GET /productions?q=terme` est traité par `SearchService`
**Then** une requête `tsvector @@ to_tsquery` est exécutée sur `search_vector`
**And** les résultats sont triés par pertinence par défaut
**And** la réponse est retournée en moins de 1 seconde pour le 95e percentile (NFR2)

**Given** un visiteur clique sur un ou plusieurs FilterChips (catégorie, domaine, sous-domaine, auteur, langue, pays, licence)
**When** les filtres sont appliqués
**Then** les filtres sont combinés en `AND` dans la requête SQL
**And** chaque filtre actif est reflété dans l'URL (FR2–FR8)
**And** les FilterChips actifs ont un état visuel distinct

**Given** un visiteur veut effacer tous les filtres
**When** il clique sur "Effacer filtres"
**Then** tous les paramètres de filtre sont retirés de l'URL
**And** le bouton "Effacer filtres" est visible uniquement quand au moins un filtre est actif

**Given** un visiteur applique un filtre et navigue à une autre page
**When** il clique sur un numéro de page
**Then** les filtres restent actifs et sont reflétés dans l'URL

---

### Story 5.4 : Listing des résultats avec tri, toggle et pagination

En tant que visiteur,
Je veux voir les résultats avec le nombre total, pouvoir les trier et basculer entre vue liste et grille,
Afin d'explorer le catalogue selon mes préférences (FR16 listing, UX-DR2, UX-DR4, UX-DR5, UX-DR12, UX-DR19).

**Acceptance Criteria:**

**Given** une recherche ou un filtre est actif
**When** la page `/productions` affiche les résultats
**Then** le nombre total de résultats est affiché : "{N} résultat(s)"
**And** un dropdown "Trier par" est visible : Pertinence, Date, Vues, Téléchargements

**Given** le visiteur change l'option de tri
**When** le dropdown est mis à jour
**Then** les résultats se réordonnent immédiatement et le critère est reflété dans l'URL

**Given** la page listing est affichée
**When** le `ListingToggle` est rendu
**Then** la vue liste est active par défaut
**And** le choix est sauvegardé en localStorage et restauré à la prochaine visite

**Given** la vue liste est active
**When** chaque `ProductionCard` est rendue
**Then** elle affiche : titre, auteur(s), catégorie, résumé tronqué, compteurs de vues et téléchargements (FR16)

**Given** la vue grille est active
**When** les `ProductionCard` sont rendues
**Then** elles s'affichent en grille 1→2→3 colonnes selon le breakpoint

**Given** la recherche ne retourne aucun résultat
**When** la liste est rendue
**Then** un état vide s'affiche : "Aucune production trouvée pour « {terme} »" avec un bouton "Réinitialiser les filtres"

**Given** plus de 20 résultats existent
**When** la pagination numérotée s'affiche
**Then** les paramètres de filtre et de recherche sont préservés à chaque changement de page

---

### Story 5.5 : SEO — Meta tags côté serveur

En tant que moteur de recherche,
Je veux accéder aux meta tags de chaque page de production directement dans le HTML,
Afin d'indexer correctement le contenu et d'afficher un aperçu riche lors du partage (FR36).

**Acceptance Criteria:**

**Given** un moteur de recherche accède à `/productions/:slug`
**When** AdonisJS génère le HTML shell
**Then** les balises suivantes sont injectées côté serveur : `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:type" content="article">`

**Given** un lien est partagé sur un réseau social
**When** le scraper accède à la page
**Then** les balises Open Graph sont présentes dans le HTML initial, avant hydratation React

**Given** la page d'accueil et la page listing sont accédées
**When** AdonisJS génère le HTML
**Then** des meta tags génériques sont injectés (titre du site, description de la bibliothèque)

---

### Story 5.6 : Accessibilité et responsive site public

En tant que visiteur utilisant un lecteur d'écran, la navigation clavier ou un mobile,
Je veux accéder à tout le contenu sans friction,
Afin que la bibliothèque soit inclusive et utilisable quel que soit le contexte (UX-DR20, UX-DR21).

**Acceptance Criteria:**

**Given** un utilisateur charge n'importe quelle page publique
**When** le HTML est rendu
**Then** un skip link "Aller au contenu principal" est le premier élément focusable (`sr-only`, visible au focus)
**And** la structure sémantique est correcte : `<header>`, `<main id="main-content">`, `<nav>`, `<footer>`
**And** un seul `<h1>` est présent par page

**Given** un utilisateur navigue au clavier
**When** il parcourt la page
**Then** tous les éléments interactifs sont atteignables dans un ordre logique
**And** chaque élément focusé affiche `ring-2 ring-green-700 ring-offset-2`

**Given** les FilterChips sont rendus
**When** un chip est interactif
**Then** `role="checkbox"`, `aria-checked={isActive}` et `aria-label="Filtrer par {label}"` sont présents

**Given** un visiteur accède au site depuis un mobile (< 768px)
**When** la page d'accueil se charge
**Then** la SearchBar occupe toute la largeur disponible
**And** les FilterChips défilent horizontalement avec scroll-snap
**And** toutes les cibles tactiles mesurent au minimum 44×44px

**Given** les couleurs sont utilisées dans l'interface
**When** un audit axe DevTools est effectué
**Then** aucune violation WCAG 2.1 AA n'est détectée
**And** toutes les couleurs respectent le ratio minimum WCAG 2.1 AA (4.5:1 pour le texte normal)

---

### Story 5.7 : Tests site public — Recherche et découverte

En tant que développeur,
Je veux une suite de tests couvrant la recherche, les filtres, la pagination et le SEO,
Afin de garantir la fiabilité du moteur de découverte.

**Acceptance Criteria:**

**Given** `tests/functional/public/ProductionsController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Recherche textuelle → résultats filtrés par tsvector
- Filtres combinés → résultats corrects
- Aucun résultat → état vide retourné
- Pagination → page 2 avec paramètres préservés
- Page d'accueil → 6 plus consultées + 6 récentes retournées
- Meta tags présents dans le HTML des pages de production

**Given** `tests/unit/services/SearchService.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Construction correcte de la requête tsvector
- Application correcte de chaque filtre
- Combinaison de filtres multiples
- Tri par pertinence, date, vues, téléchargements

---

## Epic 6 : Consultation et Téléchargement

Un visiteur peut consulter la page de détail d'une production, lire ou visionner un fichier intégré, télécharger un fichier hébergé ou accéder à une source externe. Les vues et téléchargements sont enregistrés automatiquement.

### Story 6.1 : Page de détail d'une production

En tant que visiteur,
Je veux consulter la page de détail d'une production avec l'intégralité de ses métadonnées publiques,
Afin d'évaluer la pertinence du contenu avant de le lire ou de le télécharger (FR10, FR16).

**Acceptance Criteria:**

**Given** un visiteur accède à `/productions/:slug`
**When** la page se charge
**Then** toutes les métadonnées publiques sont affichées : titre, auteur(s), catégorie, domaine, sous-domaine, langue, pays, date de publication de l'œuvre, résumé complet, licence, journal/revue, éditeur, ISBN/DOI/ISSN, institution
**And** les compteurs de vues et de téléchargements sont visibles (FR16)

**Given** la page de détail est affichée sur desktop (>= 1024px)
**When** le layout se rend
**Then** un layout 2 colonnes est utilisé : contenu principal (résumé + lecteur/téléchargement) à gauche, métadonnées secondaires + actions à droite

**Given** la page de détail est affichée
**When** le breadcrumb est rendu
**Then** il affiche : Accueil > Productions > {titre tronqué}
**And** chaque élément est un lien cliquable

**Given** la production n'existe pas ou n'est pas publiée
**When** un visiteur accède à son URL
**Then** une page 404 est retournée

**Given** la page de détail se charge
**When** le composant `ViewTracker` est monté
**Then** le décompte de 10 secondes démarre automatiquement (voir Story 6.4)

---

### Story 6.2 : Lecteurs de médias intégrés

En tant que visiteur,
Je veux lire un document ou visionner un média directement dans le navigateur sans téléchargement préalable,
Afin d'évaluer le contenu avant de décider de le télécharger (FR11, FR12, FR13, UX-DR8).

**Acceptance Criteria:**

**Given** une production a un fichier PDF ou EPUB associé
**When** la page de détail se charge
**Then** un lecteur intégré est affiché permettant la lecture dans le navigateur
**And** le lecteur est choisi lors de l'epic (iframe natif, react-pdf, ou bibliothèque tierce) selon les contraintes de compatibilité

**Given** une production a un fichier MP4 associé
**When** la page de détail se charge
**Then** un lecteur vidéo HTML5 `<video>` est affiché avec les contrôles natifs (lecture, pause, volume, plein écran)
**And** le fichier est servi via une URL signée R2 (TTL 1h)

**Given** une production a un fichier MP3 ou AAC associé
**When** la page de détail se charge
**Then** un lecteur audio HTML5 `<audio>` est affiché avec les contrôles natifs (lecture, pause, volume, progression)
**And** le fichier est servi via une URL signée R2 (TTL 1h)

**Given** une production a plusieurs fichiers associés
**When** la page de détail se charge
**Then** chaque fichier dispose de son propre lecteur ou bouton d'accès
**And** les fichiers sont listés avec leur nom et leur format

**Given** une production a `license_status = 'external_link'` et aucun fichier hébergé
**When** la page de détail se charge
**Then** aucun lecteur intégré n'est affiché
**And** un bouton "Accéder à la source" est affiché (voir Story 6.3)

---

### Story 6.3 : Téléchargement de fichiers et accès aux liens externes

En tant que visiteur,
Je veux télécharger un fichier hébergé ou accéder à la source externe d'une production,
Afin d'obtenir le contenu pour une consultation hors ligne ou sur la plateforme d'origine (FR14, FR15, FR26).

**Acceptance Criteria:**

**Given** une production a un fichier hébergé
**When** le visiteur clique sur "Télécharger"
**Then** `FileStorageService.signedUrl(fileKey)` génère une URL signée R2 (TTL 1h)
**And** le navigateur déclenche le téléchargement du fichier avec son nom d'origine
**And** `StatsService.recordDownload(productionId)` est appelé pour enregistrer le téléchargement (FR26)

**Given** le fichier R2 n'est plus disponible (supprimé ou clé invalide)
**When** le visiteur clique sur "Télécharger"
**Then** un message d'erreur s'affiche : "Ce fichier n'est temporairement pas disponible."
**And** aucune erreur non gérée n'est exposée au visiteur (NFR12)

**Given** une production a un lien externe de type "embed"
**When** la page de détail se charge
**Then** le contenu est embarqué via un `<iframe>` avec les attributs de sécurité appropriés (`sandbox`, `allow`)

**Given** une production a un lien externe de type "lien simple"
**When** le visiteur clique sur "Accéder à la source"
**Then** le lien s'ouvre dans un nouvel onglet (`target="_blank"`, `rel="noopener noreferrer"`)

**Given** le téléchargement est enregistré
**When** `StatsService.recordDownload()` est appelé
**Then** un enregistrement est inséré dans `stats_downloads` avec `production_id`, `downloaded_at`, `ip_hash` (anonymisé)
**And** le compteur de téléchargements est incrémenté côté public sans rechargement de page

---

### Story 6.4 : Enregistrement automatique des vues (10 secondes)

En tant que système,
Je veux enregistrer une vue uniquement si le visiteur reste sur la page de détail au moins 10 secondes,
Afin de comptabiliser des consultations réelles et non des clics accidentels (FR25, UX-DR10).

**Acceptance Criteria:**

**Given** le composant `ViewTracker` est monté sur la page de détail
**When** le composant est initialisé
**Then** un `setTimeout` de 10 000ms démarre immédiatement

**Given** le visiteur reste sur la page pendant 10 secondes
**When** le timeout s'écoule
**Then** `POST /stats/view` est appelé avec `productionId`
**And** `StatsService.recordView()` insère un enregistrement dans `stats_views` avec `production_id`, `recorded_at`, `ip_hash` (anonymisé), `session_id`

**Given** le visiteur quitte la page avant 10 secondes (navigation ou fermeture)
**When** le composant est démonté (unmount)
**Then** le `setTimeout` est nettoyé via `clearTimeout`
**And** aucun appel `POST /stats/view` n'est effectué

**Given** la vue est enregistrée
**When** le compteur de vues est affiché
**Then** il reflète la valeur mise à jour sans rechargement complet de page

**Given** `POST /stats/view` échoue (erreur réseau)
**When** la requête est rejetée
**Then** l'erreur est silencieuse côté visiteur — aucun message d'erreur n'est affiché
**And** l'expérience de navigation n'est pas interrompue

---

### Story 6.5 : Tests consultation et téléchargement

En tant que développeur,
Je veux une suite de tests couvrant la page de détail, les lecteurs, le téléchargement et l'enregistrement des stats,
Afin de garantir la fiabilité de la consultation et la précision des métriques.

**Acceptance Criteria:**

**Given** `tests/functional/public/StatsController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- POST /stats/view avec productionId valide → enregistrement créé dans stats_views
- POST /stats/view avec productionId invalide → 404
- POST /stats/download avec productionId valide → enregistrement créé dans stats_downloads
- Téléchargement → URL signée R2 retournée

**Given** `tests/functional/public/ProductionsController.spec.ts` (page détail) est étendu
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Page détail production publiée → 200, métadonnées complètes
- Page détail production non publiée → 404
- Page détail production inexistante → 404

**Given** `tests/unit/services/StatsService.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- recordView() → insertion stats_views avec ip_hash anonymisé
- recordDownload() → insertion stats_downloads avec ip_hash anonymisé
- Agrégation des vues par production → compte correct

---

## Epic 7 : Statistiques et Métriques

Un administrateur peut consulter les statistiques par production et en vue agrégée. Le super administrateur peut consulter les logs d'activité des admins.

### Story 7.1 : Statistiques par production (panel admin)

En tant qu'administrateur,
Je veux consulter les statistiques de vues et de téléchargements pour chaque production,
Afin de mesurer l'impact individuel de chaque contenu publié (FR27).

**Acceptance Criteria:**

**Given** un admin accède à la page de détail d'une production dans le panel (`/admin/productions/:id`)
**When** la section statistiques se charge
**Then** les données suivantes sont affichées : nombre total de vues, nombre total de téléchargements, date de première publication sur Anta, date de dernière modification

**Given** la production a des données de vues dans le temps
**When** les statistiques se chargent
**Then** un tableau ou graphique simple affiche l'évolution des vues sur les 30 derniers jours (regroupées par jour)

**Given** la production n'a encore aucune vue ni téléchargement
**When** la section statistiques se charge
**Then** un état vide factuel s'affiche : "Aucune statistique disponible pour cette production."

**Given** un admin accède aux stats d'une production qui n'est pas la sienne
**When** la page se charge
**Then** les statistiques sont accessibles (tous les admins voient toutes les stats — FR27)

---

### Story 7.2 : Vue agrégée des statistiques bibliothèque

En tant qu'administrateur,
Je veux consulter une vue d'ensemble des statistiques de toute la bibliothèque,
Afin de comprendre les tendances globales de consultation et de téléchargement (FR28).

**Acceptance Criteria:**

**Given** un admin accède à `/admin/stats`
**When** la page se charge
**Then** les métriques globales suivantes sont affichées :

- Nombre total de productions publiées
- Nombre total de vues (toutes productions confondues)
- Nombre total de téléchargements (toutes productions confondues)

**Given** la vue agrégée est affichée
**When** le tableau des productions les plus consultées est rendu
**Then** les 10 productions avec le plus de vues sont listées avec leur titre, nombre de vues et nombre de téléchargements
**And** les 10 productions avec le plus de téléchargements sont listées

**Given** des données existent sur les 30 derniers jours
**When** la section d'évolution se charge
**Then** un tableau ou graphique affiche le total de vues et téléchargements par jour sur les 30 derniers jours

**Given** la bibliothèque ne contient aucune production publiée
**When** la page stats se charge
**Then** un état vide s'affiche : "Aucune donnée disponible pour cette période."

---

### Story 7.3 : Logs d'activité des administrateurs (super admin)

En tant que super administrateur,
Je veux consulter l'historique des actions effectuées par chaque administrateur,
Afin de superviser l'activité du panel et d'assurer la traçabilité des opérations (FR29).

**Acceptance Criteria:**

**Given** un super admin accède à `/admin/stats` (section réservée) ou à une page dédiée
**When** la section logs d'activité se charge
**Then** la liste de toutes les actions admin est affichée : admin concerné, type d'action (`login | create | update | publish | unpublish | delete | password_reset`), ressource concernée (type + id), date et heure

**Given** la liste des logs est affichée
**When** le super admin filtre par administrateur
**Then** seules les actions de cet admin sont affichées

**Given** la liste des logs est affichée
**When** le super admin filtre par type d'action
**Then** seules les actions du type sélectionné sont affichées

**Given** la liste des logs contient de nombreuses entrées
**When** la page se charge
**Then** les logs sont paginés (20 par page) avec les plus récents en premier

**Given** un admin (rôle `admin`) tente d'accéder à la section logs d'activité
**When** `SuperAdminMiddleware` s'exécute
**Then** l'accès est refusé — la section n'est pas visible dans son interface

---

### Story 7.4 : Tests statistiques et métriques

En tant que développeur,
Je veux une suite de tests couvrant les trois vues de statistiques et les contrôles d'accès,
Afin de garantir la fiabilité des métriques et la sécurité des données d'activité.

**Acceptance Criteria:**

**Given** `tests/functional/admin/StatsController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Stats par production → totaux vues et téléchargements corrects
- Vue agrégée → top 10 vues et téléchargements corrects
- Vue agrégée → évolution sur 30 jours correcte
- Logs d'activité accessibles en tant que super_admin → liste retournée
- Logs d'activité filtrés par admin → résultats corrects
- Logs d'activité filtrés par type d'action → résultats corrects
- Accès logs d'activité en tant qu'admin (rôle admin) → 403

---

## Epic 8 : Infrastructure VPS (dev, staging, production)

Le développement, le staging et la production quittent le PC et Render pour des VPS maîtrisés :
dev sur VPS via Tailscale, staging public sur `anta.peraha.com`, production en Docker Compose + Caddy,
secrets Doppler pour le dev et `.env` sur les VPS, mêmes services externes partout (Supabase, R2, Mailgun).

### Story 8.1 : Environnement de développement sur VPS (Tailscale + Doppler)

En tant que développeur,
Je veux lancer Anta en mode dev sur le VPS de développement et l'ouvrir depuis mon PC via Tailscale,
Afin de développer sans dépendre de mon poste local ni d'un fichier `.env`.

**Acceptance Criteria:**

**Given** un projet Doppler `anta` avec une config `dev` contenant toutes les variables de `.env.example`
**When** `doppler run -- npm run dev` est exécuté dans le dépôt du VPS (`PORT=3333`, `HOST=127.0.0.1`)
**Then** l'application démarre sans fichier `.env` sur disque
**And** aucun secret n'est écrit dans le dépôt ni dans les fichiers du workspace

**Given** `tailscale serve` expose le port 3333 sur un port HTTPS libre du tailnet (hors 443, 8443 et 10000, déjà pris)
**When** j'ouvre l'URL `https://vmi3733843.tail39fe0e.ts.net:<port>` depuis le PC
**Then** le site public et l'admin fonctionnent
**And** le HMR de Vite se recharge à travers le proxy (`vite.config.ts` ajusté si nécessaire)
**And** l'URL n'est pas joignable hors du tailnet

**Given** la base Supabase est partagée avec le staging
**When** je travaille en dev
**Then** les règles « base partagée » sont documentées dans `CLAUDE.local.md` et dans `docs/` : pas de rollback/fresh/reset/wipe, migrations rétrocompatibles uniquement
**And** `node ace test` tourne contre un Postgres local jetable (Docker, base `anta_test`, mêmes valeurs que la CI), jamais contre Supabase

### Story 8.2 : Conteneurisation de l'application (image + Compose + Caddy)

En tant que développeur,
Je veux une image Docker de production et un fichier Compose avec Caddy,
Afin que staging et production exécutent exactement le même artefact.

**Acceptance Criteria:**

**Given** un `Dockerfile` multi-stage (Node 22 : build `node ace build`, puis image runtime avec `npm ci --omit=dev` dans `build/`)
**When** l'image est construite
**Then** elle démarre avec `node ace migration:run --force && node bin/server.js` et écoute sur `PORT`
**And** elle tourne avec un utilisateur non-root

**Given** un `compose.yaml` (services `app` et `caddy`) et un `Caddyfile` paramétré par domaine
**When** `doppler run -- docker compose up -d` est exécuté sur un hôte
**Then** Caddy sert l'app en HTTPS avec un certificat Let's Encrypt automatique et redirige HTTP → HTTPS (NFR4)
**And** la limite de corps de requête accepte les uploads de 110 Mo (parité avec `bodyparser`)
**And** les logs des conteneurs sont plafonnés (driver `json-file`, `max-size`/`max-file`)

### Story 8.3 : Staging sur le VPS partagé (`anta.peraha.com`)

En tant que développeur,
Je veux qu'Anta tourne en Docker sur le VPS de staging et soit servi publiquement sur `https://anta.peraha.com`,
Afin de tester et faire la démo de l'application dans des conditions de production.

*Révisée le 2026-11-16 : le VPS de staging est celui de Coffee Chat, dont le nginx conteneurisé détient 80/443 ; pas de Caddy ni de Doppler en staging.*

**Acceptance Criteria:**

**Given** le VPS de staging partagé avec Coffee Chat
**When** la stack Anta est démarrée (`compose.yaml` + `compose.staging.yaml`, secrets dans `/opt/anta/.env` hors dépôt)
**Then** l'app répond sur `127.0.0.1:3333` sans publier de port public et sans toucher aux conteneurs Coffee Chat

**Given** l'enregistrement DNS `anta.peraha.com` pointe vers l'IP du VPS de staging
**When** le vhost `anta.conf` est chargé dans le nginx de Coffee Chat
**Then** `https://anta.peraha.com` sert l'application avec un certificat Let's Encrypt valide, HTTP redirige vers HTTPS, les uploads jusqu'à 110 Mo passent
**And** elle utilise la même base Supabase, le même bucket R2 et Mailgun
**And** `APP_URL=https://anta.peraha.com`

**Given** Anta est arrêté
**When** le nginx de Coffee Chat est rechargé ou redémarré
**Then** il démarre normalement et Coffee Chat reste servi

### Story 8.4 : CI/CD de déploiement du staging

En tant que développeur,
Je veux qu'un push sur la branche `staging` déploie automatiquement le VPS de staging,
Afin de conserver le flux actuel (PR `development → staging`) sans Render.

**Acceptance Criteria:**

**Given** une PR `development → staging` est mergée
**When** le workflow `deploy-staging.yml` se déclenche
**Then** les tests (`node ace test`, Postgres de service CI) passent avant tout déploiement (gate)
**And** la suite fonctionnelle est réparée en CI et le `continue-on-error` du step `Run functional tests` de `ci.yml` est retiré (voir `deferred-work.md`, « TICKET — Suite fonctionnelle incompatible avec la CI »), sinon le gate ne couvre que les tests unitaires
**And** l'image est construite et poussée sur GHCR, taggée avec le SHA du commit
**And** le VPS de staging tire l'image et redémarre la stack via SSH (clé de déploiement dédiée, secrets GitHub)
**And** un health check HTTP sur `https://anta.peraha.com` valide le déploiement ; en cas d'échec le workflow est rouge et l'image précédente reste relançable par son tag

### Story 8.5 : Décommissionnement de Render

En tant que développeur,
Je veux supprimer l'environnement Render,
Afin que le VPS de staging soit l'unique staging et que Render ne coûte ni ne trompe plus personne.

**Acceptance Criteria:**

**Given** le staging VPS est validé (Stories 8.3 et 8.4)
**When** le décommissionnement est confirmé
**Then** le service Render `anta-staging` est supprimé et le keep-alive cron-job.org désactivé
**And** `render.yaml` est retiré du dépôt et la documentation (README, `docs/`, skill de déploiement) mise à jour
**And** toute référence à `anta-staging.onrender.com` (liens, `APP_URL`, mémoire projet) est remplacée par `https://anta.peraha.com`

### Story 8.6 : Mise en production sur VPS

En tant que développeur,
Je veux déployer la production sur un VPS avec la même stack que le staging,
Afin que l'application soit en ligne sur un serveur maîtrisé (NFR4, NFR13).

**Acceptance Criteria:**

**Given** un VPS de production dédié (Docker + Compose, pare-feu 22/80/443, mises à jour de sécurité automatiques) et le domaine de production configuré
**When** une PR `staging → master` est mergée
**Then** `deploy-production.yml` promeut l'image déjà validée en staging (même tag), sans rebuild
**And** les variables viennent d'un `.env` sur le VPS (`0600`, hors dépôt), stack `compose.yaml` avec Caddy
**And** le site est accessible en HTTPS sur le domaine de production, avec un comportement identique au staging

---

## Epic 9 : Référentiel d'auteurs — Panel Admin (Phase 2)

Les administrateurs gèrent un référentiel d'auteurs (fiches, affiliations, photo, consentement) et choisissent les auteurs d'une production dans ce référentiel au lieu de les saisir en texte libre ; les noms existants y sont rattachés par une conversion validée par Aurélien. Le site public est inchangé : il lit toujours la colonne dénormalisée `productions.authors`, tenue à jour par `ProductionAuthorService`.

**Règles communes aux stories Phase 2 (Epics 9 à 13)** : base Supabase partagée dev/staging → migrations additives uniquement, `down()` écrits mais jamais exécutés, jamais de `rollback`/`fresh`/`reset`/`db:wipe` ; tests sur Postgres local (`npm run test:local`), jamais contre Supabase ; dépôt public → aucun nom d'auteur réel, CSV ou donnée personnelle commité ; toutes les routes admin dans le groupe `middleware.admin()` (admin et super admin, P2-15), nommées (`.as(...)`), appelées côté client par `urlFor` (Tuyau) ; toute chaîne d'interface dans `inertia/locales/{public,admin}/{fr,en}.json` (libellés d'`EXPERIENCE.md` → Voice and Tone) ; conventions de nommage du code actuel (`snake_case`, P2 « Règle de lecture »).

### Story 9.1 : Créer et modifier une fiche auteur

En tant qu'administrateur,
Je veux créer et modifier la fiche d'un auteur (noms, prénoms, affiliations, lien Google Scholar),
Afin de constituer le référentiel d'auteurs auquel les productions seront rattachées (FR52).

**Acceptance Criteria:**

**Given** les migrations `1775918745000_create_authors_table.ts`, `1775918746000_create_author_affiliations_table.ts` et `1775918750000_add_metadata_to_admin_activity_logs.ts`
**When** `node ace migration:run` est exécuté
**Then** les tables `authors` et `author_affiliations` existent avec les colonnes, contraintes et index de P2.1 (`slug` UNIQUE, `migration_key` UNIQUE NULL, `consent_confirmed_at`/`consent_confirmed_by_id` NULL, `photo_key` NULL, `idx_authors_search_name_trgm` GIN trigram, `UNIQUE (author_id, position)`, `idx_author_affiliations_institution_key`)
**And** `admin_activity_logs.metadata` (jsonb NULL) est ajoutée sans toucher aux lignes existantes
**And** les migrations sont purement additives (aucune transformation de données) et leurs `down()` ne sont jamais exécutés sur la base partagée

**Given** les helpers `app/helpers/normalize.ts` (`normalizeKey` : NFD, diacritiques retirés, minuscules, espaces compactés) et `app/helpers/slug.ts` (translittération extraite de `ProductionService.generateSlug`, qui l'utilise désormais sans changement de comportement)
**When** une fiche `Author` ou une `AuthorAffiliation` est enregistrée
**Then** les hooks `@beforeSave` écrivent `search_name` (« prénoms noms » normalisé) et `institution_key`
**And** le slug `prenom-nom` est généré à la création (repli `auteur`, suffixe `-2`, `-3`… en cas de collision) puis **figé** : un changement de nom ne le modifie pas (D28)

**Given** un administrateur (rôle `admin` ou `super_admin`) sur `/admin/authors/create`
**When** il soumet `AuthorForm` avec Nom(s)* puis Prénom(s)* (D34), au moins une affiliation (institution*, département facultatif, ordre ↑ ↓ — la 1re est l'institution principale) et éventuellement un lien Google Scholar
**Then** la fiche est créée avec `created_by_id`, ses affiliations sont enregistrées dans l'ordre saisi, un toast « Auteur créé. » s'affiche
**And** une entrée `create` / `author` est inscrite au journal avec `metadata: { name }` (P2.6 « Journal d'activité »)

**Given** une saisie invalide (nom ou prénom vide ou > 120 caractères, aucune affiliation sur une fiche créée dans le panel, institution vide, URL Google Scholar non `http(s)` ou > 500 caractères)
**When** le formulaire est soumis
**Then** `app/validators/admin/author_validator.ts` (VineJS) refuse la saisie et chaque erreur s'affiche sous son champ (clés `authors.form.errors.*`, schéma Zod client dupliqué)
**And** le bouton × de la dernière affiliation est désactivé côté client (une fiche du panel garde ≥ 1 affiliation)

**Given** une fiche existante sur `/admin/authors/:id/edit`
**When** l'administrateur l'enregistre
**Then** les modifications sont persistées (affiliations remplacées dans une transaction), toast « Auteur enregistré. », journal `update` / `author` avec `metadata: { name, fields: [...] }`
**And** une fiche issue de la migration (`migration_key` non NULL) sans affiliation reste enregistrable (exception FR52)

**Given** un administrateur connecté
**When** il ouvre le panel
**Then** la barre latérale affiche l'entrée « Auteurs » après « Productions », active sur toutes les sous-pages `/admin/authors*`, visible pour admin et super admin
**And** `/admin/authors` liste les fiches (20/page, tri par nom de famille) : « Prénom NOM » (NOM en capitales à l'affichage seulement, D13/D34), affiliation principale, date de mise à jour, action « Modifier » ; liste vide → état vide existant (icône stone-300 + titre + description)

**Given** un visiteur non authentifié
**When** il appelle une route `/admin/authors*`
**Then** il est redirigé vers `/admin/login` (groupe `middleware.admin()`)

**Notes techniques :** P2.1 (tables, normalisation, slug), P2.6 (routes `admin.authors`, `.create`, `.store`, `.edit`, `.update`, validateur), P2-01, P2-03, P2-04. Modèles `app/models/author.ts` (`hasMany` affiliations triées par `position`) et `app/models/author_affiliation.ts`. Ajouter l'alias `"#helpers/*": "./app/helpers/*.js"` aux `imports` de `package.json` (absent aujourd'hui). `ActivityLogService.log` accepte `metadata?` ; la page Journal affiche le type de ressource « Auteur » et le nom issu de `metadata`. Page `inertia/pages/admin/Authors/{Index,Create,Edit}.tsx`, composant `inertia/components/admin/AuthorForm.tsx` (structure de `DESIGN.md` → AuthorForm, maquette `admin-authors-list.html` pour la mise en page). i18n admin : `authors.*` (libellés, aides, erreurs, toasts), `activity.resource.author`, `nav.authors`.
**Tests :** unit `normalizeKey`, slug (collision, figé au renommage), `author_validator` ; functional `tests/functional/admin/authors_crud.spec.ts` (création, modification, erreurs, journal, accès non authentifié) ; parité FR/EN dans `tests/unit/i18n/translations.spec.ts`.

---

### Story 9.2 : Liste des auteurs, filtres et suppression

En tant qu'administrateur,
Je veux retrouver une fiche par nom ou institution, repérer les fiches non publiques ou à compléter, et supprimer une fiche créée par erreur,
Afin de tenir le référentiel propre (FR52, FR55, D19, D32).

**Acceptance Criteria:**

**Given** la migration `1775918747000_create_production_authors_table.ts`
**When** elle est exécutée
**Then** le pivot `production_authors` existe (PK `(production_id, author_id)`, `UNIQUE (production_id, position)`, FK production `CASCADE`, FK auteur `RESTRICT`, `idx_production_authors_author_id`)
**And** le modèle `Production` expose la relation `authors` (`manyToMany`, `pivotColumns: ['position']`, triée par position) et la propriété jsonb est renommée `authorNames` (`columnName: 'authors'`) ; toutes les lectures existantes sont adaptées sans changement visible (suite existante verte)

**Given** un administrateur sur `/admin/authors`
**When** la liste s'affiche
**Then** le tableau présente Auteur, Affiliation principale, Productions (nombre de lignes pivot, tous statuts), Statut, Mise à jour, Actions (D32, maquette `admin-authors-list.html`)
**And** le statut est rendu par badges informatifs : « Public » / « Non public » selon `consent_confirmed_at`, « À compléter » si la fiche n'a aucune affiliation (dérivé, P2-03)

**Given** des fiches variées
**When** l'administrateur saisit une recherche (`q`), choisit une institution ou active un filtre rapide « Consentement en attente » (`consent=pending`) ou « À compléter » (`incomplete=1`)
**Then** la liste est filtrée côté serveur (recherche insensible à la casse et aux accents via `search_name` + `pg_trgm`, institution via `institution_key`), les filtres sont dans l'URL et la pagination les conserve
**And** chaque filtre rapide affiche son compteur ; un filtre sans résultat affiche « Aucun auteur ne correspond à ces filtres. »

**Given** une fiche associée à 0 production
**When** l'administrateur clique « Supprimer » puis confirme dans le dialog
**Then** la fiche et ses affiliations sont supprimées, toast de succès, journal `delete` / `author` avec `metadata: { name }`

**Given** une fiche associée à au moins une production (brouillon compris)
**When** l'administrateur tente de la supprimer
**Then** dans la liste le bouton est `aria-disabled` (focusable) avec une infobulle au survol **et** au focus reliée par `aria-describedby` ; dans la fiche, le texte « Suppression impossible : fiche liée à {n} production(s) (brouillons compris). » est visible sous le bouton
**And** un appel direct à `DELETE /admin/authors/:id` est refusé (redirection + flash d'erreur), la FK `RESTRICT` servant de garde-fou (FR55)

**Notes techniques :** P2.1 (pivot, `authorNames`), P2.6 (`GET /admin/authors` avec `q`, `institution`, `consent`, `incomplete`, `page` ; `DELETE /admin/authors/:id`), P2-01. Composants shadcn manquants (tooltip) ajoutés par la CLI (méta-paquet `radix-ui`, alias `~/*`). i18n admin `authors.list.*`, `authors.badges.*`, `authors.delete.*`.
**Tests :** functional `tests/functional/admin/authors_list.spec.ts` (filtres, compteurs, suppression OK, suppression refusée avec 1 brouillon lié, journal) ; non-régression des specs existantes après le renommage `authorNames`.

---

### Story 9.3 : Photo d'un auteur

En tant qu'administrateur,
Je veux ajouter, remplacer ou retirer la photo d'un auteur,
Afin d'illustrer sa fiche, sans exposer de métadonnées personnelles du fichier (FR52, NFR19).

**Acceptance Criteria:**

**Given** `sharp` ajouté aux dépendances de production et `app/services/image_service.ts`
**When** une photo est soumise dans `AuthorForm` (création ou modification)
**Then** elle est validée par `request.file('photo', { size: '5mb', extnames: ['jpg','jpeg','png','webp'] })` puis par décodage réel (`sharp().metadata()` : jpeg, png ou webp ; `limitInputPixels` 40 Mpx) ; sinon erreur en ligne (`authors.form.errors.photo_type`, `photo_size`)
**And** l'image est réorientée (`.rotate()`), ses métadonnées (EXIF, géolocalisation) sont supprimées, et les variantes carrées `w128.webp`, `w384.webp`, `og.jpg` (600×600) sont produites par recadrage centré (P2.5)

**Given** les variantes produites
**When** elles sont envoyées sur R2 sous un préfixe neuf `authors/<id>/<token>`
**Then** `photo_key` est écrit en base **après** l'envoi, puis l'ancien préfixe est supprimé (best-effort, échec journalisé dans les logs applicatifs)
**And** le journal `update` / `author` mentionne `photo` dans `metadata.fields`

**Given** une fiche avec photo
**When** l'administrateur coche « Retirer la photo » (`removePhoto`) et enregistre, ou supprime la fiche (Story 9.2)
**Then** `photo_key` passe à NULL et le préfixe R2 est supprimé

**Given** la fiche ou la liste admin
**When** la photo est affichée
**Then** l'aperçu utilise `FileStorageService.signedUrl` (aucune diffusion publique dans cette story) ; sans photo, les initiales (1re lettre du prénom + 1re du nom, D13) sont affichées

**Given** l'image Docker de production
**When** elle est construite
**Then** `package-lock.json` contient `@img/sharp-linux-x64` et `@img/sharp-libvips-linux-x64` et `sharp` se charge dans `node:24-bookworm-slim`

**Notes techniques :** P2.5 (validation, normalisation, variantes 1:1, clés immuables), P2-08. Même compensation que `files_controller.ts` pour l'ancien préfixe. i18n admin `authors.form.photo.*`.
**Tests :** unit `ImageService` (format réel refusé pour un texte renommé `.jpg`, > 5 Mo refusé, EXIF retiré, dimensions des variantes) avec images générées par `sharp` dans le test ; functional upload/remplacement/retrait avec `drive.fake('r2')`.

---

### Story 9.4 : Confirmer et retirer le consentement d'un auteur

En tant qu'administrateur,
Je veux confirmer le consentement d'un auteur à la publication de son profil, ou le retirer,
Afin que seuls les profils consentis deviennent publics, avec une trace de chaque décision (FR53, D16, D17, D27).

**Acceptance Criteria:**

**Given** `app/enums/action_type.ts`
**When** la story est livrée
**Then** il contient `CONSENT_CONFIRM: 'consent_confirm'` et `CONSENT_WITHDRAW: 'consent_withdraw'`, exposés automatiquement par le filtre de la page Journal et traduits (`activity.action.consent_confirm`, `activity.action.consent_withdraw`)

**Given** `AuthorForm` en création ou sur une fiche non publique
**When** il s'affiche
**Then** une case **facultative**, décochée par défaut, « L'auteur a consenti à la publication de son profil. » est présente avec l'aide de D16 ; la fiche est enregistrable sans elle (non publique)
**And** la case est désactivée tant que le formulaire ne contient aucune affiliation, et se réactive dès qu'une affiliation est saisie (D27)

**Given** la case cochée
**When** la fiche est enregistrée
**Then** `consent_confirmed_at` et `consent_confirmed_by_id` sont renseignés et une entrée `consent_confirm` / `author` (`metadata: { name }`) est journalisée en plus de `create` / `update`

**Given** une fiche non publique avec au moins une affiliation, dans la liste admin
**When** l'administrateur choisit « Confirmer le consentement » et valide le dialog « Le profil de {nom} deviendra public. »
**Then** `POST /admin/authors/:id/confirm-consent` confirme le consentement, le badge passe à « Public », journal `consent_confirm`
**And** sur une fiche sans affiliation l'action est `aria-disabled` avec l'infobulle « Complétez d'abord une affiliation. » et la route refuse la confirmation (flash d'erreur, D27)

**Given** une fiche à profil public (fiche ou liste)
**When** l'administrateur choisit « Retirer le consentement » et valide le dialog de D17 (« Le profil de {nom} ne sera plus public. Ses productions restent publiées, son nom s'affichera sans lien. »)
**Then** `POST /admin/authors/:id/withdraw-consent` remet `consent_confirmed_at` et `consent_confirmed_by_id` à NULL, le badge passe à « Non public », journal `consent_withdraw`
**And** dans la fiche d'un profil public la case est remplacée par le badge « Public » + le bouton « Retirer le consentement »

**Given** une fiche au consentement confirmé
**When** l'administrateur tente d'enregistrer 0 affiliation
**Then** le validateur refuse (`minLength(1)`, P2.1)

**Given** une confirmation sur un profil déjà public ou un retrait sur un profil non public
**When** la route est appelée
**Then** aucun changement ni entrée de journal n'est produit

**Notes techniques :** P2.1 (profil public = `consent_confirmed_at IS NOT NULL`, D27 au service et au validateur), P2.6 (routes `.confirm-consent`, `.withdraw-consent`, journal), P2-13. Les effets sur le site public (liste, profil, liens, 404) sont livrés par l'Epic 10 ; l'invalidation du cache des classements par l'Epic 12. i18n admin `authors.consent.*`.
**Tests :** functional `tests/functional/admin/authors_consent.spec.ts` (confirmation par case et par action, refus sans affiliation, retrait, idempotence, journal) ; unit validateur (affiliations conditionnelles).

---

### Story 9.5 : Proposition et validation de la table de conversion des auteurs

En tant que product owner (Aurélien),
Je veux recevoir une table de conversion proposée des noms d'auteurs existants vers des fiches, et pouvoir la contrôler après édition,
Afin de valider le rattachement avant toute écriture en base (FR56, D19).

**Acceptance Criteria:**

**Given** le dossier `commands/` et `app/services/author_conversion_service.ts` (logique testable sans CLI)
**When** `node ace authors:propose --out tmp/authors-conversion.csv` est exécuté
**Then** les noms distincts de `productions.authors` (tous statuts) non encore rattachés dans le pivot sont extraits et regroupés : `confidence=exact` (même `normalizeKey`), `confidence=grouped` (mêmes jetons triés, « Diallo Moussa » = « Moussa Diallo »), `confidence=fuzzy` (similarité `pg_trgm` > 0,6) signalé **dans `note` seulement, jamais fusionné**
**And** le découpage prénom/nom suit la règle : jeton entièrement en capitales = nom ; sinon dernier mot = nom
**And** le CSV (`;`, UTF-8 avec BOM) a les colonnes `source_name ; occurrences ; productions ; author_key ; first_names ; last_names ; existing_author_slug ; confidence ; note`

**Given** un CSV édité par Aurélien (fusions par `author_key`, corrections, `existing_author_slug`)
**When** `node ace authors:validate --file tmp/authors-conversion.csv` est exécuté
**Then** la commande vérifie que chaque nom source est mappé, qu'un `author_key` n'a qu'une identité (prénoms/noms), que chaque `existing_author_slug` existe et que les colonnes requises sont présentes
**And** elle affiche le rapport de ce qui serait créé ou rattaché, et sort avec un code ≠ 0 en cas d'erreur

**Given** l'une ou l'autre commande
**When** elle s'exécute
**Then** aucune ligne n'est écrite en base (lecture seule)
**And** le CSV n'est jamais commité ni joint à une PR (`tmp/` ignoré par git)

**Given** la story mergée sur `development`
**When** la proposition est générée sur la base partagée
**Then** elle est exécutée en utilisateur `atlas` sur le VPS de dev (`doppler run -- node ace authors:propose …`) et le CSV est remis à Aurélien hors dépôt pour validation

**Notes techniques :** P2.2 (commandes, CSV, règles de proposition), P2-05.
**Tests :** unit `AuthorConversionService` (« NOM Prénom », jetons inversés, homonymes non fusionnés, fuzzy en note seulement, erreurs de `validate`) ; functional sur Postgres local : `propose` n'écrit rien (comptages inchangés).

---

### Story 9.6 : Application idempotente et vérification de la conversion

En tant que product owner,
Je veux appliquer la table de conversion validée puis vérifier que 100 % des noms sont rattachés,
Afin que chaque production existante conserve tous ses auteurs, dans leur ordre, rattachés à des fiches (FR56).

**Acceptance Criteria:**

**Given** `app/services/production_author_service.ts`
**When** `refreshDenormalizedNames(productionIds)` est appelé
**Then** `productions.authors` est réécrit en SQL à partir du pivot (`COALESCE(jsonb_agg(first_names || ' ' || last_names ORDER BY position), '[]'::jsonb)` : la colonne est `NOT NULL`, un pivot vide donne `[]`), le trigger `productions_search_vector_update` restant inchangé (la recherche full-text trouve toujours les auteurs, P2-02)
**And** la modification du nom ou du prénom d'une fiche (Story 9.1) rafraîchit toutes ses productions

**Given** un CSV validé par `authors:validate`
**When** `node ace authors:apply --file tmp/authors-conversion.csv` est exécuté
**Then** dans **une seule transaction** : upsert des fiches par `migration_key = author_key` (consentement NULL, sans affiliation → « À compléter », `created_by_id` NULL, slug D28) ou rattachement à `existing_author_slug` ; insertion des lignes pivot dans l'ordre exact du tableau jsonb (`ON CONFLICT DO NOTHING`) ; productions déjà entièrement rattachées ignorées ; puis `refreshDenormalizedNames`
**And** si deux noms sources d'une même production désignent la même fiche (fusion par `author_key` ou `existing_author_slug`), la fiche n'y est liée qu'une fois, à la position de sa première occurrence, et les positions sont recompactées 1..n ; `verify` compte ces noms comme rattachés
**And** un rapport `tmp/authors-conversion-report-<date>.txt` liste fiches créées, liens créés et productions ignorées ; aucune entrée de journal d'activité n'est créée (pas d'admin acteur)

**Given** l'option `--dry-run`
**When** `apply` est exécuté
**Then** le même rapport est produit et la transaction est annulée

**Given** `apply` exécuté deux fois avec le même CSV, ou relancé avec un CSV complété de nouveaux noms
**When** l'état est comparé
**Then** la deuxième exécution ne crée ni doublon ni déplacement (idempotence) et seuls les nouveaux noms sont rattachés

**Given** `node ace authors:verify`
**When** il est exécuté
**Then** il rapporte les productions dont un nom jsonb n'a pas d'auteur rattaché, les positions incohérentes et les fiches orphelines, et sort avec un code ≠ 0 si le rattachement est < 100 %

**Given** la **porte manuelle (bloquante)** de la conversion sur la base partagée
**When** la story est terminée côté code et tests locaux
**Then** l'exécution sur Supabase n'a lieu **qu'après validation explicite et écrite du CSV par Aurélien**, en utilisateur `atlas` sur le VPS de dev via `doppler run` : `--dry-run` → `apply` → `verify` = 100 %
**And** le résultat (date, comptages, code de sortie de `verify`, sans aucun nom) est consigné dans le fichier de la story ; CSV et rapport restent hors dépôt
**And** la même séquence est rejouée en production lors de la release « bascule » (Story 8.6 en attente)

**Notes techniques :** P2.1 (`productions.authors` expand/contract), P2.2 (`apply`, `verify`, exécution), P2-02, P2-05.
**Tests :** functional sur Postgres local : `apply` (ordre conservé, fusion par `author_key`, rattachement à une fiche existante, fiches non publiques et « À compléter »), idempotence (deux exécutions = même état), `--dry-run` sans écriture, `verify` (0 si 100 %, ≠ 0 sinon), doublon dans une même production (lien unique, positions 1..n), `refreshDenormalizedNames` après renommage et sur pivot vide (`[]`).

---

### Story 9.7 : Sélection des auteurs d'une production depuis le référentiel (bascule)

En tant qu'administrateur,
Je veux choisir les auteurs d'une production parmi les fiches enregistrées et les ordonner,
Afin que chaque production soit rattachée à des auteurs identifiés, sans saisie libre (FR17, FR21, FR54, D18).

**Acceptance Criteria:**

**Given** `GET /admin/authors/search?q=&exclude[]=` (`admin.authors.search`)
**When** il est appelé avec au moins 2 caractères
**Then** il renvoie en JSON ≤ 10 résultats `{ id, name, primaryInstitution, isIncomplete, isPublic, photoUrl }` (`photoUrl` = URL signée de la variante `w128`, ou `null` → initiales, pour l'avatar de l'option et de `SelectedAuthorList`), recherche insensible à la casse et aux accents (`search_name` : `LIKE` ou `similarity > 0,3`), triés préfixe d'abord, puis similarité, puis nom de famille, auteurs de `exclude[]` écartés

**Given** le fieldset « Auteurs » du formulaire de production (création et édition)
**When** il s'affiche
**Then** `ChipInput` est remplacé pour les auteurs par `SelectedAuthorList` + `AuthorCombobox` (maquette `admin-author-picker.html`) ; `ChipInput` reste pour les tags
**And** `AuthorCombobox` suit le motif ARIA 1.2 combobox/listbox : recherche dès 2 caractères avec anti-rebond 250 ms, `Loader2` pendant la recherche, options « Prénom NOM » + 1re affiliation + badge « À compléter », « Aucun auteur trouvé. », « Recherche indisponible, réessayez. » en cas d'erreur ; ↑ ↓ parcourent, Entrée sélectionne, Échap ferme ; la saisie se vide après sélection
**And** `SelectedAuthorList` ajoute en fin de liste ; ↑ ↓ déplacent d'un rang (désactivés aux extrémités), × retire ; le focus reste sur le bouton actionné ; une région `aria-live="polite"` annonce « {nom} déplacé en position {n} » ; pas de glisser-déposer

**Given** une production enregistrée (brouillon ou publiée)
**When** l'administrateur enregistre avec `authorIds` ordonnés
**Then** `production_validator.ts` valide `authorIds` (uuid, distincts) et `ProductionAuthorService.sync(productionId, authorIds)` remplace les lignes pivot (positions 1..n) et rafraîchit `productions.authors` dans la même transaction ; un identifiant inconnu → erreur de validation
**And** le formulaire d'édition recharge les auteurs depuis le pivot, dans l'ordre
**And** les actions `store` et `update` de `app/controllers/admin/productions_controller.ts` n'écrivent plus jamais la colonne `productions.authors` depuis la requête (affectations `authors: data.authors ?? []` et `production.authors = data.authors ?? []` retirées ; un champ `authors` éventuellement reçu est ignoré) : seul `ProductionAuthorService` l'écrit

**Given** un brouillon sans auteur
**When** l'administrateur l'enregistre
**Then** l'enregistrement est accepté (FR20) ; `CompletionIndicator` signale « Au moins un auteur »
**And** la publication est refusée tant que le pivot est vide : `ProductionService.getMissingForPublish` compte les lignes pivot et `inertia/lib/production_completion.ts` est aligné (FR21)

**Given** une production non convertie (`productions.authors` non vide, 0 ligne pivot)
**When** son formulaire est ouvert puis enregistré sans auteur sélectionné
**Then** un avertissement « Auteurs à rattacher » est affiché et `sync` ne réécrit pas la colonne dénormalisée (aucun auteur effacé par erreur)

**Given** le seeder de démo `database/seeders/production_demo_seeder.ts` (base **locale** uniquement, jamais la base partagée)
**When** il est exécuté
**Then** il crée aussi des fiches auteurs fictives (noms inventés, `migration_key` préfixée `seed-demo:`), avec 1 ou 2 affiliations, une partie à consentement confirmé, et rattache chaque production de démo par `ProductionAuthorService.sync` (pivot et colonne dénormalisée cohérents)
**And** un nouveau passage purge d'abord les productions de démo puis les fiches `seed-demo:` (idempotent, aucune donnée réelle touchée)

**Given** le site public
**When** une production est enregistrée via le nouveau formulaire
**Then** l'affichage public est inchangé (il lit `authorNames`, tenu à jour) et la recherche full-text trouve les auteurs

**Given** la **porte manuelle (bloquante)** de la bascule
**When** la story est prête à partir en staging
**Then** elle n'est déployée sur le staging (et n'est utilisée en dev contre la base partagée pour éditer des productions) **qu'après** `authors:apply` + `authors:verify` à 100 % (Story 9.6) ; `authors:verify` est relancée juste après le déploiement et son résultat consigné dans la story

**Notes techniques :** P2.6 (`search`, formulaire `authorIds`, `getMissingForPublish`), P2.1 (expand), P2.9 lot 4 (porte). Composants `inertia/components/admin/AuthorCombobox.tsx`, `SelectedAuthorList.tsx` ; popover/combobox shadcn ajoutés par la CLI. Le « contract » (retrait de `authors: string[]` du validateur, du `ChipInput` auteurs et de `distinctSuggestions().authors`) est hors Phase 2 (release après conversion en production) : ce code mort n'est plus branché sur l'écriture dès cette story. i18n admin `authors.picker.*`, `productions.form.completion.authors`.
**Tests :** functional `tests/functional/admin/productions_authors.spec.ts` (sync ordonné, réordonnancement, identifiant inconnu, publication refusée sans auteur, production non convertie protégée, colonne `authors` jamais écrite depuis la requête, `search` : accents, casse, exclusion, limite 10, `photoUrl`) ; unit seeder (fiches `seed-demo:`, pivot rempli, purge idempotente) ; unit `production_completion` ; composants par lecture de source (`aria-activedescendant`, `aria-live`, boutons ↑ ↓ nommés).

---

### Story 9.8 : Créer un auteur sans quitter le formulaire de production

En tant qu'administrateur,
Je veux créer un co-auteur absent du référentiel depuis le formulaire de production,
Afin de ne pas perdre ma saisie et de le retrouver sélectionné automatiquement (FR54, D16, parcours 3).

**Acceptance Criteria:**

**Given** `AuthorCombobox` avec une saisie
**When** la liste s'ouvre
**Then** la dernière option est toujours « Créer un auteur « {saisie} » » ; un bouton « Créer un auteur » est aussi disponible à côté du champ

**Given** l'option ou le bouton activé
**When** `AuthorFormDialog` s'ouvre
**Then** il reprend les champs d'`AuthorForm` (Nom, Prénom, affiliations, Google Scholar, photo, case de consentement facultative désactivée sans affiliation) prérempli par la saisie découpée au dernier espace (avant = prénom, dernier mot = nom ; un seul mot = nom, D36)
**And** le focus est piégé dans le dialog ; Échap ou « Annuler » le ferment sans créer et rendent le focus au déclencheur

**Given** une saisie valide
**When** l'administrateur clique « Créer et ajouter »
**Then** une requête `fetch` multipart vers `POST /admin/authors/quick` (en-têtes `X-XSRF-TOKEN` lu du cookie `XSRF-TOKEN` et `Accept: application/json`) renvoie 201 `{ author }`
**And** le dialog se ferme, l'auteur est ajouté en fin de sélection, le focus revient à `AuthorCombobox`, toast « Auteur créé. »
**And** les saisies non enregistrées de la production sont intactes (aucune navigation Inertia)
**And** le journal reçoit `create` / `author` (+ `consent_confirm` si la case est cochée)

**Given** une saisie invalide
**When** l'envoi est tenté
**Then** l'endpoint renvoie 422 avec les erreurs VineJS en JSON, affichées en ligne ; le dialog reste ouvert ; le bouton est désactivé avec `Loader2` pendant l'envoi

**Given** une requête sans jeton XSRF valide
**When** elle atteint `POST /admin/authors/quick`
**Then** elle est rejetée par Shield (protection CSRF, NFR7)

**Notes techniques :** P2.6 (`admin.authors.quick-store`, fenêtre « Créer un auteur »), P2-14 ; `enableXsrfCookie: true` déjà présent dans `config/shield.ts`. Composant `inertia/components/admin/AuthorFormDialog.tsx` réutilisant `AuthorForm`. i18n admin `authors.dialog.*`.
**Tests :** functional `quick` (201, 422 JSON, CSRF refusé, journal) ; composant par lecture de source (`role="dialog"`, retour du focus, absence de `router.visit`).

---

### Story 9.9 : Tests référentiel d'auteurs et conversion

En tant que développeur,
Je veux une suite de tests couvrant le référentiel d'auteurs, la conversion et la sélection dans le formulaire,
Afin de garantir l'intégrité des rattachements sur la base partagée.

**Acceptance Criteria:**

**Given** les specs `tests/functional/admin/authors_crud.spec.ts`, `authors_list.spec.ts`, `authors_consent.spec.ts`, `productions_authors.spec.ts` et `authors_conversion.spec.ts`
**When** `npm run test:local -- functional` est exécuté (Postgres Docker local, `SESSION_DRIVER=memory`, `.withCsrfToken()`, `.redirects(0)`, `loginAs()`)
**Then** les scénarios suivants passent :

- Création / modification d'une fiche → affiliations ordonnées, slug figé, journal `create` / `update` avec `metadata`
- Validation → nom, prénom, affiliation requise (sauf fiche migrée), URL Scholar invalide
- Photo → variantes R2 (`drive.fake('r2')`), format réel refusé, > 5 Mo refusé, retrait
- Liste → recherche sans accents, filtre institution, filtres rapides et compteurs
- Suppression → OK sans production ; refusée avec un brouillon lié (FR55)
- Consentement → confirmation (case, action), refus sans affiliation (D27), retrait, journal `consent_confirm` / `consent_withdraw`
- Formulaire de production → `sync` ordonné, publication refusée sans auteur (FR21), production non convertie protégée
- `quick` → 201 + sélection, 422 JSON, CSRF refusé
- Conversion → `propose` sans écriture, `apply` idempotent (deux exécutions = même état), `--dry-run`, `verify` à 100 % et < 100 %
- Accès → non authentifié redirigé ; rôle `admin` et `super_admin` autorisés

**Given** les specs unitaires (`normalizeKey`, slug, `author_validator`, `AuthorConversionService`, `ImageService`, `production_completion`, composants par lecture de source, parité i18n FR/EN)
**When** `npm run test:local -- unit` est exécuté
**Then** elles passent, et la CI (`ci.yml`) les exécute sans `continue-on-error`


---

## Epic 10 : Auteurs sur le site public (Phase 2)

Un visiteur découvre les auteurs de la bibliothèque : liste des auteurs à profil public, pages de profil, noms d'auteurs cliquables partout, filtre auteur du listing, pages auteurs référencées. La politique de confidentialité décrit le traitement des données des auteurs avant toute publication de profil.

**Règle de visibilité (P2.1, D11)** : profil public = `consent_confirmed_at IS NOT NULL` ; visible sur le site = public **et** au moins une production publiée liée. Un profil non visible n'apparaît nulle part sur le site et son URL renvoie 404.

### Story 10.1 : Politique de confidentialité des auteurs et page 404 traduite

En tant que visiteur (et en tant qu'auteur),
Je veux savoir quelles données des auteurs sont publiées et comment les faire retirer, et tomber sur une page d'erreur claire quand une page n'existe pas,
Afin de faire confiance au site avant que des profils soient publiés (exigence domaine RGPD du PRD, D36).

**Acceptance Criteria:**

**Given** `/privacy-policy`
**When** la page est affichée en FR ou en EN
**Then** une nouvelle section décrit les données publiées sur les profils (nom, prénoms, affiliations, lien Google Scholar, photo), leur base (consentement de l'auteur confirmé par un administrateur), le retrait du consentement (profil repassé non public), le retrait des champs facultatifs sur demande et la suppression d'une fiche non liée à une production (FR55)
**And** le texte est rédigé dans les clés `privacy.authors.*` de `inertia/locales/public/{fr,en}.json` et validé par Aurélien avant merge ; il ne contient aucune donnée personnelle

**Given** une URL publique inconnue ou une production inexistante
**When** la réponse est rendue
**Then** `inertia/pages/errors/not_found.tsx` devient la NotFoundPage traduite, dans `PublicLayout` : statut HTTP 404, titre de page traduit, message « Cette page n'existe pas ou n'est plus disponible. » / « This page does not exist or is no longer available. », liens « Accueil » et « Recherche avancée » (`/productions`)
**And** la page a un seul `h1` et des liens d'au moins 44 px de haut

**Notes techniques :** P2.7 « Données personnelles », P2.6 (NotFoundPage, D36). i18n public `privacy.authors.*`, `not_found.*`.
**Tests :** functional `tests/functional/public/privacy.spec.ts` (section présente) et 404 (statut, composant `errors/not_found`) ; parité FR/EN.

---

### Story 10.2 : Photos d'auteurs publiques et composant Avatar

En tant que visiteur,
Je veux voir la photo d'un auteur à profil public, ou ses initiales à défaut,
Afin de reconnaître les membres de la communauté (FR57, FR58, D13, D25).

**Acceptance Criteria:**

**Given** la route publique `GET /media/*` (`media.show`, `app/controllers/public/media_controller.ts`)
**When** elle reçoit une clé `authors/<id>/<token>/<variante>`
**Then** elle diffuse le flux R2 (`disk.getStream`) avec le bon `Content-Type` et `Cache-Control: public, max-age=3600` **seulement si** le préfixe est le `photo_key` courant d'un auteur à profil public
**And** sinon (auteur non public, ancienne clé, variante inconnue) elle répond 404 avec `Cache-Control: no-store`
**And** les préfixes autres que ceux autorisés (dont `productions/…`) et toute tentative de remontée de chemin (`..`) renvoient 404 ; les fichiers sous licence restent servis par URL signée

**Given** `inertia/lib/media.ts`
**When** une photo d'auteur est rendue
**Then** il construit `src`/`srcSet` à partir de la base `photoUrl` (`w128`, `w384`) avec `width`/`height` renseignés

**Given** le composant partagé `inertia/components/shared/Avatar.tsx`
**When** l'auteur a une photo
**Then** la photo est affichée ; si elle échoue au chargement, les initiales la remplacent
**And** sans photo, les initiales (1re lettre du 1er prénom + 1re lettre du 1er nom) sont affichées sur fond green-100 / texte green-800 (D25), en `aria-hidden="true"`
**And** l'attribut `alt` est fourni par l'appelant (`alt=""` quand la photo est adjacente au nom, D36)

**Notes techniques :** P2.5 « Diffusion » (`/media`, contrôle de visibilité, photos `max-age=3600` car le consentement est révocable), P2-10. Les préfixes `thumbnails/` et `posters/` sont ajoutés par l'Epic 11. Jetons `avatar-initials-*` de `DESIGN.md`.
**Tests :** functional `tests/functional/public/media.spec.ts` (200 + en-têtes pour un auteur public, 404 non public, 404 ancienne clé, 404 `productions/…`, 404 `..`) avec `drive.fake('r2')` ; composant par lecture de source (`aria-hidden` des initiales, repli `onError`).

---

### Story 10.3 : Page de profil d'un auteur

En tant que visiteur,
Je veux consulter le profil d'un auteur et la liste de ses productions publiées,
Afin de découvrir son travail et ses affiliations (FR58, FR53, D11, D15, D17).

**Acceptance Criteria:**

**Given** `GET /authors/:slug` (`authors.show`, `app/controllers/public/authors_controller.ts`)
**When** le slug correspond à un auteur visible (profil public et ≥ 1 production publiée)
**Then** la page `inertia/pages/author.tsx` s'affiche (maquette `author-profile.html`, conteneur max-w-6xl avec aside statistiques, D35)

**Given** un slug inconnu, un auteur sans consentement, un auteur sans production publiée, ou un auteur dont le consentement vient d'être retiré ou dont la dernière production vient d'être dépubliée
**When** l'URL est demandée
**Then** la NotFoundPage est rendue avec le statut 404 (D11, D17)

**Given** un profil visible
**When** `AuthorProfileHeader` se rend
**Then** il affiche la photo (`alt="Photo de {Prénom NOM}"`) ou les initiales, le nom en `h1` « Prénom NOM », les affiliations dans l'ordre (département seulement s'il existe), le lien Google Scholar seulement s'il existe (icône + « Google Scholar », `target="_blank"`, `rel="noopener noreferrer"`, texte masqué « (nouvel onglet) », D15)
**And** l'aside présente les totaux de vues, de téléchargements et le nombre de productions publiées (« Totaux des productions publiées. ») ; un champ facultatif absent ne laisse aucun trou visuel
**And** un fil d'Ariane `<nav aria-label="Fil d'Ariane">` « Accueil › {Prénom NOM} » marque la page courante `aria-current="page"`

**Given** la section `h2` « Productions »
**When** elle s'affiche
**Then** elle liste les productions publiées de l'auteur, 12 par page, en cartes `ProductionCard`, avec compteur et `SortSelect` : date de publication de l'œuvre ↓ (défaut, omis de l'URL), `views` (totaux ↓), `downloads` (totaux ↓), `title` (A → Z)
**And** un changement de tri remet la page à 1 ; la `Pagination` numérotée conserve le tri ; une page hors limites redirige (302) vers la dernière page en conservant les paramètres (D36)

**Given** les cartes de production de la page
**When** elles sont sérialisées
**Then** elles le sont par le transformer unique `app/transformers/production_card_transformer.ts`, qui remplace les `serialize()` dupliqués de `home_controller.ts` et `productions_controller.ts` sans changer les props actuelles

**Notes techniques :** P2.6 (route, `sort=date|views|downloads|title`, 12/page, 404 comme `ProductionsController.show`), P2.1 (visibilité). Composants `inertia/components/public/AuthorProfileHeader.tsx`, `inertia/components/shared/SortSelect.tsx` (réutilisé par les Stories 10.5 et 12.1). Le niveau « Auteurs » du fil d'Ariane est ajouté en Story 10.5 ; les liens des noms d'auteurs en Story 10.4. i18n public `authors.profile.*`.
**Tests :** functional `tests/functional/public/author_profile.spec.ts` (200 visible, 404 ×4 cas, tris, pagination, page hors limites → 302, totaux) ; composant par lecture de source (`alt`, `aria-current`, « (nouvel onglet) »).

---

### Story 10.4 : Noms d'auteurs liés vers leur profil

En tant que visiteur,
Je veux cliquer sur le nom d'un auteur partout où il apparaît,
Afin d'accéder à son profil en un clic (FR59, FR53, D12, D24, D36).

**Acceptance Criteria:**

**Given** `production_card_transformer.ts` et la page de détail
**When** une production publiée est sérialisée
**Then** elle expose `authors: { name, slug | null }[]` dans l'ordre du pivot, `slug` n'étant renseigné que pour un profil public ; aucune autre donnée d'un auteur non public n'est exposée

**Given** le composant `inertia/components/public/AuthorByline.tsx`
**When** il rend les auteurs d'une production
**Then** un auteur à profil public est un lien vers `/authors/:slug` (souligné stone-300, décalage 2 px, green-700 au survol, D24) ; un auteur sans profil public est du texte simple sans style distinctif (D12) ; séparateur « , »
**And** sur les cartes, au plus 3 auteurs sont affichés puis « et {n} autres » ; sur la page de détail (byline et aside « Auteurs »), aucune troncature (D36)
**And** sur le profil d'un auteur, son propre nom est rendu en texte simple

**Given** une `ProductionCard` (listing, accueil, profil)
**When** elle s'affiche
**Then** le titre reste le lien principal, la byline est rendue hors de ce lien (aucun lien imbriqué) et l'ordre de tabulation est titre puis auteurs

**Given** un administrateur qui retire le consentement d'un auteur
**When** une page publique est rechargée
**Then** son nom s'affiche sans lien

**Notes techniques :** P2.6 (`production.show` : auteurs `{ name, slug | null }[]`), P2.7 (aucune donnée d'auteur non public). La bannière à la une réutilisera `AuthorByline` (Story 11.6). i18n public `authors.byline.others` (pluriel i18next).
**Tests :** functional (détail et listing : slug présent pour un profil public, `null` sinon, ordre) ; composants par lecture de source (pas de `<a>` imbriqué, « et {n} autres », propre nom non lié).

---

### Story 10.5 : Liste publique des auteurs et lien « Auteurs » du pied de page

En tant que visiteur,
Je veux parcourir, rechercher et filtrer la liste des auteurs,
Afin de trouver un auteur et ses productions (FR57, FR60, FR44, D3, D13, D14, D31, D34).

**Acceptance Criteria:**

**Given** la migration `1775918751000_add_stats_window_indexes.ts`
**When** elle est exécutée
**Then** les index `idx_stats_views_production_id_recorded_at`, `idx_stats_downloads_production_id_downloaded_at` et `idx_stats_downloads_downloaded_at` existent (création simple, sans `CONCURRENTLY`)

**Given** `GET /authors` (`authors.index`)
**When** la page `inertia/pages/authors.tsx` s'affiche (maquette `authors-list.html`)
**Then** elle présente un `h1` « Auteurs », la phrase « Les auteurs des productions publiées sur Anta. », `AuthorFilters`, puis les `AuthorCard` des auteurs visibles en grille 1/2/3/4 colonnes (sm/lg/xl) dans un conteneur max-w-7xl (D31), 24 par page
**And** chaque `AuthorCard` affiche `Avatar` (`alt=""`), « Prénom NOM » (lien unique étendu à la carte), l'institution principale (omise si aucune), le nombre de productions publiées et le total des vues (D3)

**Given** `AuthorFilters`
**When** le visiteur cherche un nom (`q`, soumission par Entrée), choisit une institution (sélection unique) ou un domaine des productions (sélection unique), ou change le tri
**Then** la recherche est insensible à la casse et aux accents ; la facette institution porte sur toutes les affiliations des auteurs visibles, dédoublonnées par `institution_key` avec la graphie la plus fréquente comme libellé (D14) ; tout changement ramène à la page 1 ; l'état est dans l'URL (valeur par défaut omise)
**And** le compteur « {n} auteurs · {début}–{fin} » est en `aria-live="polite"`

**Given** les tris
**When** la liste est triée
**Then** le défaut « Les plus consultés (12 derniers mois) » ordonne par vues des 365 derniers jours ↓ (expression de P2.3 sans `HAVING` : un auteur à 0 vue figure en fin de liste) ; « Nom (A → Z) » par nom de famille puis prénom ; « Nombre de productions » par nombre de productions publiées ↓ puis nom ; ex æquo : nom de famille, puis prénom

**Given** aucun profil visible, ou des filtres sans résultat
**When** la page s'affiche
**Then** respectivement « Aucun auteur pour le moment. » ou « Aucun auteur ne correspond à votre recherche. » + « Effacer les filtres »
**And** une page hors limites redirige (302) vers la dernière page en conservant les paramètres

**Given** le pied de page de toutes les pages publiques
**When** il s'affiche
**Then** la colonne « Explorer » contient Accueil, « Recherche avancée » (libellé renommé, destination `/productions` inchangée), « Auteurs » (nouveau, `/authors`) et Politique de confidentialité (FR60, FR44, D34)
**And** la NotFoundPage gagne le lien « Auteurs » et le fil d'Ariane du profil devient « Accueil › Auteurs › {Prénom NOM} »

**Notes techniques :** P2.3 (expression des vues 365 j, tris de la liste), P2.6 (`/authors` : `q`, `institution`, `domain`, `sort=views|name|productions`, 24/page ; facette institution `mode() WITHIN GROUP`), P2.1 (index). Composants `AuthorCard`, `AuthorFilters` (`inertia/components/public/`). Contrôles publics ≥ 44 px. i18n public `authors.list.*`, `footer.*`.
**Tests :** functional `tests/functional/public/authors_list.spec.ts` (seuls les auteurs visibles, recherche sans accents, facette institution dédoublonnée, filtre domaine, trois tris et ex æquo, vues hors fenêtre de 366 j ignorées par le tri par défaut, page hors limites → 302, états vides) ; composants par lecture de source (stretched link unique, `aria-live`).

---

### Story 10.6 : Filtre auteur du listing par profil public

En tant que visiteur,
Je veux filtrer le listing par un ou plusieurs auteurs enregistrés,
Afin de retrouver toutes les productions d'un auteur (FR5, D12, D28, flux 5).

**Acceptance Criteria:**

**Given** `GET /productions?author=<slug>` (paramètre répétable)
**When** un ou plusieurs slugs sont fournis
**Then** le listing ne garde que les productions liées à au moins un de ces auteurs (OU, `whereExists` sur le pivot + `authors.slug`), combiné en ET avec les autres filtres et la recherche
**And** un slug inconnu ou d'un profil non public est ignoré sans erreur

**Given** la facette auteur de `FilterBar`
**When** elle est construite
**Then** ses valeurs sont `{ value: slug, label: "Prénom NOM" }` des seuls auteurs visibles (profil public, ≥ 1 production publiée, D12), à la place des valeurs distinctes de la colonne jsonb
**And** la puce est opérable au clavier (parcours 1, flux 5), le bouton « Effacer filtres » et la pagination conservent le paramètre `author`

**Notes techniques :** P2.6 (`/productions` : filtre et facette), `app/services/search_service.ts`. Le retrait du code de facette jsonb devenu inutile fait partie du « contract » (hors Phase 2). i18n inchangée hors libellé de facette si nécessaire.
**Tests :** functional `tests/functional/public/listing.spec.ts` / `search.spec.ts` (un slug, deux slugs en OU, combinaison avec catégorie, slug non public ignoré, facette limitée aux auteurs visibles).

---

### Story 10.7 : Référencement des pages auteurs

En tant que visiteur arrivant d'un moteur de recherche ou d'un partage,
Je veux que les pages auteurs aient un titre, une description et un aperçu corrects,
Afin de reconnaître le profil avant de cliquer (FR36).

**Acceptance Criteria:**

**Given** `SeoService.forAuthor(locale, author, appUrl)`
**When** un profil visible est rendu
**Then** `title` = « Prénom NOM — Anta », `description` = « {institution principale} — {n} productions publiées sur Anta » (affiliation omise si absente), `ogType: 'profile'`, `ogUrl` = URL absolue `/authors/:slug`, `ogImage` = URL absolue `APP_URL` + `/media/authors/…/og.jpg` si une photo existe

**Given** `MetaTags` et `resources/views/inertia_layout.edge`
**When** une page porte une `ogImage`
**Then** le HTML contient `og:image` et `twitter:card` = `summary_large_image` ; sans image, `twitter:card` = `summary` (comportement réutilisé par les productions en Story 11.2)

**Given** `/authors`
**When** la page est rendue
**Then** `SeoService.authorsList(locale)` fournit titre et description de la liste

**Given** une page de production
**When** ses meta sont générées
**Then** elles ne contiennent aucune donnée d'un auteur non public (seuls les noms affichés sur la page)

**Notes techniques :** P2.7 « SEO profil », P2.5 « SEO » (`ogImage`, `twitter:card`). `ssr: false` : meta côté edge, vérifiées par lecture du HTML.
**Tests :** unit `SeoService.forAuthor` / `authorsList` (forme minimale, sans affiliation, sans photo) ; functional `tests/functional/public/seo.spec.ts` (balises présentes dans le HTML du profil et de la liste).

---

### Story 10.8 : Tests auteurs sur le site public

En tant que développeur,
Je veux une suite de tests couvrant la visibilité des auteurs sur le site public,
Afin de garantir qu'aucun profil non consenti n'est exposé.

**Acceptance Criteria:**

**Given** les specs `tests/functional/public/media.spec.ts`, `author_profile.spec.ts`, `authors_list.spec.ts`, `listing.spec.ts`, `seo.spec.ts` et `privacy.spec.ts`
**When** `npm run test:local -- functional` est exécuté
**Then** les scénarios suivants passent :

- Profil → 200 si visible ; 404 si slug inconnu, sans consentement, sans production publiée, après retrait du consentement, après dépublication de la dernière production
- `/media/authors/…` → servi pour un profil public ; 404 pour un profil non public, une ancienne clé, `productions/…`, `..`
- Liste → auteurs visibles seulement, recherche, filtres, tris, ex æquo, page hors limites → 302
- Bylines → `slug` seulement pour les profils publics, ordre du pivot
- Filtre `author=<slug>` → OU entre auteurs, ET avec les autres filtres, facette limitée aux auteurs visibles
- SEO → balises profil (`og:type=profile`, `og:image` si photo), liste ; aucune donnée d'auteur non public dans les meta de production
- Politique de confidentialité → section « auteurs » présente en FR et EN ; 404 traduite

**Given** les specs unitaires (`SeoService`, composants `Avatar`, `AuthorByline`, `AuthorCard`, `AuthorFilters`, `AuthorProfileHeader`, `SortSelect` par lecture de source, parité i18n)
**When** `npm run test:local -- unit` est exécuté
**Then** elles passent

**Given** le staging après livraison de l'epic
**When** un audit Lighthouse mobile 4G est lancé sur `/authors` et un profil
**Then** le LCP est < 3 s (NFR17) et le résultat est consigné dans la story


---

## Epic 11 : Vignettes et productions à la une (Phase 2)

Les administrateurs illustrent les productions par une vignette (ou l'image extraite d'une vidéo hébergée) et mettent jusqu'à 3 productions à la une ; les visiteurs voient les vignettes dans les cartes et les partages, et la bannière à la une en tête de l'accueil.

**Image affichée d'une production (P2.1)** : `productions.thumbnail_key` sinon `poster_key` du premier fichier `video/mp4` (ordre de création) ; aucune largeur/hauteur stockée (variantes à dimensions fixes).

### Story 11.1 : Vignette d'une production dans le panel admin

En tant qu'administrateur,
Je veux téléverser, remplacer ou retirer la vignette d'une production,
Afin de l'illustrer sur le site public (FR50, D1, NFR19).

**Acceptance Criteria:**

**Given** la migration `1775918748000_add_thumbnail_and_poster_columns.ts`
**When** elle est exécutée
**Then** `productions.thumbnail_key` et `production_files.poster_key` (varchar 255, NULL, sans défaut) existent

**Given** `ImageService` (Story 9.3) étendu au format 16:9
**When** une vignette est traitée
**Then** les variantes `w400.webp` (400×225), `w800.webp`, `w1600.webp` et `og.jpg` (1200×675, JPEG q85) sont produites par recadrage centré (`fit: 'cover'`), après validation réelle du format (JPEG, PNG, WebP ≤ 5 Mo, sinon `thumbnail.errors.invalid_type` / `thumbnail.errors.too_large`) et suppression des métadonnées

**Given** `POST /admin/productions/:productionId/thumbnail` (`admin.productions.thumbnail.store`, `app/controllers/admin/thumbnails_controller.ts`)
**When** une vignette valide est envoyée
**Then** les variantes sont écrites sous un préfixe neuf `thumbnails/<productionId>/<token 20>`, `thumbnail_key` est mis à jour **après** l'envoi, l'ancien préfixe est supprimé (best-effort), redirection arrière + flash comme `files_controller.ts`
**And** le journal reçoit `update` / `production` avec `metadata: { field: 'thumbnail', op: 'set' }`

**Given** `DELETE /admin/productions/:productionId/thumbnail` (`.destroy`)
**When** l'administrateur retire la vignette
**Then** `thumbnail_key` passe à NULL, le préfixe R2 est supprimé, journal `metadata: { field: 'thumbnail', op: 'remove' }`

**Given** le formulaire de production (dès que la production existe, comme `FileUploader`)
**When** le fieldset « Fichiers » s'affiche
**Then** `ThumbnailField` (`inertia/components/admin/ThumbnailField.tsx`) propose un téléversement immédiat avec barre de progression, validation type/taille côté client, aperçu recadré 16:9 (URL signée), « Remplacer » et « Retirer », et l'aide « JPEG, PNG ou WebP · 5 Mo max · format 16:9 conseillé (recadrage automatique) » (D36)
**And** la vignette est facultative et n'entre pas dans `CompletionIndicator` (D1) ; erreur de type ou de taille en ligne, échec réseau → toast d'erreur persistant (`notify`)

**Given** une production supprimée
**When** la suppression aboutit
**Then** le préfixe de sa vignette est supprimé de R2 (best-effort)

**Notes techniques :** P2.1 (colonnes), P2.5 (variantes 16:9, clés immuables), P2.6 (routes thumbnail, journal), P2-08. i18n admin `thumbnail.*`.
**Tests :** functional `tests/functional/admin/production_thumbnail.spec.ts` (`drive.fake('r2')`, image générée par `sharp` : pose, remplacement → ancien préfixe supprimé, retrait, format refusé, > 5 Mo refusé, journal) ; unit variantes 16:9.

---

### Story 11.2 : Vignettes sur le site public et image de partage

En tant que visiteur,
Je veux voir la vignette des productions dans les cartes et dans les aperçus de partage,
Afin d'identifier visuellement une production (FR50, FR36, D1, D2, NFR17).

**Acceptance Criteria:**

**Given** `GET /media/thumbnails/<productionId>/<token>/<variante>`
**When** le préfixe est le `thumbnail_key` courant d'une production **publiée**
**Then** l'image est diffusée avec `Cache-Control: public, max-age=31536000, immutable` ; sinon (brouillon, ancienne clé) 404 `no-store`

**Given** `production_card_transformer.ts`
**When** une carte est sérialisée
**Then** elle expose `thumbnailUrl` (base `/media/thumbnails/<id>/<token>` ou `null`) ; `inertia/lib/media.ts` construit `srcSet` (`w400 400w, w800 800w, w1600 1600w`) et les `sizes` par contexte, `width`/`height` toujours renseignés (16:9), `loading="lazy"`

**Given** une `ProductionCard` (listing, accueil, profil) d'une production avec vignette
**When** elle s'affiche
**Then** la vignette est en tête de carte (D1, D2), enveloppée dans un lien vers le même détail avec `tabindex="-1"` et `aria-hidden="true"`, `alt=""` (pas de 2e arrêt de tabulation)
**And** sans vignette, la carte texte actuelle est inchangée ; en cas d'erreur de chargement, la zone 16:9 reste vide en `muted`, texte intact

**Given** la page de détail d'une production avec vignette
**When** ses meta sont générées
**Then** `SeoService.forProduction` reçoit l'image et le HTML contient `og:image` (URL absolue `APP_URL` + `/media/…/og.jpg`, stable) et `twitter:card=summary_large_image` (mécanisme de la Story 10.7)

**Notes techniques :** P2.5 « Diffusion », « Front », « SEO », P2-10. Extension de `media_controller.ts` (Story 10.2) au préfixe `thumbnails/`.
**Tests :** functional `media.spec.ts` (vignette publiée servie, brouillon 404, ancienne clé 404), `seo.spec.ts` (`og:image` présent / absent) ; composant `ProductionCard` par lecture de source (`tabindex="-1"`, `aria-hidden`, `alt=""`, `width`/`height`).

---

### Story 11.3 : Image extraite des vidéos hébergées

En tant qu'administrateur,
Je veux qu'une vidéo hébergée sans vignette soit illustrée par une image extraite automatiquement,
Afin de pouvoir l'illustrer et la mettre à la une sans préparer d'image (FR50, D10).

**Acceptance Criteria:**

**Given** le `Dockerfile` et `.github/workflows/ci.yml`
**When** l'image est construite ou la CI s'exécute
**Then** `ffmpeg` est installé (`apt-get install -y --no-install-recommends ffmpeg` dans l'étape `runtime`, avant `USER node` ; étape apt dans le job CI)
**And** `tests/unit/infrastructure/deployment.spec.ts` vérifie la présence de `ffmpeg` dans le `Dockerfile`

**Given** `VideoFrameService.extract(inputPath)`
**When** un MP4 est téléversé via `FilesController.store`
**Then** **avant** `FileStorageService.upload` (qui déplace le fichier temporaire), l'image à t = 1 s est extraite dans un PNG temporaire (`execFile('ffmpeg', ['-ss','1','-i',input,'-frames:v','1','-f','image2','-c:v','png', out])`, repli `-ss 0` pour une vidéo < 1 s, délai maximal 20 s) ; **après** la création de la ligne `production_files` (son identifiant n'existe qu'alors), ses variantes 16:9 (`ImageService`) sont envoyées sous `posters/<fileId>/<token>` puis `production_files.poster_key` est écrit
**And** un échec d'extraction est journalisé dans les logs applicatifs et **ne fait jamais échouer** le téléversement de la vidéo (`poster_key` reste NULL)

**Given** un fichier vidéo supprimé
**When** la suppression aboutit
**Then** le préfixe de son poster est supprimé de R2

**Given** une production avec une vidéo hébergée pourvue d'un poster et sans vignette
**When** elle est affichée (cartes, `og:image`) ou servie par `/media/posters/…` (poster courant d'un fichier d'une production publiée, sinon 404)
**Then** l'image extraite est utilisée ; retirer la vignette d'une production fait réapparaître l'image extraite sans retraitement
**And** le lecteur vidéo de la page de détail utilise ce poster comme attribut `poster`

**Given** `ThumbnailField` d'une vidéo hébergée sans vignette
**When** il s'affiche
**Then** il présente l'aperçu de l'image extraite avec la mention « Image extraite de la vidéo » (D10)

**Given** la commande `node ace thumbnails:extract-video-frames [--dry-run]`
**When** elle est exécutée
**Then** elle traite les vidéos hébergées sans poster (ffmpeg lit l'URL signée R2 par requêtes de plage), affiche un rapport (traitées, échecs) et n'écrit rien en `--dry-run`
**And** **porte manuelle** : son exécution réelle (écriture en base partagée et dans R2) a lieu une seule fois, sur le VPS de dev en `atlas` via `doppler run`, **avec l'accord explicite d'Aurélien**, `--dry-run` d'abord ; le résultat (comptages) est consigné dans la story

**Notes techniques :** P2.5 « Image extraite », P2-09 ; règle d'image affichée de P2.1. i18n admin `thumbnail.extracted`.
**Tests :** functional (MP4 de 2 s généré par `ffmpeg` dans le setup, aucun binaire commité : poster créé ; vidéo < 1 s ; fichier corrompu → téléversement OK et `poster_key` NULL ; suppression du fichier → poster supprimé ; `/media/posters` servi / 404) ; commande `--dry-run` sans écriture.

---

### Story 11.4 : Page admin « À la une »

En tant qu'administrateur,
Je veux choisir jusqu'à 3 productions publiées à mettre à la une et leur ordre,
Afin d'éditorialiser la bannière de l'accueil (FR47, FR50, D20, D26, D30).

**Acceptance Criteria:**

**Given** la migration `1775918749000_create_featured_productions_table.ts`
**When** elle est exécutée
**Then** `featured_productions` existe (`position` smallint PK `CHECK BETWEEN 1 AND 3`, `production_id` UNIQUE FK `CASCADE`, `created_by_id` FK `SET NULL`, `created_at`)

**Given** `app/services/featured_service.ts`
**When** `requiresThumbnail(production)` est évalué
**Then** une vignette est requise sauf si la production possède une vidéo hébergée avec `poster_key` ; une vidéo disponible uniquement en lien externe requiert une vignette (FR50)
**And** `save(productionIds, adminId)` remplace la sélection dans une transaction (`DELETE` + `INSERT` positions 1..n) et refuse toute production non publiée ou dépourvue de la vignette requise (`featured.errors.*`)

**Given** `app/enums/action_type.ts`
**When** une sélection est enregistrée
**Then** `FEATURED_UPDATE: 'featured_update'` est journalisé avec `resourceType: 'featured_selection'`, `metadata: { before: [ids], after: [ids] }`, et traduit dans la page Journal

**Given** la barre latérale admin
**When** un administrateur (admin ou super admin) l'ouvre
**Then** l'entrée « À la une » apparaît après « Auteurs » et mène à `GET /admin/featured` (`inertia/pages/admin/Featured/Index.tsx`, maquette `admin-featured.html`)

**Given** la page « À la une »
**When** elle s'affiche
**Then** elle présente le texte d'introduction (« Jusqu'à 3 productions publiées… Les changements ne s'appliquent à l'accueil qu'après « Enregistrer ». »), 3 `FeaturedSlot` ordonnés (1 = grand format), une `BannerPreview` et une barre « Enregistrer »
**And** un emplacement vide contient `ProductionPicker` : combobox (ARIA 1.2) interrogeant `GET /admin/featured/candidates?q=&exclude[]=` (productions **publiées** par titre ou auteur, avec état de vignette ; déjà choisies exclues)
**And** un emplacement rempli propose ↑ ↓ (permutation avec le voisin) et « Retirer » (les suivants remontent, D30) et affiche le badge « Affichée » ou « Vignette manquante »

**Given** un emplacement dont la production n'a pas la vignette requise
**When** il est rempli
**Then** un avertissement et un `ThumbnailField` en ligne permettent de téléverser la vignette sur place, sans perdre l'état non enregistré des emplacements (D20)
**And** « Enregistrer » est désactivé avec l'explication visible reliée par `aria-describedby` « Enregistrement impossible : l'emplacement {n} n'a pas de vignette. », et se réactive dès le téléversement (D26)
**And** `BannerPreview` (non interactive, disposition `lg`) n'affiche que les emplacements valides et l'indique (« 2 productions affichées — l'emplacement 3 attend sa vignette ») ; « Aucune bannière sur l'accueil » si aucun emplacement

**Given** une sélection valide (y compris vide)
**When** l'administrateur clique « Enregistrer »
**Then** `PUT /admin/featured` (`featured_validator.ts` : `productionIds` uuid distincts, ≤ 3) enregistre la sélection, toast « Sélection à la une enregistrée. » ; enregistrer une sélection vide retire la bannière (FR47)
**And** un échec affiche un toast d'erreur persistant et conserve les emplacements tels quels
**And** quitter la page avec des changements non enregistrés (navigation Inertia ou fermeture d'onglet) demande confirmation

**Given** une production à la une qui requiert une vignette
**When** un administrateur tente de retirer sa vignette (Story 11.1)
**Then** le retrait est refusé avec « Vignette requise pour une production à la une. » (`thumbnail.errors.required_for_featured`)

**Notes techniques :** P2.1 (`featured_productions`), P2.5 « Règle FR50 », P2.6 (routes `admin.featured`, `.update`, `.candidates`, enregistrement), P2-11, P2-13. Composants `FeaturedSlot`, `ProductionPicker`, `BannerPreview` (`inertia/components/admin/`). i18n admin `featured.*`, `activity.action.featured_update`, `activity.resource.featured_selection`, `nav.featured`.
**Tests :** unit `requiresThumbnail` (vignette, vidéo hébergée avec / sans poster, vidéo externe) ; functional `tests/functional/admin/featured.spec.ts` (enregistrement ordonné, vide, > 3 refusé, brouillon refusé, vignette manquante refusée, `candidates` publiées seulement, journal `before`/`after`, retrait de vignette refusé).

---

### Story 11.5 : Retrait automatique d'une production à la une

En tant qu'administrateur,
Je veux qu'une production dépubliée ou supprimée quitte automatiquement la une, en étant prévenu,
Afin que la bannière ne montre jamais une production indisponible (FR51, D21).

**Acceptance Criteria:**

**Given** `FEATURED_AUTO_REMOVE: 'featured_auto_remove'` ajouté à `ActionType`
**When** `ProductionService.unpublish` ou `ProductionService.delete` s'exécute sur une production à la une
**Then** `FeaturedService.removeProduction(id, adminId, cause)` est appelé **dans la même transaction** : suppression de l'emplacement et recompactage des positions suivantes (D30) par réécriture de la sélection restante (`DELETE` puis `INSERT` positions 1..n, comme `save` ; jamais `UPDATE position = position - 1`, refusé par la clé primaire non différable)
**And** après la validation de la transaction, le journal reçoit `featured_auto_remove` / `production` avec `metadata: { position, cause: 'unpublish' | 'delete' }`

**Given** le dialog de confirmation de dépublication ou de suppression (liste admin et formulaire)
**When** la production est à la une (`isFeatured` fourni dans les props)
**Then** le corps du dialog affiche « Cette production est à la une : elle sera retirée de la bannière. » (D21)

**Given** la page « À la une » ouverte après un retrait automatique
**When** elle s'affiche
**Then** l'emplacement est déjà vidé et les suivants ont remonté

**Notes techniques :** P2.6 « Retrait automatique (FR51) », P2-12. `ProductionService.unpublish(production, adminId)` et `.delete(production, adminId)` reçoivent l'identifiant de l'admin et ouvrent la transaction (`db.transaction`) ; `ActivityLogService.log` n'accepte pas de transaction et ne lève jamais, d'où le journal écrit après le commit. i18n admin `productions.confirm.featured_warning`, `activity.action.featured_auto_remove`.
**Tests :** functional (dépublication de la position 1 sur 3 → positions recompactées 1–2 sans erreur de clé, suppression → idem, journal avec `cause`, production non à la une → aucun journal ; `isFeatured` dans les props de liste et de formulaire).

---

### Story 11.6 : Bannière des productions à la une sur l'accueil

En tant que visiteur,
Je veux voir en tête de l'accueil les productions mises à la une,
Afin de découvrir les productions que l'association met en avant (FR48, FR49, FR59, D9, D35, parcours 5).

**Acceptance Criteria:**

**Given** `home_controller.ts`
**When** l'accueil est rendu
**Then** la prop `featured` contient les productions à la une publiées, dans l'ordre défini, lue à chaque requête (non cachée) : une sélection enregistrée est visible immédiatement

**Given** au moins une production à la une
**When** `FeaturedBanner` se rend sous le hero (barre de recherche)
**Then** c'est une `<section aria-label="Productions à la une">` sans titre visible ; à partir de `lg` : 1 = pleine largeur, 2 = deux colonnes égales, 3 = la 1re en 2/3, les deux suivantes empilées dans le tiers restant, même hauteur totale ; en dessous de `lg`, empilées dans l'ordre (FR48, D35) ; pas de carrousel ni de rotation
**And** sans production à la une, la bannière est absente sans espace réservé ; après un retrait automatique la disposition est recalculée

**Given** une `FeaturedCard`
**When** elle s'affiche
**Then** elle montre uniquement l'image (vignette, sinon image extraite), le titre, les auteurs et les totaux de vues et de téléchargements (FR49), texte sous l'image sur carte blanche (D9)
**And** le titre est un lien vers le détail avec zone de clic étendue à la carte (stretched link) ; les auteurs sont rendus par `AuthorByline` (liens distincts au-dessus, FR59) ; l'image 16:9 `object-cover` a `alt=""` ; ordre de tabulation : titre puis auteurs ; compteurs avec libellés complets et icônes `aria-hidden`
**And** l'image de la 1re carte est en `loading="eager"` + `fetchpriority="high"` (LCP probable), les autres en `lazy` ; une image en erreur laisse une zone `muted` vide

**Notes techniques :** P2.5 « Front », P2.6 (`home` : prop `featured`), P2.3 (une non cachée). Composants `FeaturedBanner`, `FeaturedCard` (`inertia/components/public/`), maquette `home.html`. Les blocs actuels de l'accueil restent en place jusqu'à l'Epic 12. i18n public `featured.*`.
**Tests :** functional `tests/functional/public/home.spec.ts` (prop `featured` ordonnée, brouillon exclu, vide → absente, mise à jour immédiate après `PUT /admin/featured`) ; composants par lecture de source (`aria-label`, un seul lien principal, pas de lien imbriqué, `fetchpriority`).

---

### Story 11.7 : Tests vignettes et productions à la une

En tant que développeur,
Je veux une suite de tests couvrant les vignettes, l'image extraite et la une,
Afin de garantir la cohérence de la bannière et des images publiques.

**Acceptance Criteria:**

**Given** les specs `tests/functional/admin/production_thumbnail.spec.ts`, `production_files.spec.ts`, `featured.spec.ts`, `productions_publish.spec.ts` et `tests/functional/public/{media,seo,home}.spec.ts`
**When** `npm run test:local -- functional` est exécuté (avec `ffmpeg` disponible localement et en CI)
**Then** les scénarios suivants passent :

- Vignette → pose, remplacement (ancien préfixe supprimé), retrait, format et taille refusés, journal `update` `{ field: 'thumbnail' }`
- Image extraite → poster créé au téléversement d'un MP4 généré, échec non bloquant, suppression avec la vidéo
- `/media` → vignette et poster servis pour une production publiée, 404 pour un brouillon ou une ancienne clé, `Cache-Control` attendus
- `og:image` → présent avec vignette ou poster, `twitter:card` adapté
- Une → enregistrement ordonné, vide, > 3, brouillon, vignette requise (vidéo hébergée exemptée, vidéo externe non), journal `featured_update`
- Retrait automatique → dépublication et suppression, recompactage, journal `featured_auto_remove`
- Accueil → bannière ordonnée, absente si vide, à jour immédiatement

**Given** les specs unitaires (`ImageService` 16:9, `requiresThumbnail`, `deployment.spec.ts` ffmpeg, composants par lecture de source, parité i18n)
**When** `npm run test:local -- unit` est exécuté
**Then** elles passent


---

## Epic 12 : Accueil refondu, recherche avancée et suggestions (Phase 2)

Un visiteur trouve dès l'accueil la recherche avancée, la bannière à la une et quatre blocs titrés (récentes, plus consultées, plus téléchargées, auteurs les plus consultés), et découvre sur chaque page de détail des productions similaires.

**Ordre de l'accueil (FR9)** : hero (h1, SearchBar + « Recherche avancée ») → bannière à la une (Story 11.6) → « Récemment publiées » → « Les plus consultées » → « Les plus téléchargées » → « Auteurs les plus consultés ». Aucune recherche active.

### Story 12.1 : Recherche avancée depuis l'accueil et tris du listing

En tant que visiteur,
Je veux accéder à la recherche avancée depuis la barre de recherche de l'accueil et trier le listing par récence, vues ou téléchargements,
Afin d'explorer la bibliothèque à ma façon (FR44, FR9, D7, D8, D34).

**Acceptance Criteria:**

**Given** le hero de l'accueil
**When** il s'affiche
**Then** la `SearchBar` est accompagnée du bouton secondaire (outline) « Recherche avancée » accolé, lien vers `/productions` sans paramètre (même destination que le lien du pied de page), cible ≥ 44 px (FR44, D8)
**And** les puces de catégories du hero sont supprimées et la prop `categories` retirée de `home_controller.ts` (D8)
**And** soumettre la barre mène à `/productions?q=…` ; une barre vide mène à `/productions`

**Given** le listing `/productions`
**When** le visiteur ouvre le sélecteur de tri
**Then** `SortSelect` (libellé visible) propose « Pertinence » (`relevance`), « Récemment publiées » (`date`), « Les plus consultées » (`views`), « Les plus téléchargées » (`downloads`) (D34) ; `views` et `downloads` trient sur les **totaux** (D7)
**And** un changement de tri navigue avec `sort` dans l'URL, remet la page à 1 et ramène le défilement en haut des résultats ; la valeur par défaut est omise de l'URL ; `relevance` sans `q` retombe sur `date` (comportement actuel)

**Notes techniques :** P2.6 (`home` : `categories` supprimé), `app/services/search_service.ts` (valeurs de tri existantes), `SortSelect` de la Story 10.3. Maquette `home.html`. i18n public `home.hero.advanced_search`, `listing.sort.*` (FR/EN, D23).
**Tests :** functional `home.spec.ts` (prop `categories` absente), `listing.spec.ts` (quatre tris, `relevance` sans `q`) ; composants par lecture de source (`SearchBar` + lien « Recherche avancée », `SortSelect` libellé).

---

### Story 12.2 : Blocs « Récemment publiées », « Les plus consultées » et « Les plus téléchargées »

En tant que visiteur,
Je veux voir sur l'accueil les productions récentes et les plus consultées ou téléchargées des 12 derniers mois,
Afin de repérer ce qui intéresse la communauté en ce moment (FR9, FR45, FR46, D2, D4, D5, D6, D28).

**Acceptance Criteria:**

**Given** `app/services/ranking_service.ts`
**When** les classements « consultées » et « téléchargées » sont calculés
**Then** ils comptent les vues (`stats_views.recorded_at`) ou téléchargements (`stats_downloads.downloaded_at`) des 365 derniers jours glissants (`now() - interval '365 days'`) par jointure interne : une production à 0 sur la période est exclue (D5) ; ordre : nombre sur la fenêtre ↓, puis `anta_published_at` ↓, puis `id` ; 3 éléments (requêtes de P2.3)
**And** les cartes sont hydratées par `production_card_transformer.ts` avec les **totaux** de vues et de téléchargements (FR46, D4)
**And** « Récemment publiées » = les 3 productions publiées les plus récentes sur Anta (`anta_published_at` ↓)

**Given** le cache des classements
**When** l'accueil est rendu
**Then** les identifiants ordonnés des classements sont mémorisés dans une `Map` du processus (TTL 10 min) ; « Récemment publiées » et la une ne sont pas mis en cache
**And** `RankingService.invalidate()` est appelé par la publication, la dépublication et la suppression d'une production, `ProductionAuthorService.sync`, la confirmation et le retrait du consentement, la modification et la suppression d'une fiche auteur

**Given** `home_controller.ts`
**When** l'accueil est rendu
**Then** les props `recent`, `mostViewed`, `mostDownloaded` (3 éléments) remplacent les deux sections actuelles (6 + 6), dans l'ordre de FR9 sous la bannière

**Given** un `HomeBlock`
**When** il s'affiche
**Then** il a un titre `h2` (« Récemment publiées », « Les plus consultées », « Les plus téléchargées »), le sous-titre discret « sur les 12 derniers mois » pour les blocs classés (D4), une grille 3 colonnes dès `md`, 1 colonne en dessous (D2, D35), des `ProductionCard` identiques au listing (vignette comprise)
**And** un bloc à 1–2 éléments est affiché avec « Voir plus » (cellules vides conservées) ; un bloc à 0 élément est absent, titre compris (FR46, D5) ; catalogue vide → seul le hero reste
**And** « Voir plus » mène à `/productions?sort=date`, `?sort=views`, `?sort=downloads` (D28) et porte un nom accessible complet (« Voir plus : Les plus consultées », texte masqué), cible ≥ 44 px
**And** aucun dédoublonnage avec la bannière (D6)

**Notes techniques :** P2.3 (SQL, cache, invalidation), P2-06, P2.1 (index de la Story 10.5). Composant `HomeBlock` (`inertia/components/public/`), maquette `home.html`. i18n public `home.blocks.*` (FR/EN, D23).
**Tests :** functional `home.spec.ts` (stats datées de 366 j ignorées, production à 0 exclue, ex æquo départagé par `anta_published_at`, totaux affichés ≠ compte 365 j, bloc vide absent, brouillon exclu, cache invalidé après dépublication) ; unit `RankingService` (TTL, `invalidate`) ; composant `HomeBlock` par lecture de source (nom accessible de « Voir plus », `h2`).

---

### Story 12.3 : Bloc « Auteurs les plus consultés »

En tant que visiteur,
Je veux voir sur l'accueil les auteurs les plus consultés des 12 derniers mois,
Afin d'accéder à leur profil en deux clics (FR45, FR46, FR53, D3, D5, D36).

**Acceptance Criteria:**

**Given** `RankingService.topAuthors()`
**When** il est calculé
**Then** il retient les auteurs à profil public liés à des productions publiées, dont les vues des 365 derniers jours sont > 0 ; ordre : vues sur la fenêtre ↓, puis date de leur dernière production publiée sur Anta ↓, puis nom de famille, prénom, `id` (D36) ; 3 éléments ; même cache et même invalidation que la Story 12.2

**Given** `home_controller.ts`
**When** l'accueil est rendu
**Then** la prop `topAuthors` alimente le 4e `HomeBlock` « Auteurs les plus consultés » (sous-titre « sur les 12 derniers mois ») composé d'`AuthorCard` (Story 10.5) affichant le **total** des vues
**And** « Voir plus » (nom accessible « Voir plus : Auteurs les plus consultés ») mène à `/authors` avec son tri par défaut (FR45) ; bloc à 0 élément absent

**Given** un administrateur qui retire le consentement d'un auteur présent dans le bloc
**When** l'accueil est rechargé
**Then** l'auteur n'y figure plus (cache invalidé, FR53)

**Notes techniques :** P2.3 (requête auteurs, départage D36), P2-06. i18n public `home.blocks.authors`.
**Tests :** functional `home.spec.ts` (profil non public exclu, auteur à 0 vue sur 365 j exclu, départage par dernière publication puis nom, total des vues affiché, retrait du consentement → absent immédiatement).

---

### Story 12.4 : Suggestions de productions similaires

En tant que visiteur,
Je veux voir, sous une production, jusqu'à 4 productions similaires,
Afin de poursuivre ma découverte sans nouvelle recherche (FR61, D22, NFR18).

**Acceptance Criteria:**

**Given** `app/services/suggestion_service.ts`
**When** les suggestions d'une production publiée sont calculées
**Then** une production publiée est candidate si elle partage au moins un auteur (pivot), un tag, un sous-domaine (jsonb) ou le domaine ; la production consultée est exclue
**And** l'ordre est : critère le plus fort partagé (auteur > tag > sous-domaine > domaine), puis nombre d'éléments communs (chaque auteur, tag et sous-domaine commun, + 1 pour le domaine), puis `anta_published_at` ↓, puis `id` ; 4 au maximum (requête de P2.4, sans l'opérateur jsonb `?` dans `db.rawQuery`)

**Given** `GET /productions/:slug/suggestions` (`production.suggestions`)
**When** il est appelé
**Then** il renvoie `{ results: ProductionCard[] }` (≤ 4, sérialisés par le transformer, auteurs liés et vignettes compris) avec `Cache-Control: public, max-age=300` ; 404 si la production n'est pas publiée

**Given** la page de détail
**When** elle se charge
**Then** les métadonnées et le lecteur s'affichent sans attendre les suggestions (NFR18)
**And** `SuggestionsGrid` (pleine largeur sous la grille principale, maquette `production-detail-suggestions.html`) lance `fetch` au montage avec un `AbortController` de **2 000 ms** et affiche un squelette de 4 cartes (`aria-hidden="true"`, animation `motion-safe` seulement) dans un conteneur `aria-busy="true"` avec le statut masqué « Chargement des productions similaires… »

**Given** des résultats reçus
**When** la section s'affiche
**Then** elle a le titre `h2` « Productions similaires », jusqu'à 4 cartes sans raison affichée, 2 colonnes sur mobile (compactes < sm) et 4 sur desktop (D22, D35)
**And** une région `aria-live="polite"` masquée annonce une fois « {n} productions similaires » ; le focus n'est jamais déplacé

**Given** 0 résultat, une erreur ou un délai > 2 s
**When** le chargement se termine
**Then** la section est retirée silencieusement, sans message ni annonce (D22)
**And** le résultat est mémorisé par slug dans une `Map` du module : aucun nouveau chargement au retour arrière

**Notes techniques :** P2.4 (endpoint, SQL, interprétation du « critère partagé »), P2-07. Composant `SuggestionsGrid` + `Skeleton` shadcn (CLI). i18n public `suggestions.*`.
**Tests :** functional `tests/functional/public/suggestions.spec.ts` (ordre auteur > tag > sous-domaine > domaine, départage par nombre puis date, production courante exclue, brouillons exclus, ≤ 4, aucune candidate → `[]`, brouillon consulté → 404, en-tête `Cache-Control`) ; composant par lecture de source (`aria-busy`, `aria-live`, délai 2000, retrait silencieux).

---

### Story 12.5 : Tests accueil, classements, suggestions et performance

En tant que développeur,
Je veux une suite de tests et des mesures couvrant l'accueil refondu et les suggestions,
Afin de garantir les règles de classement et les seuils de performance.

**Acceptance Criteria:**

**Given** les specs `tests/functional/public/home.spec.ts`, `listing.spec.ts` et `suggestions.spec.ts`
**When** `npm run test:local -- functional` est exécuté
**Then** les scénarios suivants passent :

- Accueil → ordre des props, 3 éléments par bloc, prop `categories` absente
- Classements → stats à 366 j ignorées, éléments à 0 exclus, ex æquo départagés, totaux affichés, bloc vide absent
- Auteurs les plus consultés → profils publics seulement, départage D36, retrait du consentement pris en compte immédiatement
- Cache → invalidation par publication, dépublication, suppression, `sync`, consentement, modification et suppression d'auteur
- Listing → tris `relevance` / `date` / `views` / `downloads` sur les totaux
- Suggestions → ordre par critère, nombre puis date, exclusions, ≤ 4, 404 brouillon

**Given** le seeder de démo (auteurs et pivot depuis la Story 9.7)
**When** il génère les vues et téléchargements
**Then** `recorded_at` et `downloaded_at` sont répartis aléatoirement sur les 540 derniers jours (aujourd'hui tous à `now()`), pour que la fenêtre de 365 j soit exercée

**Given** la base **locale** remplie (seeder démo 300 productions avec auteurs, pivot et stats datées ; jamais de stats factices dans la base partagée)
**When** `EXPLAIN ANALYZE` est exécuté sur les requêtes de classement et de suggestions
**Then** les index de la Story 10.5 sont utilisés et les temps sont consignés dans la story

**Given** le staging après livraison de l'epic
**When** Lighthouse (mobile 4G simulé) est lancé sur l'accueil complet (bannière + 4 blocs) et une page de détail
**Then** le LCP est < 3 s (NFR17) et les suggestions apparaissent en < 2 s (NFR18)
**And** un test de charge de 50 visiteurs simultanés sur la recherche et les filtres (local ou staging, avec l'accord d'Aurélien pour le staging partagé) donne un p95 < 1 s (NFR20) ; résultats consignés dans la story


---

## Epic 13 : Conformité WCAG 2.1 AA du site public (Phase 2)

Tout visiteur, y compris au clavier ou avec un lecteur d'écran, peut réaliser les parcours 1 et 2 sur le site public ; l'absence de violation A/AA est vérifiée automatiquement à chaque livraison. Le panel d'administration est hors périmètre.

### Story 13.1 : Audit automatisé axe des pages publiques

En tant que visiteur en situation de handicap,
Je veux que les pages publiques ne présentent aucune violation WCAG 2.1 A/AA détectable automatiquement,
Afin d'utiliser Anta avec mes technologies d'assistance (NFR16, P2-16).

**Acceptance Criteria:**

**Given** la suite Japa `browser` (déjà déclarée dans `adonisrc.ts`, `@japa/browser-client` dans `tests/bootstrap.ts`) et `@axe-core/playwright` en devDependency
**When** `npm run test:local -- browser` est exécuté sur des données de test (bannière à 3 productions, blocs remplis, auteurs visibles)
**Then** axe (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) est lancé sur l'accueil, le listing avec filtres actifs, la page de détail (variantes PDF, EPUB, vidéo, audio, avec suggestions), la liste des auteurs, un profil, la politique de confidentialité et la page 404, en FR **et** en EN (cookie `i18n_lang`)
**And** chaque page présente 0 violation A/AA

**Given** des violations détectées lors de la mise en place
**When** la story est terminée
**Then** elles sont toutes corrigées dans le code (noms accessibles, contrastes, landmarks, identifiants dupliqués, rôles ARIA)

**Given** `.github/workflows/ci.yml`
**When** une PR vers `development` ou `staging` est ouverte
**Then** la suite `browser` s'exécute (installation de Chromium Playwright) et bloque le merge en cas de violation (pas de `continue-on-error`)

**Notes techniques :** P2.8 « Accessibilité », P2-16. Données de test créées dans la suite (aucun appel à la base partagée).
**Tests :** `tests/browser/a11y.spec.ts` (une entrée par page × langue).

---

### Story 13.2 : Parcours 1 et 2 au clavier et au lecteur d'écran

En tant que visiteur naviguant au clavier ou avec un lecteur d'écran,
Je veux réaliser les parcours 1 (recherche → détail → téléchargement) et 2 (accueil → bannière ou blocs → profil d'auteur → production → suggestions),
Afin d'accéder aux productions sans souris ni vue (NFR16, D33, D36).

**Acceptance Criteria:**

**Given** les titres et résumés des productions (cartes, bannière, détail, suggestions)
**When** la langue de la production (`language`) diffère de la langue d'interface
**Then** ils portent un attribut `lang` correspondant (critère 3.1.2) ; l'attribut `lang` de `<html>` suit la langue d'interface (3.1.1)

**Given** chaque page publique
**When** elle est parcourue au clavier
**Then** l'ordre de tabulation suit l'ordre de lecture (carte de production : titre puis auteurs ; vignette hors tabulation), aucun piège au clavier, focus visible global (`ring` 2 px) y compris sur les cartes à stretched link (contour couvrant la carte), lien d'évitement fonctionnel
**And** un seul `h1` par page, blocs et sections en `h2`, titres de cartes en `h3`, landmarks `header` / `main` / `footer`
**And** les lecteurs intégrés (PDF, EPUB, vidéo, audio) sont pilotables au clavier ; les contrôles publics nouveaux font ≥ 44 px

**Given** les contrastes
**When** ils sont mesurés
**Then** texte normal ≥ 4,5:1, texte large et composants d'interface ≥ 3:1 ; la bordure d'input conservée (D33) est revérifiée au critère 1.4.11 et corrigée si les champs ne sont pas identifiables autrement

**Given** l'audit manuel
**When** il est réalisé par un humain (Aurélien ou un testeur désigné) avec NVDA sous Windows et VoiceOver sous macOS, en FR et en EN, sur les parcours 1 (dont le filtre auteur au clavier, flux 5) et 2 (flux 1)
**Then** le développeur fournit la grille d'audit et corrige tous les points bloquants ; le rapport (date, outils, constats, corrections, points résiduels acceptés par Aurélien) est consigné dans `_bmad-output/implementation-artifacts/`

**Notes techniques :** `EXPERIENCE.md` → Accessibility Floor, NFR Accessibilité du PRD, D33, D36.
**Tests :** composants par lecture de source (`lang` conditionnel, hiérarchie des titres) ; extension de `tests/browser/a11y.spec.ts` avec un parcours clavier automatisé (Tab jusqu'au téléchargement, focus visible).

---

### Story 13.3 : Plan du site `sitemap.xml` (facultatif)

En tant que moteur de recherche,
Je veux un plan du site listant les pages publiques indexables,
Afin d'indexer les productions publiées et les profils visibles (FR36, P2.7).

**Acceptance Criteria:**

**Given** `GET /sitemap.xml`
**When** il est demandé
**Then** il liste en URL absolues (`APP_URL`) l'accueil, `/productions`, `/authors`, les productions publiées et les profils visibles, avec `lastmod`
**And** il ne contient ni brouillon, ni profil non public, ni URL du panel admin
**And** `robots.txt` déclare la ligne `Sitemap:`

**Notes techniques :** P2.7 « Plan du site » (facultatif : peut être reporté sans effet sur la couverture des FR).
**Tests :** functional `tests/functional/public/sitemap.spec.ts` (inclusions, exclusions) et `robots_txt.spec.ts`.

---

### Story 13.4 : Tests et recette accessibilité Phase 2

En tant que développeur,
Je veux une recette d'accessibilité et de performance consolidée pour la Phase 2,
Afin de livrer la Phase 2 avec la preuve du respect des NFR.

**Acceptance Criteria:**

**Given** les specs unitaires de composants (`tests/unit/components/*.spec.ts`, lecture de source) et `tests/unit/i18n/translations.spec.ts`
**When** `npm run test:local -- unit` est exécuté
**Then** les scénarios suivants passent :

- Attributs ARIA des composants Phase 2 (`aria-busy`, `aria-live`, `aria-current`, `aria-label` de la bannière, `aria-describedby` des actions indisponibles)
- `alt=""` des images adjacentes à un texte, `alt="Photo de {Prénom NOM}"` du profil
- `tabindex="-1"` des vignettes liées, aucun lien imbriqué dans les cartes
- Toutes les clés Phase 2 présentes en FR et en EN

**Given** la suite `browser`
**When** elle est exécutée en CI
**Then** 0 violation A/AA sur toutes les pages couvertes, dans les deux langues

**Given** le staging en fin de Phase 2
**When** Lighthouse mobile 4G est lancé sur l'accueil, `/authors`, un profil et une page de détail
**Then** LCP < 3 s et score Accessibilité consigné ; le rapport d'audit manuel de la Story 13.2 est validé par Aurélien
