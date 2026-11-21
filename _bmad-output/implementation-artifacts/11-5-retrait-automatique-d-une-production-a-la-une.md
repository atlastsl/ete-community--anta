---
baseline_commit: 8930e94
---

# Story 11.5 : Retrait automatique d'une production à la une

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur**,
je veux **qu'une production dépubliée ou supprimée quitte automatiquement la une, en étant prévenu**,
afin que **la bannière ne montre jamais une production indisponible** (FR51, D21).

## Décision de périmètre (lire en premier)

- Story **sans migration**, **sans dépendance npm**, sans composant shadcn ajouté.
- **DANS 11.5** :
  - `FEATURED_AUTO_REMOVE: 'featured_auto_remove'` dans `ActionType`, libellé de la page Journal ;
  - `FeaturedService.removeProduction(productionId, adminId, cause, trx)` : retrait + recompactage (`DELETE` puis `INSERT` 1..n), journal après le commit ;
  - `ProductionService.unpublish(production, adminId)` et `.delete(production, adminId)` ouvrent la transaction, verrouillent la ligne de la production **puis** appellent `removeProduction` (règle d'ordre des verrous D-11.4-5) ; pour la suppression, **avant** le `DELETE FROM productions` ;
  - dépublication automatique à l'enregistrement du formulaire (production publiée devenue incomplète, FR22) : même retrait, même transaction (D-11.5-3) ;
  - `isFeatured` dans les props de la liste admin (par ligne) et du formulaire d'édition ; avertissement D21 dans les dialogs de dépublication / suppression (composant partagé `ProductionConfirmDialog`) ; le bouton « Dépublier » du formulaire passe par ce dialog (D-11.5-4).
- **HORS 11.5 (ne PAS implémenter)** :
  - bannière publique de l'accueil (prop `featured`, `FeaturedBanner` public) → **11.6** ;
  - blocage de la suppression de la vidéo d'une production à la une sans vignette : non bloquée, non retirée (D-11.5-6, question PO maintenue) ;
  - affichage de `position` / `cause` dans la page Journal (métadonnées enregistrées, libellé d'action seulement).

## Acceptance Criteria

1. **Type d'action** — **Given** `ActionType`, **When** il est lu, **Then** il contient `FEATURED_AUTO_REMOVE: 'featured_auto_remove'` **and** la page Journal le traduit (« Retrait automatique de la une » / « Automatically removed from featured ») et son filtre expose 11 types.
2. **Retrait et recompactage (D30)** — **Given** une production à la une, **When** `ProductionService.unpublish(production, adminId)` ou `.delete(production, adminId)` s'exécute, **Then** `FeaturedService.removeProduction(id, adminId, cause, trx)` est appelé **dans la même transaction** : son emplacement disparaît (`DELETE … WHERE production_id = ?`) et les suivants remontent un par un dans l'ordre croissant (`position = k` où `position = k + 1`, jamais `UPDATE position = position - 1` en une instruction) ; les emplacements conservés gardent exactement `created_by_id` et `created_at` (D-11.5-2, amendée D-11.5-7).
3. **Ordre des verrous (D-11.4-5)** — **Given** `unpublish` / `delete`, **When** ils s'exécutent, **Then** la ligne de la production est verrouillée d'abord (`FOR NO KEY UPDATE` pour la dépublication, `FOR UPDATE` pour la suppression), puis `LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE` ; pour la suppression, `removeProduction` précède le `DELETE FROM productions` (le `CASCADE` ne retire plus jamais l'emplacement sans journal) **and** un enregistrement de la une concurrent (lignes `FOR SHARE` tenues, verrou de table demandé ensuite) ne provoque aucun interblocage (test à deux connexions réelles, comme 11.4).
4. **Journal après commit** — **Given** un retrait, **When** la transaction est validée, **Then** le journal reçoit `featured_auto_remove` / `production` / id avec `metadata: { position, cause: 'unpublish' | 'delete' }` (position avant retrait) **and** rien n'est journalisé si la transaction est annulée **and** une production hors de la une → aucun `featured_auto_remove`.
5. **Dépublication automatique (D-11.5-3)** — **Given** une production publiée à la une, **When** l'enregistrement du formulaire la rend incomplète (dépublication automatique existante), **Then** elle quitte la une dans la même transaction (cause `unpublish`, journal) **and** le flash devient `productions.auto_unpublished_featured` (« … dépubliée car elle est désormais incomplète, et retirée de la bannière à la une. »).
6. **`isFeatured` dans les props (D-11.5-5)** — **Given** `GET /admin/productions`, **When** la liste se rend, **Then** chaque ligne porte `isFeatured` (booléen) **and** `GET /admin/productions/:id/edit` porte la prop `isFeatured`.
7. **Avertissement des dialogs (D21)** — **Given** le dialog de dépublication ou de suppression (liste) ou de dépublication (formulaire), **When** la production est à la une, **Then** le corps du dialog affiche, dans un encadré d'avertissement avec `AlertTriangle` (`warning-notice`), « Cette production est à la une : elle sera retirée de la bannière. » (`productions.confirm.featured_warning`), relié à la description du dialog (`aria-describedby`) ; sinon le dialog est inchangé.
8. **Page « À la une » après retrait** — **Given** la page `GET /admin/featured` ouverte après un retrait automatique, **When** elle s'affiche, **Then** l'emplacement est déjà vidé et les suivants ont remonté (prop `selection`).

## Tasks / Subtasks

- [x] **T1 — Service** (AC 1–4)
  - [x] 1.1 `ActionType.FEATURED_AUTO_REMOVE`.
  - [x] 1.2 `FeaturedService.removeProduction(productionId, adminId, cause, trx)` : verrou de table, lecture de la sélection, no-op si absente, `DELETE` de l’emplacement puis décalage ligne par ligne croissant des suivantes (revue, D-11.5-7), `trx.after('commit')` → `ActivityLogService.log` ; retourne la position retirée ou `null`.
  - [x] 1.3 `ProductionService.unpublish(production, adminId)` : transaction, ligne `FOR NO KEY UPDATE`, `removeProduction(…, 'unpublish')`, statut brouillon.
  - [x] 1.4 `ProductionService.delete(production, adminId)` : ligne `FOR UPDATE`, `removeProduction(…, 'delete')` avant les `DELETE` ; nettoyage R2 inchangé.
- [x] **T2 — Contrôleur** (AC 5, 6)
  - [x] 2.1 `unpublish` / `destroy` passent `auth.user!.id`.
  - [x] 2.2 `update` : retrait dans la transaction si dépublication automatique ; flash `auto_unpublished_featured`.
  - [x] 2.3 `index` : `isFeatured` par ligne (une requête des ids de la sélection) ; `edit` : prop `isFeatured`.
  - [x] 2.4 Appels existants de `ProductionService.delete` (tests 11.3) mis à jour.
- [x] **T3 — Front** (AC 1, 7)
  - [x] 3.1 `inertia/components/admin/ProductionConfirmDialog.tsx` (dépublier / supprimer, avertissement D21).
  - [x] 3.2 `admin/Productions/Index.tsx` : dialogs remplacés, `isFeatured` des lignes.
  - [x] 3.3 `ProductionFormActions` : « Dépublier » → dialog (prop `isFeatured`) ; `Edit.tsx` passe `isFeatured`.
  - [x] 3.4 i18n admin fr/en : `productions.confirm.featured_warning`, `productions.auto_unpublished_featured`, `activity.action.featured_auto_remove`.
- [x] **T4 — Tests** (tous les AC)
  - [x] 4.1 Functional `tests/functional/admin/featured_auto_remove.spec.ts` : dépublication de la position 1 sur 3 → 1–2 sans erreur de clé, `created_by_id` conservé ; suppression → idem ; journal `{ position, cause }` ; hors une → aucun journal ; rollback → aucun journal ; dépublication automatique du formulaire ; page « À la une » recompactée ; `isFeatured` liste / formulaire ; concurrence à deux connexions (dépublication et suppression vs enregistrement) ; ordre des instructions.
  - [x] 4.2 Unit (lecture de source) : `ProductionConfirmDialog`, liste, `ProductionFormActions` ; `activity_logs.spec.ts` (11 types).
  - [x] 4.3 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/services/production_service.ts` : `unpublish(production)` = `status = draft` + `save()` hors transaction ; `delete(production)` supprime les fichiers R2 lus, puis transaction `DELETE FROM production_files … RETURNING` + `DELETE FROM productions … RETURNING thumbnail_key` (le `CASCADE` retire aujourd'hui l'emplacement sans journal), puis nettoyage R2 (fichiers ajoutés entre-temps, vignette, posters).
- `app/services/featured_service.ts` (11.4) : `save` (lignes `FOR SHARE` puis `LOCK TABLE … SHARE ROW EXCLUSIVE`, `DELETE` + `INSERT`), `selectionIds(client)`, `assertThumbnailRemovable`.
- `app/controllers/admin/productions_controller.ts` : `unpublish` (journal `unpublish` après), `destroy` (journal `delete` **avant** la suppression), `update` (transaction, ligne `forUpdate`, dépublication automatique si incomplète), `index` (lignes sans `isFeatured`), `edit`.
- `inertia/pages/admin/Productions/Index.tsx` : deux `Dialog` (`role="alertdialog"`) dépublier / supprimer ; `ProductionFormActions.tsx` : « Dépublier » poste directement, sans confirmation ; le formulaire n'a pas de bouton « Supprimer ».
- `ActivityLogService.log` : hors transaction, ne lève jamais → journal après le commit (`trx.after('commit', …)` de Lucid, attendu par `commit()`).

### Garde-fous

- Ordre des verrous (D-11.4-5) : ligne(s) `productions` d'abord, `featured_productions` ensuite, pour **tout** écrivain de la sélection.
- PK `position` non différable : jamais `UPDATE position` ; `DELETE` puis `INSERT`.
- Tests à deux connexions réelles : pas de transaction globale, nettoyage explicite (productions, journal, admin), `drive.fake('r2')` (la suppression nettoie R2), `lock_timeout` pour ne jamais pendre.
- Composants `inertia/` testés par lecture de source.
- Dépôt public : aucune donnée réelle dans les tests.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.5] ; en-tête Epic 11.
- [Source: architecture.md#P2.6] « Retrait automatique (FR51) », « Journal d'activité » (table) ; P2-12.
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md:53, 90, 129, 141, 162, 265] ; [DESIGN.md:266–270, 382].
- [Source: 11-4-page-admin-a-la-une.md] D-11.4-5 (ordre des verrous, consigne pour 11.5), test « ordre des verrous », question ouverte 2 ; [deferred-work.md] « Suppression de la vidéo d'une production à la une sans vignette ».

## Décisions (D-11.5-n)

- **D-11.5-1** : ordre des verrous (D-11.4-5) appliqué aux deux méthodes : `unpublish` verrouille la ligne `FOR NO KEY UPDATE` (modification d'une colonne non clé, comme `ThumbnailService.remove` ; n'empêche pas les insertions enfants), `delete` `FOR UPDATE` (la ligne va disparaître) ; `removeProduction` prend ensuite le verrou de table. La dépublication automatique de `update` tient déjà la ligne `FOR UPDATE`.
- **D-11.5-2** : `removeProduction(productionId, adminId, cause, trx)` exige la transaction de l'appelant et journalise par `trx.after('commit')` : le journal n'est écrit que si la transaction est validée, quel que soit l'appelant. Les emplacements restants gardent `created_by_id` et `created_at` (choix de qui les a posés) ; seule la position change. `metadata.position` = position avant retrait.
- **D-11.5-3** : la dépublication automatique du formulaire (FR22) est une dépublication : la production quitte la une (cause `unpublish`) ; aucun dialog sur ce chemin, l'admin est prévenu par le flash `productions.auto_unpublished_featured`.
- **D-11.5-4** : « Dépublier » du formulaire passe désormais par le même dialog de confirmation que la liste (toujours, pas seulement à la une) : un seul composant `ProductionConfirmDialog` ; la suppression n'existe que dans la liste (inchangé).
- **D-11.5-5** : `isFeatured` est un instantané au rendu (une requête des ids de la sélection pour la liste) ; le serveur reste l'autorité : une production mise à la une après le rendu est quand même retirée et journalisée, seul l'avertissement manquait.
- **D-11.5-6** : suppression de la vidéo (donc du poster) d'une production à la une sans vignette : hors FR51 (la production reste publiée et disponible), **ni bloquée ni retirée** ; la page « À la une » la signale (« Vignette manquante ») et bloque un nouvel enregistrement ; 11.6 doit tolérer une production sans image. Question PO maintenue.

- **D-11.5-7** (revue, amende D-11.5-2 et l'AC de l'epic) : recompactage par `DELETE … WHERE production_id = ?` puis décalage **ligne par ligne, ordre croissant** (`UPDATE … SET position = k WHERE position = k + 1`) : chaque déplacement vise un emplacement libre (PK non différable respectée) et `production_id` ne change pas, donc aucune revérification de clé étrangère. La réécriture `DELETE` + `INSERT` prenait `FOR KEY SHARE` sur les **autres** productions à la une après le verrou de table → interblocage avec un admin tenant l'une d'elles `FOR UPDATE` (dépublication automatique de son formulaire, suppression). `epics.md` (Story 11.5) et `architecture.md` (P2.6) amendés le 2026-11-21.

## Review Findings

- [x] [Review][Patch] Interblocage du recompactage [app/services/featured_service.ts] — `DELETE` + `multiInsert` revérifiait la FK des autres emplacements (`FOR KEY SHARE` après `LOCK TABLE`) ; reproduit en SQL par la revue. Décalage ligne par ligne croissant (D-11.5-7) ; tests à deux connexions (Q tenue `FOR UPDATE`, P dépubliée / supprimée, `lock_timeout`) — échouent avec l'ancienne réécriture (interblocage), passent avec la nouvelle.
- [x] [Review][Patch] Test de source « `position - 1` » remplacé par des tests de comportement : `created_at` / `created_by_id` conservés à l'identique (`created_at::text`), sélection à trous (1 et 3) recompactée sans conflit de clé.
- [x] [Review][Patch] `ProductionConfirmDialog` : l'`id` personnalisé de `DialogDescription` cassait l'identifiant Radix (avertissement « Missing Description » en dev) → identifiant Radix par défaut, avertissement **dans** la description (`asChild`), plus d'`aria-describedby` explicite ; tests de source mis à jour.
- [x] [Review][Patch] Commentaire périmé de `FeaturedService.save` sur le `CASCADE` → `removeProduction` prend le verrou de table, renvoi à D-11.4-5.
- [x] [Review][Patch] Reformatage Prettier hors sujet annulé (`Productions/Index.tsx` bloc `Select`, `Edit.tsx` `toLocaleString`).
- [x] [Review][Defer] Seeder de démo : purge directe des productions `SEED_DEMO` (trous de positions, pas de journal) — dev seulement, consigné dans `deferred-work.md`.
- [ ] [Review][PO] Confirmation systématique de « Dépublier » dans le formulaire (D-11.5-4).
- [ ] [Review][PO] Suppression de la vidéo d'une production à la une sans vignette : ni bloquée ni retirée (D-11.5-6).

## Questions ouvertes (non bloquantes, défauts retenus)

1. Suppression de la vidéo d'une production à la une sans vignette (D-11.5-6) : la bloquer comme le retrait de vignette ?
2. Confirmation systématique de « Dépublier » dans le formulaire (D-11.5-4).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : `featured_auto_remove.spec.ts` et `production_confirm_dialog.spec.ts` écrits avant le code (`removeProduction`, `ProductionConfirmDialog`, `isFeatured` absents). Le premier lancement ciblé a été interrompu (sortie bufferisée par `| tail`, processus arrêté) ; relancé après implémentation : 22/22 verts.
- Mutation de contrôle : `removeProduction` placé **avant** le verrou de ligne dans `unpublish` → le test à deux connexions échoue (interblocage détecté par Postgres, ~2 s) ; ordre correct restauré → vert.
- Lint : 5 `no-await-expression-member` corrigés (contrôleur `edit`, tests).
- Suite complète `npm run test:local` : **1249 tests verts** (baseline 1227, +22), code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration ; rien contre Supabase ni R2 (`drive.fake('r2')`).
- Revue (5 correctifs + 1 report) : mutation « réécriture `DELETE` + `INSERT` » → le nouveau test de concurrence échoue (interblocage, ~2 s) ; ordre ligne par ligne → vert. Après correctifs : **1253 tests verts** (+4), `npm run test:local` code 0, lint 0, typecheck 0, build 0.

### Completion Notes List

- `ActionType.FEATURED_AUTO_REMOVE` ; la page Journal l'expose automatiquement (11 types) avec le libellé « Retrait automatique de la une ».
- `FeaturedService.removeProduction(productionId, adminId, cause, trx)` : `LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE`, lecture de la sélection, no-op (`null`) hors une, sinon `DELETE` de l’emplacement et décalage ligne par ligne croissant des suivantes (revue, D-11.5-7 ; lignes conservées à l’identique) ; journal `featured_auto_remove` / `production` `{ position, cause }` par `trx.after('commit')` (jamais sur rollback) ; type `FeaturedRemovalCause`.
- `ProductionService.unpublish(production, adminId)` : transaction, ligne `FOR NO KEY UPDATE`, retrait, brouillon (l'instance reçue est mise à jour). `ProductionService.delete(production, adminId)` : ligne `FOR UPDATE` puis retrait **avant** les `DELETE` ; nettoyage R2 inchangé.
- Contrôleur : `unpublish` / `destroy` passent l'admin ; `update` retire de la une lors de la dépublication automatique (flash `productions.auto_unpublished_featured`) ; `index` : `isFeatured` par ligne (une requête) ; `edit` : prop `isFeatured`.
- Front : `ProductionConfirmDialog` (dépublier / supprimer, encadré ambre `AlertTriangle` relié par `aria-describedby`, boutons `type="button"`) utilisé par la liste (deux dialogs) et par `ProductionFormActions` (« Dépublier » confirmé, D-11.5-4) ; `Edit.tsx` transmet `isFeatured`.
- i18n admin fr/en : `productions.confirm.featured_warning` (EXPERIENCE.md:90), `productions.auto_unpublished_featured`, `activity.action.featured_auto_remove`.
- `deferred-work.md` : report « suppression de la vidéo d'une production à la une » annoté (D-11.5-6).
- Non vérifié dans un navigateur (pas de `.env`) : dialogs couverts par les tests de source.

### File List

- app/enums/action_type.ts
- app/services/featured_service.ts
- app/services/production_service.ts
- app/controllers/admin/productions_controller.ts
- inertia/components/admin/ProductionConfirmDialog.tsx (nouveau)
- inertia/components/admin/ProductionFormActions.tsx
- inertia/pages/admin/Productions/Index.tsx
- inertia/pages/admin/Productions/Edit.tsx
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- tests/functional/admin/featured_auto_remove.spec.ts (nouveau)
- tests/unit/components/production_confirm_dialog.spec.ts (nouveau)
- tests/functional/admin/activity_logs.spec.ts
- tests/functional/admin/production_files_poster.spec.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/11-5-retrait-automatique-d-une-production-a-la-une.md (nouveau)
- _bmad-output/planning-artifacts/epics.md (revue : AC Story 11.5 amendé)
- _bmad-output/planning-artifacts/architecture.md (revue : P2.6 « Retrait automatique » amendé)

## Change Log

- 2026-11-21 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-21 : implémentation (`FEATURED_AUTO_REMOVE`, `FeaturedService.removeProduction`, `unpublish` / `delete` transactionnels avec ordre des verrous D-11.4-5, dépublication automatique du formulaire, `isFeatured` liste / formulaire, `ProductionConfirmDialog` avec avertissement D21) ; 1249 tests verts ; statut review.
- 2026-11-21 : revue de code — 5 correctifs (recompactage ligne par ligne sans revérification de FK, D-11.5-7, + tests de concurrence et de comportement ; description Radix du dialog ; commentaire de `save` ; reformatage annulé) + report seeder ; epics/architecture amendés ; 1253 tests verts ; statut done.
