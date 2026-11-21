import type Production from '#models/production'
import { BaseTransformer } from '@adonisjs/core/transformers'
import PublicBylineService from '#services/public_byline_service'

/**
 * Single serialization of the public production cards (P2.6, Story 10.3): home blocks,
 * listing and author profile. Expects the `viewsCount` / `downloadsCount` aggregates
 * (`withAggregate`) in `$extras`; exposes no image (D37). `authors` = the byline computed by
 * `PublicBylineService.attach` (Story 10.4: `{ name, slug | null }[]`, pivot order).
 */
export default class ProductionCardTransformer extends BaseTransformer<Production> {
  toObject() {
    const p = this.resource
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      authors: PublicBylineService.of(p),
      category: p.category,
      domain: p.domain,
      summary: p.summary,
      viewsCount: Number(p.$extras.viewsCount ?? 0),
      downloadsCount: Number(p.$extras.downloadsCount ?? 0),
      publishedAt: p.antaPublishedAt?.toISO() ?? null,
    }
  }
}
