import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import MediaService from '#services/media_service'

/**
 * Public images backed by R2 (P2.5, P2-10): `GET /media/*`. The bucket stays private; only
 * the current key of a visible owner is streamed (author photos: public profiles).
 *
 * Every refusal is an empty `404` with `Cache-Control: no-store` returned through
 * `response.notFound()`: never throw (`findOrFail`, `abort`…), the exception handler would
 * answer an image request with the HTML NotFoundPage (review note of Story 10.1).
 */
export default class MediaController {
  async show({ params, response }: HttpContext) {
    const notFound = () => {
      response.header('Cache-Control', 'no-store')
      return response.notFound()
    }

    const segments: unknown = params['*']
    if (!Array.isArray(segments) || !segments.every((s) => typeof s === 'string')) {
      return notFound()
    }

    const media = await MediaService.resolve(segments)
    if (!media) return notFound()

    const disk = drive.use('r2')
    // Metadata first: a missing object is a clean 404 (a stream error after the headers
    // would only reset the connection), and the ETag allows a 304 on revalidation.
    let meta: Awaited<ReturnType<typeof disk.getMetaData>>
    try {
      meta = await disk.getMetaData(media.key)
    } catch (error) {
      logger.warn({ err: error, key: media.key }, 'Media object missing from storage')
      return notFound()
    }

    response.header('Content-Type', media.contentType)
    response.header('Cache-Control', media.cacheControl)
    if (meta.etag) response.header('ETag', meta.etag)
    if (response.fresh()) return response.notModified()

    let stream: Awaited<ReturnType<typeof disk.getStream>>
    try {
      stream = await disk.getStream(media.key)
    } catch (error) {
      logger.warn({ err: error, key: media.key }, 'Media object could not be read')
      response.removeHeader('ETag')
      response.removeHeader('Content-Type')
      return notFound()
    }
    if (meta.contentLength) response.header('Content-Length', meta.contentLength)
    return response.stream(stream, () => {
      response.header('Cache-Control', 'no-store')
      return ['Not found', 404]
    })
  }
}
