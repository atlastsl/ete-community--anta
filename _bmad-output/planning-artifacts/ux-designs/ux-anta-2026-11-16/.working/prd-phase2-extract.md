# Extrait PRD — Phase 2 (Growth), vue UX

Sources : `_bmad-output/planning-artifacts/prd.md` (révisé 2026-11-15) et `validation-report-2026-11-15.md`.
Extrait en lecture seule, rédigé le 2026-11-16 pour le workflow UX Phase 2. Citations verbatim sauf mention contraire.

---

## 1. Exigences fonctionnelles Phase 2 (verbatim)

### FR modifiées en Phase 2

- **FR5 (modifié Phase 2) :** Un visiteur peut filtrer les résultats par auteur, parmi les auteurs enregistrés (FR52)
- **FR9 (modifié Phase 2) :** La page d'accueil affiche, dans cet ordre : la barre de recherche et son bouton « Recherche avancée » (FR44), la bannière des productions à la une (FR48), puis quatre blocs titrés — « Récemment publiées », « Les plus consultées », « Les plus téléchargées », « Auteurs les plus consultés » (FR45–FR46). Aucune recherche n'est active par défaut
- **FR17 (modifié Phase 2) :** Un administrateur peut créer une production en renseignant ses métadonnées : titre, auteur(s) choisis parmi les auteurs enregistrés (FR54), catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, journal/revue, éditeur, ISBN/DOI/ISSN, institution d'affiliation, licence, statut
- Également modifiées (hors demande, utiles à l'UX) :
  - **FR21 (modifié Phase 2) :** Un administrateur peut publier un brouillon — la publication requiert que toutes les métadonnées de la production soient renseignées (titre, au moins un auteur enregistré, catégorie, domaine, sous-domaine, langue, date de publication de l'œuvre, résumé, tags, pays de publication, licence, statut) et qu'au moins un fichier ou lien soit associé ; le système valide ces conditions avant autorisation
  - **FR36 (modifié Phase 2) :** Le système génère côté serveur les balises meta (title, description, Open Graph) pour chaque page de production et chaque page de profil d'auteur du site public. (Section SEO : profil d'auteur → « nom, affiliation principale, photo ».)

### Page d'Accueil (Phase 2)

- **FR44 :** Un visiteur peut accéder à la page de recherche avancée (listing complet avec filtres, même destination que le lien du pied de page) via un bouton « Recherche avancée » placé à côté de la barre de recherche
- **FR45 :** Chaque bloc titré de la page d'accueil affiche 3 éléments et un bouton « Voir plus » :
  - **Récemment publiées :** les 3 productions publiées le plus récemment sur Anta ; « Voir plus » ouvre le listing trié par date de publication sur Anta décroissante
  - **Les plus consultées :** les 3 productions publiées ayant le plus de vues ; « Voir plus » ouvre le listing trié par vues décroissantes
  - **Les plus téléchargées :** les 3 productions publiées ayant le plus de téléchargements ; « Voir plus » ouvre le listing trié par téléchargements décroissants
  - **Auteurs les plus consultés :** les 3 auteurs à profil public (FR53) dont les productions publiées cumulent le plus de vues ; « Voir plus » ouvre la liste des auteurs (FR57) avec son tri par défaut
- **FR46 :** Les classements des blocs « Les plus consultées », « Les plus téléchargées » et « Auteurs les plus consultés » portent sur les vues ou téléchargements enregistrés sur les 365 derniers jours glissants. Un bloc sans aucun élément à afficher n'est pas affiché

### Productions à la Une (Phase 2)

- **FR47 :** Un administrateur peut sélectionner de 0 à 3 productions publiées à mettre à la une et définir leur ordre d'affichage. La sélection n'a pas d'échéance : elle reste affichée jusqu'à sa modification par un administrateur
- **FR48 :** La bannière des productions à la une s'affiche en tête de la page d'accueil, sans titre de section, et n'est pas affichée si aucune production n'est sélectionnée. Disposition sur écran large :
  - **1 production :** pleine largeur
  - **2 productions :** deux colonnes de largeur égale
  - **3 productions :** la première occupe 2/3 de la largeur ; les deux suivantes se partagent le tiers restant, empilées et de hauteur égale
  - Sur mobile, les productions s'empilent verticalement dans l'ordre défini
- **FR49 :** Chaque production à la une affiche uniquement sa vignette, son titre, son ou ses auteurs et ses nombres totaux de vues et de téléchargements ; un clic ouvre sa page de détail
- **FR50 :** Une vignette (image) est obligatoire pour mettre à la une une production, sauf pour une vidéo hébergée sur Anta : sa vignette est facultative et, à défaut, une image extraite de la vidéo est affichée. Une vidéo disponible uniquement en lien externe requiert une vignette
- **FR51 :** Une production dépubliée ou supprimée est retirée automatiquement de la sélection à la une

### Gestion des Auteurs — Panel Admin (Phase 2)

- **FR52 :** Un administrateur peut créer et modifier une fiche auteur : nom(s) et prénom(s) (obligatoires), établissements affiliés (au moins un ; chaque affiliation comprend une université ou institution obligatoire et un département facultatif — seules les fiches issues de la migration (FR56) peuvent n'en avoir aucun, et sont alors signalées « à compléter » dans le panel), lien Google Scholar (facultatif, URL valide), photo (facultative)
- **FR53 :** Le profil d'un auteur n'est public qu'après confirmation par un administrateur du consentement de l'auteur à sa publication ; cette confirmation est requise à la création d'une fiche dans le panel. Tant qu'elle manque, l'auteur n'apparaît ni dans la liste des auteurs ni dans le bloc « Auteurs les plus consultés », et son nom s'affiche sur ses productions sans lien vers un profil
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

### Rappels Phase 1 toujours en vigueur et touchant la Phase 2

- **FR16 :** compteurs de vues et téléchargements visibles sur la page de listing et la page de détail.
- **FR25 :** une vue est enregistrée 10 secondes après l'ouverture de la page de détail.
- **FR38 :** politique de confidentialité accessible depuis toutes les pages.
- **FR40–FR41 :** interface FR/EN, sélecteur visible sur toutes les pages, langue restaurée. « Les métadonnées des productions et des auteurs restent dans la langue de rédaction. »
- Responsive : « Site public : pleinement utilisable sur desktop, tablette et mobile. Panel admin : optimisé desktop-first, fonctionnel sur tablette. »
- Périmètre super admin : dispose de toutes les capacités d'un admin, y compris FR47–FR56.

---

## 2. Écrans impliqués

### Site public

| Écran | FR servies | Données affichées / éléments |
|---|---|---|
| **Accueil** (`home`) | FR9, FR44, FR45, FR46, FR48, FR59, FR60, FR38, FR40 | Ordre imposé : barre de recherche + bouton « Recherche avancée » → bannière à la une (si ≥ 1) → 4 blocs titrés de 3 éléments + « Voir plus » chacun. Aucune recherche active par défaut. Le contenu des cartes de production des blocs n'est **pas** précisé par le PRD (FR16 impose les compteurs sur le listing ; à aligner sur les cartes existantes). |
| **Bannière à la une** (dans l'accueil) | FR47–FR51, FR59 | Uniquement : vignette, titre, auteur(s) (lien si profil public), totaux de vues et de téléchargements. Clic → page de détail. Pas de titre de section. Mise en page 1 / 2 / 3 éléments (voir FR48), empilée sur mobile. |
| **Bloc « Récemment publiées »** | FR45 | 3 productions (date de publication sur Anta décroissante). Voir plus → listing trié par date de publication sur Anta décroissante. |
| **Bloc « Les plus consultées »** | FR45, FR46 | 3 productions, classement sur les vues des 365 derniers jours. Voir plus → listing trié par vues décroissantes. |
| **Bloc « Les plus téléchargées »** | FR45, FR46 | 3 productions, téléchargements sur 365 j. Voir plus → listing trié par téléchargements décroissants. |
| **Bloc « Auteurs les plus consultés »** | FR45, FR46, FR53 | 3 auteurs à profil public, vues cumulées sur 365 j. Voir plus → liste des auteurs (tri par défaut). Contenu de la carte auteur non précisé (cohérence probable avec FR57). Accès au profil en ≤ 2 clics depuis l'accueil (critère de succès). |
| **Recherche avancée / listing** (`productions`) | FR1–FR8, FR5 modifié, FR16, FR44, FR45 | Listing complet avec filtres ; filtre auteur = auteurs enregistrés. Doit accepter les tris : date de publication sur Anta ↓, vues ↓, téléchargements ↓ (destinations des « Voir plus »). Même destination que le lien du pied de page. |
| **Liste des auteurs** (nouvelle) | FR57, FR60, FR53 | Paginée ; seuls auteurs à profil public avec ≥ 1 production publiée. Par auteur : photo (ou initiales), nom complet, institution principale (1re affiliation), nb de productions publiées, total des vues. Tri par défaut : vues 365 j ↓ ; alternatifs : nom A→Z, nb de productions. Filtres : institution, domaine des productions. Recherche par nom. Lien « Auteurs » dans le pied de page de toutes les pages. |
| **Profil d'auteur** (nouvelle) | FR58, FR36, FR59 | Photo, nom complet, affiliations (institution + département), lien Google Scholar, totaux vues et téléchargements des productions publiées, liste paginée des productions publiées (tri par défaut : date de publication de l'œuvre ↓ ; alternatifs : plus consultées, plus téléchargées, titre A→Z). Meta SSR : nom, affiliation principale, photo. |
| **Détail d'une production** (`production`) — auteurs + suggestions | FR10–FR16, FR59, FR61 | Noms d'auteurs ordonnés, liens vers profil si public, texte simple sinon. Section suggestions : jusqu'à 4 productions similaires, chargées sans bloquer métadonnées et lecteur, en < 2 s ; section masquée si aucune candidate. Contenu des cartes de suggestion non précisé. |
| **Cartes de production** (transverses) | FR16, FR59 | Noms d'auteurs à profil public cliquables. |
| **Pied de page** (toutes pages publiques) | FR38, FR44, FR60 | Liens : politique de confidentialité, recherche avancée / listing, « Auteurs ». |

### Panel admin (hors périmètre WCAG, desktop-first)

| Écran | FR servies | Données / éléments |
|---|---|---|
| **Auteurs — liste admin** | FR52, FR53, FR55, FR56 | Fiches auteurs ; signalement « à compléter » (fiche migrée sans affiliation) ; état du consentement (confirmé / en attente) ; suppression possible seulement si aucune production associée (brouillon ou publiée). |
| **Auteurs — création / édition** | FR52, FR53 | Nom(s)\* et prénom(s)\* ; affiliations (≥ 1, sauf fiches migrées) : université/institution\* + département facultatif, répétables ; lien Google Scholar (URL valide, facultatif) ; photo (facultative, JPEG/PNG/WebP ≤ 5 Mo). Confirmation du consentement **requise à la création**. Retrait sur demande des champs facultatifs (photo, Google Scholar, département). |
| **Confirmation du consentement (fiches migrées)** | FR53, FR56 | Action qui rend le profil public (parcours 5 : revue des fiches migrées, complétion des affiliations, confirmation). |
| **Productions à la une — sélection** | FR47, FR50, FR51 | Choix de 0 à 3 productions **publiées**, ordre d'affichage, téléversement de vignette (obligatoire sauf vidéo hébergée ; vignette requise pour vidéo en lien externe). Effet immédiat sur la bannière. Objectif : modification en < 1 min. |
| **Formulaire de production — sélecteur d'auteurs** | FR17, FR21, FR54 | Sélection multiple ordonnée parmi les auteurs enregistrés ; plus de saisie libre ; création d'un auteur dans une fenêtre (modale) sans quitter le formulaire, sélection automatique de l'auteur créé. Publication bloquée sans au moins un auteur enregistré. |
| **Migration / table de conversion** | FR56 | Table « nom existant → fiche auteur » proposée puis validée par le product owner **avant exécution**. Le PRD ne dit pas qu'il s'agit d'un écran du panel (voir question 22). Après migration : fiches sans consentement, éventuellement « à compléter ». |

---

## 3. Parcours impliquant la Phase 2 (protagonistes tels que nommés)

### Parcours 2 — Visiteur Externe en Découverte — **Amara**, enseignante-chercheuse en littérature africaine au Sénégal
1. Arrive sur Anta via un lien partagé, sans connaître la communauté.
2. Sur l'accueil, la bannière met en avant **trois** productions à la une.
3. Parcourt les blocs « Récemment publiées », « Les plus consultées », « Les plus téléchargées ».
4. Dans « Auteurs les plus consultés », ouvre le profil d'une chercheuse : affiliations, lien Google Scholar, vues et téléchargements cumulés, liste de ses productions.
5. Ouvre un article et le télécharge sans créer de compte.
6. Rebondit sur une suggestion de production similaire en bas de page.
7. Bascule l'interface en anglais ; la langue est conservée à la visite suivante.
8. Utilise le site au clavier comme à la souris.
- Moment clé : « découverte en cascade (accueil → auteur → production → production similaire) ».
- Exigences révélées : FR1–FR16, FR40–FR41, FR44–FR46, FR48–FR49, FR57–FR61, NFR Accessibilité.

### Parcours 3 — Admin Enregistrant une Production — **Fatou**, administratrice d'Anta (livre numérique d'un membre basé à Paris)
1. Se connecte au panel.
2. Crée une production, remplit les métadonnées, téléverse le PDF.
3. Choisit l'auteur dans la liste des auteurs enregistrés.
4. Le co-auteur n'existe pas : elle le crée via une fenêtre sans quitter le formulaire ; il est sélectionné automatiquement.
5. Enregistre en brouillon, vérifie, publie ; visible immédiatement sur le site public.
6. Consulte les statistiques par production et agrégées.
- Moment clé : < 5 minutes. Exigences révélées : FR17–FR28, FR30, FR35, FR52–FR54.

### Parcours 5 — Admin Gérant les Auteurs et la Mise en Avant — **Fatou**
1. Un nouveau membre a rejoint l'association ; la communauté veut mettre en avant trois productions du mois.
2. Crée la fiche auteur (nom, prénom, université et département, lien Google Scholar, photo) **après avoir confirmé avoir obtenu son consentement**.
3. Ouvre la gestion des productions à la une, sélectionne trois productions publiées et les ordonne.
4. Article et podcast : téléverse une vignette vitrine. Vidéo : aucune vignette, une image extraite de la vidéo est utilisée.
5. La bannière reflète la sélection immédiatement et reste en place jusqu'à la prochaine modification.
6. À la mise en service de la Phase 2 : passe en revue les fiches migrées, complète les affiliations manquantes, confirme le consentement des auteurs joints → profils publics.
7. Supprime une fiche créée par erreur et associée à aucune production.
- Moment clé : fiche créée en autonomie ; sélection à la une modifiée en < 1 minute. Exigences révélées : FR47–FR53, FR55–FR56.

### Parcours 1 (Kofi, doctorant en mathématiques) et 4 (le super admin)
Pas de FR Phase 2 dans les exigences révélées. Le parcours 1 est néanmoins dans l'audit manuel WCAG (clavier + lecteur d'écran) et utilise le filtre auteur (FR5 modifié).

### Critères de succès Phase 2 (verbatim)
- **Visibilité des auteurs :** un visiteur atteint le profil d'un auteur depuis la page d'accueil en 2 clics au plus (bloc « Auteurs les plus consultés » ou nom d'auteur sur une carte de production)
- **Découverte :** chaque page de détail d'une production partageant au moins un critère (auteur, mot-clé, sous-domaine ou domaine) avec une autre production publiée affiche au moins une suggestion
- **Éditorialisation :** un administrateur modifie la sélection des productions à la une en moins d'une minute
- **Migration :** 100 % des noms d'auteurs existants sont rattachés à un auteur enregistré selon la table de conversion validée, sans perte d'auteur sur aucune production ; aucun profil issu de la migration n'est public avant confirmation du consentement
- **Accessibilité :** 0 violation WCAG 2.1 AA détectée sur les pages publiques (audit automatisé et audit manuel, voir NFR Accessibilité)

---

## 4. Accessibilité et NFR (verbatim)

### Exigences Domaine — Accessibilité
« Le site public est conforme au niveau **WCAG 2.1 AA** (Phase 2). Le panel d'administration est hors périmètre de conformité. Critères de mesure : voir NFR Accessibilité. »

### NFR Accessibilité
- Le site public est conforme au niveau WCAG 2.1 AA ; le panel d'administration est hors périmètre
- **Pages couvertes :** accueil, listing et recherche, page de détail (lecteurs PDF, EPUB, vidéo et audio inclus), liste des auteurs, profil d'auteur, politique de confidentialité, dans les deux langues de l'interface
- **Audit automatisé :** 0 violation de niveau A ou AA sur chaque page couverte, mesuré par un moteur d'audit automatisé (axe) à chaque livraison
- **Audit manuel :** parcours 1 et 2 réalisables entièrement au clavier, avec focus visible, et avec un lecteur d'écran (NVDA sous Windows, VoiceOver sous macOS) ; contrastes ≥ 4,5:1 pour le texte normal et ≥ 3:1 pour le texte large et les composants d'interface
- Toute image porteuse d'information (vignette, photo d'auteur) dispose d'un texte alternatif ; les lecteurs intégrés sont pilotables au clavier

### Autres NFR à impact UX
- **Performance :** « Chargement initial du site public : affichage du contenu principal (Largest Contentful Paint) en moins de 3 secondes sur un profil mobile 4G simulé (audit Lighthouse), y compris la page d'accueil complète (bannière et quatre blocs), la liste des auteurs et les pages de profil »
- « Réponse aux recherches et filtres : < 1 seconde pour le 95e percentile avec 50 visiteurs simultanés, mesuré par test de charge »
- « Les métadonnées et le lecteur de la page de détail s'affichent sans attendre le calcul des suggestions (FR61) ; les suggestions apparaissent en moins de 2 secondes après le chargement de la page »
- **Stockage :** « Images (vignettes des productions à la une, photos d'auteurs) : JPEG, PNG ou WebP, ≤ 5 Mo par image »
- **Responsive :** site public pleinement utilisable desktop / tablette / mobile ; admin desktop-first, fonctionnel sur tablette.
- **Navigateurs :** 2 dernières versions de Chrome, Firefox, Edge, Safari.
- **SEO :** meta SSR pour productions et profils d'auteur (nom, affiliation principale, photo) ; rendu du contenu côté client.

### Données personnelles des auteurs (Exigences Domaine, verbatim)
« **Données des auteurs (Phase 2) :** les profils publics exposent des données personnelles (nom, prénom, affiliations, lien Google Scholar, photo). Leur publication requiert le consentement de l'auteur, confirmé par l'administrateur à la création de la fiche (FR53). Sur demande de l'auteur, les champs facultatifs (photo, lien Google Scholar, département) sont retirés ; la suppression complète de la fiche suit la règle FR55. La politique de confidentialité décrit ces traitements. »

### Risques (Phase 2)
| Risque | Niveau | Mitigation |
|---|---|---|
| Ressources limitées | Faible | Phase 2 découpée en lots livrables indépendamment (accueil, auteurs, suggestions, accessibilité) |
| Migration des auteurs (doublons, orthographe) | Moyen | Table de conversion proposée puis validée par le product owner avant exécution (FR56) ; contrôle post-migration |
| Régression d'accessibilité | Faible | Audit automatisé à chaque livraison ; audit manuel avant chaque mise en production majeure |

### Hors périmètre (impact UX)
Comptes visiteurs, commentaires, notation ou favoris ; WCAG du panel ; notifications (Phase 3) ; application native / hors ligne. Phase 3 : biographie, ORCID, réseaux académiques sur les profils (donc **pas** en Phase 2).

---

## 5. Règles métier qui déterminent les états de l'interface

**Accueil**
- R1. Ordre fixe : recherche + « Recherche avancée » → bannière → Récemment publiées → Les plus consultées → Les plus téléchargées → Auteurs les plus consultés (FR9).
- R2. Aucune recherche active par défaut (FR9).
- R3. Chaque bloc : 3 éléments + « Voir plus » (FR45). Un bloc **sans aucun élément** n'est pas affiché (FR46) → pas d'état vide visible ; un bloc avec 1 ou 2 éléments n'est pas traité (Q5).
- R4. Classements « consultées », « téléchargées », « auteurs » = 365 derniers jours glissants (FR46) ; « Récemment publiées » = date de publication sur Anta.
- R5. Destinations « Voir plus » : listing trié date de publication sur Anta ↓ / vues ↓ / téléchargements ↓ ; liste des auteurs avec tri par défaut (vues 365 j ↓) (FR45).
- R6. Bloc auteurs : seulement les profils publics (consentement confirmé) (FR45, FR53).

**Bannière à la une**
- R7. 0 à 3 productions publiées, ordre défini par l'admin ; pas d'échéance (FR47).
- R8. 0 sélection → bannière absente, sans titre ni espace réservé (FR48).
- R9. Mise en page écran large : 1 = pleine largeur ; 2 = 2 colonnes égales ; 3 = 2/3 + deux éléments empilés de hauteur égale dans le 1/3. Mobile : empilement dans l'ordre (FR48).
- R10. Contenu strict : vignette, titre, auteur(s), **totaux** vues + téléchargements ; clic → détail (FR49). Pas de catégorie, de résumé ni de date.
- R11. Vignette obligatoire, sauf vidéo hébergée sur Anta (facultative, image extraite à défaut) ; vidéo en lien externe uniquement → vignette obligatoire (FR50). Images JPEG/PNG/WebP ≤ 5 Mo.
- R12. Dépublication ou suppression → retrait automatique de la sélection (FR51) → la bannière passe à n−1 éléments (changement de mise en page) ou disparaît.

**Auteurs**
- R13. Consentement : obligatoire à la création dans le panel ; fiches migrées créées sans consentement (FR53, FR56).
- R14. Sans consentement : absent de la liste et du bloc auteurs ; nom affiché **sans lien** sur ses productions (FR53). Avec consentement : nom = lien vers profil partout (détail, cartes, bannière) (FR59).
- R15. Liste publique : seulement profil public **et** ≥ 1 production publiée (FR57).
- R16. Photo absente → initiales (FR57) ; photo facultative.
- R17. Institution principale = première affiliation (FR57) → l'ordre des affiliations compte dans le formulaire admin.
- R18. Fiche migrée sans affiliation → badge « à compléter » dans le panel (FR52) ; une fiche créée dans le panel exige ≥ 1 affiliation.
- R19. Suppression d'une fiche seulement sans production associée, brouillon compris (FR55) → bouton supprimer désactivé ou expliqué sinon.
- R20. Retrait sur demande des champs facultatifs (photo, Google Scholar, département) → le profil doit rester correct sans ces champs.
- R21. Ordre des auteurs d'une production défini par l'admin et conservé par la migration (FR54, FR56).
- R22. Plus de saisie libre de nom d'auteur ; création en modale, auteur sélectionné automatiquement (FR54).
- R23. Publication d'une production impossible sans au moins un auteur enregistré (FR21).
- R24. Liste publique : tri par défaut vues 365 j ↓, mais la carte affiche le **total** des vues (FR57) ; profil : totaux, liste triée par date de publication de l'œuvre ↓ (FR58).

**Suggestions**
- R25. Jusqu'à 4 ; candidates = au moins un critère commun (auteur, tag, sous-domaine, domaine) ; classement critère le plus fort → nb de critères → date de publication sur Anta ↓ ; production courante exclue ; section absente si 0 candidate (FR61).
- R26. Chargement asynchrone : la page s'affiche sans les suggestions, qui arrivent en < 2 s → état de chargement non bloquant (NFR Performance).

**Transverses**
- R27. Totaux de compteurs sur la bannière, le profil et les cartes ; fenêtre de 365 j seulement pour les classements → deux bases de calcul visibles.
- R28. Interface FR/EN, métadonnées et données auteurs non traduites (Périmètre i18n). Les libellés FR des blocs sont donnés par le PRD ; les libellés EN restent à définir.
- R29. Pas de comptes visiteurs, favoris, notation ni « suivre un auteur » (Hors périmètre).

---

## 6. Ambiguïtés et questions ouvertes pour l'UX

1. **Vignettes hors bannière :** le PRD ne définit une vignette que pour la mise à la une (FR50). Les cartes des blocs, du listing, des suggestions et du profil ont-elles une image (vignette si présente, visuel par catégorie, aucune) ? La vignette est-elle un attribut de la production (réutilisable) ou de l'entrée à la une ?
2. **Contenu des cartes de production** des blocs d'accueil et des suggestions : non spécifié (seul FR16 impose les compteurs au listing). Reprendre la carte actuelle du listing ? Afficher la catégorie, la date, le domaine ?
3. **Contenu de la carte auteur** du bloc « Auteurs les plus consultés » : non spécifié. Aligner sur FR57 (photo/initiales, nom, institution principale, nb de productions, vues) ? Quelle valeur de vues afficher : 365 j (base du classement) ou total ?
4. **Totaux et fenêtre de 365 j :** la liste des auteurs est triée sur 365 j mais affiche le total des vues (FR57) ; les blocs sont classés sur 365 j. Faut-il dire à l'utilisateur sur quelle période porte le classement (« sur 12 mois ») pour éviter qu'un ordre paraisse incohérent avec les chiffres affichés ?
5. **Blocs partiels :** avec 1 ou 2 éléments (catalogue récent, peu de vues sur 365 j), le bloc s'affiche-t-il incomplet ? « Voir plus » reste-t-il visible ? Comment départager les ex æquo (beaucoup de productions à 0 vue sur 365 j) ?
6. **Doublons accueil :** une production peut apparaître dans la bannière et dans un ou plusieurs blocs. Faut-il dédoublonner ?
7. **Tri des « Voir plus » sur le listing :** le tri par vues ou téléchargements du listing porte-t-il sur 365 j (comme le bloc) ou sur le total ? Ces tris sont-ils proposés à l'utilisateur dans l'interface du listing (sélecteur de tri visible) ou atteignables seulement par URL ?
8. **Barre de recherche de l'accueil vs « Recherche avancée » :** la soumission de la barre ouvre-t-elle le listing (avec la requête) ou affiche-t-elle les résultats sur l'accueil ? Hiérarchie visuelle du bouton « Recherche avancée » (bouton secondaire, lien) ?
9. **Bannière : interactions imbriquées :** la carte entière est cliquable (FR49) mais les noms d'auteurs à profil public sont des liens (FR59). Il faut un motif accessible sans liens imbriqués (lien principal sur le titre avec zone de clic étendue, auteurs en liens distincts).
10. **Bannière : rendu du texte :** titre, auteurs et compteurs par-dessus la vignette (contraste ≥ 4,5:1 à garantir sur une image quelconque) ou sous la vignette ? Ratio et recadrage des vignettes pour les mises en page 1/2/3 (même image en pleine largeur et en 1/6 de surface) ? Comportement sur tablette ?
11. **Image extraite d'une vidéo hébergée (FR50) :** quelle image (première image, instant fixe) ? Aperçu dans le panel avant validation ? Texte alternatif ?
12. **Texte alternatif des vignettes et photos :** saisi par l'admin ou dérivé (titre de la production, nom de l'auteur) ? Une vignette purement décorative à côté du titre peut-elle avoir `alt=""` ?
13. **Auteur à profil public sans production publiée :** exclu de la liste (FR57), mais sa page de profil est-elle accessible par URL (404, page vide, liste vide) ? Que se passe-t-il quand la dernière production de l'auteur est dépubliée ?
14. **Nom d'auteur sans profil public :** distinction visuelle avec les noms cliquables (style, infobulle) ? Le filtre auteur du listing (FR5) propose-t-il **tous** les auteurs enregistrés, y compris ceux sans consentement ? Le PRD dit « parmi les auteurs enregistrés » ; afficher leur nom là est cohérent avec FR53, mais cela reste à confirmer.
15. **Profil public sans affiliation :** un auteur migré peut-il voir son consentement confirmé avant que son affiliation soit complétée ? Si oui, il faut un affichage sans « institution principale » dans la liste et sur le profil, et des meta SSR sans affiliation.
16. **Consentement à la création dans la modale du formulaire de production (FR54) :** la case de consentement y est-elle obligatoire ? Si l'admin n'a pas encore le consentement d'un co-auteur, peut-il créer la fiche (FR53 l'exige à la création) ? Sinon, la saisie de la production est bloquée. Faut-il une création « sans consentement » analogue aux fiches migrées ?
17. **Retrait du consentement :** le PRD ne prévoit pas de repasser un profil en non public (seulement le retrait des champs facultatifs ou la suppression FR55, impossible si des productions sont liées). Faut-il une action « retirer le consentement » dans le panel ?
18. **Modèle des noms :** « nom(s) et prénom(s) » : ordre d'affichage (Prénom Nom ou NOM Prénom), tri A→Z sur le nom de famille ou le prénom, calcul des initiales avec des noms composés ou multiples ?
19. **Filtre « institution » de la liste publique :** les institutions sont saisies en texte libre par affiliation. Liste de valeurs proposée (dédoublonnage, casse, variantes) ? Le filtre porte-t-il sur toutes les affiliations ou sur l'institution principale ? Filtre « domaine des productions » : sélection unique ou multiple ?
20. **Pagination :** nombre d'éléments par page (liste des auteurs, productions du profil) ; pagination numérotée ou « charger plus » ; tri et filtres conservés dans l'URL ?
21. **Sélecteur d'auteurs (FR54) :** recherche avec autocomplétion, distinction des homonymes (afficher l'affiliation, le badge « à compléter », l'état du consentement), réordonnancement (glisser-déposer et alternative clavier/boutons), suppression d'un auteur sélectionné.
22. **Table de conversion (FR56) :** écran du panel (revue et validation par le product owner) ou artefact hors produit (fichier/script) validé une fois ? Le PRD dit seulement « proposée puis validée par le product owner avant exécution ». Faut-il une vue admin « fiches migrées à revoir » (filtres : consentement en attente, à compléter) pour le parcours 5 ?
23. **Écran « à la une » :** page dédiée ou section du tableau de bord ? Sélecteur limité aux productions publiées, avec recherche ? Vignette téléversée dans cet écran (parcours 5) ou dans le formulaire de production ? Que se passe-t-il quand une production choisie n'a pas de vignette (blocage, téléversement en ligne) ? Faut-il un aperçu de la bannière ?
24. **Retrait automatique (FR51) :** l'admin est-il prévenu (message, indication dans l'écran à la une, avertissement à la dépublication d'une production à la une) ?
25. **Suggestions :** afficher la raison (« même auteur », « même domaine ») ? Disposition à 4 cartes (grille, carrousel) et sur mobile ? Squelette de chargement ou apparition sans réserve d'espace (attention au CLS et à l'annonce aux lecteurs d'écran avec `aria-live`) ? Que faire en cas d'erreur ou de dépassement des 2 s ?
26. **Libellés anglais** des blocs, des boutons « Voir plus » et « Recherche avancée », du lien « Auteurs » et de « à compléter » (non fournis).
27. **Lien Google Scholar :** libellé, icône, ouverture dans un nouvel onglet (signalée pour l'accessibilité) ?
28. **Base de design :** le rapport de validation note que `ux-design-specification.md` (2026-04-03) décrit l'ancienne page d'accueil (puces de catégories, deux sections) et ne couvre ni bannière, ni auteurs, ni suggestions. La mémoire du topic (2026-11-16) le déclare obsolète : partir des pages actuelles (`inertia/`, shadcn, tokens CSS).

### Remarques UX du rapport de validation (2026-11-15)
- « La spécification UX (2026-04-03) décrit l'ancienne page d'accueil (puces de catégories, deux sections) et ne couvre ni bannière, ni auteurs, ni suggestions : révision UX nécessaire ». « Reste hors PRD : révision de la spécification UX (page d'accueil, bannière, pages auteurs, suggestions). »
- Problèmes corrigés depuis dans le PRD : consentement des fiches migrées (FR53/FR56), affiliation « à compléter » (FR52), vignette obligatoire pour une vidéo externe (FR50), critère « Découverte » aligné sur FR61, parcours 5 « moins d'une minute ».
- Suggestion facultative : sitemap XML et URL canoniques (productions, profils), utile pour la conception des URL des profils.
- Les FR44–FR61 et la NFR Accessibilité sont jugées « d'un très bon niveau de précision ».
