import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import MediaService from '#services/media_service'

/**
 * Whether a storage error means "no such object" (fs fake: `ENOENT`; S3/R2: `NoSuchKey`,
 * `NotFound`, HTTP 404), looking through flydrive's wrapping exception (`cause`).
 */
export function isStorageNotFound(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; current && depth < 4; depth++) {
    const e = current as {
      code?: unknown
      name?: unknown
      Code?: unknown
      $metadata?: { httpStatusCode?: unknown }
      cause?: unknown
    }
    if (e.code === 'ENOENT' || e.code === 'NoSuchKey' || e.Code === 'NoSuchKey') return true
    if (e.name === 'NoSuchKey' || e.name === 'NotFound') return true
    if (e.$metadata?.httpStatusCode === 404) return true
    current = e.cause
  }
  return false
}

/**
 * Public images backed by R2 (P2.5, P2-10): `GET|HEAD /media/*`, called by `MediaMiddleware`
 * before the router (no session, no cookies). The bucket stays private; only the current
 * key of a visible owner is streamed (author photos: public profiles).
 *
 * Every refusal is an empty response with `Cache-Control: no-store` (404, or 503 when the
 * storage fails): never throw (`findOrFail`, `abort`…), the exception handler would answer
 * an image request with the HTML NotFoundPage (review note of Story 10.1).
 */
export default class MediaController {
  async show({ params, request, response }: HttpContext) {
    const refuse = (status: 404 | 503) => {
      for (const header of ['Content-Type', 'Content-Length', 'ETag']) response.removeHeader(header)
      response.header('Cache-Control', 'no-store')
      return status === 404 ? response.notFound() : response.serviceUnavailable()
    }
    const storageFailure = (error: unknown, key: string, step: string) => {
      if (isStorageNotFound(error)) {
        logger.warn({ key }, `Media object missing from storage (${step})`)
        return refuse(404)
      }
      logger.error({ err: error, key }, `Media storage failure (${step})`)
      return refuse(503)
    }

    const segments: unknown = params['*']
    if (!Array.isArray(segments) || !segments.every((s) => typeof s === 'string')) {
      return refuse(404)
    }

    let media: Awaited<ReturnType<typeof MediaService.resolve>>
    try {
      media = await MediaService.resolve(segments)
    } catch (error) {
      logger.error({ err: error }, 'Media lookup failed')
      return refuse(503)
    }
    if (!media) return refuse(404)

    const disk = drive.use('r2')
    // Metadata first: a missing object is a clean 404 (a stream error after the headers
    // would only reset the connection), the ETag allows a 304, HEAD needs no body.
    let meta: Awaited<ReturnType<typeof disk.getMetaData>>
    try {
      meta = await disk.getMetaData(media.key)
    } catch (error) {
      return storageFailure(error, media.key, 'metadata')
    }

    response.header('Content-Type', media.contentType)
    response.header('Cache-Control', media.cacheControl)
    if (meta.etag) response.header('ETag', meta.etag)
    if (response.fresh()) return response.notModified()
    if (meta.contentLength) response.header('Content-Length', meta.contentLength)
    if (request.method() === 'HEAD') return response.status(200)

    let stream: Awaited<ReturnType<typeof disk.getStream>>
    try {
      stream = await disk.getStream(media.key)
    } catch (error) {
      return storageFailure(error, media.key, 'stream')
    }
    return response.stream(stream, (error) => {
      // Headers are only flushed with the first chunk: drop the image ones so the client
      // gets a complete empty 404 instead of waiting for `Content-Length` bytes.
      for (const header of ['Content-Type', 'Content-Length', 'ETag']) response.removeHeader(header)
      response.header('Cache-Control', 'no-store')
      if (isStorageNotFound(error)) {
        logger.warn({ key: media.key }, 'Media object missing from storage (read)')
        return ['', 404]
      }
      logger.error({ err: error, key: media.key }, 'Media storage failure (read)')
      return ['', 503]
    })
  }
}
