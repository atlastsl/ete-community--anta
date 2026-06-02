import type { HttpContext } from '@adonisjs/core/http'
import type Production from '#models/production'
import SearchService, {
  type ProductionFilters,
  SORT_OPTIONS,
  type SortOption,
} from '#services/search_service'
import LicenseStatus from '#enums/license_status'
import SeoService from '#services/seo_service'

/** Sérialisation plate d'une production pour les ProductionCard. */
function serialize(p: Production) {
  return {
    id: p.id,
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
}
