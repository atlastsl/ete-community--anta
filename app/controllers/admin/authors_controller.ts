import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { errors as vineErrors } from '@vinejs/vine'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import Author from '#models/author'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import AuthorService, { type AuthorListFilters } from '#services/author_service'
import FileStorageService from '#services/file_storage_service'
import ImageService, { ImageValidationError, type ImageVariant } from '#services/image_service'
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

    const authors = paginator.all()
    const photoUrls = await Promise.all(
      authors.map((author) => this.photoUrl(author.photoKey, 'w128.webp'))
    )

    return inertia.render('admin/Authors/Index', {
      authors: authors.map((author, index) => {
        const primary = author.affiliations[0]
        return {
          id: author.id,
          firstNames: author.firstNames,
          lastNames: author.lastNames,
          photoUrl: photoUrls[index],
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
    const validated = await request.validateUsing(authorValidator)
    const data = { ...validated, affiliations: validated.affiliations ?? [] }
    assertAffiliationRule(data, { isMigrated: false })
    // Image processing comes before any write (card or R2 object).
    const photo = await this.photoVariants(validated.photo)

    const author = await AuthorService.create(data, auth.user!.id, photo)

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
        photoUrl: await this.photoUrl(author.photoKey, 'w384.webp'),
      },
    })
  }

  async update({ params, request, auth, response, session }: HttpContext) {
    const author = await this.findOrFail(params.id)
    const validated = await request.validateUsing(authorValidator)
    const data = { ...validated, affiliations: validated.affiliations ?? [] }
    assertAffiliationRule(data, { isMigrated: author.migrationKey !== null })
    const photo = await this.photoVariants(validated.photo)

    const { fields } = await AuthorService.update(author, data, {
      photo,
      removePhoto: validated.removePhoto === true,
    })

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

  /**
   * Decodes and normalizes the uploaded photo; a refused image becomes an inline error
   * under the photo field (same mechanism as `assertAffiliationRule`).
   */
  private async photoVariants(
    file: MultipartFile | undefined | null
  ): Promise<ImageVariant[] | null> {
    if (!file) return null
    try {
      if (!file.tmpPath) throw new ImageValidationError('photo_type')
      return await ImageService.authorPhotoVariants(file.tmpPath)
    } catch (error) {
      if (!(error instanceof ImageValidationError)) throw error
      throw new vineErrors.E_VALIDATION_ERROR([
        { field: 'photo', message: `authors.form.errors.${error.code}`, rule: error.code },
      ])
    }
  }

  /** Signed preview URL of a photo variant (never public); `null` if signing fails. */
  private async photoUrl(photoKey: string | null, variant: string): Promise<string | null> {
    if (!photoKey) return null
    const key = `${photoKey}/${variant}`
    try {
      return await FileStorageService.signedUrl(key)
    } catch (error) {
      logger.error({ err: error, key }, 'Failed to sign author photo URL')
      return null
    }
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
