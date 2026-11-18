import type { HttpContext } from '@adonisjs/core/http'
import { errors as lucidErrors } from '@adonisjs/lucid'
import Author from '#models/author'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import AuthorService from '#services/author_service'
import { authorValidator, assertAffiliationRule } from '#validators/admin/author_validator'

const PER_PAGE = 20
/** UUID guard: a non-UUID id passed to `where` would make Postgres throw (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Authors referential in the admin panel (Story 9.1, FR52) - admin and super admin
 * (`middleware.admin()` group, P2-15). Search, filters and deletion come with Story 9.2.
 */
export default class AuthorsController {
  async index({ request, inertia }: HttpContext) {
    const page = Math.max(1, Number(request.input('page', 1)) || 1)

    const paginator = await Author.query()
      .preload('affiliations')
      .orderBy('last_names', 'asc')
      .orderBy('first_names', 'asc')
      .orderBy('id', 'asc')
      .paginate(page, PER_PAGE)
    const meta = paginator.getMeta()

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
        }
      }),
      pagination: {
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        total: meta.total,
        perPage: meta.perPage,
      },
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

  /** 404 for a malformed or unknown id (never a Postgres error). */
  private async findOrFail(id: unknown): Promise<Author> {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new lucidErrors.E_ROW_NOT_FOUND()
    }
    return Author.findOrFail(id)
  }
}
