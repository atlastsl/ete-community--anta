import db from '@adonisjs/lucid/services/db'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'

/**
 * Filtres multi-critères du site public (FR2–FR8). Chaque dimension est un tableau :
 * plusieurs valeurs d'une même dimension = OR ; dimensions différentes = AND.
 */
export type ProductionFilters = {
  category: string[]
  domain: string[]
  subdomain: string[]
  author: string[]
  language: string[]
  country: string[]
  license: string[]
}

export type Facets = ProductionFilters

export const SORT_OPTIONS = ['relevance', 'date', 'views', 'downloads'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

export const EMPTY_FILTERS: ProductionFilters = {
  category: [],
  domain: [],
  subdomain: [],
  author: [],
  language: [],
  country: [],
  license: [],
}

type SearchOptions = {
  q?: string | null
  filters: ProductionFilters
  sort: SortOption
  page: number
  perPage: number
}

const APPROX_LIMIT = 24

/**
 * Logique de recherche full-text (tsvector) + filtres du catalogue public.
 *
 * Recherche exacte : `search_vector @@ websearch_to_tsquery('simple', q)` — config `'simple'`
 * IDENTIQUE au trigger `productions_search_vector_trigger`. Tri par pertinence (`ts_rank`)
 * quand `q` est présent, sinon par date de publication Anta décroissante.
 *
 * Résultats approchants (`approximate`) quand la recherche exacte ne renvoie rien :
 *  1) relâche en OR (au moins un mot, avec préfixe) ; 2) à défaut, proximité orthographique
 *  `pg_trgm` sur le titre (gère les fautes de frappe).
 */
export default class SearchService {
  /** Base : productions publiées + agrégats vues/téléchargements + filtres appliqués. */
  private static baseQuery(filters: ProductionFilters) {
    const query = Production.query()
      .where('status', ProductionStatus.PUBLISHED)
      .withAggregate('statsViews', (sub) => sub.count('*').as('viewsCount'))
      .withAggregate('statsDownloads', (sub) => sub.count('*').as('downloadsCount'))

    if (filters.category.length) query.whereIn('category', filters.category)
    if (filters.domain.length) query.whereIn('domain', filters.domain)
    if (filters.language.length) query.whereIn('language', filters.language)
    if (filters.country.length) query.whereIn('publicationCountry', filters.country)
    if (filters.license.length) query.whereIn('licenseStatus', filters.license)
    // Dimensions jsonb multi-valeurs (OR intra-dimension via containment).
    this.applyJsonbFilter(query, 'authors', filters.author)
    this.applyJsonbFilter(query, 'subdomain', filters.subdomain)

    return query
  }

  /** Filtre OR sur une colonne jsonb tableau (`col @> '["v"]'`). */
  private static applyJsonbFilter(
    query: ReturnType<typeof Production.query>,
    column: string,
    values: string[]
  ) {
    if (!values.length) return
    query.where((sub) => {
      for (const value of values) {
        sub.orWhereRaw(`${column} @> ?::jsonb`, [JSON.stringify([value])])
      }
    })
  }

  static search({ q, filters, sort, page, perPage }: SearchOptions) {
    const query = this.baseQuery(filters)

    const term = q?.trim()
    if (term) {
      query.whereRaw("search_vector @@ websearch_to_tsquery('simple', ?)", [term])
    }

    // Tri (FR16/UX-DR5). `relevance` requiert un terme ; sinon retombe sur la date.
    if (sort === 'views') {
      query.orderBy('viewsCount', 'desc')
    } else if (sort === 'downloads') {
      query.orderBy('downloadsCount', 'desc')
    } else if (sort === 'relevance' && term) {
      query.orderByRaw("ts_rank(search_vector, websearch_to_tsquery('simple', ?)) desc", [term])
    } else {
      query.orderBy('antaPublishedAt', 'desc')
    }

    // Départage déterministe (clé primaire) — pagination stable sur valeurs ex-aequo.
    query.orderBy('id', 'asc')

    return query.paginate(page, perPage)
  }

  /**
   * Résultats approchants quand la recherche exacte est vide (filtres conservés).
   * Retourne [] si aucun terme ou aucune proximité trouvée.
   */
  static async approximate({
    q,
    filters,
    limit = APPROX_LIMIT,
  }: {
    q: string
    filters: ProductionFilters
    limit?: number
  }): Promise<Production[]> {
    const term = q.trim()
    if (!term) return []

    // 1. Relâche OR : au moins un mot (préfixe) correspond. Mots assainis → to_tsquery sûr.
    const words = term
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean)
    if (words.length) {
      const orQuery = words.map((w) => `${w}:*`).join(' | ')
      const relaxed = await this.baseQuery(filters)
        .whereRaw("search_vector @@ to_tsquery('simple', ?)", [orQuery])
        .orderByRaw("ts_rank(search_vector, to_tsquery('simple', ?)) desc", [orQuery])
        .orderBy('id', 'asc')
        .limit(limit)
      if (relaxed.length) return relaxed
    }

    // 2. Proximité orthographique (pg_trgm) sur le titre — gère les fautes de frappe.
    return this.baseQuery(filters)
      .whereRaw('similarity(title, ?) > 0.1', [term])
      .orderByRaw('similarity(title, ?) desc', [term])
      .orderBy('id', 'asc')
      .limit(limit)
  }

  /** Valeurs distinctes disponibles par dimension (productions publiées uniquement). */
  static async facets(): Promise<Facets> {
    const [category, domain, language, country, license, author, subdomain] = await Promise.all([
      this.distinctValues('category'),
      this.distinctValues('domain'),
      this.distinctValues('language'),
      this.distinctValues('publicationCountry'),
      this.distinctValues('licenseStatus'),
      this.distinctJsonbValues('authors'),
      this.distinctJsonbValues('subdomain'),
    ])

    return { category, domain, subdomain, author, language, country, license }
  }

  /** Valeurs distinctes d'une colonne jsonb tableau (auteurs, sous-domaines). */
  private static async distinctJsonbValues(column: string): Promise<string[]> {
    const res = await db.rawQuery(
      `select distinct jsonb_array_elements_text(${column}) as value
       from productions
       where status = ?
       order by value asc`,
      [ProductionStatus.PUBLISHED]
    )
    return (res.rows as { value: string }[]).map((r) => r.value)
  }

  private static async distinctValues(column: string): Promise<string[]> {
    const rows = await Production.query()
      .where('status', ProductionStatus.PUBLISHED)
      .whereNotNull(column)
      .distinct(column)
      .orderBy(column, 'asc')

    return rows
      .map((row) => (row as unknown as Record<string, string>)[column])
      .filter((value) => value !== null && value !== '')
  }
}
