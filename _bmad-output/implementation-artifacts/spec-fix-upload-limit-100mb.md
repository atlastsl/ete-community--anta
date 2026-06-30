---
title: 'Correction limite upload multipart (20 Mo → 110 Mo)'
type: 'bugfix'
created: '2026-06-30'
status: 'done'
route: 'one-shot'
context:
  - '_bmad-output/planning-artifacts/architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'upload admin d'un fichier de plus de 20 Mo échouait avec une erreur `Request entity too large` (HTTP 413), alors que l'UI et la validation par-fichier serveur autorisent jusqu'à 100 Mo (NFR3/NFR10). Le parser multipart global (`config/bodyparser.ts`) était plafonné à `20mb` et rejetait la requête entière avant que la validation par-fichier (`files_controller` + `FileStorageService`, cap 100 Mo) ne s'exécute.

**Approach:** Remonter la limite multipart globale à `110mb` — volontairement au-dessus du cap par-fichier (100 Mo) pour laisser l'enveloppe multipart (boundaries + champs formulaire) passer ; la validation par-fichier existante produit alors un flash d'erreur propre pour tout fichier >100 Mo, au lieu d'un 413 opaque. Les 10 Mo de headroom couvrent l'overhead d'enveloppe pour qu'un fichier de 100 Mo pile ne soit pas rejeté au niveau bodyparser.

</frozen-after-approval>

## Suggested Review Order

**Cause racine & correctif**

- Le bodyparser multipart global plafonnait à 20 Mo, rejetant la requête avant la validation par-fichier (100 Mo).
  [`bodyparser.ts:74`](../../config/bodyparser.ts#L74)

**Défense en profondeur (caps par-fichier déjà en place, inchangés)**

- Validation par-fichier côté controller : `size: '100mb'` + extnames autorisés.
  [`files_controller.ts:25`](../../app/controllers/admin/files_controller.ts#L25)

- Cap serveur 100 Mo + rejet oversize / MIME — garde qui empêche tout fichier 100–110 Mo d'atteindre R2.
  [`file_storage_service.ts:30`](../../app/services/file_storage_service.ts#L30)

- Constante cliente 100 Mo (affichage UX cohérent avec le cap serveur).
  [`file_constraints.ts:7`](../../inertia/lib/file_constraints.ts#L7)

**Garde contre régression**

- Test unitaire assertant `multipart.limit >= 100mb` — échoue si la valeur est revertée sous 100 Mo.
  [`config_files.spec.ts:162`](../../tests/unit/infrastructure/config_files.spec.ts#L162)
