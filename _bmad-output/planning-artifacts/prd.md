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
  ]
inputDocuments: []
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document — Anta

**Auteur :** Aurélien
**Date :** 2026-04-03
**Type :** Application web — Bibliothèque numérique communautaire
**Contexte :** Greenfield — Complexité faible

---

## Résumé Exécutif

Anta est une bibliothèque numérique centralisée qui archive et rend accessibles les productions intellectuelles des membres d'une association à ancrage académique. Le produit sert deux audiences : les membres de la communauté (usage interne) et le grand public (vitrine académique). Le problème résolu est la dispersion des productions — livres, articles scientifiques, productions audiovisuelles, podcasts — éparpillées selon les domaines, les pays de résidence des auteurs et les plateformes. Anta crée un point d'accès unique permettant la recherche, la consultation et le téléchargement.

Sa valeur n'est pas révolutionnaire — elle est structurante : une communauté à forte production intellectuelle mérite une infrastructure documentaire pérenne. Pour les membres, c'est un gain de temps et de visibilité. Pour l'extérieur, c'est une fenêtre sur les capacités académiques et professionnelles de la communauté.

---

## Critères de Succès

### Succès Utilisateur

Un utilisateur réussit sa recherche en affinant une liste de résultats pertinents en moins de 3 interactions (recherche + filtre(s) + clic), via la combinaison de la barre de recherche et des filtres par métadonnées. Le moment de satisfaction intervient quand la liste se réduit jusqu'à la production recherchée.

### Succès Administration

Un administrateur enregistre et publie une production de façon autonome, sans assistance technique, en moins de 5 minutes. Le processus de publication est conditionné à la complétude des champs obligatoires et à l'association d'au moins un fichier ou lien.

### Succès Technique

- Recherche fonctionnelle et réactive sur l'ensemble des métadonnées
- Zéro perte de fichier lors des téléversements et téléchargements
- Panel admin accessible exclusivement aux comptes autorisés (auth email + mot de passe)
- Disponibilité 99% du site public

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

**Action :** Elle parcourt la page d'accueil, voit les productions récentes. Elle filtre par domaine "Littérature africaine" et découvre des travaux pertinents. Elle télécharge deux articles sans créer de compte. Elle note qu'un article a 200+ consultations — signal de pertinence.

**Moment clé :** Accès public sans friction, compteurs visibles, contenu accessible immédiatement.

**Exigences révélées :** FR1–FR9, FR10–FR16

---

### Parcours 3 — Admin Enregistrant une Production

**Persona :** Fatou, administratrice d'Anta, reçoit un livre numérique d'un membre basé à Paris.

**Situation :** Elle se connecte au panel admin avec ses identifiants.

**Action :** Elle crée une nouvelle production, remplit les métadonnées (titre, auteur, catégorie, domaine, sous-domaine, langue, date, éditeur, résumé, tags, pays), téléverse le PDF. Elle enregistre en brouillon, vérifie, puis publie. La production est immédiatement visible sur le site public.

**Moment clé :** En moins de 5 minutes, la production est centralisée et accessible. Depuis le panel, elle consulte les statistiques par production et en vue agrégée.

**Exigences révélées :** FR17–FR26, FR36, FR38

---

### Parcours 4 — Super Admin Gérant les Accès

**Persona :** Le super admin, unique, responsable des accès humains à Anta.

**Situation :** Un nouveau membre est désigné pour alimenter la bibliothèque.

**Action :** Le super admin crée un compte admin (email + mot de passe provisoire). Le nouvel admin peut immédiatement se connecter et enregistrer des productions après avoir défini son mot de passe permanent. Le super admin peut aussi désactiver un compte existant et consulter les statistiques d'activité des admins.

**Exigences révélées :** FR27–FR30, FR37

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

### Accessibilité

Conformité WCAG reportée en Phase 2 (Growth).

---

## Exigences Application Web

### Architecture

Anta est une MPA (application web multi-pages) composée de deux applications distinctes partageant un backend commun :

| Couche               | Technologie                 |
| -------------------- | --------------------------- |
| Backend              | AdonisJS (Node.js)          |
| Frontend site public | React                       |
| Frontend panel admin | React (application séparée) |

### Support Navigateurs

Navigateurs modernes uniquement (dernières 2 versions) : Chrome, Firefox, Edge, Safari. Pas de support IE11 ou legacy.

### Responsive

Site public : pleinement utilisable sur desktop, tablette et mobile. Panel admin : optimisé desktop-first, fonctionnel sur tablette.

### SEO — SSR Partiel

AdonisJS génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production — titre, auteur, résumé, catégorie, langue. Le rendu du contenu reste côté client (React). Panel admin exclu de l'indexation (robots.txt / noindex).

---

## Cadrage & Développement Phasé

### Phase 1 — MVP

**Approche :** Livrer le minimum qui centralise les productions et les rend accessibles. Utile dès le premier jour.

**Site public :** page d'accueil avec productions récentes, barre de recherche full-text, filtres par métadonnées (catégorie, domaine, sous-domaine, auteur, langue, pays, licence), page de détail avec lecteur intégré et téléchargement, compteurs de vues et téléchargements (public).

**Panel admin :** authentification email + mot de passe, formulaire de création/édition de production (toutes métadonnées + fichiers/liens), workflow brouillon → publication, statistiques par production et agrégées, gestion des comptes admin.

**Super admin :** compte unique initialisé à la création, gestion des accès admin, statistiques d'activité des admins.

### Phase 2 — Growth

- Suggestions de productions similaires sur les pages de détail
- Notifications aux membres sur les nouvelles publications
- Conformité WCAG (accessibilité)

### Phase 3 — Vision

- Intégration avec bases académiques externes (DOI, arXiv, Google Scholar...)
- API publique pour exposer le catalogue
- Profils d'auteurs enrichis

### Risques

| Risque                   | Niveau | Mitigation                                     |
| ------------------------ | ------ | ---------------------------------------------- |
| Stockage fichiers lourds | Faible | Fichiers > 100 Mo exclus de l'hébergement      |
| Adoption utilisateurs    | Nul    | Outil interne, communauté identifiée           |
| Ressources limitées      | Faible | MVP minimal ; statistiques simplifiables en V1 |

---

## Exigences Fonctionnelles

### Découverte et Recherche

- **FR1 :** Un visiteur peut effectuer une recherche textuelle sur l'ensemble des métadonnées des productions
- **FR2 :** Un visiteur peut filtrer les résultats par catégorie (livre, article, vidéo, musique, podcast...)
- **FR3 :** Un visiteur peut filtrer les résultats par domaine
- **FR4 :** Un visiteur peut filtrer les résultats par sous-domaine
- **FR5 :** Un visiteur peut filtrer les résultats par auteur
- **FR6 :** Un visiteur peut filtrer les résultats par langue
- **FR7 :** Un visiteur peut filtrer les résultats par pays de publication
- **FR8 :** Un visiteur peut filtrer les résultats par statut de licence (production membre / licence libre / lien externe)
- **FR9 :** La page d'accueil affiche deux sections : les productions les plus consultées et les productions récemment ajoutées — la barre de recherche et les filtres sont visibles et utilisables dès l'arrivée, sans recherche active par défaut

### Consultation et Téléchargement

- **FR10 :** Un visiteur peut consulter la page de détail d'une production avec l'intégralité de ses métadonnées publiques
- **FR11 :** Un visiteur peut lire un document PDF ou EPUB directement dans le navigateur via un lecteur intégré
- **FR12 :** Un visiteur peut visionner une vidéo MP4 directement dans le navigateur via un lecteur intégré
- **FR13 :** Un visiteur peut écouter un fichier audio MP3 ou AAC directement dans le navigateur via un lecteur intégré
- **FR14 :** Un visiteur peut télécharger une production hébergée (PDF, EPUB, MP4, MP3, AAC)
- **FR15 :** Un visiteur peut accéder à la source externe d'une production sous copyright (lien embed ou lien simple)
- **FR16 :** Un visiteur peut consulter le nombre de vues et de téléchargements d'une production sur la page de listing et sur la page de détail

### Gestion des Productions (Panel Admin)

- **FR17 :** Un administrateur peut créer une production en renseignant ses métadonnées : titre, auteur(s), catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, journal/revue, éditeur, ISBN/DOI/ISSN, institution d'affiliation, licence, statut
- **FR18 :** Un administrateur peut associer à une production un ou plusieurs fichiers hébergés (PDF, EPUB, MP4, MP3, AAC)
- **FR19 :** Un administrateur peut associer à une production un ou plusieurs liens externes (embed ou lien simple)
- **FR20 :** Un administrateur peut enregistrer une production en tant que brouillon sans remplir tous les champs ni la publier
- **FR21 :** Un administrateur peut publier un brouillon — la publication requiert que toutes les métadonnées de la production soient renseignées (titre, auteur(s), catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, licence, statut) et qu'au moins un fichier ou lien soit associé ; le système valide ces conditions avant autorisation
- **FR22 :** Un administrateur peut modifier une production (brouillon ou publiée) et enregistrer les modifications sans déclencher de republication automatique
- **FR23 :** Un administrateur peut dépublier une production publiée, qui repasse en état brouillon
- **FR24 :** Un administrateur peut supprimer une production du système

**Cycle de vie :** `Brouillon → Publié → (Dépublié → Brouillon)`

### Statistiques et Métriques

- **FR25 :** Le système enregistre une vue 10 secondes après l'ouverture de la page de détail d'une production
- **FR26 :** Le système enregistre un téléchargement à chaque téléchargement d'une production
- **FR27 :** Un administrateur peut consulter les statistiques (vues, téléchargements) par production dans le panel admin
- **FR28 :** Un administrateur peut consulter une vue agrégée des statistiques de l'ensemble de la bibliothèque
- **FR29 :** Le super administrateur peut consulter les statistiques d'activité des administrateurs : productions enregistrées par admin, productions modifiées par admin, logs de connexion

### Gestion des Comptes et Accès

- **FR30 :** Un administrateur peut s'authentifier sur le panel admin avec son email et son mot de passe
- **FR32 :** Le super administrateur peut créer un compte administrateur
- **FR33 :** Le super administrateur peut désactiver un compte administrateur
- **FR34 :** Le super administrateur dispose d'un compte unique, initialisé à la création du site
- **Périmètre super admin :** Le super administrateur dispose de toutes les capacités d'un administrateur (FR17–FR29) et peut en plus gérer les comptes administrateurs (FR32–FR33, FR39, FR42–FR43). Son accès aux productions est identique à celui d'un admin.

### Métadonnées Système

- **FR35 :** Le système gère trois niveaux de dates par production :
  - **Date de publication de l'œuvre** — saisie par l'admin, visible publiquement
  - **Date de création système** et **date de modification système** — générées automatiquement, visibles dans le panel admin uniquement
  - **Date de publication sur Anta** — générée à la première publication, visible dans le panel admin uniquement

### Référencement

- **FR36 :** Le système génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production du site public
- **FR37 :** Le panel d'administration est exclu de l'indexation par les moteurs de recherche

### Conformité

- **FR38 :** Le site public affiche une politique de confidentialité accessible depuis toutes les pages
- **FR39 :** Le système permet la suppression d'un compte administrateur et de ses données de connexion associées

### Gestion des Accès — Compléments

- **FR42 :** Un administrateur doit définir un nouveau mot de passe lors de sa première connexion, avant d'accéder au panel (le mot de passe provisoire créé par le super admin est à usage unique)
- **FR43 :** Le super administrateur peut réinitialiser le mot de passe d'un compte administrateur (génération d'un nouveau mot de passe provisoire envoyé par email)

### Internationalisation

- **FR40 :** Le site public et le panel admin affichent l'intégralité de leur interface en français et en anglais — l'utilisateur bascule via un sélecteur de langue visible sur toutes les pages
- **FR41 :** La langue sélectionnée est mémorisée (cookie ou localStorage) et restaurée automatiquement lors des visites suivantes
- **Périmètre :** l'internationalisation couvre l'interface uniquement (labels, boutons, navigation, messages d'erreur, textes fixes). Les métadonnées des productions restent dans la langue de rédaction.

---

## Exigences Non-Fonctionnelles

### Performance

- Chargement initial du site public : < 3 secondes sur connexion standard
- Réponse aux recherches et filtres : < 1 seconde pour le 95e percentile sous charge normale
- Téléversement : taille maximale 100 Mo par fichier ; formats acceptés : PDF, EPUB, MP4, MP3, AAC

### Sécurité

- Toutes les communications chiffrées via HTTPS (site public et panel admin)
- Mots de passe hashés en base de données (scrypt — défaut AdonisJS, plus moderne que bcrypt)
- Sessions admin avec expiration automatique après inactivité
- Protection CSRF activée sur toutes les actions du panel admin
- Logs de connexion et d'activité admin conservés dans le système

### Stockage

- Fichiers hébergés : PDF, EPUB, MP4, MP3, AAC ≤ 100 Mo
- Fichiers > 100 Mo ou contenus sous copyright : lien externe uniquement
- Intégrité des fichiers hébergés garantie — zéro perte acceptable

### Disponibilité

- Site public et panel admin : disponibilité 99% (≤ 7 heures d'indisponibilité par mois)

### Scalabilité

- L'architecture supporte une charge communautaire moyenne sans interruption de service
- Priorité : stabilité sous usage normal, pas montée en charge extrême
