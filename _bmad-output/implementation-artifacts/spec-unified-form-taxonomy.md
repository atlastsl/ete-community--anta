---
title: 'Formulaire production unifié + taxonomies prédéfinies'
type: 'feature'
created: '2026-06-12'
status: 'done'
route: 'plan-code-review'
context:
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'enregistrement admin d'une production force deux pages (Create sans fichiers → Edit pour attacher), et les champs catégorie/domaine/sous-domaine acceptent du texte libre, ce qui fragmente les filtres publics et l'UX.

**Approach:** Unifier le formulaire Create en une seule page avec files/links en file d'attente client, puis enregistrer (brouillon) ou publier en chaîne. Remplacer catégorie/domaine par des `<Select>` et sous-domaine par multi-select contraint, clés stockées en BD et libellés i18n ; migration des valeurs existantes.

## Boundaries & Constraints

**Always:** Clés snake_case en BD ; libellés via i18n (`taxonomy.*`) ; sous-domaine multi-valeur filtré par domaine choisi ; règles FR21 inchangées (complétude + attachement pour publier) ; tests unitaires/functional mis à jour.

**Ask First:** Extension des listes de taxonomie après livraison ; bouton partager (objectif 3, différé).

**Never:** Texte libre pour catégorie/domaine/sous-domaine ; nouvelle page intermédiaire après Create ; modification du statut via PUT update (FR22).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CREATE_SAVE | Create, métadonnées + fichiers/liens en attente, Enregistrer | POST create → upload attente → redirect Edit | Flash erreur si upload échoue après create |
| CREATE_PUBLISH | Create, formulaire complet + attachement OK, Publier | create → upload → POST publish → redirect Edit publié | publish.incomplete si échec validation serveur |
| TAXONOMY_INVALID | category/domain hors enum ou subdomain hors liste domaine | 422 validation | Messages VineJS |
| DOMAIN_CHANGE | domaine changé, subdomains invalides pour nouveau domaine | subdomains filtrés/vidés côté client | — |
| MIGRATION | Valeurs FR legacy en BD | UPDATE vers clés ; log `[taxonomy-migration] unmapped:` | Valeurs non mappées → NULL (category/domain) ou retirées (subdomain) |

</frozen-after-approval>

## Code Map

- `app/constants/production_taxonomy.ts` — clés catégories, domaines, sous-domaines par domaine, table de migration FR→clé
- `database/migrations/1775918745000_convert_production_taxonomy_to_keys.ts` — conversion données existantes
- `app/validators/admin/production_validator.ts` — enum + validation subdomain/domaine
- `app/controllers/admin/productions_controller.ts` — filterOptions depuis constantes ; store→edit redirect
- `inertia/lib/taxonomy.ts` — miroir client + helpers label i18n
- `inertia/lib/production_submit.ts` — chaîne upload/publish post-create
- `inertia/components/admin/ProductionForm.tsx` — Select taxonomie, files/links sans productionId
- `inertia/components/admin/FileUploader.tsx` — mode pending
- `inertia/components/admin/LinkManager.tsx` — mode pending
- `inertia/pages/admin/Productions/Create.tsx` — chaîne save/publish
- `inertia/locales/admin/fr.json` + `en.json` — clés taxonomy.*
- `inertia/locales/public/fr.json` + `en.json` — affichage public
- `inertia/pages/production.tsx`, `ProductionCard.tsx` — libellés traduits
- `database/seeders/production_demo_seeder.ts` — clés taxonomie

## Tasks & Acceptance

**Execution:**
- [x] `app/constants/production_taxonomy.ts` -- définir catégories (11), domaines (6), sous-domaines par domaine, map migration
- [x] `database/migrations/1775918745000_convert_production_taxonomy_to_keys.ts` -- convertir productions existantes
- [x] `inertia/lib/taxonomy.ts` -- exporter constantes + helpers label i18n
- [x] `app/validators/admin/production_validator.ts` -- vine.enum category/domain ; assertProductionTaxonomy
- [x] `inertia/locales/admin/fr.json` + `en.json` -- labels taxonomy
- [x] `inertia/locales/public/fr.json` + `en.json` -- labels taxonomy
- [x] `inertia/components/admin/ChipInput.tsx` -- mode allowedValues contraint
- [x] `inertia/components/admin/ProductionForm.tsx` -- Select + section files toujours visible
- [x] `inertia/components/admin/FileUploader.tsx` -- props pendingFiles
- [x] `inertia/components/admin/LinkManager.tsx` -- props pendingLinks
- [x] `inertia/pages/admin/Productions/Create.tsx` -- chaîne save/publish
- [x] `inertia/components/admin/ProductionFormActions.tsx` -- onPublishCreate
- [x] `app/controllers/admin/productions_controller.ts` -- filterOptions constantes ; store→edit redirect
- [x] `inertia/pages/admin/Productions/Index.tsx` -- afficher labels taxonomy
- [x] `inertia/pages/production.tsx` + `ProductionCard.tsx` -- labels i18n
- [x] `app/controllers/public/home_controller.ts` -- catégories prédéfinies homepage
- [x] `database/seeders/production_demo_seeder.ts` -- clés taxonomie
- [x] `tests/unit/validators/production_validator.spec.ts` -- cas enum
- [x] `tests/functional/admin/productions_create.spec.ts` -- redirect edit + clés taxonomie

**Acceptance Criteria:**
- Given la page Create, when l'admin remplit métadonnées et ajoute fichier ou lien en attente, then la section fichiers est visible sans placeholder et Publier s'active si complet.
- Given Create complet, when Enregistrer, then production créée, attachements uploadés, redirect `/admin/productions/:id/edit`.
- Given Create complet, when Publier, then production créée, attachements uploadés, statut published.
- Given le formulaire, when catégorie/domaine, then seules les valeurs prédéfinies sont sélectionnables (11 catégories, 6 domaines).
- Given un domaine sélectionné, when sous-domaine, then seules les clés de la liste du domaine sont ajoutables (multi).
- Given des productions legacy en BD, when migration exécutée, then category/domain/subdomain stockent des clés valides ou NULL/vides pour non mappés.
- Given une page publique, when affichage catégorie/domaine/sous-domaine, then libellés i18n selon locale visiteur.

## Spec Change Log

- (2026-06-12) Revue auto : aucun loopback requis. Objectif 3 (bouton partager) différé dans `deferred-work.md`.

## Design Notes

Chaîne create client : `post('/admin/productions')` → uploads séquentiels Inertia → `publish` optionnel.

Taxonomies validées : 11 catégories, 6 domaines, sous-domaines filtrés par domaine (`production_taxonomy.ts`).

## Verification

**Commands:**
- `node ace test unit --files=tests/unit/validators/production_validator.spec.ts` -- 16 passed
- `node ace test functional --files=tests/functional/admin/productions_create.spec.ts` -- 6 passed
- `node ace test functional --files=tests/functional/admin/productions_edit.spec.ts` -- 7 passed
- `node ace test functional --files=tests/functional/admin/productions_publish.spec.ts` -- 5 passed
- `node ace migration:run` -- appliquer conversion taxonomie en environnement cible

**Manual checks:**
- Create : ajouter PDF en attente + Publier → production visible site public
- Filtres `/productions?category=book` avec libellés traduits

## Suggested Review Order

**Formulaire unifié (create → upload → publish)**

- Point d'entrée : page Create avec files/links en attente et chaîne post-save
  [`Create.tsx:1`](../../inertia/pages/admin/Productions/Create.tsx#L1)

- Upload séquentiel des pièces jointes après redirect vers Edit
  [`production_submit.ts:1`](../../inertia/lib/production_submit.ts#L1)

- FileUploader / LinkManager en mode pending sans productionId
  [`FileUploader.tsx:35`](../../inertia/components/admin/FileUploader.tsx#L35)

**Taxonomies prédéfinies**

- Source de vérité serveur + mapping legacy FR→clé
  [`production_taxonomy.ts:1`](../../app/constants/production_taxonomy.ts#L1)

- Migration de données existantes
  [`1775918745000_convert_production_taxonomy_to_keys.ts:1`](../../database/migrations/1775918745000_convert_production_taxonomy_to_keys.ts#L1)

- Select admin + ChipInput contraint + i18n public
  [`ProductionForm.tsx:166`](../../inertia/components/admin/ProductionForm.tsx#L166)

**Validation & tests**

- Enum VineJS + assertProductionTaxonomy
  [`production_validator.ts:1`](../../app/validators/admin/production_validator.ts#L1)

- Tests create redirect edit
  [`productions_create.spec.ts:46`](../../tests/functional/admin/productions_create.spec.ts#L46)
