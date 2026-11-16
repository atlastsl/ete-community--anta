---
name: Anta
status: final
updated: 2026-11-16
sources:
  - ../../prd.md                      # FR1–FR61, parcours 1/2/3/5, NFR Accessibilité, Données des auteurs (amendé 2026-11-16 : FR46, FR50, FR53)
  - ../../validation-report-2026-11-15.md
  - .decision-log.md                  # D1–D36 (canonique, prime sur ce fichier en cas d'écart)
  - mockups/                          # 7 maquettes HTML + index (références, les spines priment)
  - code:start/routes.ts, inertia/pages/, inertia/locales/, app/services/search_service.ts  # comportement MVP tel qu'implémenté
---

# Anta — Experience Spine (Phase 2)

## Foundation

- **Surfaces** : site public web responsive (desktop, tablette, mobile ; mobile-first) ; panel admin desktop-first (`lg`), fonctionnel sur tablette, message « utilisez un ordinateur » en dessous de `lg` (inchangé).
- **UI system** : shadcn/ui `new-york`, base `stone`, Tailwind v4, icônes lucide, toasts sonner (public `top-center`, admin `bottom-right`). `DESIGN.md` est la référence visuelle ; ce fichier ne spécifie que le comportement.
- **i18n** : react-i18next FR (fallback) / EN, sans préfixe d'URL ; toute nouvelle chaîne passe par `inertia/locales/{public,admin}/{fr,en}.json`. Métadonnées des productions et des auteurs non traduites (FR40–FR41).
- **Rendu** : Inertia, `ssr: false` ; meta SEO/OG côté edge (FR36) : vignette en `og:image` des productions (D1), photo + nom + affiliation principale pour les profils.
- **Références visuelles** : [maquettes HTML](mockups/index.html) (7 écrans clés) ; les pages actuelles (`inertia/`) font foi pour l'existant. En cas de conflit, les spines priment sur les maquettes.
- **Périmètre** : deltas Phase 2 (FR44–FR61, FR5/FR9/FR17/FR21/FR36 modifiés, WCAG 2.1 AA du site public). Tout comportement MVP non cité ici reste **tel qu'implémenté**.

## Information Architecture

Nouvelles URL en anglais, comme l'existant (`/productions`, `/privacy-policy`) (D28).

### Site public

| Surface | URL | Atteinte depuis | Contenu / changement | FR · D |
|---|---|---|---|---|
| Accueil (refondu) — [maquette](mockups/home.html) | `/` | logo, pied de page | Ordre fixe : hero (h1, SearchBar + « Recherche avancée ») → FeaturedBanner (si ≥ 1) → HomeBlock « Récemment publiées » → « Les plus consultées » → « Les plus téléchargées » → « Auteurs les plus consultés ». Puces de catégories supprimées. Aucune recherche active. | FR9, FR44–FR46, FR48 · D2–D8 |
| Listing / recherche avancée | `/productions?q=&sort=relevance\|date\|views\|downloads&author=<slug>&…` | SearchBar, « Recherche avancée », « Voir plus », pied de page | Valeurs de tri existantes (`search_service.ts`) ; tris vues / téléchargements sur les **totaux** (D7). Filtre auteur = auteurs à profil public, paramètre `author` = slug, répétable (FR5, D12, D28). Vignettes dans les cartes (D1). | FR5, FR44–FR45 · D7, D12, D28 |
| Liste des auteurs — [maquette](mockups/authors-list.html) | `/authors?q=&institution=&domain=&sort=views\|name\|productions&page=` | « Voir plus » du bloc auteurs, pied de page « Auteurs » | h1 « Auteurs » + phrase d'introduction ; AuthorFilters ; AuthorCard ×24/page ; pagination. | FR57, FR60 · D3, D13, D14, D31 |
| Profil d'auteur — [maquette](mockups/author-profile.html) | `/authors/:slug?sort=date\|views\|downloads\|title&page=` | AuthorCard, AuthorByline (cartes, bannière, détail) | Fil d'Ariane, AuthorProfileHeader, section « Productions » (compteur, tri, 12/page). 404 si non public ou sans production publiée (D11). | FR58, FR59, FR36 · D11, D15 |
| Détail d'une production — [maquette](mockups/production-detail-suggestions.html) | `/productions/:slug` | cartes, bannière, suggestions | AuthorByline liée (byline et aside « Auteurs ») ; SuggestionsGrid pleine largeur sous la grille principale ; vignette en `og:image`. | FR59, FR61 · D22 |
| Pied de page | toutes pages | — | Colonne « Explorer » : Accueil, **Recherche avancée** (renommé, même destination `/productions`), **Auteurs** (nouveau), Politique de confidentialité. | FR38, FR44, FR60 · D34 |
| Page 404 | URL inconnue, profil non public | — | NotFoundPage traduite dans PublicLayout. | D11, D36 |

Header inchangé (logo + LanguageSwitcher, pas de menu). Profil atteint en ≤ 2 clics depuis l'accueil (bloc auteurs ou nom sur une carte) : critère de succès PRD.

**Slug d'auteur** (D28) : `prenom-nom` translittéré en minuscules ASCII, suffixe `-2`, `-3`… en cas de collision, **figé à la création** (un changement de nom ne le modifie pas).

### Panel admin

| Surface | URL | Atteinte depuis | Contenu | FR · D |
|---|---|---|---|---|
| Auteurs — liste — [maquette](mockups/admin-authors-list.html) | `/admin/authors?q=&institution=&consent=pending&incomplete=1&page=` | barre latérale « Auteurs » | Recherche, filtre Institution, filtres rapides « Consentement en attente » et « À compléter » (avec compteurs). Tableau : Auteur, Affiliation principale, Productions (tous statuts), Statut (badges), Mise à jour, Actions (Modifier, Confirmer / Retirer le consentement, Supprimer). Bouton « Créer un auteur ». | FR52, FR53, FR55 · D19, D27, D32 |
| Fiche auteur | `/admin/authors/create`, `/admin/authors/:id/edit` | liste | AuthorForm pleine page ; actions Enregistrer, Confirmer / Retirer le consentement, Supprimer. | FR52, FR53, FR55 · D16, D17, D27 |
| Fenêtre « Créer un auteur » — [maquette](mockups/admin-author-picker.html) | modale dans le formulaire de production | AuthorCombobox, bouton « Créer un auteur » | AuthorFormDialog ; l'auteur créé est ajouté en fin de sélection. | FR54 · D16 |
| Formulaire de production (modifié) | `/admin/productions/create`, `…/:id/edit` | — | Fieldset « Auteurs » : SelectedAuthorList + AuthorCombobox (remplace ChipInput) ; ThumbnailField dans le fieldset « Fichiers ». | FR17, FR21, FR50, FR54 · D1, D10, D18 |
| À la une — [maquette](mockups/admin-featured.html) | `/admin/featured` | barre latérale « À la une » | 3 FeaturedSlot ordonnés, ProductionPicker dans l'emplacement libre, BannerPreview, barre « Enregistrer ». | FR47, FR50 · D20, D26, D30 |
| ConfirmDialog (dépublier / supprimer) (modifié) | listing admin, formulaire | — | Avertissement si la production est à la une. | FR51 · D21 |

Barre latérale admin : Productions, **Auteurs**, **À la une**, Statistiques, puis (super admin) Utilisateurs, Journal. Auteurs et À la une sont visibles par tout admin (FR47–FR56). Événements journalisés : création, modification et suppression d'auteur ; confirmation et retrait du consentement (FR53) ; modification de la sélection à la une ; retrait automatique (D21). Les types d'action exacts sont à fixer en architecture (voir Questions ouvertes).

## Voice and Tone

Microcopie sobre, factuelle, vouvoiement (comme l'existant). La voix de marque est dans `DESIGN.md`. Termes fixes : « fiche auteur » (admin), « profil public » (site), « à la une », « vignette ».

| Clé (proposée) | FR | EN |
|---|---|---|
| Bloc récent | Récemment publiées | Recently published |
| Bloc vues | Les plus consultées | Most viewed |
| Bloc téléchargements | Les plus téléchargées | Most downloaded |
| Bloc auteurs | Auteurs les plus consultés | Most viewed authors |
| Sous-titre des blocs classés (D4) | sur les 12 derniers mois | over the last 12 months |
| Voir plus (nom accessible) | Voir plus (+ masqué « : {titre du bloc} ») | See more (+ « : {block title} ») |
| Bouton hero / pied de page | Recherche avancée · Auteurs | Advanced search · Authors |
| Région bannière (`aria-label`) | Productions à la une | Featured productions |
| Section suggestions | Productions similaires | Similar productions |
| Tris du listing (D34) | Pertinence · Récemment publiées · Les plus consultées · Les plus téléchargées | Relevance · Recently published · Most viewed · Most downloaded |
| Tris des auteurs | Les plus consultés (12 derniers mois) · Nom (A → Z) · Nombre de productions | Most viewed (last 12 months) · Name (A → Z) · Number of productions |
| Tris du profil | Date de publication de l'œuvre · Les plus consultées · Les plus téléchargées · Titre (A → Z) | Publication date · Most viewed · Most downloaded · Title (A → Z) |
| Introduction de la liste des auteurs | Les auteurs des productions publiées sur Anta. | The authors of the productions published on Anta. |
| Compteurs | {n} production(s) · {n} vue(s) · {n} téléchargement(s) (pluriels i18next) ; « {n} auteurs · {début}–{fin} » | {n} production(s) · {n} view(s) · {n} download(s) ; « {n} authors · {start}–{end} » |
| Statistiques du profil | Vues · Téléchargements · Productions — Totaux des productions publiées. | Views · Downloads · Productions — Totals of published productions. |
| Google Scholar (D15) | Google Scholar + masqué « (nouvel onglet) » | Google Scholar + « (opens in a new tab) » |
| Liste des auteurs vide (filtres) | Aucun auteur ne correspond à votre recherche. + « Effacer les filtres » | No author matches your search. + « Clear filters » |
| Liste des auteurs vide (aucun profil public) | Aucun auteur pour le moment. | No authors yet. |
| 404 | Cette page n'existe pas ou n'est plus disponible. | This page does not exist or is no longer available. |
| Badges admin (D32) | Public · Non public · À compléter | Public · Not public · Incomplete |
| Consentement (D16) | L'auteur a consenti à la publication de son profil. Aide : « Facultatif. Sans ce consentement, la fiche est créée mais le profil reste non public : le nom apparaît sur les productions, sans lien vers un profil. Vous pourrez le confirmer plus tard dans la fiche de l'auteur. » | The author has consented to the publication of their profile. Help: « Optional. Without consent, the record is created but the profile stays private… » |
| Confirmer le consentement (D27) | Confirmer le consentement — dialog : « Le profil de {nom} deviendra public. » ; indisponible : « Complétez d'abord une affiliation. » | Confirm consent — « {name}'s profile will become public. » ; « Add an affiliation first. » |
| Retirer le consentement (D17) | Retirer le consentement — dialog : « Le profil de {nom} ne sera plus public. Ses productions restent publiées, son nom s'affichera sans lien. » | Withdraw consent — « {name}'s profile will no longer be public… » |
| Suppression impossible (FR55) | Suppression impossible : fiche liée à {n} production(s) (brouillons compris). | Cannot delete: this record is linked to {n} production(s), drafts included. |
| Vignette manquante (FR50, D26) | Cette production n'a pas de vignette. Ajoutez-en une pour pouvoir enregistrer la sélection. · Enregistrement impossible : l'emplacement {n} n'a pas de vignette. | This production has no thumbnail. Add one to save the selection. · Cannot save: slot {n} has no thumbnail. |
| Aide vignette | JPEG, PNG ou WebP · 5 Mo max · format 16:9 conseillé (recadrage automatique) | JPEG, PNG or WebP · 5 MB max · 16:9 recommended (automatic cropping) |
| Page « À la une » | Jusqu'à 3 productions publiées, affichées dans cet ordre en tête de l'accueil. Les changements ne s'appliquent à l'accueil qu'après « Enregistrer ». | Up to 3 published productions, shown in this order at the top of the home page. Changes apply only after « Save ». |
| Dépublier une production à la une (D21) | Cette production est à la une : elle sera retirée de la bannière. | This production is featured: it will be removed from the banner. |
| Combobox d'auteurs | Ajouter un auteur · placeholder « Nom ou prénom… » · Aucun auteur trouvé. · Créer un auteur « {saisie} » | Add an author · « Last or first name… » · No author found. · Create author “{query}” |
| Image extraite (D10) | Image extraite de la vidéo | Frame extracted from the video |
| Succès admin | Auteur créé. · Auteur enregistré. · Sélection à la une enregistrée. | Author created. · Author saved. · Featured selection saved. |

Règles : pas d'emoji ni de point d'exclamation ; libellés de boutons à l'infinitif (« Enregistrer », « Téléverser une vignette ») ; noms d'auteurs toujours « Prénom NOM » (D13) : nom de famille en capitales **à l'affichage**, la donnée garde la casse saisie (D34).

## Component Patterns

Comportemental. Visuel : `DESIGN.md` → Components.

| Composant | Où | Règles de comportement |
|---|---|---|
| SearchBar + Recherche avancée | Accueil | Soumission → `/productions?q=…` (D8) ; barre vide → `/productions`. « Recherche avancée » = lien vers `/productions` sans paramètre, même destination que le lien du pied de page (FR44). |
| FeaturedBanner | Accueil | Rendue seulement si ≥ 1 production à la une, sans titre visible (FR48) ; ordre défini par l'admin ; disposition selon le nombre (`DESIGN.md` → Layout & Spacing). Pas de carrousel, pas de rotation. |
| FeaturedCard | Bannière | Contenu strict FR49 : vignette, titre, auteurs, totaux vues + téléchargements. Titre = lien vers le détail avec zone de clic étendue à la carte (stretched link) ; noms d'auteurs à profil public = liens distincts au-dessus (D9). Vignette `alt=""`. Vidéo hébergée sans vignette → image extraite (D10). |
| HomeBlock | Accueil | 3 éléments max (FR45) ; 1–2 éléments → bloc affiché avec « Voir plus » (D5) ; 0 → bloc absent, titre compris (FR46). « Voir plus » (D28) : récent → `/productions?sort=date`, vues → `?sort=views`, téléchargements → `?sort=downloads`, auteurs → `/authors` (tri par défaut, FR45). |
| ProductionCard | Blocs, listing, profil, suggestions | Seul le titre est le lien principal (comportement actuel). Vignette éventuelle enveloppée dans un lien vers le même détail, `tabindex="-1"` + `aria-hidden="true"` (pas de 2e arrêt de tabulation). Compteurs = totaux. Sur le profil d'un auteur, son propre nom est rendu en texte simple (pas de lien vers la page courante). |
| AuthorByline | Cartes, bannière, détail | Liens en `{components.author-link}` (D24). Ordre = ordre défini par l'admin (FR54). Profil public → lien `/authors/:slug` ; sinon texte simple (FR53, D12). Séparateur « , » ; pas de troncature sur le détail ; sur les cartes, 3 auteurs puis « et {n} autres ». |
| AuthorCard | Bloc auteurs, liste des auteurs | Lien unique sur le nom, étendu à la carte (stretched link). Affiche photo ou initiales, « Prénom NOM », institution principale (1re affiliation, omise si aucune), nb de productions publiées, **total** des vues (D3, FR57). |
| Avatar | Cartes auteur, profil, admin | Photo si présente ; sinon initiales = 1re lettre du 1er prénom + 1re lettre du 1er nom (D13). Échec de chargement de la photo → initiales. |
| AuthorProfileHeader | Profil | Affiliations dans l'ordre saisi ; département affiché seulement s'il existe ; lien Google Scholar seulement s'il existe, nouvel onglet signalé (D15) ; statistiques = totaux vues, téléchargements et nombre de productions publiées (FR58). Champ facultatif absent → aucun trou visuel. |
| AuthorFilters | `/authors` | Barre horizontale (D31) : recherche par nom (paramètre `q`, soumission par Entrée), Institution (sélection unique ; toutes affiliations, valeurs dédoublonnées sans tenir compte de la casse, D14), Domaine des productions (sélection unique), Tri. Tout changement → page 1, état dans l'URL (D14) ; compteur de résultats en `aria-live="polite"`. |
| SortSelect | Listing, liste des auteurs, profil | Changement → navigation Inertia avec `sort` dans l'URL, page remise à 1, défilement ramené en haut des résultats. Valeur par défaut omise de l'URL. |
| Pagination | Listing, liste des auteurs (24), profil (12) | Numérotée (D14) ; `aria-current="page"` ; conserve tri et filtres ; page hors limites → dernière page. |
| SuggestionsGrid | Détail | Chargée après la page (non bloquante) ; jusqu'à 4 cartes, sans raison affichée (D22, FR61) ; squelette réservant l'espace ; 0 candidate, erreur ou > 2 s → section retirée silencieusement. Aucun nouveau chargement au retour arrière. |
| Skeleton | Suggestions | Seul usage Phase 2 ; 4 cartes fantômes à la hauteur des cartes réelles ; `aria-hidden="true"`, conteneur `aria-busy="true"`. |
| NotFoundPage | 404 | Statut HTTP 404, titre de page traduit, liens Accueil / Auteurs / Recherche avancée. |
| AuthorCombobox | Formulaire de production | Recherche serveur par nom ou prénom dès 2 caractères (anti-rebond 250 ms), insensible à la casse et aux accents ; options : « Prénom NOM », 1re affiliation, badge « À compléter » (D18) ; auteurs déjà sélectionnés exclus ; dernière option toujours « Créer un auteur « {saisie} » » → AuthorFormDialog prérempli (saisie découpée au dernier espace : avant = prénom, dernier mot = nom ; un seul mot = nom). Entrée sélectionne, Échap ferme, la saisie se vide après sélection. Plus de saisie libre (FR54). |
| SelectedAuthorList | Formulaire de production | Ajout en fin de liste ; ↑ ↓ déplacent d'un rang (désactivés aux extrémités), × retire (D18) ; pas de glisser-déposer ; focus conservé sur le bouton actionné ; annonce `aria-live="polite"` « {nom} déplacé en position {n} ». Pas de lien vers la fiche auteur (évite de quitter le formulaire). Liste vide → publication bloquée (FR21) via `CompletionIndicator` (« Au moins un auteur »). |
| AuthorFormDialog | Formulaire de production | Champs d'AuthorForm ; « Créer et ajouter » → fiche créée, dialog fermé, auteur ajouté à la sélection, focus rendu à l'AuthorCombobox, toast « Auteur créé. » (FR54). Erreurs en ligne, dialog ouvert. Les saisies non enregistrées de la production sont préservées (pas de navigation). Échap / Annuler ferment sans créer. |
| AuthorForm | Fiche auteur, dialog | Nom(s)* et prénom(s)* ; affiliations répétables (institution*, département facultatif), ≥ 1 pour toute fiche créée dans le panel (bouton × de la dernière désactivé), ordre ↑ ↓ (la 1re = institution principale) ; Google Scholar facultatif (URL valide, erreur en ligne) ; photo facultative JPEG/PNG/WebP ≤ 5 Mo avec aperçu et « Retirer la photo » ; consentement : case **facultative** (D16), décochée par défaut. Fiche migrée sans affiliation : enregistrable, badge « À compléter » tant qu'aucune affiliation (FR52). |
| Consentement : confirmer / retirer (D27) | Fiche auteur, liste admin | **Confirmer** : sur une fiche non publique, case de la fiche (puis Enregistrer) ou action « Confirmer le consentement » de la liste (dialog de confirmation). Indisponible tant que la fiche n'a aucune affiliation (le profil public exige une institution principale) : case désactivée, action désactivée avec infobulle « Complétez d'abord une affiliation. » ; une affiliation saisie dans le formulaire suffit à réactiver la case. **Retirer** : sur un profil public, la case est remplacée par le badge « Public » + bouton « Retirer le consentement » (dialog, D17) ; même action dans la liste. Les deux sont journalisés (FR53). Profil public sans production publiée : invisible sur le site tant qu'aucune production n'est publiée (D11). |
| Suppression d'une fiche | Liste et fiche admin | Possible seulement si 0 production associée, brouillons compris (FR55). Sinon : dans la liste, bouton `aria-disabled` (focusable) avec infobulle au survol et au focus reliée par `aria-describedby` ; dans la fiche, texte d'explication visible sous le bouton. Confirmation par dialog. |
| FeaturedSlot | À la une | 3 emplacements ordonnés (1 = grand format). Vide → ProductionPicker. Rempli → ↑ ↓ (permutation avec le voisin) et « Retirer » ; retirer un emplacement fait remonter les suivants (D30). Badge « Affichée » ou « Vignette manquante ». Vignette absente et production autre qu'une vidéo hébergée (vidéo en lien externe comprise, FR50) → avertissement + ThumbnailField en ligne (D20). |
| ProductionPicker | À la une | Combobox dans l'emplacement libre (D30) : recherche par titre ou auteur parmi les productions **publiées** ; productions déjà choisies exclues ; chaque option indique l'état de sa vignette ; une production sans vignette reste sélectionnable (elle bloque alors l'enregistrement jusqu'au téléversement). |
| BannerPreview | À la une | Reflète l'état non enregistré, disposition `lg` ; **n'affiche que les emplacements valides** (vignette présente ou image extraite) et l'indique (« 2 productions affichées — l'emplacement 3 attend sa vignette ») ; non interactif. |
| Enregistrement de la une (D26) | À la une | Sélection enregistrée **explicitement** par « Enregistrer ». Bouton désactivé tant qu'un emplacement rempli n'a pas de vignette requise, avec explication visible reliée par `aria-describedby` (« Enregistrement impossible : l'emplacement {n} n'a pas de vignette. ») ; il se réactive dès le téléversement. Succès → toast, bannière publique à jour immédiatement (parcours 5). Quitter avec des changements non enregistrés → confirmation (navigation Inertia et fermeture d'onglet). |
| ThumbnailField | Formulaire de production, FeaturedSlot | Téléversement immédiat avec progression (comme `FileUploader`), type et taille validés côté client et serveur (JPEG/PNG/WebP ≤ 5 Mo) ; aperçu recadré 16:9 ; Remplacer, Retirer. Facultatif dans le formulaire (hors `CompletionIndicator`) (D1). Retirer la vignette d'une production à la une qui en exige une → refus avec le message « Vignette requise pour une production à la une. ». Vidéo hébergée sans vignette → aperçu de l'image extraite à t = 1 s, générée au téléversement de la vidéo (D10). |
| ConfirmDialog (dépublier / supprimer) | Admin productions | Si la production est à la une : avertissement D21 dans le corps ; la confirmation retire la production de la sélection (FR51) et journalise le retrait. |
| Badges auteurs | Liste admin, fiche, combobox | « À compléter » tant qu'aucune affiliation ; « Public » / « Non public » selon le consentement (D32) ; informatifs, non cliquables ; mis à jour dès l'enregistrement. Filtre « Consentement en attente » = fiches « Non public ». |
| Admin sidebar | Panel | Entrées « Auteurs » et « À la une » ; active sur toutes les sous-pages de leur section ; visibles pour admin et super admin. |

## State Patterns

| Surface | État | Traitement |
|---|---|---|
| Accueil | Aucune production à la une | Bannière absente, aucun espace réservé (FR48). |
| Accueil | Bloc à 0 élément | Bloc absent (FR46). Les exclusions à 0 sur 365 j (D5) peuvent vider les blocs classés. |
| Accueil | Bloc à 1–2 éléments | Affiché tel quel + « Voir plus » (D5) ; la grille garde ses colonnes (cellules vides). |
| Accueil | Catalogue vide | Seul le hero reste affiché. |
| Accueil | Bannière n−1 après retrait automatique (D21, FR51) | Disposition recalculée (3 → 2 colonnes égales, 2 → pleine largeur, 1 → absente). |
| Accueil / cartes | Production sans vignette | Carte texte actuelle (D1). |
| Bannière, cartes | Vignette en erreur de chargement | Zone 16:9 `{colors.muted}` vide, texte intact. |
| Listing | Tri sans requête | `relevance` sans `q` retombe sur `date` (comportement actuel). |
| Listing | Filtre auteur | Facette = auteurs à profil public ayant ≥ 1 production publiée (D12). |
| Liste des auteurs | Aucun profil public | h1 + « Aucun auteur pour le moment. » ; lien du pied de page conservé. |
| Liste des auteurs | Filtres sans résultat | Message vide + « Effacer les filtres ». |
| Profil | Non public, sans production publiée, slug inconnu | 404 (D11), y compris après dépublication de la dernière production ou retrait du consentement (D17). |
| Profil | Sans photo / Scholar / département / affiliation | Initiales ; lignes omises ; meta OG sans affiliation ni image. |
| Détail | Suggestions en chargement | Squelette 4 cartes + statut masqué « Chargement des productions similaires… » ; la page est déjà utilisable (NFR Performance). |
| Détail | Suggestions : 0, erreur, > 2 s | Section absente, aucun message (D22, FR61). |
| Détail | Auteur sans profil public | Nom en texte simple (FR53). |
| Navigation Inertia publique | Chargement | Barre de progression Inertia par défaut (inchangé). |
| Admin auteurs | Liste vide / filtre vide | Pattern existant (icône stone-300 + titre + description) ; filtre vide → « Aucun auteur ne correspond à ces filtres. ». |
| Admin auteurs | Fiche migrée sans affiliation | Badge « À compléter » dans la liste, le combobox et la fiche ; confirmation du consentement indisponible (D27). |
| Admin auteurs | Consentement en attente | Badge « Non public » ; filtre rapide dédié avec compteur (D19, D32). |
| Admin auteurs | Suppression impossible | Bouton indisponible + explication (FR55). |
| AuthorCombobox | Recherche en cours / aucun résultat / erreur réseau | `Loader2` dans le champ ; « Aucun auteur trouvé. » + option de création ; erreur → « Recherche indisponible, réessayez. » dans la liste. |
| AuthorFormDialog | Envoi | Bouton désactivé + `Loader2` ; erreurs de validation en ligne. |
| Fiche auteur | Enregistrement / validation | Bouton désactivé + `Loader2` ; erreurs en ligne sous chaque champ (nom, prénom, institution, URL Scholar, photo) ; succès → toast « Auteur enregistré. ». |
| À la une | 0 emplacement rempli | Valide : enregistrer vide retire la bannière (FR47). BannerPreview affiche « Aucune bannière sur l'accueil ». |
| À la une | Vignette manquante | Avertissement par emplacement, badge « Vignette manquante », « Enregistrer » désactivé avec explication, aperçu limité aux emplacements valides (D26). |
| À la une | Production retirée automatiquement | L'emplacement est déjà vidé à l'ouverture de la page ; l'événement figure au journal (D21). |
| À la une | Échec d'enregistrement | Toast d'erreur persistant (`notify`), emplacements conservés tels quels. |
| ThumbnailField | Téléversement / échec / format refusé | Barre de progression ; erreur en ligne (type, taille) ; toast d'erreur persistant si échec réseau (`notify`). |

## Interaction Primitives

- **Stretched link** (FeaturedCard, AuthorCard) : un seul `<a>` (le titre ou le nom) dont le pseudo-élément couvre la carte ; tout autre lien de la carte (auteurs) est positionné au-dessus. Jamais de liens imbriqués ni de carte `onClick`.
- **Combobox** (AuthorCombobox, ProductionPicker) : motif ARIA 1.2 combobox + listbox, `aria-activedescendant`, ↑ ↓ parcourent, Entrée sélectionne, Échap ferme puis vide.
- **Réordonnancement ↑ ↓** (auteurs sélectionnés, affiliations, emplacements à la une) : boutons explicites nommés (« Monter {nom} »), un rang par action, focus conservé, annonce polie. **Pas de glisser-déposer** (D18).
- **Action indisponible** (admin) : bouton `aria-disabled` resté focusable + infobulle au survol **et** au focus, ou texte visible ; jamais d'explication au seul survol.
- **Pagination numérotée** (D14) : liens réels (`<a href>`), état dans l'URL, partageable.
- **Sélecteur de tri** : `Select` shadcn avec libellé visible ; la valeur change l'URL.
- **Nouvel onglet** : seulement Google Scholar (et liens externes existants) ; texte masqué « (nouvel onglet) » + icône `ExternalLink`.
- **Modale** : un niveau max (AuthorFormDialog, dialogs de confirmation) ; Échap ferme ; focus piégé puis rendu à l'élément déclencheur.
- **Interdits** : carrousel ou rotation automatique de la bannière, défilement infini, survol seul pour révéler une action.

## Accessibility Floor

Exigences PRD (NFR Accessibilité, verbatim) :
- « Le site public est conforme au niveau WCAG 2.1 AA ; le panel d'administration est hors périmètre »
- « Pages couvertes : accueil, listing et recherche, page de détail (lecteurs PDF, EPUB, vidéo et audio inclus), liste des auteurs, profil d'auteur, politique de confidentialité, dans les deux langues de l'interface »
- « Audit automatisé : 0 violation de niveau A ou AA sur chaque page couverte, mesuré par un moteur d'audit automatisé (axe) à chaque livraison »
- « Audit manuel : parcours 1 et 2 réalisables entièrement au clavier, avec focus visible, et avec un lecteur d'écran (NVDA sous Windows, VoiceOver sous macOS) ; contrastes ≥ 4,5:1 pour le texte normal et ≥ 3:1 pour le texte large et les composants d'interface »
- « Toute image porteuse d'information (vignette, photo d'auteur) dispose d'un texte alternatif ; les lecteurs intégrés sont pilotables au clavier »

Règles comportementales :
- **Structure** : un seul h1 par page (accueil : accroche du hero ; liste : « Auteurs » ; profil : nom) ; blocs, « Productions » du profil et suggestions en h2 ; titres de cartes en h3. Bannière = `<section aria-label="Productions à la une">` sans titre visible. Fil d'Ariane en `<nav aria-label="Fil d'Ariane">` avec `aria-current="page"`. Landmarks `header` / `main` / `footer`, lien d'évitement existant conservé.
- **Clavier** : ordre de tabulation = ordre de lecture ; par FeaturedCard : titre puis auteurs liés ; par ProductionCard : titre puis auteurs (vignette hors tabulation). Focus visible global `{colors.ring}` 2 px (existant) ; sur les cartes à stretched link, le contour couvre la carte.
- **Textes alternatifs** (D9, D36) : vignette ou photo adjacente à son titre ou au nom (bannière, cartes, suggestions, cartes auteur, combobox) → `alt=""`, l'information étant portée par le texte voisin ; photo du profil → `alt="Photo de {Prénom NOM}"`. Initiales `aria-hidden`.
- **Liens** : « Voir plus » doté d'un nom accessible complet (« Voir plus : Les plus consultées ») ; noms d'auteurs liés distinguables sans la couleur (soulignés, D24) ; Google Scholar annonce l'ouverture d'un nouvel onglet (D15).
- **Suggestions** : conteneur `aria-busy="true"` et statut masqué pendant le chargement ; à l'arrivée, région `aria-live="polite"` masquée qui annonce une fois « {n} productions similaires » ; rien n'est annoncé en cas d'échec (D22) ; le focus n'est jamais déplacé.
- **Compteurs** : icônes `aria-hidden` + libellé complet (« 1 234 vues »), comme `ProductionCard` actuel.
- **Langue des contenus** : titres et résumés portent un attribut `lang` dérivé du champ `language` de la production quand il diffère de la langue d'interface (critère 3.1.2).
- **Mouvement** : squelette en `motion-safe` uniquement ; aucune animation automatique.
- **Cibles** : ≥ 44 px pour les contrôles publics nouveaux (Voir plus, Recherche avancée, Google Scholar, pagination, tri, filtres).
- **Admin** (hors périmètre WCAG) : combobox et ↑ ↓ opérables au clavier (D18) ; dialogs avec focus piégé ; actions indisponibles expliquées au focus.

## Règles de classement et compteurs

| Liste | Classement | Chiffres affichés | Source |
|---|---|---|---|
| Récemment publiées (accueil) | date de publication sur Anta ↓ | totaux | FR45 |
| Les plus consultées / téléchargées (accueil) | vues / téléchargements des 365 derniers jours glissants ↓ ; 0 sur 365 j exclu ; ex æquo : la plus récemment publiée sur Anta d'abord | totaux | FR46, D4, D5 |
| Auteurs les plus consultés (accueil) | vues cumulées des productions publiées sur 365 j ↓ ; profils publics seulement ; 0 vue exclu ; ex æquo : auteur dont la dernière production a été publiée le plus récemment sur Anta, puis nom de famille | total des vues | FR45, FR46, D5 |
| Listing `sort=views` / `downloads` | **totaux** ↓ (l'ordre peut différer de celui du bloc, accepté) | totaux | D7 |
| Liste des auteurs | défaut vues 365 j ↓ ; alternatifs nom de famille A→Z (D13), nb de productions publiées ↓ ; ex æquo : nom de famille, puis prénom | totaux | FR57 |
| Profil | défaut date de publication de l'œuvre ↓ ; alternatifs vues totales ↓, téléchargements totaux ↓, titre A→Z | totaux | FR58 |
| Suggestions | critère le plus fort (auteur > tag > sous-domaine > domaine) → nb de critères → date de publication sur Anta ↓ ; production courante exclue ; 4 max | totaux | FR61 |

Le sous-titre « sur les 12 derniers mois » (D4) lève l'apparente incohérence entre ordre (365 j) et chiffres (totaux). Pas de dédoublonnage bannière / blocs (D6).

## Données personnelles des auteurs

- Un profil n'est public qu'après confirmation du consentement par un admin (FR53), à la création ou plus tard. La case est facultative (D16) : sans elle, la fiche est non publique, comme les fiches migrées ; la saisie d'une production n'est jamais bloquée.
- La confirmation exige au moins une affiliation (D27).
- Profil non public : absent de la liste, du bloc auteurs et du filtre auteur, nom sans lien, URL en 404 (FR53, D11, D12).
- Retrait du consentement (D17) → retour à l'état non public. Confirmation et retrait sont journalisés. Sur demande, retrait des champs facultatifs (photo, Google Scholar, département) depuis la fiche ; suppression complète seulement si aucune production liée (FR55).
- La politique de confidentialité (`/privacy-policy`) décrit ces traitements : nouvelle section FR/EN (exigence domaine du PRD).
- Aucune donnée d'auteur hors profil public dans les meta OG des productions.

## Migration des auteurs (hors produit)

- Table de conversion FR56 = **CSV hors produit** (nom existant → fiche auteur) généré, validé par Aurélien, exécuté par script (D19). Aucun écran de conversion dans le panel.
- Chaque production garde tous ses auteurs et leur ordre ; fiches migrées créées sans consentement (non publiques) et « À compléter » si aucune affiliation (FR52, FR56). Slugs générés à la migration selon D28.
- Seul impact UI : filtres rapides « Consentement en attente » et « À compléter » de la liste admin (D19), utilisés dans le parcours 5. Contrôle post-migration : 100 % des noms rattachés (critère de succès PRD).

## Key Flows

### Flux 1 — Découverte en cascade (Amara, enseignante-chercheuse en littérature africaine au Sénégal) — parcours 2

1. Amara arrive sur l'accueil par un lien partagé. Sous le hero, la bannière présente trois productions à la une : la première en grand format, deux autres empilées à droite.
2. Elle parcourt « Récemment publiées », « Les plus consultées », « Les plus téléchargées » ; le sous-titre « sur les 12 derniers mois » explique l'ordre des deux derniers blocs.
3. Dans « Auteurs les plus consultés », elle ouvre la carte d'une chercheuse (2e clic depuis l'accueil, critère de succès) → `/authors/:slug`.
4. Le profil affiche photo, affiliations, lien Google Scholar (annoncé « nouvel onglet »), vues, téléchargements et nombre de productions, puis ses productions triées par date.
5. Elle ouvre un article, le lit dans le lecteur PDF intégré et le télécharge sans compte.
6. Pendant la lecture, un squelette occupe le bas de page, puis quatre « Productions similaires » apparaissent ; le lecteur d'écran annonce « 4 productions similaires ».
7. **Climax** : elle choisit une suggestion du même auteur puis, dans sa byline, clique sur le nom d'un co-auteur et arrive sur un second profil : accueil → auteur → production → production similaire → auteur, sans repasser par la recherche.
8. Elle bascule en EN : les libellés deviennent « Most viewed authors », « See more » ; la langue est conservée à la visite suivante (FR41).
9. Au clavier : titre de carte puis auteurs liés, focus visible autour de toute la carte.
10. Une autre fois, elle suit « Auteurs » dans le pied de page (FR60), filtre la liste par son institution, trie par « Nom (A → Z) » et retrouve une collègue en page 2 (FR57).

Échecs : suggestions en erreur ou > 2 s → section absente, la page reste complète (D22). Profil devenu non public → 404 traduite avec liens Accueil / Auteurs.

### Flux 2 — Production avec co-auteur inconnu (Fatou, administratrice) — parcours 3

1. Fatou crée une production, remplit les métadonnées, téléverse le PDF et, si elle le souhaite, une vignette (ThumbnailField, aperçu 16:9).
2. Dans « Ajouter un auteur », elle tape « Diallo » : le combobox propose deux homonymes, distingués par leur affiliation ; l'un porte « À compléter ». Elle sélectionne le bon.
3. Le co-auteur n'existe pas : elle tape son nom et choisit « Créer un auteur « Moussa Konaté » ».
4. La fenêtre « Créer un auteur » s'ouvre préremplie (nom KONATÉ, prénom Moussa) ; elle ajoute une affiliation (institution obligatoire) et laisse la case de consentement décochée, faute de consentement obtenu (D16).
5. **Climax** : « Créer et ajouter » → la fenêtre se ferme, le co-auteur apparaît en position 2, le focus revient au champ, ses autres saisies sont intactes. Elle échange l'ordre par ↑, enregistre, publie : moins de 5 minutes au total.
6. Sur le site, le nom du premier auteur (profil public) est un lien ; celui du co-auteur est en texte simple.

Échecs : URL Google Scholar invalide → erreur en ligne, fenêtre ouverte. Publication sans auteur → `CompletionIndicator` « Au moins un auteur », publication refusée (FR21).

### Flux 3 — Nouvel auteur et sélection à la une (Fatou) — parcours 5, étapes 1–5

1. Un nouveau membre a rejoint l'association. Fatou ouvre Auteurs → « Créer un auteur », saisit nom, prénom, université et département, lien Google Scholar, photo, et coche le consentement qu'elle a obtenu.
2. Elle ouvre « À la une ». L'emplacement 1 est vide : dans le sélecteur, elle tape « littérature » et choisit un article publié.
3. L'article n'a pas de vignette : badge « Vignette manquante », avertissement, « Enregistrer » désactivé avec son explication. Elle téléverse l'image sur place ; le bouton se réactive. Même chose pour un podcast en emplacement 2.
4. En emplacement 3, une vidéo hébergée sans vignette : l'aperçu montre l'image extraite de la vidéo (D10), aucun avertissement.
5. Elle passe le podcast en emplacement 1 avec ↑ ; l'aperçu de la bannière se recompose.
6. **Climax** : « Enregistrer » → toast « Sélection à la une enregistrée. » ; l'accueil public montre la nouvelle bannière immédiatement, moins d'une minute après l'ouverture de la page (critère Éditorialisation).

Échecs : vignette > 5 Mo ou au mauvais format → erreur en ligne, enregistrement toujours bloqué. Plus tard, un collègue dépublie l'article à la une : le dialog l'avertit (D21) ; la bannière passe à deux colonnes, le retrait figure au journal.

### Flux 4 — Revue des fiches migrées (Fatou) — parcours 5, étapes 6–7

1. À la mise en service, Fatou ouvre Auteurs et active le filtre rapide « À compléter ».
2. Elle ouvre une fiche migrée sans affiliation, ajoute l'université, enregistre : le badge « À compléter » disparaît.
3. Avec le filtre « Consentement en attente », elle utilise « Confirmer le consentement » pour les auteurs qui ont consenti (confirmation obtenue hors Anta) ; l'action reste indisponible pour ceux qui n'ont pas encore d'affiliation. Le badge passe à « Public ».
4. **Climax** : de retour sur le site, les noms de ces auteurs sont devenus des liens sur toutes leurs productions, et ils apparaissent dans la liste des auteurs ; les autres restent en texte simple.
5. Une fiche créée par erreur, liée à aucune production : « Supprimer » est disponible ; confirmation ; fiche supprimée.

Échecs : supprimer une fiche liée à une production → action indisponible, explication « Suppression impossible : fiche liée à {n} production(s) (brouillons compris). » (FR55). Un auteur demande le retrait : « Retirer le consentement » → profil en 404, noms sans lien (D17).

### Flux 5 — Recherche par auteur au clavier (Kofi, doctorant en mathématiques) — parcours 1, FR5

1. Kofi, au clavier avec NVDA, tabule depuis l'accueil jusqu'à « Recherche avancée » (FR44) et arrive sur `/productions`.
2. Il déplie la dimension « Auteur » du panneau de filtres ; la liste ne propose que des auteurs à profil public (D12), en « Prénom NOM ».
3. Il tape dans la recherche de facette et coche un auteur ; les résultats se mettent à jour et le nombre de résultats est lu.
4. **Climax** : sur la première carte, il tabule du titre au nom de l'auteur et l'ouvre : le profil lui donne d'un coup toutes les productions de son directeur de recherche, triables par « Les plus consultées ».

Échec : aucun résultat → message existant + « Effacer les filtres ».

## Responsive & Platform

| Breakpoint | Comportement Phase 2 |
|---|---|
| `< sm` (< 640 px) | « Recherche avancée » sous la barre, pleine largeur ; bannière, blocs, liste des auteurs et productions du profil en 1 colonne ; filtres des auteurs empilés ; suggestions en 2 colonnes, variante compacte (résumé masqué). |
| `sm`–`md` | « Recherche avancée » accolé à la barre ; liste des auteurs et productions du profil en 2 colonnes ; filtres sur 2 colonnes. |
| `≥ md` (768 px) | Blocs d'accueil en 3 colonnes ; bannière encore empilée. |
| `≥ lg` (1024 px) | Bannière en disposition 1/2/3 (FR48, D35) ; liste des auteurs et profil en 3 colonnes ; filtres des auteurs sur une ligne ; aside statistiques du profil à droite ; suggestions en 4 colonnes ; panel admin disponible. |
| `≥ xl` (1280 px) | Liste des auteurs en 4 colonnes. |

Navigateurs : 2 dernières versions de Chrome, Firefox, Edge, Safari. LCP < 3 s sur mobile 4G simulé pour l'accueil complet, la liste des auteurs et les profils (NFR Performance) : vignettes servies en tailles adaptées (`srcset`), `loading="lazy"` hors bannière, dimensions fixées pour éviter le CLS.

## Questions ouvertes non bloquantes (architecture)

- Types d'action du journal d'activité (auteur créé / modifié / supprimé, consentement confirmé / retiré, sélection à la une modifiée, retrait automatique) et format de leurs détails.
- Extraction de l'image vidéo à t = 1 s (outil, traitement synchrone ou en file, rattrapage des vidéos déjà hébergées).
- Génération et stockage des tailles de vignette (R2, formats, `srcset`) et recadrage 16:9.
- Calcul des classements sur 365 j glissants (requête directe, vue matérialisée ou cache) au regard du LCP.
- Recherche serveur du combobox (insensibilité aux accents, `pg_trgm`) et dédoublonnage des institutions sans tenir compte de la casse.
