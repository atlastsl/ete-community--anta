import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { FEATURED_MAX_SLOTS } from '#services/featured_service'

/**
 * Featured selection (Story 11.4, P2.6): ordered distinct production ids, at most 3. An empty
 * list is valid (it removes the banner, FR47). Existence, status and thumbnail are checked by
 * `FeaturedService.save`.
 */
export const featuredValidator = vine.compile(
  vine.object({
    productionIds: vine.array(vine.string().uuid()).maxLength(FEATURED_MAX_SLOTS).distinct(),
  })
)

featuredValidator.messagesProvider = new SimpleMessagesProvider({
  'productionIds.required': 'featured.errors.invalid',
  'productionIds.array': 'featured.errors.invalid',
  'productionIds.maxLength': 'featured.errors.too_many',
  'productionIds.array.maxLength': 'featured.errors.too_many',
  'productionIds.distinct': 'featured.errors.duplicate',
  'productionIds.*.string': 'featured.errors.invalid',
  'productionIds.*.uuid': 'featured.errors.invalid',
  'string': 'featured.errors.invalid',
  'uuid': 'featured.errors.invalid',
})
