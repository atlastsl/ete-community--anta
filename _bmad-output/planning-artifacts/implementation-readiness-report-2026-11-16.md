---
stepsCompleted:
  [
    step-01-document-discovery,
    step-02-prd-analysis,
    step-03-fr-coverage,
    step-04-ux-alignment,
    step-05-epic-quality,
    step-06-final-assessment,
  ]
status: complete
completedAt: '2026-11-16'
scope: 'Phase 2 — Growth (Epics 9–13)'
mode: 'non interactif (décisions prises par l agent, points produit listés pour Aurélien)'
documentsAssessed:
  prd: '_bmad-output/planning-artifacts/prd.md'
  architecture: '_bmad-output/planning-artifacts/architecture.md (section « Phase 2 — Growth (2026-11-16) »)'
  epics: '_bmad-output/planning-artifacts/epics.md (Epics 9–13)'
  ux: '_bmad-output/planning-artifacts/ux-designs/ux-anta-2026-11-16/ (DESIGN.md, EXPERIENCE.md, .decision-log.md, mockups/)'
  code: 'branche development @ c5cde51 (app/, database/, inertia/, config/, Dockerfile, .github/workflows/ci.yml)'
---

# Implementation Readiness Assessment Report — Phase 2

**Date :** 2026-11-16
**Projet :** anta
**Périmètre :** Phase 2 (Growth) : FR5, FR9, FR17, FR21, FR36 modifiées, FR44–FR61, NFR Accessibilité et NFR chiffrées ; Epics 9 à 13 (33 stories). Le MVP (Epics 1–7) et l'Epic 8 sont livrés et hors périmètre.

## Inventaire des Documents

| Document        | Fichier                                                                 | Statut |
| --------------- | ----------------------------------------------------------------------- | ------ |
| PRD             | `prd.md` (amendé 2026-11-15 et 2026-11-16)                              | ✅ Présent |
| Architecture    | `architecture.md`, section « Phase 2 — Growth (2026-11-16) » (P2.1–P2.10) | ✅ Présent |
| Epics & Stories | `epics.md`, Epics 9–13                                                  | ✅ Présent |
| UX Design       | `ux-designs/ux-anta-2026-11-16/` : `DESIGN.md`, `EXPERIENCE.md` (status final), `.decision-log.md` (D1–D36), 7 maquettes + index | ✅ Présent |
| UX obsolète     | `ux-design-specification.md`, `ux-design-directions.html`               | ⏭️ Ignorés (décision du 2026-11-16) |

Aucun doublon entier/fragmenté. Les fichiers sont tous des documents uniques.

## Analyse du PRD

### Exigences Fonctionnelles Phase 2 (18 nouvelles + 5 modifiées)

**Modifiées :** FR5 (filtre auteur parmi les auteurs enregistrés), FR9 (ordre de l'accueil : recherche + « Recherche avancée », bannière, 4 blocs), FR17 (auteurs choisis dans le référentiel), FR21 (au moins un auteur enregistré pour publier), FR36 (meta des profils d'auteurs).

**Page d'accueil (FR44–FR46)**
FR44 : bouton « Recherche avancée » à côté de la barre de recherche
FR45 : 4 blocs titrés de 3 éléments + « Voir plus » (récentes, consultées, téléchargées, auteurs)
FR46 : classements sur 365 j glissants, éléments à 0 exclus, départage par publication Anta la plus récente, totaux affichés, bloc vide absent

**Productions à la une (FR47–FR51)**
FR47 : 0 à 3 productions publiées, ordonnées, sans échéance
FR48 : bannière sans titre, dispositions 1 / 2 / 3, empilée sur mobile
FR49 : contenu strict (vignette, titre, auteurs, totaux)
FR50 (amendé 2026-11-18, D37) : vignette réservée aux productions à la une, affichée seulement dans la bannière ; obligatoire pour la une sauf vidéo hébergée (image extraite)
FR51 : retrait automatique à la dépublication / suppression

**Auteurs — panel (FR52–FR56)**
FR52 : fiche auteur (noms, affiliations ≥ 1 sauf fiche migrée « à compléter », Scholar, photo)
FR53 : profil public seulement après confirmation du consentement, retrait possible, journalisé
FR54 : sélection ordonnée depuis le référentiel, création sans quitter le formulaire
FR55 : suppression seulement sans production liée
FR56 : conversion des noms existants par table validée par le product owner, ordre conservé, fiches non publiques

**Auteurs — public (FR57–FR60)**
FR57 : liste paginée des auteurs publics avec ≥ 1 production publiée, tris, filtres, recherche
FR58 : profil (photo, affiliations, Scholar, totaux, productions paginées et triables)
FR59 : noms d'auteurs publics liés vers leur profil
FR60 : lien « Auteurs » dans le pied de page

**Suggestions (FR61)** : jusqu'à 4 productions similaires, classement auteur > tag > sous-domaine > domaine, puis nombre de critères, puis date.

### Exigences Non-Fonctionnelles Phase 2

- **Accessibilité** : WCAG 2.1 AA du site public (pages listées, FR/EN), axe à 0 violation A/AA à chaque livraison, audit manuel clavier + NVDA + VoiceOver, contrastes chiffrés, textes alternatifs.
- **Performance** : LCP < 3 s (Lighthouse mobile 4G) y compris accueil complet, liste et profils ; recherche p95 < 1 s à 50 visiteurs ; suggestions non bloquantes, < 2 s.
- **Stockage** : images JPEG/PNG/WebP ≤ 5 Mo.
- **Sécurité** : logs ≥ 12 mois (nouveaux événements inclus).

(Les epics numérotent ces NFR NFR16–NFR20 ; le PRD ne les numérote pas. Correspondance explicite dans `epics.md`, acceptable.)

### Évaluation de Complétude du PRD

Le PRD Phase 2 est **complet et testable** : critères de succès mesurables, parcours 2, 3 et 5 tracés vers les FR, règles de classement chiffrées (FR46, FR61), consentement et migration explicités, hors périmètre posé. Une seule ambiguïté relevée et corrigée (FR5, voir Mineur 1).

## Validation de Couverture des Epics

### Matrice de Couverture FR (Phase 2)

| FR   | Exigence (résumé)                                  | Epic / Story                            | Statut  |
| ---- | -------------------------------------------------- | --------------------------------------- | ------- |
| FR5  | Filtre auteur (référentiel, profils publics)       | Epic 10 / 10.6                          | Couvert |
| FR9  | Ordre de l'accueil                                 | Epic 11 / 11.6 + Epic 12 / 12.1–12.3    | Couvert |
| FR17 | Auteurs choisis dans le référentiel                | Epic 9 / 9.7, 9.8                       | Couvert |
| FR21 | Au moins un auteur enregistré pour publier         | Epic 9 / 9.7                            | Couvert |
| FR36 | Meta des profils, og:image des profils             | 10.7 (+ 13.3 facultative)               | Couvert |
| FR44 | Bouton « Recherche avancée » (+ pied de page)      | 12.1 (+ 10.5)                           | Couvert |
| FR45 | 4 blocs de 3 + « Voir plus »                       | 12.2, 12.3                              | Couvert |
| FR46 | Fenêtre 365 j, exclusion des 0, départage, totaux  | 12.2, 12.3                              | Couvert |
| FR47 | Sélection 0–3 ordonnée                             | 11.4                                    | Couvert |
| FR48 | Bannière, dispositions                             | 11.6                                    | Couvert |
| FR49 | Contenu strict de la carte à la une                | 11.6                                    | Couvert |
| FR50 | Vignette de la une, règle, image extraite          | 11.1, 11.2, 11.3, 11.4, 11.6            | Couvert |
| FR51 | Retrait automatique                                | 11.5                                    | Couvert |
| FR52 | Fiche auteur, « à compléter »                      | 9.1, 9.2, 9.3                           | Couvert |
| FR53 | Consentement : confirmation, retrait, effets       | 9.4 + 10.2–10.6 + 12.3                  | Couvert |
| FR54 | Sélection ordonnée, création en fenêtre            | 9.7, 9.8                                | Couvert |
| FR55 | Suppression conditionnelle                         | 9.2                                     | Couvert |
| FR56 | Conversion validée, appliquée, vérifiée            | 9.5, 9.6                                | Couvert |
| FR57 | Liste publique des auteurs                         | 10.5                                    | Couvert |
| FR58 | Profil public                                      | 10.3                                    | Couvert |
| FR59 | Noms liés                                          | 10.4 (+ 11.6)                           | Couvert |
| FR60 | Lien « Auteurs » du pied de page                   | 10.5                                    | Couvert |
| FR61 | Suggestions                                        | 12.4                                    | Couvert |

NFR : Accessibilité → Epic 13 + critères intégrés (10.x, 11.2, 11.6, 12.x) ; LCP → 11.2, 11.6, 12.2, 10.8, 12.5, 13.4 ; suggestions → 12.4, 12.5 ; images ≤ 5 Mo → 9.3, 11.1 ; charge → 12.5 ; logs → 9.1, 9.4, 11.1, 11.4, 11.5.

### Exigences Manquantes

Aucune.

### Statistiques de Couverture

- **FRs Phase 2 (nouvelles + modifiées) :** 23
- **Couvertes :** 23
- **Taux de couverture :** 100 % (critères de succès Phase 2 : tous rattachés à une story ou à la recette)

## Alignement UX

### Statut du Document UX

Trouvé : spines `DESIGN.md` et `EXPERIENCE.md` en `status: final`, 36 décisions validées (D1–D36), 0 `[ASSUMPTION]` restante, 7 maquettes (les spines priment, D29). Les 5 questions ouvertes d'`EXPERIENCE.md` (journal, extraction vidéo, tailles de vignettes, calcul des classements, recherche du combobox) sont toutes tranchées en architecture (P2.10, « Réponses aux questions ouvertes »).

### Alignement UX <-> PRD

| Aspect UX                                                     | Couverture PRD          | Statut |
| ------------------------------------------------------------- | ----------------------- | ------ |
| D1 / D37 vignette réservée à la une (bannière seulement)       | FR50 (amendé 2026-11-18) | Aligné |
| D5 exclusion des 0, départage, totaux                         | FR46 (amendé 2026-11-16) | Aligné |
| D16 / D17 consentement facultatif, retrait                    | FR53 (amendé 2026-11-16) | Aligné |
| D11 profil sans production publiée → 404                       | FR57–FR58 (précision UX) | Conforme |
| D12 filtre auteur limité aux profils publics                  | FR5                      | ⚠️ → corrigé (Mineur 1) |
| D20 / D26 page « À la une », vignette sur place               | FR47, FR50               | Aligné |
| D22 suggestions masquées si > 2 s                             | FR61, NFR Performance    | Aligné |
| D28 `sort=date` (remplace `recent` de D7)                      | FR45                     | Aligné (maquettes : aucune occurrence de `sort=recent`, vérifié) |
| Flux 1–5 (Amara, Fatou ×3, Kofi)                              | Parcours 1, 2, 3, 5      | Aligné |

### Alignement UX <-> Architecture

| Composant / règle UX                                | Support architecture                                    | Statut |
| --------------------------------------------------- | ------------------------------------------------------- | ------ |
| Combobox accents/casse, institutions dédoublonnées  | P2.1 `normalizeKey` + `pg_trgm` (extension et index trigram déjà présents : `1775918742000_enable_pg_trgm_extension.ts`) | Aligné |
| Avatar dans les options du combobox (DESIGN.md → AuthorCombobox, SelectedAuthorList) | P2.6 `search` sans URL de photo | ⚠️ → corrigé (Mineur 4) |
| Image extraite à t = 1 s                            | P2.5 `ffmpeg` (présent sur le VPS de dev : `/usr/bin/ffmpeg`) | Aligné, précision (Mineur 3) |
| Vignettes 16:9 de la bannière, `srcset`             | P2.5 `sharp`, `/media/*`                                 | Aligné |
| Classements 365 j et LCP                            | P2.3 SQL + cache mémoire, colonnes `recorded_at` / `downloaded_at` confirmées dans les migrations | Aligné |
| Fenêtre « Créer un auteur » sans navigation         | P2-14 `fetch` + `X-XSRF-TOKEN` (`enableXsrfCookie: true` confirmé, `config/shield.ts:46`) | Aligné |
| Journal des nouveaux événements                     | P2.6 (4 types, `metadata`) ; filtre `Object.values(ActionType)` confirmé (`activity_logs_controller.ts:7`) | Aligné |

### Avertissements

Aucun écart bloquant. Les spines priment sur les maquettes.

## Faisabilité vérifiée dans le code

Contrôles empiriques sur `development` @ `c5cde51` et sur le Postgres **local** (`anta-test-db`, jamais la base partagée) :

- Migrations : dernière existante `1775918744000_add_slug_to_productions_table.ts` → les numéros `1775918745000`–`1775918751000` sont libres. Ils ne seront pas exécutés dans l'ordre des stories (9.1 crée `…50000` avant `…47000` en 9.2), ce que le runner Lucid accepte : `runUp()` exécute tout fichier absent de la table des migrations, sans contrôle d'ordre (`node_modules/@adonisjs/lucid/build/src/migration/runner.js:482-502`). Aucune dépendance entre ces migrations.
- `commands/` est bien scanné automatiquement (`adonisrc.ts:24-25`) ; la suite `browser` est déclarée (`adonisrc.ts:103-104`, `tests/bootstrap.ts:31`) ; `playwright` est installé ; `drive.fake('r2')` est configuré (`config/drive.ts:8-11`).
- Le trigger `productions_search_vector_trigger` est `BEFORE INSERT OR UPDATE` et indexe `NEW.authors::text` (`1775918733547_create_productions_table.ts:64,77-79`) : la stratégie expand/contract de P2-02 tient.
- `admin_activity_logs.resource_id` est nullable (`…37632_create_admin_activity_logs_table.ts`) : `featured_update` sans `resourceId` est possible.
- Tris `relevance|date|views|downloads` déjà présents (`search_service.ts:21`), `date` = `anta_published_at` ↓ : D28 réutilise l'existant.

## Revue Qualité des Epics

### Checklist par Epic

| Epic    | Valeur utilisateur | Indépendant           | Stories bien dimensionnées | Pas de dépendance future | ACs testables | Traçabilité FR |
| ------- | ------------------ | --------------------- | -------------------------- | ------------------------ | ------------- | -------------- |
| Epic 9  | Oui (admins, PO)   | Oui (MVP)             | ⚠️ 9.7 volumineuse          | Oui                      | Oui           | FR17, FR21, FR52–FR56 |
| Epic 10 | Oui                | Oui (Epic 9)          | Oui                        | Oui                      | Oui           | FR5, FR36, FR53, FR57–FR60, FR44 |
| Epic 11 | Oui                | Oui (Epics 9–10)      | ⚠️ 11.4 volumineuse         | Oui                      | Oui           | FR36, FR47–FR51 |
| Epic 12 | Oui                | Oui (Epics 9–11)      | Oui                        | Oui                      | Oui           | FR9, FR44–FR46, FR61 |
| Epic 13 | Oui                | Oui (Epics 10–12)     | Oui                        | Oui                      | Oui (13.2 en partie manuel) | NFR Accessibilité |

Dépendances contrôlées story par story : toutes les références croisées pointent vers une story antérieure (ex. 11.1 → `ImageService` de 9.3 ; 12.2 → index de 10.5 ; 12.3 → `AuthorCard` de 10.5) ou annoncent une extension ultérieure sans en dépendre (« ajouté en Story 10.4 », « réutilisé par 11.2 »). Aucune dépendance circulaire. Tables créées au moment où elles servent (auteurs en 9.1, pivot en 9.2, colonnes d'image en 11.1, une en 11.4, index en 10.5).

**Brownfield / base partagée :** migrations additives, `down()` jamais exécutés, conversion hors migration (commandes idempotentes, `--dry-run`, `verify`), portes manuelles explicites (9.5, 9.6, 9.7, 11.3), colonne `productions.authors` conservée (rollback d'image sûr). Conforme aux contraintes de `CLAUDE.local.md`.

### Violations Critiques

Aucune.

### Problèmes Majeurs (3, tous corrigés)

**Majeur 1 — Risque d'effacement des noms d'auteurs à la bascule (Story 9.7, P2.1)**

Le contrôleur écrit aujourd'hui la colonne depuis la requête :
- `app/controllers/admin/productions_controller.ts:175` : `production.authors = data.authors ?? []`
- `app/controllers/admin/productions_controller.ts:268` : `authors: data.authors ?? [],`

Or l'architecture reportait au « contract » le retrait du « validateur `authors: string[]` » (P2.1), et la Story 9.7 disait à la fois « `ChipInput` est remplacé pour les auteurs » (AC) et « le retrait … du `ChipInput` auteurs … est hors Phase 2 » (notes). Si ces affectations restent, un formulaire qui n'envoie plus `authors` écrit `[]`. Sur une production non convertie (0 ligne pivot, cas que 9.7 protège : « `sync` ne réécrit pas la colonne dénormalisée »), les noms seraient effacés, et `authors:verify` tomberait sous 100 %.
- **Correction appliquée :** 9.7 gagne l'AC « les actions `store` et `update` … n'écrivent plus jamais la colonne `productions.authors` depuis la requête … seul `ProductionAuthorService` l'écrit », plus un test. P2.1 précise que le code « texte libre » est débranché de l'écriture dès la bascule (le contract ne retire plus que du code mort).

**Majeur 2 — Le recompactage FR51 échouerait sur la clé primaire (Story 11.5, P2.6)**

`featured_productions.position` est une clé primaire (P2.1) et le recompactage après retrait n'était pas spécifié. Un `UPDATE … SET position = position - 1` échoue selon l'ordre physique des lignes, vérifié sur le Postgres local :
```
DELETE FROM fp WHERE position = 1;
UPDATE fp SET position = position - 1 WHERE position > 1;
ERROR:  duplicate key value violates unique constraint "fp_pkey"
DETAIL:  Key ("position")=(2) already exists.
```
- **Correction appliquée :** 11.5 impose la réécriture `DELETE` + `INSERT` 1..n (comme `save`). P2.1 ajoute une règle commune aux trois tables ordonnées (`production_authors`, `author_affiliations`, `featured_productions`). Précision au passage : `ProductionService.unpublish(production)` et `.delete(production)` ne reçoivent ni admin ni transaction (`production_service.ts:147,157`), et `ActivityLogService.log` n'accepte pas de transaction et absorbe ses erreurs (`activity_log_service.ts:13-23`). 11.5 et P2.6 ajoutent donc `adminId` à ces deux méthodes, ouvrent la transaction et écrivent le journal après le commit.

**Majeur 3 — Pas de jeu de données local réaliste pour les Epics 10–12 (Stories 9.7, 12.5, P2.8)**

Le seeder de démo, seul jeu de données local, n'écrit que la colonne jsonb (`production_demo_seeder.ts:113`, `authors: JSON.stringify(authors)`) et date toutes les stats à `now()` (lignes 168-176 : `{ production_id, ip_hash }` sans `recorded_at`). Après la bascule, la base locale n'aurait donc ni fiche ni pivot (profils, liste des auteurs, bloc auteurs, suggestions par auteur vides), et la fenêtre de 365 j ne serait jamais exercée. L'AC de 12.5 (« `EXPLAIN ANALYZE` … sur la base locale remplie, seeder démo 300 productions ») ne pouvait pas mesurer les requêtes P2.3/P2.4 de façon réaliste.
- **Correction appliquée :** 9.7 ajoute l'extension du seeder (fiches fictives `seed-demo:`, affiliations, une partie consentie, `ProductionAuthorService.sync`, purge idempotente, base locale seulement). 12.5 répartit les stats de démo sur 540 jours. P2.8 est aligné.

### Préoccupations Mineures

Corrigées (clarifications sans effet sur le produit) :

1. **FR5 ↔ D12** : le PRD disait « parmi les auteurs enregistrés (FR52) » alors que D12 (validée par Aurélien) et la Story 10.6 limitent la facette aux profils publics. → PRD et inventaire des epics précisés : « à profil public (FR52, FR53) ».
2. **`refreshDenormalizedNames` sur pivot vide** : la colonne est `NOT NULL` (`authors … notNullable().defaultTo('[]')`, migration productions ligne 11), et `jsonb_agg` sur 0 ligne renvoie NULL. Vérifié en local : `ERROR: null value in column "authors" … violates not-null constraint`. Le cas est atteignable (brouillon converti dont on retire tous les auteurs, autorisé par 9.7). → `COALESCE(…, '[]'::jsonb)` ajouté (9.6, P2.1).
3. **Poster vidéo : identifiant inconnu au moment de l'extraction** : la clé `posters/<fileId>/…` est calculée « avant `FileStorageService.upload` », mais la ligne `production_files` n'est créée qu'après l'envoi (`files_controller.ts:48-57`). → 11.3 et P2.5 : extraction en PNG temporaire avant l'envoi ; variantes et `poster_key` écrits après la création de la ligne.
4. **Avatar du combobox** : DESIGN.md montre un avatar dans les options d'`AuthorCombobox` et dans `SelectedAuthorList`, mais le JSON de `search` ne le portait pas. → `photoUrl` (URL signée `w128` ou `null`) ajouté (9.7, P2.6).
5. **Conversion : doublon dans une même production** : si deux noms fusionnés par `author_key` figurent dans la même production, `ON CONFLICT DO NOTHING` sur la PK `(production_id, author_id)` laisse un trou de position que `verify` signalerait. → 9.6 et P2.2 : un seul lien, à la première occurrence, positions recompactées 1..n, noms comptés comme rattachés.
6. **Alias d'import** : `app/helpers/` est nouveau et `#helpers/*` est absent des `imports` de `package.json`. → ajouté aux notes de 9.1.

Non corrigées (acceptées) :

7. Stories de tests dédiées (9.9, 10.8, 11.7, 12.5, 13.4) sans valeur utilisateur propre : convention du MVP, acceptée.
8. Stories 9.7 et 11.4 volumineuses (endpoint + 2 composants ARIA + service + porte pour 9.7). Elles restent cohérentes et livrables d'un bloc. Les découper (9.7a recherche + combobox / 9.7b sync + publication) est possible si la revue de code l'exige.
9. Epic 11 est séquencée après l'Epic 10 (réutilisation de `/media` et `AuthorByline`), alors que P2.9 déclare les vignettes « parallélisables avec 2–5 ». Ordre plus strict, sans risque.
10. P2.2 annonce pour la découpe prénom / nom la « même règle que le combobox ». La conversion ajoute pourtant la règle « jeton en capitales = nom », que le combobox (D36) n'applique pas. Simple formulation.
11. Les photos d'auteurs restent en cache navigateur jusqu'à 1 h après un retrait du consentement (`max-age=3600`), les suggestions 5 min (`max-age=300`) : compromis assumés en P2.5 / P2.4.
12. La note de l'Epic 2 (« 2FA … réintroduction possible en Phase 2 ») est périmée : la Phase 2 ne réintroduit pas le 2FA (FR31 retirée).

### Vérifications Spéciales

- **Projet brownfield** : points d'intégration explicites (formulaire de production, `home_controller.ts`, `productions_controller.ts`, `files_controller.ts`, `ProductionService`, journal, layout public), compatibilité de l'existant (`authorNames`, trigger inchangé, facette jsonb conservée jusqu'au contract). ✅
- **Migration de données** : hors migrations, idempotente, porte de validation par le PO, `verify` à 100 % avant et après le déploiement de la bascule. ✅
- **Template de démarrage** : sans objet (brownfield).

## Résumé et Recommandations

### Statut Global de Maturité

**🟢 PRÊT POUR L'IMPLÉMENTATION** (après corrections) : l'Epic 9 peut démarrer. Aucun point bloquant ; les 3 problèmes majeurs et 6 mineurs ont été corrigés dans `epics.md`, `architecture.md` et `prd.md` (entrées `editHistory` du 2026-11-16).

---

### Corrections appliquées

| # | Document | Section | Correction |
|---|---|---|---|
| M1 | epics.md, architecture.md | 9.7, P2.1 | Colonne `productions.authors` plus jamais écrite depuis la requête dès la bascule |
| M2 | epics.md, architecture.md | 11.5, P2.1, P2.6 | Recompactage `DELETE` + `INSERT` ; `adminId` + transaction dans `unpublish`/`delete` ; journal après le commit |
| M3 | epics.md, architecture.md | 9.7, 12.5, P2.8 | Seeder de démo avec fiches, affiliations, pivot ; stats datées sur 540 j |
| m1 | prd.md, epics.md | FR5 | « à profil public (FR52, FR53) », aligné sur D12 |
| m2 | epics.md, architecture.md | 9.6, P2.1 | `COALESCE(…, '[]'::jsonb)` |
| m3 | epics.md, architecture.md | 11.3, P2.5 | Poster écrit après création de la ligne `production_files` |
| m4 | epics.md, architecture.md | 9.7, P2.6 | `photoUrl` dans `admin.authors.search` |
| m5 | epics.md, architecture.md | 9.6, P2.2 | Doublon dans une même production |
| m6 | epics.md | 9.1 | Alias `#helpers/*` |

### Points nécessitant Aurélien (décisions ou actions produit)

1. **Validation du CSV de conversion (9.5 → 9.6), sur le chemin critique.** La bascule (9.7), et donc tout ce qui suit sur le staging, n'y est déployée qu'après `apply` + `verify` à 100 %. Recommandation : exécuter `authors:propose` dès que 9.5 est mergée, pour que la validation se fasse pendant le développement de 9.7–9.8.
2. **Données `SEED_DEMO` dans la base partagée ?** La mémoire du projet mentionne le seeder de démo (`institution='SEED_DEMO'`). Si ces 300 productions existent sur Supabase, leurs noms fictifs entreront dans le CSV et leurs stats faussent les classements du staging. À décider : purge préalable ciblée (`institution = 'SEED_DEMO'`, le seeder lui-même recrée les données après sa purge) ou exclusion explicite de ces productions de la conversion.
3. **Recueil des consentements.** Toutes les fiches migrées sont non publiques. Tant qu'aucun consentement n'est confirmé, la liste des auteurs, les profils, les noms liés et le bloc « Auteurs les plus consultés » restent vides sur le staging : la recette des Epics 10 et 12 en dépend.
4. **Texte de la politique de confidentialité (10.1)** à valider avant merge.
5. **Audit manuel (13.2)** : désigner le testeur et disposer de NVDA (Windows) et de VoiceOver (macOS).
6. **Accords ponctuels** déjà prévus par les stories : exécution réelle de `thumbnails:extract-video-frames` (11.3), test de charge sur le staging partagé (12.5).
7. **Production (8.6 en attente)** : préciser si la production aura sa propre base ou partira d'une copie. La séquence `apply`/`verify` de la release « bascule » en dépend.

### Points Forts

- **Couverture FR Phase 2 : 23/23 (100 %)**, NFR et décisions UX D1–D36 tracées story par story.
- **Architecture ancrée dans le code** : conventions réelles (`snake_case`, `recorded_at`, `subdomain` jsonb), migrations additives, cohabitation des images grâce à la dénormalisation.
- **Portes manuelles explicites** sur toute écriture en base partagée ou dans R2.
- **33 stories en Given/When/Then** avec tests nommés (specs, cas limites, lecture de source pour TS6305).
- **Accessibilité outillée** : suite `browser` + axe bloquante en CI, critères a11y intégrés aux stories publiques.

### Points à Surveiller (non bloquants)

- Taille des Stories 9.7 et 11.4 (découpage possible à la création de la story).
- Ajout de `ffmpeg` et de Chromium Playwright à `ci.yml` : durée du job `test`, qui sert aussi de porte au déploiement du staging.
- Formulation P2.2 / D36 sur la découpe prénom / nom ; note 2FA périmée de l'Epic 2.

### Recommandation Finale

Lancer `bmad-sprint-planning` pour intégrer les Epics 9–13, puis `bmad-create-story` sur la **Story 9.1**. Traiter en parallèle les points Aurélien 1 et 2 (CSV et données de démo partagées), qui conditionnent le passage de la bascule en staging.

---

**Rapport généré le :** 2026-11-16
**Documents évalués :** prd.md · architecture.md (Phase 2) · ux-designs/ux-anta-2026-11-16/ · epics.md (Epics 9–13) · code `development` @ c5cde51
**Problèmes identifiés :** 0 critique · 3 majeurs (corrigés) · 12 mineurs (6 corrigés, 6 acceptés)
**Problèmes bloquants :** 0

## Addendum 2026-11-18 — décision D37

Correction d'Aurélien : seules les productions à la une ont une vignette. D37 amende D1 et D2 ; FR50, l'architecture (P2.5, P2-17) et les stories 11.1 à 11.4, 11.7, 12.2, 12.4, 13.2 et 13.4 ont été alignés, ainsi que les maquettes `home.html`, `author-profile.html` et `production-detail-suggestions.html`. La story 11.2 est recentrée sur la diffusion des images de la bannière (`/media/thumbnails`) ; plus d'`og:image` de production. Toujours 33 stories, couverture inchangée hors FR36 (désormais 10.7 seule). Statut : 🟢 maintenu.
