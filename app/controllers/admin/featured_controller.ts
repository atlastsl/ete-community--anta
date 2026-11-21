import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { errors as vineErrors } from '@vinejs/vine'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import FeaturedService, { FeaturedError } from '#services/featured_service'
import { featuredValidator } from '#validators/admin/featured_validator'

/** UUID guard: a non-UUID id passed to `whereIn` would make Postgres throw (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_Q_LENGTH = 100
const MAX_IDS = 50

/**
 * UUIDs of a repeated query string parameter (`exclude[]`, `ids[]`), lower-cased. Beyond 20
 * items qs turns the array into an object (`arrayLimit`): its values are accepted as well.
 */
function uuidList(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === 'object'
      ? Object.values(raw)
      : raw === undefined || raw === null
        ? []
        : [raw]
  return values
    .filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
    .map((id) => id.toLowerCase())
    .slice(0, MAX_IDS)
}

/**
 * Featured page (Story 11.4, FR47, FR50, P2.6). The selection is edited locally and saved
 * explicitly (`PUT`); every failure of the save is a back redirect with an error on the
 * `productionIds` field (flashed as a validation error: the only bag shared as the Inertia
 * `errors` prop), never an error page that would replace the unsaved slots. No success flash:
 * the page shows its own toast (D-11.4-6).
 */
export default class FeaturedController {
  async index({ inertia }: HttpContext) {
    return inertia.render('admin/Featured/Index', {
      selection: await FeaturedService.selection(),
    })
  }

  async update({ request, auth, response, session }: HttpContext) {
    let productionIds: string[]
    try {
      ;({ productionIds } = await request.validateUsing(featuredValidator))
    } catch (error) {
      if (!(error instanceof vineErrors.E_VALIDATION_ERROR)) throw error
      const first = (error.messages as { message: string }[])[0]?.message
      return this.fail(session, response, first ?? 'featured.errors.invalid')
    }

    let result
    try {
      result = await FeaturedService.save(productionIds, auth.user!.id)
    } catch (error) {
      if (error instanceof FeaturedError) {
        // The refused slot is named (1..n) for a production of the list (review 11.4).
        const index = productionIds.findIndex((id) => id.toLowerCase() === error.productionId)
        const position = error.code === 'duplicate' || index < 0 ? undefined : index + 1
        return this.fail(session, response, `featured.errors.${error.code}`, position)
      }
      logger.error({ err: error, productionIds }, 'Featured selection save failed')
      return this.fail(session, response, 'featured.errors.storage')
    }

    if (result.changed) {
      await ActivityLogService.log({
        adminUserId: auth.user!.id,
        actionType: ActionType.FEATURED_UPDATE,
        resourceType: 'featured_selection',
        metadata: { before: result.before, after: result.after },
      })
    }
    return response.redirect().back()
  }

  /**
   * JSON for the production picker: `q` + `exclude[]` (published productions by title or
   * author), or `ids[]` alone (fresh state of the unsaved slots after a thumbnail change,
   * any status with `unavailable`, deleted ones absent: D-11.4-2).
   */
  async candidates({ request, response }: HttpContext) {
    const ids = uuidList(request.input('ids'))
    if (ids.length > 0) {
      return response.json({ productions: await FeaturedService.items(ids) })
    }
    const rawQ = request.input('q')
    const q = typeof rawQ === 'string' ? rawQ.slice(0, MAX_Q_LENGTH) : ''
    return response.json({
      productions: await FeaturedService.candidates({
        q,
        exclude: uuidList(request.input('exclude')),
      }),
    })
  }

  private fail(
    session: HttpContext['session'],
    response: HttpContext['response'],
    message: string,
    position?: number
  ) {
    const messages = [{ field: 'productionIds', message, rule: 'featured' }]
    // Second entry of the same bag: the slot the refusal is about (`featured.errors.*_slot`).
    if (position !== undefined) {
      messages.push({ field: 'position', message: String(position), rule: 'featured' })
    }
    session.flashValidationErrors(new vineErrors.E_VALIDATION_ERROR(messages), false)
    return response.redirect().back()
  }
}
