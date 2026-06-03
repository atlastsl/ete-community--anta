import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import StatsDownload from '#models/stats_download'
import StatsView from '#models/stats_view'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'

const STATS_WINDOW_DAYS = 30

/** Statistiques agrégées d'une production (panel admin — FR27). */
export type ProductionStatsData = {
  totalViews: number
  totalDownloads: number
  viewsByDay: { date: string; count: number }[]
}

/** Ligne d'un top-N de productions (vue agrégée — FR28). */
export type StatsTopRow = {
  id: string
  slug: string
  title: string
  views: number
  downloads: number
}

/** Statistiques agrégées de toute la bibliothèque (vue d'ensemble admin — FR28). */
export type LibraryStatsData = {
  totalPublished: number
  totalViews: number
  totalDownloads: number
  topViewed: StatsTopRow[]
  topDownloaded: StatsTopRow[]
  evolution: { date: string; views: number; downloads: number }[]
}

/**
 * Enregistrement + agrégation des métriques publiques (vues/téléchargements).
 *
 * Échec silencieux (cf. ActivityLogService) à l'enregistrement : une écriture de stat qui
 * échoue ne doit JAMAIS casser l'action utilisateur (téléchargement, navigation).
 */
export default class StatsService {
  /**
   * Hash anonymisé de l'IP : SHA-256 salé par APP_KEY (non réversible, pas de rainbow table
   * sur l'espace des IP). `null` si pas d'IP disponible.
   */
  private static hashIp(ip?: string | null): string | null {
    if (!ip) return null
    return createHash('sha256')
      .update(ip + env.get('APP_KEY'))
      .digest('hex')
  }

  /** Enregistre un téléchargement (FR26). IP anonymisée. */
  static async recordDownload(productionId: string, ip?: string | null): Promise<void> {
    try {
      await StatsDownload.create({
        productionId,
        downloadedAt: DateTime.now(),
        ipHash: StatsService.hashIp(ip),
      })
    } catch (error) {
      logger.error({ err: error, productionId }, 'StatsService: failed to record download')
    }
  }

  /** Enregistre une vue (FR25 — après 10s côté client). IP anonymisée + identifiant de session. */
  static async recordView(
    productionId: string,
    ip?: string | null,
    sessionId?: string | null
  ): Promise<void> {
    try {
      await StatsView.create({
        productionId,
        recordedAt: DateTime.now(),
        ipHash: StatsService.hashIp(ip),
        sessionId: sessionId ?? null,
      })
    } catch (error) {
      logger.error({ err: error, productionId }, 'StatsService: failed to record view')
    }
  }

  /**
   * Statistiques agrégées d'une production (FR27) : totaux all-time + évolution des vues
   * sur les 30 derniers jours (regroupées par jour, 0-remplies).
   *
   * Le bucketing par jour est fait en JS (Luxon) sur la fenêtre de 30 jours pour garantir
   * la cohérence du fuseau entre le filtre, les buckets et le tableau de sortie.
   */
  static async productionStats(productionId: string): Promise<ProductionStatsData> {
    const [viewsRows, downloadsRows] = await Promise.all([
      StatsView.query().where('productionId', productionId).count('* as total'),
      StatsDownload.query().where('productionId', productionId).count('* as total'),
    ])
    const totalViews = Number(viewsRows[0].$extras.total)
    const totalDownloads = Number(downloadsRows[0].$extras.total)

    // Fenêtre = [aujourd'hui - 29 jours ; aujourd'hui] (30 jours inclus).
    const startOfToday = DateTime.now().startOf('day')
    const cutoff = startOfToday.minus({ days: STATS_WINDOW_DAYS - 1 })

    const recentViews = await StatsView.query()
      .where('productionId', productionId)
      .where('recordedAt', '>=', cutoff.toSQL({ includeOffset: false })!)
      .select('recordedAt')

    const counts = new Map<string, number>()
    for (const row of recentViews) {
      const key = row.recordedAt.toFormat('yyyy-MM-dd')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const viewsByDay: { date: string; count: number }[] = []
    for (let i = STATS_WINDOW_DAYS - 1; i >= 0; i--) {
      const date = startOfToday.minus({ days: i }).toFormat('yyyy-MM-dd')
      viewsByDay.push({ date, count: counts.get(date) ?? 0 })
    }

    return { totalViews, totalDownloads, viewsByDay }
  }

  /**
   * Vue d'ensemble de la bibliothèque (FR28) : totaux, top 10 vues/téléchargements,
   * évolution 30j (vues & téléchargements). Bucketing 30j en JS (cohérence fuseau, cf. 7.1).
   */
  static async libraryStats(): Promise<LibraryStatsData> {
    const [publishedRows, viewsRows, downloadsRows] = await Promise.all([
      Production.query().where('status', ProductionStatus.PUBLISHED).count('* as total'),
      StatsView.query().count('* as total'),
      StatsDownload.query().count('* as total'),
    ])
    const totalPublished = Number(publishedRows[0].$extras.total)
    const totalViews = Number(viewsRows[0].$extras.total)
    const totalDownloads = Number(downloadsRows[0].$extras.total)

    // Top 10 — même pattern withAggregate que home_controller.publishedWithCounts.
    const topQuery = () =>
      Production.query()
        .where('status', ProductionStatus.PUBLISHED)
        .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
        .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))

    const serializeTop = (p: Production): StatsTopRow => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      views: Number(p.$extras.viewsCount ?? 0),
      downloads: Number(p.$extras.downloadsCount ?? 0),
    })

    const [topViewedRows, topDownloadedRows] = await Promise.all([
      topQuery().orderBy('viewsCount', 'desc').orderBy('id', 'asc').limit(10),
      topQuery().orderBy('downloadsCount', 'desc').orderBy('id', 'asc').limit(10),
    ])

    // Évolution 30j (vues + téléchargements) — bucketing JS sur la fenêtre, cohérent en fuseau.
    const startOfToday = DateTime.now().startOf('day')
    const cutoff = startOfToday
      .minus({ days: STATS_WINDOW_DAYS - 1 })
      .toSQL({ includeOffset: false })!

    const [recentViews, recentDownloads] = await Promise.all([
      StatsView.query().where('recordedAt', '>=', cutoff).select('recordedAt'),
      StatsDownload.query().where('downloadedAt', '>=', cutoff).select('downloadedAt'),
    ])

    const vMap = new Map<string, number>()
    for (const row of recentViews) {
      const key = row.recordedAt.toFormat('yyyy-MM-dd')
      vMap.set(key, (vMap.get(key) ?? 0) + 1)
    }
    const dMap = new Map<string, number>()
    for (const row of recentDownloads) {
      const key = row.downloadedAt.toFormat('yyyy-MM-dd')
      dMap.set(key, (dMap.get(key) ?? 0) + 1)
    }

    const evolution: { date: string; views: number; downloads: number }[] = []
    for (let i = STATS_WINDOW_DAYS - 1; i >= 0; i--) {
      const date = startOfToday.minus({ days: i }).toFormat('yyyy-MM-dd')
      evolution.push({ date, views: vMap.get(date) ?? 0, downloads: dMap.get(date) ?? 0 })
    }

    return {
      totalPublished,
      totalViews,
      totalDownloads,
      topViewed: topViewedRows.map(serializeTop),
      topDownloaded: topDownloadedRows.map(serializeTop),
      evolution,
    }
  }
}
