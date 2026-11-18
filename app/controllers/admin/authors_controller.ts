import type { HttpContext } from '@adonisjs/core/http'
import { errors as lucidErrors } from '@adonisjs/lucid'
import Author from '#models/author'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import AuthorService, { type AuthorListFilters } from '#services/author_service'
import { normalizeKey } from '#helpers/normalize'
import { authorValidator, assertAffiliationRule } from '#validators/admin/author_validator'

const PER_PAGE = 20
/** Longest search term kept (longer input is truncated). */
const MAX_Q_LENGTH = 100
/** UUID guard: a non-UUID id passed to `where` would make Postgres throw (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function strInput(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Authors referential in the admin panel (Stories 9.1 and 9.2, FR52, FR55) - admin and
 * super admin (`middleware.admin()` group, P2-15): list with search, filters and counters,
 * create, edit and delete (refused while the card is linked to a production).
 */
export default class AuthorsController {
  async index({ request, inertia }: HttpContext) {
    const page = Math.max(1, Number(request.input('page', 1)) || 1)

    const rawQ = strInput(request.input('q'))
    const rawInstitution = strInput(request.input('institution'))
    const institution = rawInstitution ? normalizeKey(rawInstitution) || null : null
    const filters: AuthorListFilters = {
      q: rawQ ? rawQ.slice(0, MAX_Q_LENGTH).trim() || null : null,
      institution,
      consent: request.input('consent') === 'pending' ? 'pending' : null,
      incomplete: request.input('incomplete') === '1',
    }

    const query = Author.query().preload('affiliations').withCount('productions')
    AuthorService.applyListFilters(query, filters)
    AuthorService.applyListOrder(query, filters.q)
    const paginator = await query.paginate(page, PER_PAGE)
    const meta = paginator.getMeta()

    const [counts, institutionOptions] = await Promise.all([
      AuthorService.quickFilterCounts(),
      AuthorService.institutionOptions(),
    ])

    return inertia.render('admin/Authors/Index', {
      authors: paginator.all().map((author) => {
        const primary = author.affiliations[0]
        return {
          id: author.id,
          firstNames: author.firstNames,
          lastNames: author.lastNames,
          primaryAffiliation: primary
            ? { institution: primary.institution, department: primary.department }
            : null,
          updatedAt: (author.updatedAt ?? author.createdAt)?.toISO() ?? null,
          productionsCount: Number(author.$extras.productions_count ?? 0),
          isPublic: author.consentConfirmedAt !== null,
          isIncomplete: author.affiliations.length === 0,
        }
      }),
      pagination: {
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        total: meta.total,
        perPage: meta.perPage,
      },
      filters: {
        q: filters.q,
        institution: filters.institution,
        consent: filters.consent,
        incomplete: filters.incomplete,
      },
      counts,
      institutionOptions,
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('admin/Authors/Create', {})
  }

  async store({ request, auth, response, session }: HttpContext) {
    const data = await request.validateUsing(authorValidator)
    assertAffiliationRule(data, { isMigrated: false })

    const author = await AuthorService.create(data, auth.user!.id)

    // After the commit: ActivityLogService is outside the transaction and never throws.
    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.CREATE,
      resourceType: 'author',
      resourceId: author.id,
      metadata: { name: AuthorService.displayName(author) },
    })

    session.flash('success', 'authors.flash.created')
    return response.redirect(`/admin/authors/${author.id}/edit`)
  }

  async edit({ params, inertia }: HttpContext) {
    const author = await this.findOrFail(params.id)
    await author.load('affiliations')

    return inertia.render('admin/Authors/Edit', {
      author: {
        id: author.id,
        firstNames: author.firstNames,
        lastNames: author.lastNames,
        googleScholarUrl: author.googleScholarUrl ?? '',
        affiliations: author.affiliations.map((a) => ({
          institution: a.institution,
          department: a.department ?? '',
        })),
        isMigrated: author.migrationKey !== null,
        productionsCount: await AuthorService.productionsCount(author.id),
      },
    })
  }

  async update({ params, request, auth, response, session }: HttpContext) {
    const author = await this.findOrFail(params.id)
    const data = await request.validateUsing(authorValidator)
    assertAffiliationRule(data, { isMigrated: author.migrationKey !== null })

    const { fields } = await AuthorService.update(author, data)

    if (fields.length > 0) {
      await ActivityLogService.log({
        adminUserId: auth.user!.id,
        actionType: ActionType.UPDATE,
        resourceType: 'author',
        resourceId: author.id,
        metadata: { name: AuthorService.displayName(author), fields },
      })
    }

    session.flash('success', 'authors.flash.saved')
    return response.redirect(`/admin/authors/${author.id}/edit`)
  }

  /**
   * Deletes a card linked to no production (FR55). Back to the list, with its filters and
   * page when the request came from it (from the edit page, `back()` would land on a 404).
   */
  async destroy({ params, auth, request, response, session }: HttpContext) {
    const author = await this.findOrFail(params.id)
    const name = AuthorService.displayName(author)
    const listUrl = this.listUrlFrom(request.header('referer'))

    const result = await AuthorService.delete(author)
    if (!result.deleted) {
      session.flash('error', 'authors.delete.refused')
      return response.redirect(listUrl)
    }

    // After the commit: ActivityLogService is outside the transaction and never throws.
    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.DELETE,
      resourceType: 'author',
      resourceId: author.id,
      metadata: { name },
    })

    session.flash('success', 'authors.flash.deleted')
    return response.redirect(listUrl)
  }

  /** The list URL with its query string when the referer is the list; never another host. */
  private listUrlFrom(referer: string | undefined): string {
    if (!referer) return '/admin/authors'
    try {
      const url = new URL(referer)
      return url.pathname === '/admin/authors' ? `${url.pathname}${url.search}` : '/admin/authors'
    } catch {
      return '/admin/authors'
    }
  }

  /** 404 for a malformed or unknown id (never a Postgres error). */
  private async findOrFail(id: unknown): Promise<Author> {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new lucidErrors.E_ROW_NOT_FOUND()
    }
    return Author.findOrFail(id)
  }
}
