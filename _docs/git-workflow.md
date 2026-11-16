# Workflow Git Anta

## Branches principales

| Branche       | Rôle                                                          | Protection                       |
| ------------- | ------------------------------------------------------------- | -------------------------------- |
| `master`      | Production (VPS — Epic 8)                                     | PR + 1 review obligatoire        |
| `development` | Centralisation des features en cours (branche **par défaut**) | CI doit passer avant merge       |
| `staging`     | Environnement test/démo (`https://anta.peraha.com`, VPS)      | CI doit passer avant merge       |

## Workflow par story

1. Se positionner sur `development` à jour :
   ```bash
   git checkout development
   git pull origin development
   ```

2. Créer une branche feature/fix :
   ```bash
   git checkout -b feat/X.Y-slug   # ex. feat/2-1-admin-layout
   # ou
   git checkout -b fix/X.Y-slug    # ex. fix/1-3-r2-upload-bug
   ```

3. Développer + tester localement :
   ```bash
   node ace test --suite unit
   npm run lint
   ```

4. Commit + push :
   ```bash
   git add <fichiers-modifiés>
   git commit -m "feat(story-X.Y): brève description"
   git push -u origin feat/X.Y-slug
   ```

5. Sur GitHub : créer une **Pull Request** `feat/X.Y-slug → development`

6. Une fois le CI vert (et la review effectuée si applicable) : merger en mode **squash** pour garder l'historique propre.

7. Supprimer la branche feature localement et sur le remote.

## Déploiement test (staging VPS)

1. Créer une PR `development → staging` sur GitHub
2. Au merge, le workflow `deploy-staging.yml` lance les tests, pousse l'image sur GHCR (tag = SHA du commit), déploie le VPS puis vérifie `/health`
3. Vérifier l'app sur `https://anta.peraha.com`

En cas d'échec, le VPS relance l'image précédente et le workflow est rouge. Pour revenir à une version : Actions → `Deploy staging` → **Run workflow** avec `image_tag` = SHA. Détails : [`docs/staging-vps.md`](../docs/staging-vps.md).

## Déploiement production (VPS — Epic 8)

Le workflow de production arrive avec la Story 8.6. En attendant :

1. Créer une PR `staging → master`
2. Review obligatoire (1 reviewer minimum)
3. CI doit passer
4. Merge → déclenchera (futur) workflow GitHub Actions de déploiement VPS

## Conventions de nommage des branches

- `feat/X.Y-slug` — nouvelle fonctionnalité (où X.Y = numéro de story)
- `fix/X.Y-slug` — correction de bug
- `chore/slug` — maintenance, deps, build (pas de story associée)
- `docs/slug` — documentation uniquement

## Conventions de commits (Conventional Commits)

```
feat(story-1.5): SuperAdminSeeder with idempotency
fix(db): Supabase pooler SSL config
chore(deps): bump react-i18next to v17.0.8
docs(deployment): document staging rollback
```
