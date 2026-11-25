/**
 * The browser half of a video upload: make a picked clip ready to send.
 *
 * A phone records 4K HEVC at 60 frames a second, sideways with a rotation
 * flag, sometimes in HDR: 400 MB for two minutes that half the web cannot
 * play. `prepareVideoUpload` re-encodes it on the device, before anything is
 * sent, into what every player takes: an upright H.264 and AAC MP4 inside
 * 1280 by 720 at 30 frames a second, its index at the front so it plays as it
 * arrives, with a JPEG poster of the same shape. Around a tenth of the bytes.
 *
 * It uses the browser's own codecs (WebCodecs, through ts-videos) and never
 * fails an upload: where the browser cannot do it, or the clip is one it
 * cannot read, the original comes back untouched with the reason, and the
 * caller sends that.
 *
 * Import this file by its own path (`@stacksjs/video/browser`). It pulls in
 * nothing from the server side of this package, and loads the encoder only
 * when a clip is actually prepared.
 */

export interface PrepareVideoUploadOptions {
  /** The box the result fits, by its long and short edge whichever way up it is. Default 1280 by 720. */
  maxLongEdge?: number
  maxShortEdge?: number
  /** Default 30. */
  maxFrameRate?: number
  /** Bits a second for the picture. Default by size: about 2.5 Mbit/s at 720p. */
  videoBitrate?: number
  /** Whether to make a poster. Default true. */
  poster?: boolean
  /**
   * The most the converted clip may weigh. It is held in memory until it is
   * done, so a clip too long for the limit is not converted at all: the
   * original comes back with `reason: 'too-large'`.
   */
  maxOutputBytes?: number
  signal?: AbortSignal
  /** 0 to 1, as the encoder moves through the clip. */
  onProgress?: (ratio: number) => void
  /**
   * How long the conversion may go between progress ticks before it is given
   * up and the original sent instead (`reason: 'stalled'`), in milliseconds.
   * A browser whose encoder never answers (an iOS simulator's, a GPU process
   * that wedged) would otherwise hold the upload forever. Default 20 seconds;
   * 0 waits as long as it takes, first tick included.
   */
  stallMs?: number
  /**
   * How long it may take to the first tick. Reading a clip's index comes
   * before any, one small read per sample (about 130,000 for six minutes at
   * 60 fps), so a long clip on a phone takes a while. Default 60 seconds and
   * 25 more for every 100 MB of the clip.
   */
  firstTickMs?: number
}

export interface PreparedVideoUpload {
  /** What to send: the converted MP4, or the original when it was not converted. */
  video: Blob
  /** A JPEG of one frame, in the video's shape; only with a converted clip. */
  poster?: Blob
  /** `webcodecs` when `video` is this function's own encode, null when it is the file as picked. */
  converter: 'webcodecs' | null
  /** Why the original is being sent, when it is: for a log, never for the person. */
  reason?: 'unsupported' | 'already-ready' | 'too-large' | 'failed' | 'stalled'
  /** The error behind `failed`, or the `VideoPrepareStalledError` behind `stalled`. */
  cause?: unknown
  /** The frame of `video`, when it is known. */
  width?: number
  height?: number
  /** Seconds, when known. */
  duration?: number
  sourceBytes: number
}

/** Whether this browser can convert video at all. Cheap: it only looks for the codecs. */
export function canPrepareVideoUpload(): boolean {
  const scope = globalThis as Record<string, unknown>
  return ['VideoDecoder', 'VideoEncoder', 'EncodedVideoChunk', 'VideoFrame', 'OffscreenCanvas'].every(name => typeof scope[name] === 'function')
}

/** Whether the page is out of sight, where it has one. */
const isHidden = (): boolean => Boolean((globalThis as { document?: { hidden?: boolean } }).document?.hidden)

const isAbort = (error: unknown, signal?: AbortSignal): boolean => Boolean(signal?.aborted) || (error as { name?: string } | null)?.name === 'AbortError'

/** How long a conversion may go between ticks, by default. */
const STALL_MS = 20_000
/** How long to the first tick, by default: a base, and more for a bigger clip. */
const FIRST_TICK_MS = 60_000
const FIRST_TICK_MS_PER_MB = 250

/** A conversion that stopped moving, given up so the original can be sent. */
export class VideoPrepareStalledError extends Error {
  override name = 'VideoPrepareStalledError'
  constructor(readonly stallMs: number) {
    super(`The clip did not move for ${Math.round(stallMs / 1000)} seconds while it was converted`)
  }
}

/**
 * Converts a picked clip for upload, or answers it as it is. Only a
 * cancellation throws.
 */
export async function prepareVideoUpload(file: Blob, options: PrepareVideoUploadOptions = {}): Promise<PreparedVideoUpload> {
  const original = (reason: PreparedVideoUpload['reason'], cause?: unknown): PreparedVideoUpload =>
    ({ video: file, converter: null, reason, sourceBytes: file.size, ...(cause === undefined ? {} : { cause }) })
  if (!canPrepareVideoUpload())
    return original('unsupported')
  if (options.signal?.aborted)
    throw options.signal.reason ?? new DOMException('The upload was cancelled', 'AbortError')
  // The encoder's own signal: the caller's cancel, or this watchdog giving up.
  const work = new AbortController()
  const stallMs = options.stallMs ?? STALL_MS
  const firstTickMs = options.firstTickMs ?? FIRST_TICK_MS + Math.round(file.size / 1_048_576 * FIRST_TICK_MS_PER_MB)
  let ticked = false
  let settled = false
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let stop: (outcome: { stalled: VideoPrepareStalledError } | { cancelled: unknown }) => void = () => {}
  // Settles when the conversion stops moving or the caller cancels, whether
  // or not the encoder ever answers: a WebCodecs step that never settles
  // must not hold the upload, or its Cancel.
  const halted = new Promise<{ stalled: VideoPrepareStalledError } | { cancelled: unknown }>((resolve) => { stop = resolve })
  const watch = () => {
    clearTimeout(watchdog)
    // A hidden page's timers are held back, and its work with them: the wait
    // starts again when it is seen.
    if (!stallMs || settled || isHidden())
      return
    const budget = ticked ? stallMs : Math.max(stallMs, firstTickMs)
    watchdog = setTimeout(() => stop({ stalled: new VideoPrepareStalledError(budget) }), budget)
  }
  const cancel = () => stop({ cancelled: options.signal!.reason })
  options.signal?.addEventListener('abort', cancel, { once: true })
  const page = (globalThis as { document?: EventTarget }).document
  page?.addEventListener?.('visibilitychange', watch)
  watch()
  const converting = (async () => {
    const { prepareVideoForUpload } = await import('ts-videos/native-transcode')
    return prepareVideoForUpload(file, {
      maxLongEdge: options.maxLongEdge,
      maxShortEdge: options.maxShortEdge,
      maxFrameRate: options.maxFrameRate,
      videoBitrate: options.videoBitrate,
      poster: options.poster ?? true,
      maxOutputBytes: options.maxOutputBytes,
      signal: work.signal,
      onProgress: (progress) => {
        // An encoder given up on can still tick: it is no one's now.
        if (settled)
          return
        ticked = true
        watch()
        options.onProgress?.(progress.ratio)
      },
    })
  })()
  try {
    const outcome = await Promise.race([converting.then(result => ({ result })), halted])
    if ('cancelled' in outcome) {
      work.abort(outcome.cancelled)
      throw outcome.cancelled ?? new DOMException('The upload was cancelled', 'AbortError')
    }
    if ('stalled' in outcome) {
      work.abort(outcome.stalled)
      return original('stalled', outcome.stalled)
    }
    const { result } = outcome
    if (result.unchanged)
      return { ...original('already-ready'), width: result.width, height: result.height, duration: result.duration }
    return {
      video: result.video,
      poster: result.poster,
      converter: 'webcodecs',
      width: result.width,
      height: result.height,
      duration: result.duration,
      sourceBytes: file.size,
    }
  }
  catch (error) {
    if (isAbort(error, options.signal))
      throw error
    if ((error as { name?: string } | null)?.name === 'UploadVideoTooLargeError')
      return original('too-large', error)
    return original('failed', error)
  }
  finally {
    settled = true
    clearTimeout(watchdog)
    options.signal?.removeEventListener('abort', cancel)
    page?.removeEventListener?.('visibilitychange', watch)
    // An encoder given up on may still settle later: its outcome is no one's.
    converting.catch(() => {})
  }
}
