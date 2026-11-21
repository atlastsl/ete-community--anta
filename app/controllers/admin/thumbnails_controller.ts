import { unlink } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { errors as vineErrors } from '@vinejs/vine'
import Production from '#models/production'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import ImageService, {
  ImageValidationError,
  type ImageErrorCode,
  type ImageVariant,
} from '#services/image_service'
import ThumbnailService from '#services/thumbnail_service'
import { thumbnailValidator } from '#validators/admin/thumbnail_validator'

/** UUID guard: a non-UUID id passed to `where` would make Postgres throw (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `ImageService` refusal → `thumbnail.errors.*` suffix. */
const ERROR_KEYS: Record<ImageErrorCode, string> = {
  photo_type: 'invalid_type',
  photo_size: 'too_large',
  photo_dimensions: 'dimensions',
}

/**
 * Thumbnail of a production (Story 11.1, P2.6): immediate upload or removal from
 * `ThumbnailField` (featured page, D37). Always a back redirect: the field's visit keeps the
 * page state, so every failure is an error on the `thumbnail` field (refused file, unknown
 * production, storage failure), never an error page that would replace the featured page.
 * No success flash: the field shows its own toast (a repeated flash would not re-trigger the
 * layout's toast while the page stays mounted).
 */
export default class ThumbnailsController {
  async store({ request, params, auth, response, session }: HttpContext) {
    try {
      const production = await this.find(params.productionId)
      if (!production) return this.fail(session, response, 'not_found')
      const { thumbnail } = await request.validateUsing(thumbnailValidator)

      let variants: ImageVariant[]
      try {
        if (!thumbnail.tmpPath) throw new ImageValidationError('photo_type')
        variants = await ImageService.thumbnailVariants(thumbnail.tmpPath)
      } catch (error) {
        if (!(error instanceof ImageValidationError)) throw error
        throw new vineErrors.E_VALIDATION_ERROR([
          {
            field: 'thumbnail',
            message: `thumbnail.errors.${ERROR_KEYS[error.code]}`,
            rule: error.code,
          },
        ])
      }

      try {
        await ThumbnailService.set(production, variants)
      } catch (error) {
        return this.storageFailure(error, production.id, session, response)
      }
      await ActivityLogService.log({
        adminUserId: auth.user!.id,
        actionType: ActionType.UPDATE,
        resourceType: 'production',
        resourceId: production.id,
        metadata: { field: 'thumbnail', op: 'set' },
      })
      return response.redirect().back()
    } finally {
      await this.discardUpload(request)
    }
  }

  async destroy({ params, auth, response, session }: HttpContext) {
    const production = await this.find(params.productionId)
    if (!production) return this.fail(session, response, 'not_found')

    let removed: boolean
    try {
      removed = await ThumbnailService.remove(production)
    } catch (error) {
      return this.storageFailure(error, production.id, session, response)
    }
    if (removed) {
      await ActivityLogService.log({
        adminUserId: auth.user!.id,
        actionType: ActionType.UPDATE,
        resourceType: 'production',
        resourceId: production.id,
        metadata: { field: 'thumbnail', op: 'remove' },
      })
    }
    return response.redirect().back()
  }

  /** `null` for a malformed (never sent to Postgres) or unknown id. */
  private async find(id: unknown): Promise<Production | null> {
    if (typeof id !== 'string' || !UUID_RE.test(id)) return null
    return Production.find(id)
  }

  private fail(
    session: HttpContext['session'],
    response: HttpContext['response'],
    code: 'not_found' | 'storage'
  ) {
    // Flashed like a validation error (`inputErrorsBag`): the only bag shared as the Inertia
    // `errors` prop, so the field's visit gets it in `onError` (`flashErrors` is not shared).
    session.flashValidationErrors(
      new vineErrors.E_VALIDATION_ERROR([
        { field: 'thumbnail', message: `thumbnail.errors.${code}`, rule: code },
      ]),
      false
    )
    return response.redirect().back()
  }

  /** R2 or database failure: logged; a production deleted meanwhile is `not_found`. */
  private storageFailure(
    error: unknown,
    productionId: string,
    session: HttpContext['session'],
    response: HttpContext['response']
  ) {
    if (error instanceof lucidErrors.E_ROW_NOT_FOUND) {
      return this.fail(session, response, 'not_found')
    }
    logger.error({ err: error, productionId }, 'Thumbnail storage failed')
    return this.fail(session, response, 'storage')
  }

  /** The bodyparser never removes its temporary upload files: done after every request. */
  private async discardUpload(request: HttpContext['request']): Promise<void> {
    const tmpPath = request.file('thumbnail')?.tmpPath
    if (tmpPath) await unlink(tmpPath).catch(() => {})
  }
}
