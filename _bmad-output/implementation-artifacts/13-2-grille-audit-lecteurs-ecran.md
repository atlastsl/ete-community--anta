# Grille d'audit manuel — lecteurs d'écran et clavier (Story 13.2)

Porte manuelle de la Story 13.2 (NFR16 « Audit manuel », D33, D36) : parcours 1 et 2 du PRD réalisés **entièrement
au clavier** puis **au lecteur d'écran**, avec **NVDA sous Windows** et **VoiceOver sous macOS**, interface en **FR** et
en **EN**. À exécuter par le PO ou un testeur désigné sur le staging, après déploiement de la branche de l'Epic 13.
L'agent de développement ne l'exécute pas : il a automatisé ce qui peut l'être (`tests/browser/keyboard.spec.ts`,
`tests/browser/a11y.spec.ts`) et corrigera les points bloquants relevés ici.

## Mode d'emploi

1. Remplir l'en-tête « Session » (une ligne par combinaison outil × langue).
2. Pour chaque étape, noter dans la colonne de la combinaison : **OK**, **KO-B** (bloquant), **KO-M** (majeur),
   **KO-m** (mineur) ou **NA**, et décrire tout KO dans « Constats » (n° d'étape, ce qui a été entendu / vu).
3. Langue de l'interface : bouton **FR | EN** de l'en-tête (la langue est conservée d'une visite à l'autre).
4. Ne pas utiliser la souris ni le pavé tactile pendant les parcours (sauf pour démarrer le lecteur d'écran).

Gravité :
- **Bloquant** : le parcours ne peut pas être terminé (piège au clavier, contrôle inatteignable ou sans nom, contenu
  non lu). À corriger avant la mise en production.
- **Majeur** : le parcours aboutit au prix d'un effort anormal (ordre de lecture confus, annonce trompeuse, focus perdu).
- **Mineur** : gêne ponctuelle (prononciation, verbosité, libellé perfectible).

## Session

| Combinaison | Date | Testeur | OS + version | Navigateur + version | Lecteur d'écran + version | URL testée |
|---|---|---|---|---|---|---|
| NVDA · FR | | | Windows | Firefox ou Chrome | NVDA | `<URL du staging>` |
| NVDA · EN | | | Windows | | NVDA | |
| VoiceOver · FR | | | macOS | Safari | VoiceOver | |
| VoiceOver · EN | | | macOS | Safari | VoiceOver | |

Pré-requis des données (staging) : bannière « À la une » à 3 productions ; blocs d'accueil remplis ; au moins un
auteur à profil public avec photo, affiliation et lien Google Scholar ; une production **PDF** de cet auteur avec
co-auteur public ; une production dont la langue est **différente** de l'interface (ex. une production en anglais
quand l'interface est en français) ; une vidéo hébergée, un audio et un EPUB pour l'étape « lecteurs ».

Raccourcis utiles :
- **NVDA** : `Insert` = touche NVDA ; `H` / `Maj+H` titre suivant / précédent ; `1`–`3` titre de niveau n ; `D` repère
  suivant ; `K` lien suivant ; `F` champ suivant ; `NVDA+F7` liste des éléments (titres, liens, repères) ;
  `NVDA+Espace` bascule mode navigation / formulaire ; `Échap` sort d'un lecteur intégré.
- **VoiceOver** : `VO` = `Ctrl+Option` ; `VO+U` rotor (titres, liens, repères, contrôles de formulaire) ;
  `VO+Cmd+H` titre suivant ; `VO+→` élément suivant ; `VO+Espace` activer ; `Tab` contrôle suivant (activer
  « Utiliser la navigation au clavier » dans Réglages Système → Clavier, et dans Safari → Réglages → Avancés
  « Appuyer sur Tab pour mettre en évidence chaque élément »).

## A. Contrôles transverses (chaque page visitée)

| # | Vérification | Résultat attendu | NVDA FR | NVDA EN | VO FR | VO EN |
|---|---|---|---|---|---|---|
| A1 | Premier `Tab` sur la page | « Aller au contenu principal » / « Skip to main content » apparaît, visible ; `Entrée` place la lecture au début du contenu | | | | |
| A2 | Focus visible | Contour vert de 2 px sur chaque élément atteint ; sur une carte de la bannière et une carte d'auteur, le contour entoure **toute la carte** | | | | |
| A3 | Liste des titres (`NVDA+F7` / rotor) | Un seul titre de niveau 1, sections en niveau 2, titres de cartes en niveau 3, aucun saut de niveau | | | | |
| A4 | Repères (`D` / rotor) | « bannière » (en-tête), « principal », « informations de contenu » (pied de page), navigations nommées (langue, fil d'Ariane, pied de page, pagination) | | | | |
| A5 | Langue de l'interface | Les libellés sont lus avec la voix de la langue de l'interface (pas d'accent français sur l'anglais et inversement) | | | | |
| A6 | Langue des contenus (3.1.2) | Le titre et le résumé d'une production d'une autre langue sont lus avec la voix de **sa** langue (cartes, bannière, détail, suggestions) | | | | |
| A7 | Bascule FR / EN au clavier | Les boutons « FR » et « EN » sont annoncés comme boutons, l'actif comme « actuel » ; après bascule, la page est relue dans la nouvelle langue sans rechargement | | | | |
| A8 | Aucun piège | `Tab` et `Maj+Tab` permettent toujours de sortir de chaque zone (lecteurs, listes déroulantes, panneau de filtres) | | | | |
| A9 | Zoom 200 % et 320 px de large | Contenu lisible sans défilement horizontal, focus toujours visible, aucun contrôle masqué | | | | |
| A10 | Contrastes perçus | Textes lisibles ; champs de recherche identifiables par leur bordure (D33 amendé : bordure 4,8:1) | | | | |

## B. Parcours 1 — Recherche par auteur au clavier (PRD parcours 1, flux 5)

| # | Action | Résultat attendu | NVDA FR | NVDA EN | VO FR | VO EN |
|---|---|---|---|---|---|---|
| B1 | Accueil : `Tab` jusqu'à « Recherche avancée » / « Advanced search », `Entrée` | Lien annoncé avec son nom ; arrivée sur le catalogue, titre de page lu | | | | |
| B2 | Atteindre le champ de recherche, saisir un terme connu, `Entrée` | Champ annoncé « Rechercher… », type recherche ; résultats chargés ; le **nombre de résultats est annoncé** | | | | |
| B3 | Atteindre le panneau « Filtres » (mobile : bouton « Filtres », annoncé replié / déplié) | Titre « Filtres » ; groupes annoncés comme éléments repliables (« réduit » / « développé ») | | | | |
| B4 | Déplier « Auteur » / « Author » (`Entrée` ou `Espace`) | Groupe annoncé « développé » ; seuls des auteurs à profil public, en « Prénom NOM » | | | | |
| B5 | Champ de recherche de facette : saisir une partie du nom | Champ annoncé avec son libellé ; la liste se réduit | | | | |
| B6 | `Tab` jusqu'à l'auteur, `Espace` (puis essayer `Entrée`) | Annoncé comme **bouton bascule** « non enfoncé » puis « enfoncé » ; nombre de résultats annoncé ; le focus reste sur la ligne (D-13.1-6 : confirmer que l'annonce « bouton bascule » est comprise) | | | | |
| B7 | Après 20 auteurs cochés (si testable) | Le texte d'aide « 20 auteurs au maximum » est lu depuis le champ de facette ; les lignes restantes sont annoncées « indisponibles » | | | | |
| B8 | Trier les résultats (« Trier par ») | Liste déroulante annoncée avec sa valeur ; flèches + `Entrée` choisissent ; `Échap` referme ; le focus reste sur la liste déroulante après le tri | | | | |
| B9 | Première carte : `Tab` sur le titre puis `Tab` | Titre lu (niveau 3 via `H`), puis **le nom de l'auteur** (lien souligné) ; compteurs lus « 12 vues », « 5 téléchargements » (pas seulement « 12 ») | | | | |
| B10 | `Entrée` sur le titre | Page de détail ; titre de niveau 1 = titre de la production ; fil d'Ariane « Accueil / Productions / titre » avec page courante | | | | |
| B11 | Lecteur PDF : `Tab` jusqu'au lecteur, le parcourir, en sortir | Cadre annoncé « Lecteur PDF : nom du fichier » ; défilement possible au clavier ; « Plein écran » activable, `Échap` en sort ; `Tab` / `Maj+Tab` ressortent du lecteur | | | | |
| B12 | `Tab` jusqu'à « Télécharger » / « Download », `Entrée` | Lien annoncé ; le fichier est téléchargé ; le compteur de téléchargements augmente | | | | |
| B13 | Profil depuis la carte (variante flux 5) : nom de l'auteur → profil → tri « Les plus consultées » | Profil atteint ; tri appliqué, focus conservé sur la liste déroulante | | | | |

## C. Parcours 2 — Découverte en cascade (PRD parcours 2, flux 1)

| # | Action | Résultat attendu | NVDA FR | NVDA EN | VO FR | VO EN |
|---|---|---|---|---|---|---|
| C1 | Accueil : titre de niveau 1 (accroche), puis région « Productions à la une » / « Featured productions » | Région nommée annoncée ; 3 cartes ; vignettes **non** lues (images décoratives) | | | | |
| C2 | Carte de la bannière : `Tab` sur le titre puis `Tab` | Titre (lien), contour autour de la carte ; puis auteurs liés ; compteurs « Vues 12 », « Téléchargements 5 » | | | | |
| C3 | Blocs « Récemment publiées », « Les plus consultées », « Les plus téléchargées » | Titres de niveau 2 ; sous-titre « sur les 12 derniers mois » lu ; « Voir plus » annoncé avec son nom complet (« Voir plus : Les plus consultées ») | | | | |
| C4 | Bloc « Auteurs les plus consultés » : `Tab` sur une carte, `Entrée` | Nom annoncé (niveau 3), contour autour de la carte ; profil ouvert (2 actions depuis l'accueil) | | | | |
| C5 | Profil : photo, affiliations, Google Scholar | Photo annoncée « Photo de Prénom NOM » ; Google Scholar annoncé « (nouvel onglet) » ; statistiques lues avec leurs libellés | | | | |
| C6 | « Productions » du profil (niveau 2) : ouvrir une production | Liste des cartes ; le nom de l'auteur du profil n'est pas un lien sur ses propres cartes | | | | |
| C7 | Détail : lecteur (PDF / vidéo / audio / EPUB selon la production) | Vidéo et audio : lecture, pause, volume, position au clavier ; EPUB : « Ouvrir le document » ; lecteur intégré externe (`iframe`) atteignable et quittable | | | | |
| C8 | Suggestions en bas de page | Pendant le chargement, le statut masqué (`role=status`) « Chargement des productions similaires… » peut être lu (une fois, sans répétition) ; les squelettes ne sont jamais lus ; à l'arrivée, **une seule** annonce polie « 4 productions similaires » ; le focus ne bouge jamais | | | | |
| C9 | Ouvrir une suggestion, puis un co-auteur dans sa byline | Nouvelle page de détail puis second profil, sans repasser par la recherche | | | | |
| C10 | Bascule en EN / FR depuis l'en-tête | Libellés traduits (« Most viewed authors », « See more ») ; `<html lang>` suit (voix de la langue) ; langue conservée à la visite suivante | | | | |
| C11 | Pied de page « Auteurs » → liste : filtre institution, tri « Nom (A → Z) », page 2 | Champs et listes annoncés avec leurs libellés visibles ; nombre d'auteurs annoncé après filtre ; pagination « page 2 » / « page actuelle » ; focus conservé après filtre ou tri | | | | |
| C12 | Page 404 (URL inconnue) | Titre de niveau 1 traduit ; liens Accueil / Auteurs | | | | |

## Constats

| # | Étape | Combinaison | Gravité | Constat (entendu / vu) | Correctif (story / commit) | Statut |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

## Points résiduels acceptés par le PO

| # | Constat | Justification | Date d'acceptation |
|---|---|---|---|
| 1 | | | |

## Rapport

- Date(s) de l'audit :
- Outils et versions :
- Synthèse (bloquants trouvés / corrigés, majeurs, mineurs) :
- Décision : parcours 1 et 2 conformes au plancher NFR16 — oui / non
