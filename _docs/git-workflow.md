# Workflow Git Anta

## Branches principales

| Branche       | Rôle                                                          | Protection                       |
| ------------- | ------------------------------------------------------------- | -------------------------------- |
| `master`      | Production (VPS — Epic 8)                                     | PR + 1 review obligatoire        |
| `development` | Centralisation des features en cours (branche **par défaut**) | CI doit passer avant merge       |
| `staging`     | Environnement test/démo (connectée à Render auto-deploy)      | CI doit passer avant merge       |

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

## Déploiement test (Render)

1. Créer une PR `development → staging` sur GitHub
2. Une fois CI vert + merge, **Render auto-deploy** détecte le push
3. Vérifier l'app sur `https://anta-staging.onrender.com` (URL à confirmer après le premier déploiement)

⚠️ Si Render Free Tier dort (15 min d'inactivité), prévoir 30-60s pour le cold start. Le cron-job.org configuré toutes les 14 min limite ce cas.

## Déploiement production (VPS — Epic 8)

Le workflow VPS sera mis en place lors de l'Epic 8 (migration depuis Render). En attendant :

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
docs(deployment): add Render rollback procedure
```
