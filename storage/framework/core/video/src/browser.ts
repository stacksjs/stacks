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
}

export interface PreparedVideoUpload {
  /** What to send: the converted MP4, or the original when it was not converted. */
  video: Blob
  /** A JPEG of one frame, in the video's shape; only with a converted clip. */
  poster?: Blob
  /** `webcodecs` when `video` is this function's own encode, null when it is the file as picked. */
  converter: 'webcodecs' | null
  /** Why the original is being sent, when it is: for a log, never for the person. */
  reason?: 'unsupported' | 'already-ready' | 'too-large' | 'failed'
  /** The error behind `failed`. */
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

const isAbort = (error: unknown, signal?: AbortSignal): boolean => Boolean(signal?.aborted) || (error as { name?: string } | null)?.name === 'AbortError'

/**
 * Converts a picked clip for upload, or answers it as it is. Only a
 * cancellation throws.
 */
export async function prepareVideoUpload(file: Blob, options: PrepareVideoUploadOptions = {}): Promise<PreparedVideoUpload> {
  const original = (reason: PreparedVideoUpload['reason'], cause?: unknown): PreparedVideoUpload =>
    ({ video: file, converter: null, reason, sourceBytes: file.size, ...(cause === undefined ? {} : { cause }) })
  if (!canPrepareVideoUpload())
    return original('unsupported')
  try {
    const { prepareVideoForUpload } = await import('ts-videos/native-transcode')
    const result = await prepareVideoForUpload(file, {
      maxLongEdge: options.maxLongEdge,
      maxShortEdge: options.maxShortEdge,
      maxFrameRate: options.maxFrameRate,
      videoBitrate: options.videoBitrate,
      poster: options.poster ?? true,
      maxOutputBytes: options.maxOutputBytes,
      signal: options.signal,
      onProgress: options.onProgress ? progress => options.onProgress!(progress.ratio) : undefined,
    })
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
}
