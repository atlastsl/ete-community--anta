import type { HttpContext } from '@adonisjs/core/http'
import Production from '#models/production'
import ProductionLink from '#models/production_link'
import { createLinkValidator } from '#validators/admin/production_validator'

export default class LinksController {
  async store({ request, params, response, session }: HttpContext) {
    const production = await Production.findOrFail(params.productionId)
    const data = await request.validateUsing(createLinkValidator)

    await ProductionLink.create({
      productionId: production.id,
      url: data.url,
      linkType: data.linkType,
      label: data.label ?? null,
    })

    session.flash('success', 'productions.links.added')
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const link = await ProductionLink.query()
      .where('id', params.linkId)
      .where('productionId', params.productionId)
      .firstOrFail()

    await link.delete()

    session.flash('success', 'productions.links.deleted')
    return response.redirect().back()
  }
}
