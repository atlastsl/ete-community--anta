# Carte de couverture — Epic 7 (Statistiques et Métriques)

Traçabilité scénario → test. Établie à la clôture (Story 7.4). Couverture construite au fil des stories 7.1→7.3 (TDD) puis complétée en 7.4.

## Story 7.1 — Statistiques par production (panel admin)

| Scénario | Test | Type |
|---|---|---|
| Totaux vues/téléchargements corrects | `tests/unit/services/stats_service.spec.ts` › `productionStats` + `tests/functional/admin/productions_stats.spec.ts` | unit + functional |
| Évolution 30j (regroupée par jour, 30 entrées 0-remplies) | `stats_service.spec.ts` › `productionStats` (length 30, somme, `viewsByDay[29]`=aujourd'hui) | unit |
| État vide (0 vue & 0 téléchargement) | `stats_service.spec.ts` (sans stat → 0) + `tests/unit/components/production_stats.spec.ts` | unit + source |
| Accès tous-admins (FR27, pas de contrôle de propriété) | `productions_stats.spec.ts` (admin ouvre /edit) | functional |
| UI (4 indicateurs + barres + table sr-only) | `production_stats.spec.ts` | source |

## Story 7.2 — Vue agrégée bibliothèque (`/admin/stats`)

| Scénario | Test | Type |
|---|---|---|
| Totaux (publiées / vues / téléchargements) | `stats_service.spec.ts` › `libraryStats` (delta) + `tests/functional/admin/stats.spec.ts` | unit + functional |
| Top 10 vues — tri décroissant + tête correcte | `stats_service.spec.ts` (tri desc + prod « star » 100 vues en tête + longueur ≤ 10) | unit |
| Top 10 téléchargements — tri décroissant | `stats_service.spec.ts` (tri desc + longueur ≤ 10) | unit |
| Évolution 30j (vues + téléchargements) | `stats_service.spec.ts` (length 30 + **bucket aujourd'hui delta** 7.4) | unit |
| État vide (aucune production publiée) | `tests/unit/components/stats_page.spec.ts` (`totalPublished === 0`) | source |
| Page : 3 métriques + 2 tables top-10 + évolution + liens slug | `stats_page.spec.ts` | source |
| Accès (anonyme → 302) | `stats.spec.ts` | functional |

## Story 7.3 — Logs d'activité (super admin)

| Scénario | Test | Type |
|---|---|---|
| Liste accessible (super_admin) | `tests/functional/admin/activity_logs.spec.ts` | functional |
| Filtre par administrateur | `activity_logs.spec.ts` | functional |
| Filtre par type d'action | `activity_logs.spec.ts` | functional |
| Pagination 20/page (récents d'abord) | `activity_logs.spec.ts` (total 25 → lastPage 2, perPage 20) | functional |
| Accès refusé (rôle admin → 302 /admin/productions) | `activity_logs.spec.ts` | functional |
| Page : filtres + table + état vide + pagination | `tests/unit/components/activity_logs_page.spec.ts` | source |

## StatsService (transversal)

| Scénario | Test | Type |
|---|---|---|
| recordView → stats_views (ip_hash haché + session_id) | `stats_service.spec.ts` › recordView | unit |
| recordDownload → stats_downloads (ip_hash haché) | `stats_service.spec.ts` › recordDownload | unit |
| ip_hash déterministe / null si pas d'IP | `stats_service.spec.ts` | unit |

## Notes

- **Organisation** : un fichier de test par préoccupation (vs `StatsController.spec` du libellé epic) — cohérent avec le repo.
- **403 → 302** : l'accès admin refusé aux logs est un **302** (comportement de `SuperAdminMiddleware`), pas un 403.
- **Échecs locaux** : la BDD locale (Supabase partagée) est polluée → certains tests data-dépendants échouent en local mais passent en CI propre. Les tests `libraryStats`/`productionStats` utilisent des assertions **par delta** + `.timeout(20000)` (agrégation lourde contre Supabase distant). **Aucun** échec connu ne concerne l'Epic 7.
- **Tests functional admin** = `continue-on-error` en CI (ticket Epic 8) ; garantie réelle = tests **unit** `stats_service`.
