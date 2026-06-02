
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
