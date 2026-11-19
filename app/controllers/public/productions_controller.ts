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
import ProductionCardTransformer from '#transformers/production_card_transformer'
import PublicBylineService from '#services/public_byline_service'
import PublicAuthorService from '#services/public_author_service'

/** Sérialisation complète pour la page détail (toutes métadonnées publiques + fichiers/liens). */
function serializeDetail(p: Production) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    // Byline computed by `PublicBylineService.attach` (Story 10.4): `{ name, slug | null }[]`.
    authors: PublicBylineService.of(p),
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
      author: [], // résolu ci-dessous contre la facette (slugs visibles seulement, 10.6)
      language: asArray(request.input('language')),
      country: asArray(request.input('country')),
      // license validé contre l'enum (pas de valeur arbitraire dans le WHERE)
      license: asArray(request.input('license')).filter((v) => LICENSE_VALUES.includes(v)),
    }

    // Facettes d'abord : `author=<slug>` n'est retenu que pour un auteur visible de la facette
    // (Story 10.6, D12) ; slug inconnu, non public ou ancien nom libre → ignoré, sans erreur.
    const facets = await SearchService.facets()
    filters.author = PublicAuthorService.knownAuthorSlugs(
      asArray(request.input('author')),
      facets.author
    )

    const paginator = await SearchService.search({ q, filters, sort, page, perPage: PER_PAGE })
    const meta = paginator.getMeta()

    await PublicBylineService.attach(paginator.all())
    // Résultats approchants : si la recherche exacte ne renvoie rien, proposer les plus proches.
    let results = ProductionCardTransformer.transform(paginator.all())
    let approximate = false
    if (meta.total === 0 && q) {
      const approx = await SearchService.approximate({ q, filters })
      if (approx.length) {
        await PublicBylineService.attach(approx)
        results = ProductionCardTransformer.transform(approx)
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
      return inertia.render('errors/not_found', { meta: SeoService.notFound(locale) })
    }

    await PublicBylineService.attach([production])
    const detail = serializeDetail(production)

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
      production: { ...detail, files },
      meta: SeoService.forProduction(
        locale,
        {
          title: production.title,
          summary: production.summary,
          slug: production.slug,
          // Names shown on the page (byline), nothing else about the authors (P2.7).
          authors: detail.authors.map((author) => author.name),
        },
        env.get('APP_URL')
      ),
    })
  }

  /**
   * Téléchargement d'un fichier d'une production publiée (FR14, FR26).
   * Enregistre le téléchargement puis redirige (302) vers l'URL signée R2 (attachment).
   * 404 si production non publiée / fichier étranger ou inexistant (NFR12).
   */
  async download(ctx: HttpContext) {
    const { params, request, response, session } = ctx
    const production = await Production.query()
      .where('slug', params.slug)
      .where('status', ProductionStatus.PUBLISHED)
      .first()

    if (!production) {
      return this.notFound(ctx)
    }

    const file = await production.related('files').query().where('id', params.fileId).first()

    if (!file) {
      return this.notFound(ctx)
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

  /**
   * 404 d'un lien de téléchargement : NotFoundPage traduite (comme `show`) pour un navigateur ;
   * 404 sans corps pour un client qui n'accepte pas le HTML (Story 10.1, revue).
   */
  private notFound({ request, response, inertia }: HttpContext) {
    response.status(404)
    if (request.accepts(['html', 'json']) !== 'html') return response.notFound()
    const locale = SeoService.localeFromCookieHeader(request.header('cookie'))
    return inertia.render('errors/not_found', { meta: SeoService.notFound(locale) })
  }
}
