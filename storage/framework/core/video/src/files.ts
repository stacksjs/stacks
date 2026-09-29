import { videoAssetHeaders } from './index'

/**
 * Serving a stored video file the way players ask for it. iOS requests
 * `Range: bytes=0-1` first and will not play a file that answers with the
 * whole body; every player seeks with ranges.
 */

export interface ByteRange {
  start: number
  end: number
}

/**
 * The range a `Range` header asks for within a file of `size` bytes: null for
 * the whole file (no header, or one this does not read), 'unsatisfiable' for
 * a range that starts past the end.
 */
export function parseByteRange(header: string | null | undefined, size: number): ByteRange | null | 'unsatisfiable' {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header ?? '').trim())
  if (!match || (!match[1] && !match[2]))
    return null
  if (!match[1]) {
    // bytes=-500: the last 500 bytes.
    const length = Math.min(Number(match[2]), size)
    return length > 0 ? { start: size - length, end: size - 1 } : 'unsatisfiable'
  }
  const start = Number(match[1])
  if (start >= size)
    return 'unsatisfiable'
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  return end >= start ? { start, end } : 'unsatisfiable'
}

const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m3u8: 'application/vnd.apple.mpegurl',
  mpd: 'application/dash+xml',
  m4s: 'video/iso.segment',
  vtt: 'text/vtt',
}

/** The Content-Type for a video file by its name. */
export function videoContentType(name: string): string {
  return VIDEO_TYPES[name.split(/[?#]/, 1)[0]!.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream'
}

export interface VideoFileResponseOptions {
  /** The request's Range header. */
  range?: string | null
  etag?: string
  contentType?: string
  /** A manifest of protected media is not cached publicly. */
  protectedMedia?: boolean
}

/** A Response for a stored video, 206 for a range, 416 past the end. */
export function videoFileResponse(file: Blob, name: string, options: VideoFileResponseOptions = {}): Response {
  const size = file.size
  const type = options.contentType || videoContentType(name)
  const range = parseByteRange(options.range, size)
  if (range === 'unsatisfiable')
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  if (!range)
    return new Response(file, { status: 200, headers: { ...videoAssetHeaders(name, size, options.etag, options.protectedMedia), 'Content-Type': type } })
  const length = range.end - range.start + 1
  return new Response(file.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      ...videoAssetHeaders(name, length, options.etag, options.protectedMedia),
      'Content-Type': type,
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    },
  })
}
