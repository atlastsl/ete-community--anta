import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { normalizeKey } from '#helpers/normalize'
import ProductionStatus from '#enums/production_status'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import PosterService, { type PosterCandidate } from '#services/poster_service'
import ThumbnailService from '#services/thumbnail_service'
import ProductionAuthorService from '#services/production_author_service'
import ActivityLogService from '#services/activity_log_service'
import ActionType from '#enums/action_type'
import MediaService from '#services/media_service'
import PublicBylineService, { type AuthorCredit } from '#services/public_byline_service'

/** Number of featured slots (P2.1: `position` CHECK 1..3). */
export const FEATURED_MAX_SLOTS = 3
/** Shortest normalized search term of the production picker. */
export const CANDIDATES_MIN_LENGTH = 2
/** Results of one picker search. */
export const CANDIDATES_LIMIT = 10
const SIMILARITY_THRESHOLD = 0.3

const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

export type FeaturedErrorCode = 'not_found' | 'not_published' | 'thumbnail_required' | 'duplicate'

/** Refusal of a selection or of a thumbnail removal (`featured.errors.<code>`). */
export class FeaturedError extends Error {
  constructor(
    readonly code: FeaturedErrorCode,
    readonly productionId: string
  ) {
    super(`Featured selection refused: ${code}`)
  }
}

/** Image shown by the banner: thumbnail, else extracted video frame, else none (FR50). */
export type FeaturedImageState = 'thumbnail' | 'poster' | 'missing'

/**
 * One author of an item: a card of the referential (formatted « Prénom NOM » by the client,
 * D13) or a denormalized name no linked card matches (unconverted production), as is.
 */
export type FeaturedAuthor = { firstNames: string; lastNames: string } | { name: string }

/**
 * A production as shown by the featured page (slot, picker option, banner preview). Mirrored
 * by `inertia/lib/featured.ts`. Preview URLs are signed (`w800`, admin only).
 */
export type FeaturedItem = {
  id: string
  title: string
  authors: FeaturedAuthor[]
  category: string | null
  domain: string | null
  imageState: FeaturedImageState
  /** `thumbnail_key` is set (true even when its URL could not be signed). */
  hasThumbnail: boolean
  /** FR50: no hosted video with an extracted frame. */
  requiresThumbnail: boolean
  thumbnailPreviewUrl: string | null
  posterPreviewUrl: string | null
  /** Totals shown by the banner card (FR49). */
  viewsCount: number
  downloadsCount: number
  /** Not published (any more): cannot be saved as is, never shown by the banner. */
  unavailable: boolean
}

/**
 * A card of the public home banner (Story 11.6, FR49): strictly the image base (public
 * `/media/…` URL, never a key or a signed URL), the title, the public byline and the totals.
 */
export type FeaturedBannerItem = {
  id: string
  slug: string
  title: string
  authors: AuthorCredit[]
  imageUrl: string
  viewsCount: number
  downloadsCount: number
}

/** A featured production of the banner with its displayed image base (before bylines). */
export type FeaturedBannerRow = { production: Production; imageUrl: string }

/** Why a production left the selection automatically (journal `metadata.cause`). */
export type FeaturedRemovalCause = 'unpublish' | 'delete'

export type FeaturedSaveResult = { before: string[]; after: string[]; changed: boolean }

type DbClient = TransactionClientContract | typeof db

/**
 * Featured productions (Story 11.4, FR47, FR50, P2.1, P2.6): up to 3 published productions in
 * an editorial order. The selection is rewritten as a whole (DELETE + INSERT 1..n, never
 * `UPDATE position`) under a table lock that serializes the writers; productions are read
 * `FOR SHARE`, which waits for (and is waited by) the thumbnail removal lock.
 */
export default class FeaturedService {
  /** FR50 (P2.5): a thumbnail is required unless a hosted MP4 has an extracted frame. */
  static requiresThumbnail(production: { files: readonly PosterCandidate[] }): boolean {
    return PosterService.displayed(production.files) === null
  }

  /** The production cannot be featured as is: no thumbnail while one is required. */
  static missingThumbnail(production: {
    thumbnailKey: string | null
    files: readonly PosterCandidate[]
  }): boolean {
    return !production.thumbnailKey && this.requiresThumbnail(production)
  }

  /** Ids of the current selection, by position. */
  static async selectionIds(client: DbClient = db): Promise<string[]> {
    const rows = await client
      .from('featured_productions')
      .select('production_id')
      .orderBy('position', 'asc')
    return rows.map((row: { production_id: string }) => row.production_id)
  }

  /**
   * Replaces the selection (FR47): refuses any unknown, unpublished production or one without
   * its required thumbnail (`FeaturedError`, nothing written). The same selection writes
   * nothing (`changed: false`, D-11.4-4). Logging is the caller's job, after the commit.
   */
  static async save(productionIds: string[], adminId: string): Promise<FeaturedSaveResult> {
    const ids = productionIds.map((id) => id.toLowerCase())
    // Same uuid in two cases: one production in two slots (the unique key would refuse it).
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)
    if (duplicate) throw new FeaturedError('duplicate', duplicate)
    return db.transaction(async (trx) => {
      // Lock order (D-11.4-5), shared with every writer of the selection: production rows
      // first, then the table. `ProductionService.unpublish` / `.delete` hold the production
      // row when `removeProduction` takes the table: taking the table first would deadlock.
      await this.assertFeaturable(ids, trx)
      // Self-conflicting, readers allowed: concurrent writers never collide on the PK.
      await trx.rawQuery('LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE')

      const before = await this.selectionIds(trx)
      if (before.length === ids.length && before.every((id, index) => id === ids[index])) {
        return { before, after: before, changed: false }
      }
      await trx.from('featured_productions').delete()
      if (ids.length > 0) {
        await trx.table('featured_productions').multiInsert(
          ids.map((id, index) => ({
            position: index + 1,
            production_id: id,
            created_by_id: adminId,
          }))
        )
      }
      return { before, after: ids, changed: true }
    })
  }

  /**
   * Guard of the thumbnail removal (Story 11.1 route), called inside its transaction once the
   * production row is locked: a featured production that requires its thumbnail keeps it.
   */
  static async assertThumbnailRemovable(
    productionId: string,
    trx: TransactionClientContract
  ): Promise<void> {
    const featured = await trx
      .from('featured_productions')
      .where('production_id', productionId)
      .first()
    if (!featured) return
    const files = await ProductionFile.query({ client: trx }).where('production_id', productionId)
    if (this.requiresThumbnail({ files })) {
      throw new FeaturedError('thumbnail_required', productionId)
    }
  }

  /**
   * Automatic removal (Story 11.5, FR51, D21): the production leaves the selection inside the
   * caller's unpublish / delete transaction, which must already hold the production row
   * (lock order D-11.4-5: row first, then the table) and call this BEFORE deleting the row
   * (the CASCADE would drop the slot unlogged). The following slots move up (D30) one row at
   * a time in ascending order (`position = k` where `position = k + 1`): each move targets a
   * free slot, so the non-deferrable primary key holds (a bulk `position - 1` would not), and
   * `production_id` is unchanged, so no FK check locks the other featured productions (a
   * DELETE + INSERT rewrite would take FOR KEY SHARE on them after the table lock and
   * deadlock with an admin holding one of them FOR UPDATE, D-11.5-7). Rows stay exact
   * (`created_by_id`, `created_at`).
   * `featured_auto_remove` is logged once the transaction commits (`ActivityLogService` is
   * outside the transaction), never on rollback. Returns the removed position, or null.
   */
  static async removeProduction(
    productionId: string,
    adminId: string,
    cause: FeaturedRemovalCause,
    trx: TransactionClientContract
  ): Promise<number | null> {
    await trx.rawQuery('LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE')
    const rows: { position: number; production_id: string }[] = await trx
      .from('featured_productions')
      .select('position', 'production_id')
      .orderBy('position', 'asc')
    const removed = rows.find((row) => row.production_id === productionId)
    if (!removed) return null

    const position = removed.position
    await trx.from('featured_productions').where('production_id', productionId).delete()
    const following = rows.filter((row) => row.position > position)
    for (const [index, row] of following.entries()) {
      await trx
        .from('featured_productions')
        .where('position', row.position)
        .update({ position: position + index })
    }
    trx.after('commit', () =>
      ActivityLogService.log({
        adminUserId: adminId,
        actionType: ActionType.FEATURED_AUTO_REMOVE,
        resourceType: 'production',
        resourceId: productionId,
        metadata: { position, cause },
      })
    )
    return position
  }

  /**
   * Public banner of the home page (Story 11.6, FR48, FR49), read on every request (never
   * cached, P2.3): the **published** featured productions, by position, with their totals and
   * displayed image (thumbnail, else extracted frame, P2.1). A production without any
   * displayable image (video removed, D-11.5-6) is left out (D-11.6-2), like the admin
   * preview. Two queries (selection with its aggregates as subqueries, then the MP4 files
   * with a poster). The bylines are **not** attached here: the caller attaches them once for
   * every production of the page (`PublicBylineService.attach`), then calls `bannerItems`.
   */
  static async bannerRows(): Promise<FeaturedBannerRow[]> {
    const productions = await Production.query()
      .select('productions.*')
      .join('featured_productions', 'featured_productions.production_id', 'productions.id')
      .where('productions.status', ProductionStatus.PUBLISHED)
      .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
      .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))
      .preload('files', (q) => q.where('mime_type', 'video/mp4').whereNotNull('poster_key'))
      .orderBy('featured_productions.position', 'asc')

    return productions.flatMap((production) => {
      const imageUrl = MediaService.productionImageUrl({
        status: production.status,
        thumbnailKey: production.thumbnailKey,
        files: production.files,
      })
      return imageUrl ? [{ production, imageUrl }] : []
    })
  }

  /** Public cards of the banner rows; their bylines must already be attached. */
  static bannerItems(rows: FeaturedBannerRow[]): FeaturedBannerItem[] {
    return rows.map(({ production, imageUrl }) => ({
      id: production.id,
      slug: production.slug,
      title: production.title,
      authors: PublicBylineService.of(production),
      imageUrl,
      viewsCount: Number(production.$extras.viewsCount ?? 0),
      downloadsCount: Number(production.$extras.downloadsCount ?? 0),
    }))
  }

  /** The current selection as page items, by position. */
  static async selection(): Promise<FeaturedItem[]> {
    const ids = await this.selectionIds()
    if (ids.length === 0) return []
    const productions = await Production.query().whereIn('id', ids).preload('files')
    return this.toItems(this.inOrder(productions, ids))
  }

  /**
   * Existing productions among `ids`, in that order, whatever their status (`unavailable`
   * when not published): refresh of the unsaved slots (D-11.4-2). A deleted one is absent.
   */
  static async items(ids: string[]): Promise<FeaturedItem[]> {
    if (ids.length === 0) return []
    const productions = await Production.query().whereIn('id', ids).preload('files')
    return this.toItems(this.inOrder(productions, ids))
  }

  /**
   * Picker search (D-11.4-7): published productions by title (substring or trigram
   * similarity) or author (denormalized names, or `search_name` of a linked author card),
   * excluding the chosen ones.
   */
  static async candidates({
    q,
    exclude,
  }: {
    q: string
    exclude: string[]
  }): Promise<FeaturedItem[]> {
    const term = q.trim()
    const normalized = normalizeKey(term)
    if (normalized.length < CANDIDATES_MIN_LENGTH) return []
    const like = `%${escapeLike(term)}%`
    const normalizedLike = `%${escapeLike(normalized)}%`

    const query: ModelQueryBuilderContract<typeof Production> = Production.query()
      .where('productions.status', ProductionStatus.PUBLISHED)
      .where((sub) => {
        sub
          .whereRaw('productions.title ILIKE ?', [like])
          .orWhereRaw('similarity(productions.title, ?) > ?', [term, SIMILARITY_THRESHOLD])
          .orWhereRaw('productions.authors::text ILIKE ?', [like])
          .orWhereExists((pivot) =>
            pivot
              .from('production_authors')
              .join('authors', 'authors.id', 'production_authors.author_id')
              .whereColumn('production_authors.production_id', 'productions.id')
              .whereRaw('authors.search_name LIKE ?', [normalizedLike])
          )
      })
    if (exclude.length > 0) query.whereNotIn('productions.id', exclude)
    const productions = await query
      .orderByRaw('(productions.title ILIKE ?) DESC', [`${escapeLike(term)}%`])
      .orderByRaw('similarity(productions.title, ?) DESC', [term])
      .orderBy('productions.anta_published_at', 'desc')
      .orderBy('productions.id', 'asc')
      .limit(CANDIDATES_LIMIT)
      .preload('files')
    return this.toItems(productions)
  }

  /**
   * Page items: authors (pivot cards, then unmatched names), totals, image state and signed
   * previews (thumbnail, else displayed poster). Three queries whatever the batch size.
   */
  static async toItems(productions: Production[]): Promise<FeaturedItem[]> {
    if (productions.length === 0) return []
    const ids = productions.map((production) => production.id)
    const [authorRows, views, downloads] = await Promise.all([
      db
        .from('production_authors')
        .join('authors', 'authors.id', 'production_authors.author_id')
        .whereIn('production_authors.production_id', ids)
        .orderBy('production_authors.production_id')
        .orderBy('production_authors.position')
        .select(
          'production_authors.production_id',
          'authors.first_names',
          'authors.last_names',
          'authors.search_name'
        ),
      this.totals('stats_views', ids),
      this.totals('stats_downloads', ids),
    ])
    const linkedOf = new Map<string, typeof authorRows>()
    for (const row of authorRows) {
      linkedOf.set(row.production_id, [...(linkedOf.get(row.production_id) ?? []), row])
    }

    return Promise.all(
      productions.map(async (production) => {
        const linked = linkedOf.get(production.id) ?? []
        const { unlinkedNames } = ProductionAuthorService.legacyOf(
          production.authorNames,
          linked.map((row: { search_name: string }) => row.search_name)
        )
        const authors: FeaturedAuthor[] = [
          ...linked.map((row: { first_names: string; last_names: string }) => ({
            firstNames: row.first_names,
            lastNames: row.last_names,
          })),
          ...unlinkedNames.map((name) => ({ name })),
        ]
        const files = production.files ?? []
        const poster = PosterService.displayed(files)
        const hasThumbnail = !!production.thumbnailKey
        const requiresThumbnail = poster === null
        const [thumbnailPreviewUrl, posterPreviewUrl] = await Promise.all([
          ThumbnailService.signedUrl(production.thumbnailKey),
          PosterService.signedUrl(poster?.posterKey ?? null),
        ])
        return {
          id: production.id,
          title: production.title,
          authors,
          category: production.category,
          domain: production.domain,
          imageState: hasThumbnail ? 'thumbnail' : requiresThumbnail ? 'missing' : 'poster',
          hasThumbnail,
          requiresThumbnail,
          thumbnailPreviewUrl,
          posterPreviewUrl,
          viewsCount: views.get(production.id) ?? 0,
          downloadsCount: downloads.get(production.id) ?? 0,
          unavailable: production.status !== ProductionStatus.PUBLISHED,
        } satisfies FeaturedItem
      })
    )
  }

  /** Locks the chosen productions (`FOR SHARE`) and checks each of them, in order. */
  private static async assertFeaturable(
    ids: string[],
    trx: TransactionClientContract
  ): Promise<void> {
    if (ids.length === 0) return
    const query = Production.query({ client: trx }).whereIn('id', ids)
    query.knexQuery.forShare()
    const productions = await query.preload('files')
    const byId = new Map(productions.map((production) => [production.id, production]))
    for (const id of ids) {
      const production = byId.get(id)
      if (!production) throw new FeaturedError('not_found', id)
      if (production.status !== ProductionStatus.PUBLISHED) {
        throw new FeaturedError('not_published', id)
      }
      if (
        this.missingThumbnail({ thumbnailKey: production.thumbnailKey, files: production.files })
      ) {
        throw new FeaturedError('thumbnail_required', id)
      }
    }
  }

  /** Row count per production of a stats table. */
  private static async totals(table: string, ids: string[]): Promise<Map<string, number>> {
    const rows = await db
      .from(table)
      .whereIn('production_id', ids)
      .groupBy('production_id')
      .select('production_id')
      .count('* as total')
    return new Map(
      rows.map((row: { production_id: string; total: string | number }) => [
        row.production_id,
        Number(row.total),
      ])
    )
  }

  private static inOrder(productions: Production[], ids: string[]): Production[] {
    const byId = new Map(productions.map((production) => [production.id, production]))
    return ids.map((id) => byId.get(id)).filter((p): p is Production => p !== undefined)
  }
}
