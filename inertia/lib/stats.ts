/**
 * Types des statistiques agrégées partagés serveur → client (vue `/admin/stats` — FR28).
 * Miroir de `StatsService.LibraryStatsData` (le code serveur n'est pas importable côté client
 * — frontière TS, cf. `~/lib/seo.ts`).
 */
export type StatsTopRow = {
  id: string
  slug: string
  title: string
  views: number
  downloads: number
}

export type LibraryStatsData = {
  totalPublished: number
  totalViews: number
  totalDownloads: number
  topViewed: StatsTopRow[]
  topDownloaded: StatsTopRow[]
  evolution: { date: string; views: number; downloads: number }[]
}
