import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import logger from '@adonisjs/core/services/logger'
import ImageService, { type ImageVariant } from '#services/image_service'

/** Frame extraction failure (missing binary, unreadable video, timeout, no frame). */
export class VideoFrameError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'VideoFrameError'
  }
}

/**
 * Downscale only (review of 11.3): the frame keeps the smallest size that still covers the
 * largest 16:9 variant (1600×900) — width 1600 for a frame narrower than 16:9, height 900 for
 * a wider one — so an 8K frame never reaches `VIDEO_FRAME_MAX_BYTES` and ffmpeg encodes a small
 * PNG. Quotes protect the commas from the filtergraph parser (no shell is involved).
 */
const FRAME_SCALE =
  "scale=w='if(gt(iw/1600,ih/900),-2,min(1600,iw))':h='if(gt(iw/1600,ih/900),min(900,ih),-2)'"

type RunResult = { ok: true } | { ok: false; error: unknown }

/**
 * Frame extracted from a hosted video (Story 11.3, P2.5, P2-09): the image at t = 1 s (t = 0
 * for a video shorter than one second) becomes the 16:9 poster variants.
 *
 * ffmpeg (apt package, never an npm wrapper) is spawned with `execFile`: no shell, arguments
 * as an array, the input given as `file:<absolute path>` and `-protocol_whitelist file`, so a
 * path can never be read as an option or a protocol and the container never makes ffmpeg
 * open the network. The output goes to a folder created for the call and always removed.
 * One time budget (`timeoutMs`, 20 s) covers both attempts; past it the process is killed.
 * `-threads 1` and the downscale bound the CPU and memory of one extraction (review of 11.3;
 * a hard memory cap of the container is deferred).
 */
export default class VideoFrameService {
  /** Binary looked up in PATH (overridden by the tests). */
  static binary = 'ffmpeg'
  /** Total budget of one extraction, fallback included (D-11.3-4). */
  static timeoutMs = 20_000

  /** PNG bytes of the frame at t = 1 s (fallback t = 0); throws `VideoFrameError`. */
  static async extract(inputPath: string): Promise<Buffer> {
    const deadline = Date.now() + this.timeoutMs
    const dir = await mkdtemp(join(tmpdir(), 'anta-frame-'))
    try {
      const input = `file:${resolve(inputPath)}`
      let lastError: unknown = null
      for (const [index, seek] of ['1', '0'].entries()) {
        const out = join(dir, `frame-${index}.png`)
        const remaining = deadline - Date.now()
        if (remaining <= 0) break
        const result = await this.run(
          [
            '-nostdin',
            '-hide_banner',
            '-loglevel',
            'error',
            '-protocol_whitelist',
            'file',
            '-ss',
            seek,
            '-i',
            input,
            '-threads',
            '1',
            '-frames:v',
            '1',
            '-vf',
            FRAME_SCALE,
            '-f',
            'image2',
            '-update',
            '1',
            '-c:v',
            'png',
            out,
          ],
          remaining
        )
        if (!result.ok) {
          lastError = result.error
          // A missing binary or a timeout will not get better at t = 0.
          if (this.isFatal(result.error)) break
          continue
        }
        // Seeking past the end (video < 1 s) exits 0 without writing any frame.
        const frame = await readFile(out).catch(() => null)
        if (frame && frame.length > 0) return frame
      }
      throw new VideoFrameError('No frame could be extracted from the video', {
        cause: lastError,
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  /**
   * Poster variants of a video, or `null`: never throws, a failure is logged and must never
   * fail the video upload (P2.5).
   */
  static async posterVariants(inputPath: string): Promise<ImageVariant[] | null> {
    try {
      const frame = await this.extract(inputPath)
      return await ImageService.posterVariants(frame)
    } catch (error) {
      logger.warn({ err: error }, 'Video frame extraction failed: no poster')
      return null
    }
  }

  private static run(args: string[], timeout: number): Promise<RunResult> {
    return new Promise((done) => {
      execFile(
        this.binary,
        args,
        { timeout, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024, windowsHide: true },
        (error, _stdout, stderr) => {
          if (!error) return done({ ok: true })
          done({
            ok: false,
            error: Object.assign(error, { stderr: String(stderr).slice(0, 2000) }),
          })
        }
      )
    })
  }

  /** Missing binary (ENOENT) or killed on timeout. */
  private static isFatal(error: unknown): boolean {
    const err = error as { code?: unknown; killed?: boolean; signal?: unknown }
    return err?.code === 'ENOENT' || err?.killed === true || err?.signal === 'SIGKILL'
  }
}
