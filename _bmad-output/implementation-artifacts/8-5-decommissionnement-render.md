# Story 8.5 : Décommissionnement de Render

Status: done

## Story

En tant que développeur,
Je veux supprimer l'environnement Render,
Afin que le VPS de staging soit l'unique staging et que Render ne coûte ni ne trompe plus personne.

## Acceptance Criteria

1. **Given** le staging VPS est validé (Stories 8.3 et 8.4)
   **When** le décommissionnement est confirmé
   **Then** le service Render `anta-staging` est supprimé et le keep-alive cron-job.org désactivé
2. **And** `render.yaml` est retiré du dépôt et la documentation (README, `docs/`, skill de déploiement) mise à jour
3. **And** toute référence à `anta-staging.onrender.com` (liens, `APP_URL`, mémoire projet) est remplacée par `https://anta.peraha.com`

## Deux volets

| Volet | Qui | Quand |
|---|---|---|
| Dépôt (AC 2, 3) : `render.yaml`, docs, tests, commentaires | dev agent | maintenant, branche `feat/8-5-render-decommission` |
| Comptes externes (AC 1) : service Render, cron-job.org, intégration GitHub de Render | **Aurélien** (aucun accès depuis le VPS de dev) | **après** sa recette de 8.3 et le premier run vert de `deploy-staging.yml` (8.4) |

Le volet dépôt est sans risque avant la suppression du service : Render ne relit pas `render.yaml` après la création du service (`_docs/retrospective-deploiement.md`, leçon 1). Son auto-deploy continue avec les réglages du dashboard jusqu'à la suppression. Tant que les deux tournent, un merge sur `staging` déploie Render **et** le VPS. C'est accepté depuis 8.3 : même base, migrations idempotentes.

## Tasks / Subtasks

- [x] T1 — Retirer Render du dépôt (AC 2)
  - [x] Supprimer `render.yaml` et `_docs/deployment-render.md`.
  - [x] `.dockerignore` : retirer la ligne `render.yaml`.
  - [x] `.gitignore` (commentaire l. 9) : « clone frais (ex. Render) » → « clone frais (ex. build Docker) ».
  - [x] `.npmrc` : **garder** `include=dev` (copié par le stage builder du `Dockerfile`, l. 13 ; le stage runtime l'écarte exprès, l. 19). Reformuler le commentaire sans Render : toute plateforme qui force `NODE_ENV=production` au build.
- [x] T2 — Documentation (AC 2, 3)
  - [x] `README.md` : lien « Déploiement Render » → `docs/staging-vps.md` (staging VPS), plus `docs/docker.md` et `docs/dev-vps.md` ; ligne `staging` du tableau des branches → « Test/démo — déployée sur `https://anta.peraha.com` (VPS, `deploy-staging.yml`) ».
  - [x] `_docs/git-workflow.md` : ligne `staging` du tableau ; section « Déploiement test (Render) » → « Déploiement test (staging VPS) » : PR `development → staging`, merge → `deploy-staging.yml` (tests, image GHCR, déploiement, `/health`), vérifier `https://anta.peraha.com`, rollback par `workflow_dispatch image_tag` (renvoyer vers `docs/staging-vps.md`). Retirer le paragraphe cold start / cron-job.org. Section production : « Epic 8, Story 8.6 » au lieu de « migration depuis Render ». Exemple de commit `add Render rollback procedure` → un exemple neutre.
  - [x] `_docs/retrospective-deploiement.md` : **historique, ne pas réécrire**. Ajouter sous le titre un encadré : Render décommissionné en Story 8.5 (2026-11), staging désormais sur `https://anta.peraha.com` ; les leçons AdonisJS (build, `.adonisjs/`, démarrage depuis `build/`, `DB_SSL`) restent valables.
  - [x] `docs/staging-vps.md` (§ DNS, l. 143) : « l'ancien CNAME vers Render » peut rester (historique du changement DNS) ; vérifier qu'aucune phrase ne présente Render comme encore actif.
  - [x] `_bmad-output/implementation-artifacts/deferred-work.md` : barrer les 2 items liés à Render dans « Quick Dev spec-fix-upload-limit-100mb » (timeout / body-cap Free tier, tmp sur disque éphémère Render) avec la mention « obsolète — Render décommissionné (8.5) ; sur le VPS, limite nginx `client_max_body_size` (8.3) ». Ne rien supprimer d'autre.
- [x] T3 — Tests `tests/unit/infrastructure/config_files.spec.ts` (AC 2, 3)
  - [x] Supprimer le groupe `Infrastructure | render.yaml` (et l'import `yaml`/`parse` s'il n'est plus utilisé dans le fichier ; le groupe CI l'utilise, vérifier).
  - [x] `README.md existe et référence les docs` : attendre `docs/staging-vps.md` à la place de `_docs/deployment-render.md`.
  - [x] Remplacer le test `_docs/deployment-render.md existe…` par un test de non-régression : `render.yaml` et `_docs/deployment-render.md` absents ; aucune occurrence de `onrender.com` dans `README.md`, `_docs/git-workflow.md`, `docs/*.md`.
  - [x] Lancer `npm run test:local` (Docker `anta-test-db`, port 5433), `npm run lint`, `npm run typecheck`.
- [x] T4 — Hors dépôt, côté workspace (AC 2, 3), sans attendre Aurélien
  - [x] Skill `/root/maxxing/.claude/skills/deploiement-adonisjs-render/` : la renommer `deploiement-adonisjs-docker` (dossier + `name:`) et la réécrire pour le déploiement actuel : `.npmrc include=dev` au build, `.adonisjs/` et `database/schema.ts` commités, démarrage depuis `build/`, `migration:run --force` au démarrage, `DB_SSL=true` sur le pooler Supabase, image multi-stage + Compose + `/health` (renvois vers `docs/docker.md` et `docs/staging-vps.md`). Retirer les points propres à Render (resync `render.yaml`, keep-alive).
  - [x] Mémoire projet `/root/maxxing/projects/anta/memory.md` : la ligne « Staging » ne mentionne plus Render qu'au passé, **après** l'AC 1 (avant, Render existe encore : écrire alors « suppression en attente de la recette »).
- [x] T5 — Checklist d'Aurélien (AC 1), à reporter dans la section « Actions manuelles » de cette story et à lui présenter
  - [x] Préalables : recette 8.3 faite (login admin, upload > 10 Mo, e-mail Mailgun) ; premier run de `deploy-staging.yml` vert sur `staging`.
  - [ ] Render : Dashboard → service `anta-staging` → Settings → **Delete Web Service**.
  - [ ] cron-job.org : désactiver puis supprimer le job « Anta staging keep-alive » (GET toutes les 14 min).
  - [ ] GitHub → Settings → Integrations / GitHub Apps : retirer l'accès de Render au dépôt `atlastsl/ete-community--anta` (ou désinstaller l'app si plus aucun service Render).
  - [ ] Vérifier qu'aucune règle de protection de branche n'exige un check de statut Render.
  - [ ] À vérifier hors dépôt : CORS du bucket R2 (origine `https://anta-staging.onrender.com` à retirer si présente) ; lien « Website » du dépôt GitHub.
  - [ ] Recommandé : les variables du service Render contenaient les secrets partagés (Supabase, R2, Mailgun). La suppression du service les efface ; une rotation reste conseillée si le compte Render était partagé.

## Dev Notes

### Ce qui existe déjà (ne pas refaire)
- Staging VPS en ligne : `https://anta.peraha.com` (8.3), CI/CD `deploy-staging.yml` + `remote-deploy.sh` (8.4), runbook `docs/staging-vps.md`. Le DNS `anta` pointe déjà vers le VPS (le CNAME Render a été remplacé en 8.3) : `anta-staging.onrender.com` n'est plus joignable que par son nom Render.
- Branche **`feat/8-5-render-decommission` à créer sur `feat/8-4-ci-staging`** (branches empilées, rien n'est poussé ; Aurélien teste l'Epic 8 d'un bloc).

### Périmètre des références « Render »
- **À modifier** (vivant) : `render.yaml`, `_docs/deployment-render.md`, `README.md`, `_docs/git-workflow.md`, `.dockerignore`, `.gitignore`, `.npmrc` (commentaires), `tests/unit/infrastructure/config_files.spec.ts`, `deferred-work.md` (2 items), skill workspace, mémoire projet.
- **À laisser tel quel** (historique) :
  - stories `1-8-…`, `8-1` à `8-4` et autres artefacts d'implémentation passés ;
  - `_bmad-output/planning-artifacts/{epics,architecture}.md` : la phase initiale Render y est décrite comme historique ; la révision de l'Epic 8 vit dans la PR #11 (`docs/epic-8-vps-infra`), qui dit déjà « Render décommissionné en Story 8.5 ». Ne pas les éditer ici, ce serait un conflit avec la PR #11.
  - `_docs/retrospective-deploiement.md` (encadré seulement).
- Faux positifs du grep : `inertia.render(...)`, `inertia/ssr.tsx` (`render(page)`), « re-render » React, `mermaid-gen.md` des skills BMad.

### Pièges
- `.npmrc` n'est pas propre à Render : sans lui, un build avec `NODE_ENV=production` saute les devDeps. Le `Dockerfile` le copie dans le stage builder ; le supprimer casse `COPY package.json package-lock.json .npmrc ./`.
- `APP_URL` : sur le VPS il vaut déjà `https://anta.peraha.com` (`/opt/anta/.env`, 8.3) ; aucune valeur `onrender` dans le dépôt (`.env.example` à vérifier par grep).
- Ne pas toucher au VPS, au nginx ni à Coffee Chat : cette story ne modifie rien côté serveur.
- Le test de non-régression ne doit pas scanner `_bmad-output/` ni `_docs/retrospective-deploiement.md` (références historiques légitimes).

### Hors périmètre
- Production → 8.6. Restriction de la clé CI de Coffee Chat → session Coffee Chat (décision d'Aurélien, 2026-11-16).

### Project Structure Notes
- Supprimés : `render.yaml`, `_docs/deployment-render.md`. Modifiés : `README.md`, `_docs/git-workflow.md`, `_docs/retrospective-deploiement.md`, `.dockerignore`, `.gitignore`, `.npmrc`, `tests/unit/infrastructure/config_files.spec.ts`, `_bmad-output/implementation-artifacts/deferred-work.md`.
- Hors dépôt : `/root/maxxing/.claude/skills/deploiement-adonisjs-docker/SKILL.md` (renommée), `/root/maxxing/projects/anta/memory.md`.

### References
- `_bmad-output/planning-artifacts/epics.md` § Story 8.5 (branche `docs/epic-8-vps-infra`)
- `_bmad-output/implementation-artifacts/1-8-configuration-branches-git-et-deploiement-render.md` (ce qui a été mis en place chez Render et cron-job.org)
- `_bmad-output/implementation-artifacts/8-3-provisionnement-vps-staging.md`, `8-4-ci-cd-deploiement-staging.md`, `docs/staging-vps.md`
- `_docs/retrospective-deploiement.md`

## Actions manuelles (Aurélien)

Préalables remplis le 2026-11-16 (recette 8.3 validée, premier run vert de `deploy-staging.yml`). Aurélien supprime Render et le keep-alive le 2026-11-16 ; les autres lignes restent à vérifier de son côté.

| Action | État |
|---|---|
| Supprimer le service Render `anta-staging` (Settings → Delete Web Service) | en cours (Aurélien) |
| cron-job.org : désactiver puis supprimer « Anta staging keep-alive » | en cours (Aurélien) |
| GitHub : retirer l'accès de l'app Render au dépôt | à faire |
| Protection de branche : aucun check de statut Render requis | à vérifier |
| CORS du bucket R2 : retirer `https://anta-staging.onrender.com` si présent ; lien « Website » du dépôt | à vérifier |
| Rotation des secrets partagés (Supabase, R2, Mailgun) si le compte Render était partagé | recommandé |

Ensuite : ligne « Staging » de `/root/maxxing/projects/anta/memory.md` au passé, cocher T5, story → done après review.

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code), 2026-11-16

### Debug Log References

- Rouge : `config_files.spec.ts` modifié d'abord → 2 échecs (`render.yaml` présent, README sans `docs/staging-vps.md`).
- Vert : `npm run test:local -- unit functional` → 444/444 (448 en 8.4 − 4 tests du groupe `render.yaml`). `npm run lint` (1 formatage Prettier corrigé) et `npm run typecheck` OK.
- Grep final : plus de `onrender.com` hors `_bmad-output/` et `_docs/retrospective-deploiement.md` (historiques) ; `.env.example` n'en contenait pas.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Volet dépôt fait (AC 2, AC 3 pour le dépôt) : `render.yaml` et le guide Render supprimés ; README et `_docs/git-workflow.md` décrivent le staging VPS (déploiement `deploy-staging.yml`, rollback `image_tag`) ; rétrospective Render conservée avec un encadré « historique ».
- `.npmrc` conservé (stage de build du `Dockerfile`), seul son commentaire change.
- `deferred-work.md` : item timeout/body-cap Render barré (obsolète, nginx 110m en 8.3) ; item tmp conservé, recentré sur le conteneur du VPS (le problème n'a pas disparu avec Render).
- Skill workspace renommée `deploiement-adonisjs-docker` et réécrite pour l'image multi-stage + Compose (ancienne `deploiement-adonisjs-render` supprimée ; seule référence restante : le rapport d'import du 2026-11-15, archive).
- Planification (`epics.md`, `architecture.md`) non modifiée : historique + PR #11.
- AC 1 et mémoire projet : en attente d'Aurélien (section « Actions manuelles »). Test de non-régression ajouté pour que Render ne revienne pas dans les docs vivantes.
- 2026-11-16 : PR mergées (#12–#16, #18 sur `development` ; #19 sur `staging`), premier run de `deploy-staging.yml` vert (`/health` → `revision` 81d9e07). Recette de l'Epic 8 validée par Aurélien. Story → done.

### File List

- Supprimés : `render.yaml`, `_docs/deployment-render.md`
- Modifiés : `README.md`, `_docs/git-workflow.md`, `_docs/retrospective-deploiement.md`, `.dockerignore`, `.gitignore`, `.npmrc`, `tests/unit/infrastructure/config_files.spec.ts`, `_bmad-output/implementation-artifacts/deferred-work.md`, `_bmad-output/implementation-artifacts/8-5-decommissionnement-render.md`
- Hors dépôt : `/root/maxxing/.claude/skills/deploiement-adonisjs-docker/SKILL.md` (remplace `deploiement-adonisjs-render/`)
