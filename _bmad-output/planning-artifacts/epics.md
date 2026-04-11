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
inputDocuments:
  [
    '_bmad-output/planning-artifacts/prd.md',
    '_bmad-output/planning-artifacts/architecture.md',
    '_bmad-output/planning-artifacts/ux-design-specification.md',
  ]
---

# anta - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for anta, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

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
FR31: Le système impose l'activation du 2FA à tout compte administrateur dès sa première connexion
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
NFR5: Mots de passe hashés en base de données (bcrypt)
NFR6: Sessions admin avec expiration automatique après 2 heures d'inactivité (configurable via variable d'environnement)
NFR7: Protection CSRF activée sur toutes les actions du panel admin
NFR8: 2FA obligatoire pour tous les comptes admin (TOTP via authenticator app)
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
- **Variables d'environnement** : `.env.example` documentant toutes les variables requises (DB, R2, mail, session, 2FA)
- **Configuration R2** : `config/drive.ts` avec driver S3 Cloudflare R2 (endpoint, bucket, credentials) ; `FileStorageService` gère upload, suppression et URL signées (TTL 1h)
- **Configuration mail** : `config/mail.ts` avec Resend (principal) + Mailgun (fallback) via `@adonisjs/mail`
- **CI/CD GitHub Actions** : 3 workflows de déploiement sélectif — `deploy-public.yml` (chemin inertia/pages/public/**), `deploy-admin.yml` (chemin inertia/pages/admin/**), `deploy-full.yml` (chemin app/models/**, database/**)
- **Infrastructure serveur** : VPS Hetzner CX21, Nginx (reverse proxy), PM2 + pm2-logrotate, Let's Encrypt (Certbot)
- **Session timeout** : 2 heures d'inactivité (configurable)
- **Enum ProductionStatus** : Source de vérité unique — `'draft' | 'published' | 'unpublished'` — jamais de strings en dur
- **ActivityLogService** : Service centralisé pour tous les logs admin — actions : `login | create | update | publish | unpublish | delete | password_reset`
- **Double validation** : VineJS côté serveur + Zod côté client (mêmes règles, duplication intentionnelle)
- **Internationalisation** : Structure `inertia/locales/{public,admin}/{fr,en}.json` — tous les textes via `react-i18next`, jamais de strings en dur dans les composants
- **Bouncer policies** : `admin` (role admin OU super_admin), `superAdmin` (super_admin uniquement)
- **Middleware auth** : `AdminMiddleware` + `TwoFactorMiddleware` (vérifie `totp_enabled`) + `SuperAdminMiddleware`
- **Flux première connexion** : Mot de passe provisoire → changement obligatoire (`password_changed = false`) → activation 2FA → dashboard
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

### FR Coverage Map

FR1: Epic 5 — Recherche textuelle full-text (tsvector)
FR2: Epic 5 — Filtre par catégorie
FR3: Epic 5 — Filtre par domaine
FR4: Epic 5 — Filtre par sous-domaine
FR5: Epic 5 — Filtre par auteur
FR6: Epic 5 — Filtre par langue
FR7: Epic 5 — Filtre par pays
FR8: Epic 5 — Filtre par statut de licence
FR9: Epic 5 — Homepage : 2 sections + search/filters visibles dès l'arrivée
FR10: Epic 6 — Page détail avec métadonnées complètes
FR11: Epic 6 — Lecteur PDF/EPUB intégré
FR12: Epic 6 — Lecteur vidéo MP4 intégré
FR13: Epic 6 — Lecteur audio MP3/AAC intégré
FR14: Epic 6 — Téléchargement de fichiers hébergés
FR15: Epic 6 — Accès à la source externe (lien embed ou simple)
FR16: Epic 5 (listing) + Epic 6 (détail) — Compteurs de vues et téléchargements
FR17: Epic 4 — Création de production avec toutes les métadonnées
FR18: Epic 4 — Association de fichiers hébergés (upload R2)
FR19: Epic 4 — Association de liens externes
FR20: Epic 4 — Enregistrement en brouillon
FR21: Epic 4 — Publication avec validation de complétude
FR22: Epic 4 — Modification d'une production
FR23: Epic 4 — Dépublication (retour brouillon)
FR24: Epic 4 — Suppression d'une production
FR25: Epic 6 — Enregistrement d'une vue après 10 secondes
FR26: Epic 6 — Enregistrement d'un téléchargement
FR27: Epic 7 — Statistiques par production (panel admin)
FR28: Epic 7 — Vue agrégée des statistiques
FR29: Epic 7 — Statistiques d'activité des admins (super admin)
FR30: Epic 2 — Authentification email + mot de passe
FR31: Epic 2 — Activation 2FA obligatoire à la première connexion
FR32: Epic 3 — Création d'un compte admin (super admin)
FR33: Epic 3 — Désactivation d'un compte admin (super admin)
FR34: Epic 1 — Super admin initial via seeder
FR35: Epic 4 — Gestion des trois niveaux de dates par production
FR36: Epic 5 — Meta tags SSR côté serveur pour pages publiques
FR37: Epic 2 — Panel admin exclu de l'indexation (noindex + robots.txt)
FR38: Epic 5 — Politique de confidentialité accessible depuis toutes les pages
FR39: Epic 3 — Suppression d'un compte admin et de ses données (RGPD)
FR40: Epic 5 — Interface bilingue FR/EN avec sélecteur de langue
FR41: Epic 5 — Persistance de la langue (cookie i18n_lang)
FR42: Epic 2 — Changement de mot de passe obligatoire à la première connexion
FR43: Epic 3 — Réinitialisation du mot de passe admin (super admin)

## Epic List

### Epic 1 : Fondations Techniques

L'équipe peut démarrer le développement sur une base de projet cohérente, configurée et déployable — stack initialisée, base de données migrée, infrastructure opérationnelle, CI/CD en place.
**FRs couverts :** FR34 (seeder super admin)
**NFRs :** NFR4 (HTTPS), NFR13 (infrastructure 99%)
**UX-DRs :** UX-DR15 (design system tokens Tailwind v4 + shadcn/ui)

### Epic 2 : Authentification Admin & Sécurité des Accès

Un administrateur peut se connecter de façon sécurisée, définir son mot de passe permanent à la première connexion, et activer son 2FA obligatoire avant d'accéder au panel.
**FRs couverts :** FR30, FR31, FR37, FR42
**NFRs :** NFR5 (bcrypt), NFR6 (session timeout 2h), NFR7 (CSRF), NFR8 (2FA TOTP)
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

---

## Epic 1 : Fondations Techniques

L'équipe peut démarrer le développement sur une base de projet cohérente, configurée et déployable — stack initialisée, base de données migrée, infrastructure opérationnelle, CI/CD en place.

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
**Then** un enregistrement existe dans `admin_users` avec `role = 'super_admin'`, `is_active = true`, `totp_enabled = false`, `password_changed = false`, `password_hash` généré via bcrypt

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

### Story 1.8 : Infrastructure et CI/CD

En tant que développeur,
Je veux le serveur configuré (Nginx, PM2, Let's Encrypt) et trois workflows GitHub Actions en place,
Afin que les déploiements soient automatisés, sécurisés et sélectifs selon les chemins modifiés (NFR4, NFR13).

**Acceptance Criteria:**

**Given** le VPS Hetzner CX21 est provisionné
**When** Nginx, PM2 et Certbot sont configurés
**Then** l'application est accessible via HTTPS sur le domaine configuré
**And** HTTP redirige automatiquement vers HTTPS (NFR4)
**And** `pm2-logrotate` est activé pour la rotation des logs

**Given** du code est poussé sur la branche principale
**When** seuls des fichiers dans `inertia/pages/public/**` ou `app/controllers/public/**` sont modifiés
**Then** uniquement le workflow `deploy-public.yml` se déclenche (rebuild bundle public + rechargement PM2 partiel)

**When** seuls des fichiers dans `inertia/pages/admin/**` ou `app/controllers/admin/**` sont modifiés
**Then** uniquement le workflow `deploy-admin.yml` se déclenche

**When** des fichiers dans `app/models/**` ou `database/migrations/**` sont modifiés
**Then** le workflow `deploy-full.yml` se déclenche (migration + redéploiement complet)

**Given** l'infrastructure est configurée
**When** `node ace migration:run --force` est exécuté en production
**Then** les migrations s'appliquent sans erreur et PM2 redémarre l'application

**Given** les tests Japa sont en place
**When** `node ace test` est exécuté dans le workflow CI
**Then** les tests passent avant tout déploiement (gate CI)

---

## Epic 2 : Authentification Admin & Sécurité des Accès

Un administrateur peut se connecter de façon sécurisée, définir son mot de passe permanent à la première connexion, et activer son 2FA obligatoire avant d'accéder au panel.

### Story 2.1 : Middleware d'authentification et layouts admin

En tant que développeur,
Je veux les guards d'authentification, les middlewares de rôle et les layouts admin en place,
Afin que toutes les routes admin soient protégées et que l'interface reflète correctement le rôle de l'utilisateur connecté (UX-DR18, UX-DR22).

**Acceptance Criteria:**

**Given** un utilisateur non authentifié tente d'accéder à `/admin/*`
**When** `AdminMiddleware` s'exécute
**Then** il est redirigé vers `/admin/login`

**Given** un utilisateur authentifié avec `totp_enabled = false` tente d'accéder au dashboard
**When** `TwoFactorMiddleware` s'exécute
**Then** il est redirigé vers la page d'activation 2FA

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
**Then** les credentials sont vérifiés en base (bcrypt compare)
**And** si `password_changed = false`, redirection vers `/admin/auth/change-password`
**And** si `password_changed = true` et `totp_enabled = false`, redirection vers `/admin/auth/setup-2fa`
**And** si `password_changed = true` et `totp_enabled = true`, redirection vers `/admin/auth/verify-2fa`

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
**Then** le nouveau mot de passe est hashé (bcrypt) et sauvegardé
**And** `password_changed` passe à `true` en base de données
**And** il est redirigé vers `/admin/auth/setup-2fa`

**Given** l'admin saisit deux mots de passe différents
**When** le formulaire est soumis
**Then** une erreur de validation s'affiche : "Les mots de passe ne correspondent pas"

**Given** l'admin saisit un mot de passe trop court (< 12 caractères)
**When** le formulaire est soumis
**Then** une erreur de validation s'affiche avec les critères requis

**Given** `password_changed = true` sur le compte
**When** l'admin tente d'accéder à `/admin/auth/change-password`
**Then** il est redirigé vers le dashboard (ou vers setup-2fa si 2FA non activé)

---

### Story 2.4 : Activation 2FA obligatoire (première connexion)

En tant qu'administrateur ayant défini son mot de passe,
Je veux activer mon authentification à deux facteurs via une app TOTP,
Afin de sécuriser définitivement mon compte avant d'accéder au panel (FR31, NFR8).

**Acceptance Criteria:**

**Given** un admin avec `password_changed = true` et `totp_enabled = false` est authentifié
**When** il accède à `/admin/auth/setup-2fa`
**Then** un QR code TOTP est affiché (généré via `@adonisjs/2fa` + `qrcode`)
**And** la clé secrète TOTP est affichée en texte pour saisie manuelle
**And** un champ de saisie du code de vérification est présent

**Given** l'admin a scanné le QR code avec son app authenticator
**When** il saisit le code TOTP valide (6 chiffres) et soumet
**Then** le code est vérifié contre le secret TOTP
**And** `totp_enabled` passe à `true` et `totp_secret` est persisté en base
**And** il est redirigé vers le dashboard admin

**Given** l'admin saisit un code TOTP invalide ou expiré
**When** le formulaire est soumis
**Then** un message d'erreur s'affiche : "Code invalide. Vérifiez l'heure de votre appareil."
**And** il reste sur la page d'activation

**Given** `totp_enabled = true` sur le compte
**When** l'admin tente d'accéder à `/admin/auth/setup-2fa`
**Then** il est redirigé vers le dashboard

---

### Story 2.5 : Vérification 2FA (connexions suivantes)

En tant qu'administrateur dont le compte est complètement configuré,
Je veux vérifier mon code TOTP après chaque connexion email/mot de passe,
Afin que mon accès au panel soit protégé par une double authentification (NFR8, NFR6).

**Acceptance Criteria:**

**Given** un admin avec `totp_enabled = true` a saisi des credentials valides
**When** l'authentification email/MDP réussit
**Then** il est redirigé vers `/admin/auth/verify-2fa` et non directement vers le dashboard

**Given** l'admin est sur la page de vérification 2FA
**When** il saisit le code TOTP valide de son app authenticator
**Then** la session est créée et il est redirigé vers le dashboard

**Given** l'admin saisit un code TOTP invalide
**When** le formulaire est soumis
**Then** un message d'erreur s'affiche et il reste sur la page de vérification

**Given** une session admin est active
**When** 2 heures d'inactivité s'écoulent (NFR6)
**Then** la session expire automatiquement
**And** la prochaine requête redirige vers `/admin/login`

**Given** un admin est connecté
**When** il clique sur "Se déconnecter"
**Then** la session est détruite côté serveur et il est redirigé vers `/admin/login`

---

### Story 2.6 : Exclusion du panel admin de l'indexation

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

### Story 2.7 : Tests fonctionnels authentification

En tant que développeur,
Je veux une suite de tests fonctionnels couvrant tous les flux d'authentification,
Afin de garantir la sécurité des accès à chaque modification du code.

**Acceptance Criteria:**

**Given** `tests/functional/admin/AuthController.spec.ts` existe
**When** `node ace test` est exécuté
**Then** les scénarios suivants passent :

- Login avec credentials valides → redirection correcte selon état du compte
- Login avec credentials invalides → message d'erreur générique
- Login avec compte désactivé → accès refusé
- Flux première connexion complet (MDP → 2FA → dashboard)
- Vérification 2FA valide → accès accordé
- Vérification 2FA invalide → accès refusé
- Accès route admin sans authentification → redirection login
- Accès route super admin avec rôle admin → 403
- Expiration de session → redirection login
- Protection CSRF → rejet si token absent

**And** `tests/unit/services/TwoFactorService.spec.ts` couvre la génération et la validation TOTP

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
**Then** un enregistrement `admin_users` est créé avec `role = 'admin'`, `is_active = true`, `password_changed = false`, `totp_enabled = false`, `created_by_id` = id du super admin
**And** un mot de passe provisoire sécurisé (16 caractères aléatoires) est généré et hashé (bcrypt)
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
