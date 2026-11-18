import { unlink } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { errors as vineErrors } from '@vinejs/vine'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import Author from '#models/author'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import AuthorService, { type AuthorListFilters, type AuthorPayload } from '#services/author_service'
import ImageService, { ImageValidationError, type ImageVariant } from '#services/image_service'
import { normalizeKey } from '#helpers/normalize'
import { authorValidator, assertAffiliationRule } from '#validators/admin/author_validator'

const PER_PAGE = 20
/** Results of the production form picker (Story 9.7). */
const SEARCH_LIMIT = 10
/** Shortest search term of the picker (shorter → empty result, no query). */
const SEARCH_MIN_LENGTH = 2
/** Most `exclude[]` ids kept (the selected authors of one production). */
const MAX_EXCLUDE = 200
/** Longest search term kept (longer input is truncated). */
const MAX_Q_LENGTH = 100
/** UUID guard: a non-UUID id passed to `where` would make Postgres throw (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function strInput(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Authors referential in the admin panel (Stories 9.1 to 9.4, FR52, FR53, FR55) - admin and
 * super admin (`middleware.admin()` group, P2-15): list with search, filters and counters,
 * create, edit and delete (refused while the card is linked to a production), photo, and
 * consent confirmation / withdrawal (journaled `consent_confirm` / `consent_withdraw`), the
 * JSON search of the production form picker (Story 9.7) and its JSON quick creation (9.8).
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

  /**
   * Author picker of the production form (Story 9.7, P2.6): JSON `{ authors }`, at most 10
   * cards matching `q` (≥ 2 characters; case and accent insensitive, list filters and order
   * of Story 9.2), the ids of `exclude[]` (already selected) left out.
   */
  async search({ request, response }: HttpContext) {
    const rawQ = typeof request.input('q') === 'string' ? request.input('q').trim() : ''
    const q = rawQ.slice(0, MAX_Q_LENGTH).trim()
    // Length of the normalized term (what `search_name` is matched with): « é- » is 1.
    if (normalizeKey(q).length < SEARCH_MIN_LENGTH) return response.json({ authors: [] })

    // The query string parser turns `exclude[]` into an object beyond 20 items (qs
    // `arrayLimit`): its values are accepted as well.
    const rawExclude: unknown = request.input('exclude', [])
    const excludeValues = Array.isArray(rawExclude)
      ? rawExclude
      : rawExclude !== null && typeof rawExclude === 'object'
        ? Object.values(rawExclude)
        : [rawExclude]
    const exclude = excludeValues
      .filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
      .map((id) => id.toLowerCase())
      .slice(0, MAX_EXCLUDE)

    const query = Author.query().preload('affiliations')
    AuthorService.applyListFilters(query, {
      q,
      institution: null,
      consent: null,
      incomplete: false,
    })
    if (exclude.length > 0) query.whereNotIn('authors.id', exclude)
    AuthorService.applyListOrder(query, q)
    const authors = await query.limit(SEARCH_LIMIT)

    return response.json({ authors: await AuthorService.toPickerAuthors(authors) })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('admin/Authors/Create', {})
  }

  async store(ctx: HttpContext) {
    try {
      return await this.storeAuthor(ctx)
    } finally {
      await this.discardUpload(ctx.request)
    }
  }

  private async storeAuthor(ctx: HttpContext) {
    const author = await this.createAuthor(ctx)
    ctx.session.flash('success', 'authors.flash.created')
    return ctx.response.redirect(`/admin/authors/${author.id}/edit`)
  }

  /**
   * "Create an author" window of the production form (Story 9.8, FR54, P2-14): same chain as
   * `store`, but JSON so the page never navigates (the unsaved production form is kept):
   * 201 `{ author }` in the picker shape (appended to the selection as is), 422
   * `{ errors: [{ field, message, rule }] }` (i18n keys) whatever the `Accept` header.
   */
  async quickStore(ctx: HttpContext) {
    try {
      const author = await this.createAuthor(ctx)
      await author.load('affiliations')
      const [picked] = await AuthorService.toPickerAuthors([author])
      return ctx.response.created({ author: picked })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.unprocessableEntity({ errors: error.messages })
      }
      throw error
    } finally {
      await this.discardUpload(ctx.request)
    }
  }

  /**
   * Validates, decodes the photo, creates the card and journals `create` (+ `consent_confirm`
   * when the box was ticked). Shared by `store` and `quickStore`.
   */
  private async createAuthor({ request, auth }: HttpContext): Promise<Author> {
    const validated = await request.validateUsing(authorValidator)
    const data = { ...validated, affiliations: this.affiliationsOf(validated, request) }
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
    if (author.consentConfirmedAt !== null) {
      await this.logConsent(auth.user!.id, author, ActionType.CONSENT_CONFIRM)
    }
    return author
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
        // From the key, not the URL: "Remove the photo" stays offered if signing fails.
        hasPhoto: author.photoKey !== null,
        isPublic: author.consentConfirmedAt !== null,
        isIncomplete: author.affiliations.length === 0,
      },
    })
  }

  async update(ctx: HttpContext) {
    try {
      return await this.updateAuthor(ctx)
    } finally {
      await this.discardUpload(ctx.request)
    }
  }

  private async updateAuthor({ params, request, auth, response, session }: HttpContext) {
    const author = await this.findOrFail(params.id)
    const validated = await request.validateUsing(authorValidator)
    const data = { ...validated, affiliations: this.affiliationsOf(validated, request) }
    assertAffiliationRule(data, {
      isMigrated: author.migrationKey !== null,
      isPublic: author.consentConfirmedAt !== null,
    })
    const photo = await this.photoVariants(validated.photo)

    const { fields, consentConfirmed } = await AuthorService.update(author, data, {
      photo,
      removePhoto: validated.removePhoto === true,
      adminId: auth.user!.id,
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
    if (consentConfirmed) {
      await this.logConsent(auth.user!.id, author, ActionType.CONSENT_CONFIRM)
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
   * Confirms the consent from the list (Story 9.4, FR53). Refused without affiliation (D27,
   * checked by the service on the locked row); an already public card is left untouched.
   */
  async confirmConsent({ params, auth, request, response, session }: HttpContext) {
    const author = await this.findOrFail(params.id)
    const result = await AuthorService.confirmConsent(author, auth.user!.id)
    if (result === 'confirmed') {
      await this.logConsent(auth.user!.id, author, ActionType.CONSENT_CONFIRM)
      session.flash('success', 'authors.consent.flash.confirmed')
    } else if (result === 'no_affiliation') {
      session.flash('error', 'authors.consent.flash.refused')
    } else {
      session.flash('success', 'authors.consent.flash.already_public')
    }
    return response.redirect(this.consentReturnUrl(request.header('referer'), author.id))
  }

  /** Withdraws the consent (Story 9.4, D17); a card that is not public is left untouched. */
  async withdrawConsent({ params, auth, request, response, session }: HttpContext) {
    const author = await this.findOrFail(params.id)
    // Kept in the activity entry: the confirmation columns are reset by the withdrawal.
    const previous = {
      confirmedAt: author.consentConfirmedAt?.toISO() ?? null,
      confirmedById: author.consentConfirmedById,
    }
    const result = await AuthorService.withdrawConsent(author)
    if (result === 'withdrawn') {
      await this.logConsent(auth.user!.id, author, ActionType.CONSENT_WITHDRAW, { previous })
      session.flash('success', 'authors.consent.flash.withdrawn')
    } else {
      session.flash('success', 'authors.consent.flash.already_private')
    }
    return response.redirect(this.consentReturnUrl(request.header('referer'), author.id))
  }

  /**
   * Back to where the action came from: the card, or the list with its filters and page
   * (`redirect().back()` drops the query string). Never another host or page.
   */
  private consentReturnUrl(referer: string | undefined, authorId: string): string {
    const editPath = `/admin/authors/${authorId}/edit`
    if (referer) {
      try {
        if (new URL(referer).pathname === editPath) return editPath
      } catch {
        // Malformed referer: fall back on the list.
      }
    }
    return this.listUrlFrom(referer)
  }

  /** After the commit: ActivityLogService is outside the transaction and never throws. */
  private async logConsent(
    adminUserId: string,
    author: Author,
    actionType: typeof ActionType.CONSENT_CONFIRM | typeof ActionType.CONSENT_WITHDRAW,
    extra: Record<string, unknown> = {}
  ): Promise<void> {
    await ActivityLogService.log({
      adminUserId,
      actionType,
      resourceType: 'author',
      resourceId: author.id,
      metadata: { name: AuthorService.displayName(author), ...extra },
    })
  }

  /**
   * Multipart bodies drop an empty array, so a missing list means "no affiliation" there
   * only; a JSON body without the field is malformed (never a silent wipe).
   */
  private affiliationsOf(
    validated: { affiliations?: AuthorPayload['affiliations'] },
    request: HttpContext['request']
  ): AuthorPayload['affiliations'] {
    if (validated.affiliations) return validated.affiliations
    if (request.is(['multipart'])) return []
    throw new vineErrors.E_VALIDATION_ERROR([
      {
        field: 'affiliations',
        message: 'authors.form.errors.affiliation_required',
        rule: 'required',
      },
    ])
  }

  /** The bodyparser never removes its temporary upload files: done after every request. */
  private async discardUpload(request: HttpContext['request']): Promise<void> {
    const tmpPath = request.file('photo')?.tmpPath
    if (tmpPath) await unlink(tmpPath).catch(() => {})
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
    return AuthorService.signedPhotoUrl(photoKey, variant)
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
