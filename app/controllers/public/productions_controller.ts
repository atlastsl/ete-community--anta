import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import Production from '#models/production'
import SearchService, {
  type ProductionFilters,
  SORT_OPTIONS,
  type SortOption,
} from '#services/search_service'
import LicenseStatus from '#enums/license_status'
import ProductionStatus from '#enums/production_status'
import SeoService from '#services/seo_service'
import FileStorageService from '#services/file_storage_service'
import StatsService from '#services/stats_service'
import env from '#start/env'

/** Sérialisation plate d'une production pour les ProductionCard. */
function serialize(p: Production) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    authors: p.authors ?? [],
    category: p.category,
    domain: p.domain,
    summary: p.summary,
    viewsCount: Number(p.$extras.viewsCount ?? 0),
    downloadsCount: Number(p.$extras.downloadsCount ?? 0),
    publishedAt: p.antaPublishedAt?.toISO() ?? null,
  }
}

/** Sérialisation complète pour la page détail (toutes métadonnées publiques + fichiers/liens). */
function serializeDetail(p: Production) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    authors: p.authors ?? [],
    tags: p.tags ?? [],
    category: p.category,
    domain: p.domain,
    subdomain: p.subdomain ?? [],
    language: p.language,
    publicationCountry: p.publicationCountry,
    journal: p.journal,
    publisher: p.publisher,
    isbnDoiIssn: p.isbnDoiIssn,
    institution: p.institution,
    licenseStatus: p.licenseStatus,
    workPublishedAt: p.workPublishedAt?.toISO() ?? null,
    publishedAt: p.antaPublishedAt?.toISO() ?? null,
    viewsCount: Number(p.$extras.viewsCount ?? 0),
    downloadsCount: Number(p.$extras.downloadsCount ?? 0),
    files: p.files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    })),
    links: p.links.map((l) => ({ id: l.id, url: l.url, label: l.label, linkType: l.linkType })),
  }
}

const PER_PAGE = 20
const LICENSE_VALUES = Object.values(LicenseStatus) as string[]
const SORT_VALUES = SORT_OPTIONS as readonly string[]

/** Normalise un query param en tableau de strings non vides (répété → array, unique → [v], absent → []). */
function asArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  }
  if (typeof input === 'string' && input.trim() !== '') return [input.trim()]
  return []
}

/**
 * Listing public : recherche full-text + filtres multi-critères (FR1–FR8).
 * La logique de requête vit dans `SearchService`. Le contrôleur parse/valide les
 * query params, calcule les facettes et sérialise les props Inertia.
 *
 * Le tri configurable, le comptage affiché, le toggle liste/grille et l'UI de
 * pagination sont implémentés en Story 5.4 (la méta de pagination est déjà retournée).
 */
export default class ProductionsController {
  async index({ request, inertia }: HttpContext) {
    const page = Math.max(1, Number(request.input('page', 1)) || 1)

    const qRaw = request.input('q')
    const q = typeof qRaw === 'string' && qRaw.trim() !== '' ? qRaw.trim() : null

    // Tri validé contre la whitelist ; défaut = pertinence si recherche, sinon date
    const sortInput = request.input('sort')
    const sort: SortOption = SORT_VALUES.includes(sortInput)
      ? (sortInput as SortOption)
      : q
        ? 'relevance'
        : 'date'

    const filters: ProductionFilters = {
      category: asArray(request.input('category')),
      domain: asArray(request.input('domain')),
      subdomain: asArray(request.input('subdomain')),
      author: asArray(request.input('author')),
      language: asArray(request.input('language')),
      country: asArray(request.input('country')),
      // license validé contre l'enum (pas de valeur arbitraire dans le WHERE)
      license: asArray(request.input('license')).filter((v) => LICENSE_VALUES.includes(v)),
    }

    const paginator = await SearchService.search({ q, filters, sort, page, perPage: PER_PAGE })
    const meta = paginator.getMeta()
    const facets = await SearchService.facets()

    // Résultats approchants : si la recherche exacte ne renvoie rien, proposer les plus proches.
    let results = paginator.all().map(serialize)
    let approximate = false
    if (meta.total === 0 && q) {
      const approx = await SearchService.approximate({ q, filters })
      if (approx.length) {
        results = approx.map(serialize)
        approximate = true
      }
    }

    return inertia.render('productions', {
      results,
      approximate,
      pagination: {
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        total: meta.total,
        perPage: meta.perPage,
      },
      facets,
      activeFilters: filters,
      q,
      sort,
      meta: SeoService.listing(SeoService.localeFromCookieHeader(request.header('cookie')), q),
    })
  }

  /**
   * Page détail d'une production publiée (FR10, FR16). 404 si inexistante, brouillon ou
   * dépubliée (jamais de fuite de contenu non publié — NFR12). Les compteurs sont agrégés
   * via withAggregate ; fichiers/liens préchargés (affichés en liste — lecteurs/téléchargement
   * en Stories 6.2/6.3).
   */
  async show({ params, request, inertia, response }: HttpContext) {
    const locale = SeoService.localeFromCookieHeader(request.header('cookie'))

    const production = await Production.query()
      .where('slug', params.slug)
      .where('status', ProductionStatus.PUBLISHED)
      .preload('files')
      .preload('links')
      .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
      .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))
      .first()

    if (!production) {
      response.status(404)
      return inertia.render('errors/not_found', { meta: SeoService.site(locale) })
    }

    // URL signée R2 (TTL 1h) par fichier, générée serveur (jamais la clé brute exposée).
    // Repli par fichier : un échec R2 → url null (lecteur en "aperçu indisponible"), sans 500 (NFR12).
    const files = await Promise.all(
      production.files.map(async (f) => {
        let url: string | null = null
        try {
          url = await FileStorageService.signedUrl(f.fileKey)
        } catch (error) {
          logger.error({ err: error, fileKey: f.fileKey }, 'signed URL generation failed')
        }
        return {
          id: f.id,
          originalName: f.originalName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          url,
          downloadUrl: `/productions/${production.slug}/files/${f.id}/download`,
        }
      })
    )

    return inertia.render('production', {
      production: { ...serializeDetail(production), files },
      meta: SeoService.forProduction(locale, production, env.get('APP_URL')),
    })
  }

  /**
   * Téléchargement d'un fichier d'une production publiée (FR14, FR26).
   * Enregistre le téléchargement puis redirige (302) vers l'URL signée R2 (attachment).
   * 404 si production non publiée / fichier étranger ou inexistant (NFR12).
   */
  async download({ params, request, response, session }: HttpContext) {
    const production = await Production.query()
      .where('slug', params.slug)
      .where('status', ProductionStatus.PUBLISHED)
      .first()

    if (!production) {
      return response.notFound('Production introuvable')
    }

    const file = await production.related('files').query().where('id', params.fileId).first()

    if (!file) {
      return response.notFound('Fichier introuvable')
    }

    // Générer l'URL signée AVANT d'enregistrer : si R2 échoue, on n'enregistre pas (AC#4).
    let signedUrl: string
    try {
      signedUrl = await FileStorageService.signedDownloadUrl(file.fileKey, file.originalName)
    } catch (error) {
      logger.error({ err: error, fileKey: file.fileKey }, 'signed download URL generation failed')
      session.flash('error', 'productions.download_unavailable')
      return response.redirect(`/productions/${production.slug}`)
    }

    await StatsService.recordDownload(production.id, request.ip())
    return response.redirect(signedUrl)
  }
}
