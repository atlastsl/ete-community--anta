# Carte de couverture — Epic 6 (Consultation et Téléchargement)

Traçabilité scénario → test. Établie à la clôture (Story 6.5). Couverture construite au fil des stories 6.1→6.4 (TDD) puis complétée en 6.5.

## Page de détail (Story 6.1)

| Scénario | Test | Type |
|---|---|---|
| Production publiée → 200 + métadonnées complètes | `tests/functional/public/productions.spec.ts` › « production publiée → 200 + métadonnées complètes » | functional |
| Brouillon → 404 | `productions.spec.ts` › « production en brouillon → 404 » | functional |
| Dépubliée → 404 | `productions.spec.ts` › « production dépubliée → 404 » | functional |
| Slug inexistant → 404 | `productions.spec.ts` › « slug inexistant → 404 » | functional |
| Slug généré (accents/casse) | `productions.spec.ts` › « slug généré automatiquement » + `tests/unit/services/production_service.spec.ts` › generateSlug/generateUniqueSlug | functional + unit |
| Meta SEO production (og:article) | `tests/unit/services/seo_service.spec.ts` › forProduction | unit |

## Lecteurs de médias (Story 6.2)

| Scénario | Test | Type |
|---|---|---|
| Dispatch MIME (pdf/epub/mp4/mp3/aac) | `tests/unit/components/media_viewer.spec.ts` › dispatch | source |
| PdfViewer iframe (title, sans sandbox) | `media_viewer.spec.ts` › PdfViewer | source |
| Repli EPUB/inconnu (lien sécurisé) | `media_viewer.spec.ts` › repli | source |
| URL signée par fichier (lecture) | `productions.spec.ts` › « lecteurs de médias (URLs signées) » (1 et N fichiers) | functional |
| Repli si URL indisponible | `media_viewer.spec.ts` › « repli si URL indisponible » | source |

## Téléchargement & liens externes (Story 6.3)

| Scénario | Test | Type |
|---|---|---|
| Download publiée + fichier → 302 + stats_downloads | `tests/functional/public/download.spec.ts` › « 302 + 1 téléchargement » | functional |
| URL signée retournée (Location) | `download.spec.ts` (assertion Location, 6.5) | functional |
| ip_hash anonymisé (download) | `download.spec.ts` › « ip_hash est anonymisé » | functional |
| Download brouillon → 404 | `download.spec.ts` › « brouillon → 404 + aucun enregistrement » | functional |
| Fichier d'une autre production → 404 | `download.spec.ts` › « fichier d'une autre production → 404 » | functional |
| fileId inexistant → 404 | `download.spec.ts` › « fileId inexistant → 404 » | functional |
| Bouton Télécharger (downloadUrl + optimiste) | `media_viewer.spec.ts` › « bouton télécharger (6.3) » | source |
| Lien embed (iframe sandbox/referrer) | `media_viewer.spec.ts` › « embed → iframe sandboxé » (lit `production.tsx`) | source |
| Lien simple (target _blank, rel noopener) | `media_viewer.spec.ts` › « lien simple → nouvel onglet sécurisé » | source |

## Enregistrement des vues (Story 6.4)

| Scénario | Test | Type |
|---|---|---|
| POST /stats/view publiée → 204 + stats_views (ip_hash) | `tests/functional/public/stats_view.spec.ts` › « 204 + 1 vue » | functional |
| Non publiée → 404 + 0 vue | `stats_view.spec.ts` › « non publiée → 404 » | functional |
| productionId inexistant → 404 | `stats_view.spec.ts` › « inexistant → 404 » | functional |
| productionId format invalide → 404 (pas 500) | `stats_view.spec.ts` › « format invalide → 404 » | functional |
| productionId absent → 404 | `stats_view.spec.ts` › « absent → 404 » | functional |
| ViewTracker timer 10s / clearTimeout / silencieux | `tests/unit/components/view_tracker.spec.ts` | source |

## StatsService & agrégation

| Scénario | Test | Type |
|---|---|---|
| recordView → stats_views (ip_hash haché + session_id) | `tests/unit/services/stats_service.spec.ts` › recordView | unit |
| recordDownload → stats_downloads (ip_hash haché) | `stats_service.spec.ts` › recordDownload | unit |
| ip_hash déterministe / null si pas d'IP | `stats_service.spec.ts` | unit |
| Agrégation compteurs sur page DÉTAIL | `productions.spec.ts` › « agrégation des compteurs (6.5) » | functional |
| Agrégation vues sur LISTING (tri) | `tests/functional/public/listing.spec.ts` › `addViews` | functional |

## Notes

- **Organisation** : un fichier de test par préoccupation (vs `StatsController.spec`/`ProductionsController.spec` du libellé epic) — cohérent avec le repo.
- **Agrégation** : le calcul vit dans les contrôleurs (`withAggregate` Lucid), pas dans `StatsService` → testé sur le chemin réel (page détail + listing).
- **Échecs locaux** : la BDD locale (Supabase partagée) est polluée → certains tests data-dépendants (search_service, super_admin…) échouent en local mais passent en CI propre. **Aucun** de ces échecs ne concerne l'Epic 6.
