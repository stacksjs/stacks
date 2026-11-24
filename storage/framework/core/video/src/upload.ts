import type { VideoInspection } from './inspect'
import { inspectVideo } from './inspect'

/**
 * The server half of a video upload: what a file that arrived actually is.
 *
 * A device may convert a clip before sending it (`@stacksjs/video/browser`)
 * and say so. Nothing a client says is taken on trust: these read the file.
 */

/**
 * Whether an MP4 or QuickTime file has its index (moov) before its media
 * (mdat), read from the top-level boxes alone. Such a file starts playing
 * before it has arrived; the other kind must be fetched to its end first.
 * The first megabyte of a file is enough to answer. A WebM, or bytes that are
 * not boxes, are false.
 */
export function isFaststart(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  while (offset + 8 <= bytes.byteLength) {
    let size = view.getUint32(offset)
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!)
    if (type === 'moov')
      return true
    if (type === 'mdat')
      return false
    if (size === 1) {
      if (offset + 16 > bytes.byteLength)
        return false
      size = Number(view.getBigUint64(offset + 8))
    }
    // Size 0 runs to the end of the file, and anything smaller than a header is not a box.
    if (size < 8)
      return false
    offset += size
  }
  return false
}

export interface WebReadyLimits {
  /** Default 1280. */
  maxLongEdge?: number
  /** Default 720. */
  maxShortEdge?: number
}

/**
 * Why a file is not what `prepareVideoUpload` makes, or an empty list when it
 * is: an MP4 with H.264 video, AAC or no sound, inside the box either way up,
 * with its index first. A client's claim to have converted a clip is worth
 * exactly this check.
 */
export function webReadyProblems(video: Pick<VideoInspection, 'format' | 'videoCodec' | 'audioCodec' | 'hasAudio' | 'width' | 'height'>, faststart: boolean, limits: WebReadyLimits = {}): string[] {
  const long = Math.max(video.width || 0, video.height || 0)
  const short = Math.min(video.width || 0, video.height || 0)
  return [
    video.format !== 'mp4' && `container ${video.format}`,
    video.videoCodec !== 'h264' && `video ${video.videoCodec}`,
    video.hasAudio && video.audioCodec !== 'aac' && `audio ${video.audioCodec}`,
    (short <= 0 || long > (limits.maxLongEdge ?? 1280) || short > (limits.maxShortEdge ?? 720)) && `size ${video.width}x${video.height}`,
    !faststart && 'not faststart',
  ].filter((problem): problem is string => typeof problem === 'string')
}

export interface InspectedVideoFile extends VideoInspection {
  bytes: number
  faststart: boolean
}

/** How much of a file is read first: a faststart MP4's whole index, for a clip of a few minutes. */
const HEAD_BYTES = 8 * 1024 * 1024

/**
 * Reads what a video file on this machine is without holding it in memory:
 * its first 8 MB, which contain the whole index of a faststart file, and the
 * rest only when the index turns out to be at the end. Null when it holds no
 * video. Made for a finished upload session, which is a path, not bytes.
 */
export async function inspectVideoFile(path: string): Promise<InspectedVideoFile | null> {
  const file = Bun.file(path)
  if (!await file.exists())
    return null
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer())
  const whole = file.size <= HEAD_BYTES
  const inspection = await inspectVideo(head) ?? (whole ? null : await inspectVideo(new Uint8Array(await file.arrayBuffer())))
  if (!inspection)
    return null
  const boxes = inspection.format === 'mp4' || inspection.format === 'mov'
  return { ...inspection, bytes: file.size, faststart: boxes ? isFaststart(head) : false }
}
