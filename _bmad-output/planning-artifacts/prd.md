---
stepsCompleted:
  [
    step-01-init,
    step-02-discovery,
    step-02b-vision,
    step-02c-executive-summary,
    step-03-success,
    step-04-journeys,
    step-05-domain,
    step-06-innovation,
    step-07-project-type,
    step-08-scoping,
    step-09-functional,
    step-10-nonfunctional,
    step-11-polish,
    step-12-complete,
    step-e-01-discovery,
    step-e-02-review,
    step-e-03-edit,
    step-e-04-validation-fixes,
  ]
inputDocuments: []
workflowType: 'prd'
workflow: 'edit'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: brownfield
lastEdited: '2026-11-18'
editHistory:
  - date: '2026-11-15'
    changes: 'Phase 1 (MVP) marquée livrée. Phase 2 (Growth) redéfinie : refonte de la page d accueil (recherche avancée, bannière des productions à la une, 4 blocs titrés), entité Auteur (gestion admin, liste et profils publics, migration des auteurs existants), suggestions de productions similaires, conformité WCAG 2.1 AA du site public. Notifications aux membres reportées en Phase 3. FR5, FR9, FR17, FR21, FR36 modifiés ; FR44–FR61 ajoutés ; parcours 2 et 3 mis à jour, parcours 5 ajouté ; NFR Accessibilité ajoutée.'
  - date: '2026-11-15'
    changes: 'Corrections issues de validation-report-2026-11-15.md : traçabilité (listes des parcours 2 à 5, FR40–FR41 rattachées au cadrage et au parcours 2, FR31 signalée retirée), consentement des auteurs migrés (FR53, FR56, FR57, FR59) et affiliation à compléter (FR52), vignette obligatoire pour vidéo externe (FR50), règle de classement des suggestions (FR61), FR2 et FR28 précisées, fuites d implémentation retirées (FR41, FR44, NFR Sécurité), NFR chiffrées (performance, session, rétention des logs, intégrité, charge), risques actualisés, section Hors périmètre ajoutée, FR Phase 2 regroupées en fin de section.'
  - date: '2026-11-16'
    changes: 'Arbitrages de la révision UX Phase 2 (ux-designs/ux-anta-2026-11-16, décisions D1, D5, D16, D17) : FR46 exclusion des éléments à 0 sur 365 j, départage, totaux affichés ; FR50 vignette = attribut facultatif de la production réutilisé sur le site public ; FR53 consentement facultatif à la création (fiche non publique sans lui) et retrait du consentement.'
  - date: '2026-11-16'
    changes: 'Clarification issue du rapport implementation-readiness-report-2026-11-16.md : FR5 alignée sur la décision UX D12 validée (filtre auteur limité aux profils publics, cohérent avec FR53).'
  - date: '2026-11-18'
    changes: 'Correction d Aurélien (décision UX D37, amende D1) : FR50, la vignette est réservée aux productions à la une, renseignée depuis l écran de mise à la une et affichée uniquement dans la bannière ; aucune image dans les autres cartes ni en image Open Graph des productions.'
---

# Product Requirements Document — Anta

**Auteur :** Aurélien
**Date :** 2026-04-03 — révisé le 2026-11-15 (Phase 2 — Growth)
**Type :** Application web — Bibliothèque numérique communautaire
**Contexte :** Brownfield (MVP livré) — Complexité faible

---

## Résumé Exécutif

Anta est une bibliothèque numérique centralisée qui archive et rend accessibles les productions intellectuelles des membres d'une association à ancrage académique. Le produit sert deux audiences : les membres de la communauté (usage interne) et le grand public (vitrine académique). Le problème résolu est la dispersion des productions — livres, articles scientifiques, productions audiovisuelles, podcasts — éparpillées selon les domaines, les pays de résidence des auteurs et les plateformes. Anta crée un point d'accès unique permettant la recherche, la consultation et le téléchargement.

Sa valeur n'est pas révolutionnaire — elle est structurante : une communauté à forte production intellectuelle mérite une infrastructure documentaire pérenne. Pour les membres, c'est un gain de temps et de visibilité. Pour l'extérieur, c'est une fenêtre sur les capacités académiques et professionnelles de la communauté.

La Phase 2 (Growth) renforce cette double valeur : crédit et visibilité des membres via des profils d'auteurs publics, découverte via une page d'accueil éditorialisée et des suggestions de productions similaires, et accès pour tous via la conformité WCAG 2.1 AA du site public.

---

## Critères de Succès

### Succès Utilisateur

Un utilisateur réussit sa recherche en affinant une liste de résultats pertinents en moins de 3 interactions (recherche + filtre(s) + clic), via la combinaison de la barre de recherche et des filtres par métadonnées. Le moment de satisfaction intervient quand la liste se réduit jusqu'à la production recherchée.

### Succès Administration

Un administrateur enregistre et publie une production de façon autonome, sans assistance technique, en moins de 5 minutes. Le processus de publication est conditionné à la complétude des champs obligatoires et à l'association d'au moins un fichier ou lien.

### Succès Technique

- Recherche sur l'ensemble des métadonnées avec réponse en moins d'une seconde (voir NFR Performance)
- Zéro perte de fichier lors des téléversements et téléchargements
- Panel admin accessible exclusivement aux comptes autorisés (auth email + mot de passe)
- Disponibilité 99% du site public

### Succès Phase 2 — Growth

- **Visibilité des auteurs :** un visiteur atteint le profil d'un auteur depuis la page d'accueil en 2 clics au plus (bloc « Auteurs les plus consultés » ou nom d'auteur sur une carte de production)
- **Découverte :** chaque page de détail d'une production partageant au moins un critère (auteur, mot-clé, sous-domaine ou domaine) avec une autre production publiée affiche au moins une suggestion
- **Éditorialisation :** un administrateur modifie la sélection des productions à la une en moins d'une minute
- **Migration :** 100 % des noms d'auteurs existants sont rattachés à un auteur enregistré selon la table de conversion validée, sans perte d'auteur sur aucune production ; aucun profil issu de la migration n'est public avant confirmation du consentement
- **Accessibilité :** 0 violation WCAG 2.1 AA détectée sur les pages publiques (audit automatisé et audit manuel, voir NFR Accessibilité)

---

## Parcours Utilisateurs

### Parcours 1 — Membre en Quête d'une Production

**Persona :** Kofi, doctorant en mathématiques, membre de la communauté depuis 3 ans. Il prépare un exposé sur la topologie et cherche un article publié par un aîné de la communauté.

**Situation :** Kofi a cherché sur Google sans succès — trop de bruit, pas de contexte communautaire.

**Action :** Il ouvre Anta, saisit "topologie" dans la barre de recherche. Il affine avec les filtres "Article" et "Mathématiques / Topologie". La liste passe à 4 résultats. Il reconnaît l'auteur, clique sur la production, consulte les métadonnées complètes et télécharge le PDF.

**Moment clé :** La page de détail affiche auteur, résumé, journal, date, compteurs de vues et téléchargements. En deux clics, le PDF est sur son ordinateur.

**Exigences révélées :** FR1–FR9, FR10–FR16

---

### Parcours 2 — Visiteur Externe en Découverte

**Persona :** Amara, enseignante-chercheuse en littérature africaine au Sénégal, orientée vers Anta par un collègue.

**Situation :** Elle atterrit sur Anta via un lien partagé, sans connaître la communauté.

**Action :** Sur la page d'accueil, la bannière met en avant trois productions à la une ; elle parcourt ensuite les blocs « Récemment publiées », « Les plus consultées » et « Les plus téléchargées ». Dans le bloc « Auteurs les plus consultés », elle ouvre le profil d'une chercheuse : affiliations, lien Google Scholar, vues et téléchargements cumulés, liste de ses productions. Elle ouvre un article, le télécharge sans créer de compte, puis rebondit sur une suggestion de production similaire en bas de page. Elle bascule l'interface en anglais pour transmettre le lien à un collègue anglophone ; la langue choisie est conservée à sa visite suivante. Elle utilise le site au clavier comme à la souris.

**Moment clé :** Accès public sans friction, auteurs identifiables et crédités, découverte en cascade (accueil → auteur → production → production similaire).

**Exigences révélées :** FR1–FR16, FR40–FR41, FR44–FR46, FR48–FR49, FR57–FR61, NFR Accessibilité

---

### Parcours 3 — Admin Enregistrant une Production

**Persona :** Fatou, administratrice d'Anta, reçoit un livre numérique d'un membre basé à Paris.

**Situation :** Elle se connecte au panel admin avec ses identifiants.

**Action :** Elle crée une nouvelle production, remplit les métadonnées (titre, auteur, catégorie, domaine, sous-domaine, langue, date, éditeur, résumé, tags, pays), téléverse le PDF. Elle choisit l'auteur dans la liste des auteurs enregistrés ; le co-auteur n'existant pas encore, elle le crée via une fenêtre sans quitter son formulaire, et il est sélectionné automatiquement. Elle enregistre en brouillon, vérifie, puis publie. La production est immédiatement visible sur le site public.

**Moment clé :** En moins de 5 minutes, la production est centralisée et accessible. Depuis le panel, elle consulte les statistiques par production et en vue agrégée.

**Exigences révélées :** FR17–FR28, FR30, FR35, FR52–FR54

---

### Parcours 4 — Super Admin Gérant les Accès

**Persona :** Le super admin, unique, responsable des accès humains à Anta.

**Situation :** Un nouveau membre est désigné pour alimenter la bibliothèque.

**Action :** Le super admin crée un compte admin (email + mot de passe provisoire). Le nouvel admin peut immédiatement se connecter et enregistrer des productions après avoir défini son mot de passe permanent. Le super admin peut aussi désactiver, réinitialiser ou supprimer un compte existant et consulter les statistiques d'activité des admins.

**Exigences révélées :** FR29–FR30, FR32–FR34, FR39, FR42–FR43

---

### Parcours 5 — Admin Gérant les Auteurs et la Mise en Avant

**Persona :** Fatou, administratrice d'Anta.

**Situation :** Un membre vient de rejoindre l'association et la communauté souhaite mettre en avant trois productions marquantes du mois.

**Action :** Dans le panel, Fatou crée la fiche auteur du nouveau membre (nom, prénom, université et département, lien Google Scholar, photo) après avoir confirmé avoir obtenu son consentement. Elle ouvre ensuite la gestion des productions à la une, sélectionne trois productions publiées et les ordonne ; pour l'article et le podcast, elle téléverse une vignette vitrine ; pour la vidéo, elle n'en fournit pas et une image extraite de la vidéo est utilisée. La bannière de la page d'accueil reflète la sélection immédiatement et reste en place jusqu'à la prochaine modification. Lors de la mise en service de la Phase 2, elle passe aussi en revue les fiches issues de la migration : elle complète les affiliations manquantes et confirme le consentement des auteurs joints, dont les profils deviennent alors publics. Une fiche créée par erreur et associée à aucune production est supprimée.

**Moment clé :** La fiche auteur est créée en autonomie, sans assistance technique ; la sélection à la une est modifiée en moins d'une minute.

**Exigences révélées :** FR47–FR53, FR55–FR56

---

## Exigences Domaine

### Droits et Licences

- **Productions hébergées :** œuvres des membres ou sous licence libre. Fichiers stockés directement sur Anta (PDF, EPUB, MP4, MP3, AAC ≤ 100 Mo).
- **Productions sous copyright :** aucun fichier hébergé — lien externe fourni (embed ou lien simple).
- **Métadonnée licence :** chaque production indique son statut : production membre / licence libre / lien externe.

### Formats Supportés

| Type                   | Formats hébergés | Lecture in-site           | Téléchargement    |
| ---------------------- | ---------------- | ------------------------- | ----------------- |
| Livres / Articles      | PDF, EPUB        | Oui (lecteur intégré)     | Oui               |
| Audiovisuel            | MP4, MP3, AAC    | Oui (lecteur intégré)     | Oui               |
| Contenu sous copyright | —                | Via embed ou lien externe | Non (redirection) |

Fichiers > 100 Mo : lien externe uniquement, aucun hébergement.

### Sécurité et Conformité RGPD

- Données admin collectées : email + mot de passe uniquement.
- Mot de passe permanent défini à la première connexion (mot de passe provisoire à usage unique).
- Conformité RGPD : politique de confidentialité publiée, droit de suppression des comptes admin.
- **Données des auteurs (Phase 2) :** les profils publics exposent des données personnelles (nom, prénom, affiliations, lien Google Scholar, photo). Leur publication requiert le consentement de l'auteur, confirmé par l'administrateur à la création de la fiche (FR53). Sur demande de l'auteur, les champs facultatifs (photo, lien Google Scholar, département) sont retirés ; la suppression complète de la fiche suit la règle FR55. La politique de confidentialité décrit ces traitements.

### Accessibilité

Le site public est conforme au niveau **WCAG 2.1 AA** (Phase 2). Le panel d'administration est hors périmètre de conformité. Critères de mesure : voir NFR Accessibilité.

---

## Exigences Application Web

### Architecture

Anta est une MPA (application web multi-pages) : un backend unique sert deux interfaces distinctes, le site public et le panel admin.

| Couche               | Technologie                                                 |
| -------------------- | ----------------------------------------------------------- |
| Backend              | AdonisJS (Node.js)                                          |
| Frontend site public | React (via Inertia.js, point d'entrée dédié)                |
| Frontend panel admin | React (via Inertia.js, point d'entrée et gabarit distincts) |

### Support Navigateurs

Navigateurs modernes uniquement (dernières 2 versions) : Chrome, Firefox, Edge, Safari. Pas de support IE11 ou legacy.

### Responsive

Site public : pleinement utilisable sur desktop, tablette et mobile. Panel admin : optimisé desktop-first, fonctionnel sur tablette.

### SEO — SSR Partiel

AdonisJS génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production — titre, auteur, résumé, catégorie, langue — et pour chaque page de profil d'auteur — nom, affiliation principale, photo. Le rendu du contenu reste côté client (React). Panel admin exclu de l'indexation (robots.txt / noindex).

---

## Cadrage & Développement Phasé

### Phase 1 — MVP (livrée)

**Approche :** Livrer le minimum qui centralise les productions et les rend accessibles. Utile dès le premier jour.

**Site public :** interface bilingue français / anglais (FR40–FR41), page d'accueil avec productions récentes, barre de recherche full-text, filtres par métadonnées (catégorie, domaine, sous-domaine, auteur, langue, pays, licence), page de détail avec lecteur intégré et téléchargement, compteurs de vues et téléchargements (public).

**Panel admin :** authentification email + mot de passe, formulaire de création/édition de production (toutes métadonnées + fichiers/liens), workflow brouillon → publication, statistiques par production et agrégées, gestion des comptes admin.

**Super admin :** compte unique initialisé à la création, gestion des accès admin, statistiques d'activité des admins.

### Phase 2 — Growth

**Approche :** Donner aux auteurs une existence propre sur Anta et transformer l'accueil en vitrine éditoriale, sans changer le modèle de consultation libre.

- **Refonte de la page d'accueil :** bouton « Recherche avancée », bannière des productions à la une (0 à 3, sélection admin), blocs « Récemment publiées », « Les plus consultées », « Les plus téléchargées », « Auteurs les plus consultés » (FR9, FR44–FR51)
- **Auteurs :** référentiel d'auteurs géré dans le panel admin, sélection des auteurs d'une production depuis ce référentiel, liste publique des auteurs et pages de profil (référencées, FR36), migration des auteurs existants via une table de conversion validée (FR5, FR17, FR21, FR52–FR60)
- **Suggestions de productions similaires** sur les pages de détail (FR61)
- **Conformité WCAG 2.1 AA** du site public (NFR Accessibilité)

### Phase 3 — Vision

- Intégration avec bases académiques externes (DOI, arXiv, Google Scholar...)
- API publique pour exposer le catalogue
- Enrichissement des profils d'auteurs (biographie, ORCID, réseaux académiques)
- Notifications aux membres sur les nouvelles publications (reporté de la Phase 2)

### Hors périmètre

- Comptes visiteurs, commentaires, notation ou favoris
- Conformité WCAG du panel d'administration
- Notifications aux membres (Phase 3)
- Application mobile native et mode hors ligne
- Navigateurs anciens (IE11)

### Risques

| Risque                                        | Niveau | Mitigation                                                                                                   |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| Stockage fichiers lourds                      | Faible | Fichiers > 100 Mo exclus de l'hébergement                                                                    |
| Adoption utilisateurs                         | Faible | Communauté identifiée pour l'usage interne ; vitrine publique diffusée par les canaux de l'association       |
| Ressources limitées                           | Faible | Phase 2 découpée en lots livrables indépendamment (accueil, auteurs, suggestions, accessibilité)             |
| Migration des auteurs (doublons, orthographe) | Moyen  | Table de conversion proposée puis validée par le product owner avant exécution (FR56) ; contrôle post-migration |
| Régression d'accessibilité                    | Faible | Audit automatisé à chaque livraison ; audit manuel avant chaque mise en production majeure                   |

---

## Exigences Fonctionnelles

### Découverte et Recherche

- **FR1 :** Un visiteur peut effectuer une recherche textuelle sur l'ensemble des métadonnées des productions
- **FR2 :** Un visiteur peut filtrer les résultats par catégorie : livre, article, vidéo, musique, podcast, thèse, rapport, mémoire, note, actes de conférence, document de travail
- **FR3 :** Un visiteur peut filtrer les résultats par domaine
- **FR4 :** Un visiteur peut filtrer les résultats par sous-domaine
- **FR5 (modifié Phase 2) :** Un visiteur peut filtrer les résultats par auteur, parmi les auteurs enregistrés à profil public (FR52, FR53)
- **FR6 :** Un visiteur peut filtrer les résultats par langue
- **FR7 :** Un visiteur peut filtrer les résultats par pays de publication
- **FR8 :** Un visiteur peut filtrer les résultats par statut de licence (production membre / licence libre / lien externe)
- **FR9 (modifié Phase 2) :** La page d'accueil affiche, dans cet ordre : la barre de recherche et son bouton « Recherche avancée » (FR44), la bannière des productions à la une (FR48), puis quatre blocs titrés — « Récemment publiées », « Les plus consultées », « Les plus téléchargées », « Auteurs les plus consultés » (FR45–FR46). Aucune recherche n'est active par défaut

### Consultation et Téléchargement

- **FR10 :** Un visiteur peut consulter la page de détail d'une production avec l'intégralité de ses métadonnées publiques
- **FR11 :** Un visiteur peut lire un document PDF ou EPUB directement dans le navigateur via un lecteur intégré
- **FR12 :** Un visiteur peut visionner une vidéo MP4 directement dans le navigateur via un lecteur intégré
- **FR13 :** Un visiteur peut écouter un fichier audio MP3 ou AAC directement dans le navigateur via un lecteur intégré
- **FR14 :** Un visiteur peut télécharger une production hébergée (PDF, EPUB, MP4, MP3, AAC)
- **FR15 :** Un visiteur peut accéder à la source externe d'une production sous copyright (lien embed ou lien simple)
- **FR16 :** Un visiteur peut consulter le nombre de vues et de téléchargements d'une production sur la page de listing et sur la page de détail

### Gestion des Productions (Panel Admin)

- **FR17 (modifié Phase 2) :** Un administrateur peut créer une production en renseignant ses métadonnées : titre, auteur(s) choisis parmi les auteurs enregistrés (FR54), catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, journal/revue, éditeur, ISBN/DOI/ISSN, institution d'affiliation, licence, statut
- **FR18 :** Un administrateur peut associer à une production un ou plusieurs fichiers hébergés (PDF, EPUB, MP4, MP3, AAC)
- **FR19 :** Un administrateur peut associer à une production un ou plusieurs liens externes (embed ou lien simple)
- **FR20 :** Un administrateur peut enregistrer une production en tant que brouillon sans remplir tous les champs ni la publier
- **FR21 (modifié Phase 2) :** Un administrateur peut publier un brouillon — la publication requiert que toutes les métadonnées de la production soient renseignées (titre, au moins un auteur enregistré, catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, licence, statut) et qu'au moins un fichier ou lien soit associé ; le système valide ces conditions avant autorisation
- **FR22 :** Un administrateur peut modifier une production (brouillon ou publiée) et enregistrer les modifications sans déclencher de republication automatique
- **FR23 :** Un administrateur peut dépublier une production publiée, qui repasse en état brouillon
- **FR24 :** Un administrateur peut supprimer une production du système

**Cycle de vie :** `Brouillon → Publié → (Dépublié → Brouillon)`

### Statistiques et Métriques

- **FR25 :** Le système enregistre une vue 10 secondes après l'ouverture de la page de détail d'une production
- **FR26 :** Le système enregistre un téléchargement à chaque téléchargement d'une production
- **FR27 :** Un administrateur peut consulter les statistiques (vues, téléchargements) par production dans le panel admin
- **FR28 :** Un administrateur peut consulter une vue agrégée des statistiques de la bibliothèque : nombre de productions publiées, totaux des vues et des téléchargements, les 10 productions les plus consultées et les 10 les plus téléchargées, et les vues et téléchargements par jour sur les 30 derniers jours
- **FR29 :** Le super administrateur peut consulter les statistiques d'activité des administrateurs : productions enregistrées par admin, productions modifiées par admin, logs de connexion

### Gestion des Comptes et Accès

- **FR30 :** Un administrateur peut s'authentifier sur le panel admin avec son email et son mot de passe
- **FR31 :** retiré (activation obligatoire du 2FA, retirée du MVP le 2026-05-31)
- **FR32 :** Le super administrateur peut créer un compte administrateur
- **FR33 :** Le super administrateur peut désactiver un compte administrateur
- **FR34 :** Le super administrateur dispose d'un compte unique, initialisé à la création du site
- **Périmètre super admin :** Le super administrateur dispose de toutes les capacités d'un administrateur (FR17–FR29, FR47–FR56) et peut en plus gérer les comptes administrateurs (FR32–FR33, FR39, FR42–FR43). Son accès aux productions est identique à celui d'un admin.

### Métadonnées Système

- **FR35 :** Le système gère trois niveaux de dates par production :
  - **Date de publication de l'œuvre** — saisie par l'admin, visible publiquement
  - **Date de création système** et **date de modification système** — générées automatiquement, visibles dans le panel admin uniquement
  - **Date de publication sur Anta** — générée à la première publication, visible dans le panel admin uniquement

### Référencement

- **FR36 (modifié Phase 2) :** Le système génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production et chaque page de profil d'auteur du site public
- **FR37 :** Le panel d'administration est exclu de l'indexation par les moteurs de recherche

### Conformité

- **FR38 :** Le site public affiche une politique de confidentialité accessible depuis toutes les pages
- **FR39 :** Le super administrateur peut supprimer un compte administrateur et ses données de connexion associées

### Internationalisation

- **FR40 :** Le site public et le panel admin affichent l'intégralité de leur interface en français et en anglais — l'utilisateur bascule via un sélecteur de langue visible sur toutes les pages
- **FR41 :** La langue sélectionnée est restaurée automatiquement lors des visites suivantes sur le même navigateur
- **Périmètre :** l'internationalisation couvre l'interface uniquement (labels, boutons, navigation, messages d'erreur, textes fixes). Les métadonnées des productions et des auteurs restent dans la langue de rédaction.

### Gestion des Accès — Compléments

- **FR42 :** Un administrateur doit définir un nouveau mot de passe lors de sa première connexion, avant d'accéder au panel (le mot de passe provisoire créé par le super admin est à usage unique)
- **FR43 :** Le super administrateur peut réinitialiser le mot de passe d'un compte administrateur (génération d'un nouveau mot de passe provisoire envoyé par email)

### Page d'Accueil (Phase 2)

- **FR44 :** Un visiteur peut accéder à la page de recherche avancée (listing complet avec filtres, même destination que le lien du pied de page) via un bouton « Recherche avancée » placé à côté de la barre de recherche
- **FR45 :** Chaque bloc titré de la page d'accueil affiche 3 éléments et un bouton « Voir plus » :
  - **Récemment publiées :** les 3 productions publiées le plus récemment sur Anta ; « Voir plus » ouvre le listing trié par date de publication sur Anta décroissante
  - **Les plus consultées :** les 3 productions publiées ayant le plus de vues ; « Voir plus » ouvre le listing trié par vues décroissantes
  - **Les plus téléchargées :** les 3 productions publiées ayant le plus de téléchargements ; « Voir plus » ouvre le listing trié par téléchargements décroissants
  - **Auteurs les plus consultés :** les 3 auteurs à profil public (FR53) dont les productions publiées cumulent le plus de vues ; « Voir plus » ouvre la liste des auteurs (FR57) avec son tri par défaut
- **FR46 :** Les classements des blocs « Les plus consultées », « Les plus téléchargées » et « Auteurs les plus consultés » portent sur les vues ou téléchargements enregistrés sur les 365 derniers jours glissants ; un élément sans aucune vue (resp. aucun téléchargement) sur cette période n'y figure pas et, à égalité, la production la plus récemment publiée sur Anta passe en premier. Les nombres affichés restent les totaux. Un bloc sans aucun élément à afficher n'est pas affiché

### Productions à la Une (Phase 2)

- **FR47 :** Un administrateur peut sélectionner de 0 à 3 productions publiées à mettre à la une et définir leur ordre d'affichage. La sélection n'a pas d'échéance : elle reste affichée jusqu'à sa modification par un administrateur
- **FR48 :** La bannière des productions à la une s'affiche en tête de la page d'accueil, sans titre de section, et n'est pas affichée si aucune production n'est sélectionnée. Disposition sur écran large :
  - **1 production :** pleine largeur
  - **2 productions :** deux colonnes de largeur égale
  - **3 productions :** la première occupe 2/3 de la largeur ; les deux suivantes se partagent le tiers restant, empilées et de hauteur égale
  - Sur mobile, les productions s'empilent verticalement dans l'ordre défini
- **FR49 :** Chaque production à la une affiche uniquement sa vignette, son titre, son ou ses auteurs et ses nombres totaux de vues et de téléchargements ; un clic ouvre sa page de détail
- **FR50 :** Seules les productions à la une ont une vignette (image) : elle est renseignée depuis l'écran de mise à la une et n'est affichée que dans la bannière ; les autres cartes du site public (blocs, listing, profils, suggestions) restent sans image. Une vignette est obligatoire pour mettre à la une une production, sauf pour une vidéo hébergée sur Anta : sa vignette est facultative et, à défaut, une image extraite de la vidéo est affichée. Une vidéo disponible uniquement en lien externe requiert une vignette
- **FR51 :** Une production dépubliée ou supprimée est retirée automatiquement de la sélection à la une

### Gestion des Auteurs — Panel Admin (Phase 2)

- **FR52 :** Un administrateur peut créer et modifier une fiche auteur : nom(s) et prénom(s) (obligatoires), établissements affiliés (au moins un ; chaque affiliation comprend une université ou institution obligatoire et un département facultatif — seules les fiches issues de la migration (FR56) peuvent n'en avoir aucun, et sont alors signalées « à compléter » dans le panel), lien Google Scholar (facultatif, URL valide), photo (facultative)
- **FR53 :** Le profil d'un auteur n'est public qu'après confirmation par un administrateur du consentement de l'auteur à sa publication ; elle peut être donnée à la création de la fiche ou plus tard ; une fiche créée sans elle (y compris depuis le formulaire de production, FR54) reste non publique. Un administrateur peut retirer le consentement, ce qui repasse le profil en non public ; confirmation et retrait sont journalisés. Tant qu'elle manque, l'auteur n'apparaît ni dans la liste des auteurs ni dans le bloc « Auteurs les plus consultés », et son nom s'affiche sur ses productions sans lien vers un profil
- **FR54 :** Dans le formulaire de création ou d'édition d'une production, l'administrateur sélectionne le ou les auteurs parmi les auteurs enregistrés, dans un ordre qu'il définit ; la saisie libre d'un nom d'auteur n'est plus possible. Il peut créer un nouvel auteur via une fenêtre sans quitter le formulaire ; l'auteur créé est alors sélectionné automatiquement
- **FR55 :** Un administrateur peut supprimer une fiche auteur uniquement si elle n'est associée à aucune production (brouillon ou publiée)
- **FR56 :** Les noms d'auteurs saisis avant la Phase 2 sont rattachés aux auteurs enregistrés selon une table de conversion (nom existant → fiche auteur) proposée puis validée par le product owner avant exécution ; chaque production conserve tous ses auteurs et leur ordre. Les fiches issues de la migration sont créées sans consentement confirmé (profil non public, FR53)

### Auteurs — Site Public (Phase 2)

- **FR57 :** Un visiteur peut consulter la liste paginée des auteurs à profil public (FR53) ayant au moins une production publiée. Chaque auteur y présente sa photo (ou ses initiales à défaut), son nom complet, son institution principale (première affiliation), son nombre de productions publiées et le nombre total de vues de ses productions. Tri par défaut : vues des 365 derniers jours décroissantes ; tris alternatifs : nom (A → Z), nombre de productions publiées. Filtres : institution, domaine des productions. Recherche par nom
- **FR58 :** Un visiteur peut consulter la page de profil d'un auteur : photo, nom complet, affiliations, lien Google Scholar, nombres totaux de vues et de téléchargements de ses productions publiées, et liste paginée de ses productions publiées triée par date de publication de l'œuvre décroissante ; tris alternatifs : plus consultées, plus téléchargées, titre (A → Z)
- **FR59 :** Sur le site public, chaque nom d'auteur à profil public affiché (page de détail, cartes de production, bannière à la une) est un lien vers la page de profil de l'auteur
- **FR60 :** Le pied de page de toutes les pages publiques contient un lien « Auteurs » vers la liste des auteurs

### Suggestions (Phase 2)

- **FR61 :** La page de détail d'une production affiche jusqu'à 4 productions publiées similaires. Une production est candidate si elle partage au moins un critère : un auteur, un mot-clé (tag), le sous-domaine ou le domaine. Les candidates sont classées par critère le plus fort partagé — auteur commun, puis mot-clé commun, puis même sous-domaine, puis même domaine —, puis par nombre de critères partagés, puis par date de publication sur Anta décroissante. La production consultée est exclue ; la section n'est pas affichée s'il n'y a aucune candidate

---

## Exigences Non-Fonctionnelles

### Performance

- Chargement initial du site public : affichage du contenu principal (Largest Contentful Paint) en moins de 3 secondes sur un profil mobile 4G simulé (audit Lighthouse), y compris la page d'accueil complète (bannière et quatre blocs), la liste des auteurs et les pages de profil
- Réponse aux recherches et filtres : < 1 seconde pour le 95e percentile avec 50 visiteurs simultanés, mesuré par test de charge
- Téléversement : taille maximale 100 Mo par fichier ; formats acceptés : PDF, EPUB, MP4, MP3, AAC
- Les métadonnées et le lecteur de la page de détail s'affichent sans attendre le calcul des suggestions (FR61) ; les suggestions apparaissent en moins de 2 secondes après le chargement de la page

### Accessibilité

- Le site public est conforme au niveau WCAG 2.1 AA ; le panel d'administration est hors périmètre
- **Pages couvertes :** accueil, listing et recherche, page de détail (lecteurs PDF, EPUB, vidéo et audio inclus), liste des auteurs, profil d'auteur, politique de confidentialité, dans les deux langues de l'interface
- **Audit automatisé :** 0 violation de niveau A ou AA sur chaque page couverte, mesuré par un moteur d'audit automatisé (axe) à chaque livraison
- **Audit manuel :** parcours 1 et 2 réalisables entièrement au clavier, avec focus visible, et avec un lecteur d'écran (NVDA sous Windows, VoiceOver sous macOS) ; contrastes ≥ 4,5:1 pour le texte normal et ≥ 3:1 pour le texte large et les composants d'interface
- Toute image porteuse d'information (vignette, photo d'auteur) dispose d'un texte alternatif ; les lecteurs intégrés sont pilotables au clavier

### Sécurité

- Toutes les communications chiffrées via HTTPS (site public et panel admin)
- Mots de passe stockés sous forme hachée et salée avec un algorithme adaptatif reconnu, jamais en clair
- Sessions admin expirées automatiquement après 2 heures d'inactivité
- Protection CSRF activée sur toutes les actions du panel admin
- Logs de connexion et d'activité admin conservés au moins 12 mois

### Stockage

- Fichiers hébergés : PDF, EPUB, MP4, MP3, AAC ≤ 100 Mo
- Fichiers > 100 Mo ou contenus sous copyright : lien externe uniquement
- Images (vignettes des productions à la une, photos d'auteurs) : JPEG, PNG ou WebP, ≤ 5 Mo par image
- Intégrité des fichiers hébergés garantie — zéro perte acceptable : la taille de chaque fichier stocké est vérifiée contre le fichier reçu avant confirmation du téléversement

### Disponibilité

- Site public et panel admin : disponibilité 99% (≤ 7 heures d'indisponibilité par mois)

### Scalabilité

- Le site public supporte 50 visiteurs simultanés en respectant les seuils de performance ci-dessus, mesuré par test de charge
- Priorité : stabilité sous usage communautaire ; la montée en charge au-delà de cette cible est hors périmètre
