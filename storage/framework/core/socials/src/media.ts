import type { PublicFetchOptions } from '@stacksjs/security'
import type { PostVideo, PublishPostInput } from './types'
import { fetchPublicUrl } from '@stacksjs/security'

/**
 * Images a post refers to by address.
 *
 * The X and Mastodon drivers used to download such an image with a bare
 * `fetch`: whatever address a post carried, including the server's own
 * loopback services or a cloud metadata endpoint, of any size, following any
 * redirect. An address on a post is somebody else's input, so it goes through
 * `fetchPublicUrl`, which re-checks every hop and caps the body, and the
 * bytes are identified by what they are rather than by the type the other end
 * claimed.
 */

/** Larger than any network accepts. Each network's own limit is its own to enforce. */
export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024

export type PostImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface PostImage {
  bytes: Uint8Array
  mimeType: PostImageMimeType
}

/** Identify an image from its first bytes. */
export function sniffImageType(bytes: Uint8Array): PostImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)
    return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)
    return 'image/png'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return 'image/gif'
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  return null
}

/**
 * Download the image at `url`. Null when it is refused, cannot be fetched, or
 * is not a JPEG, PNG, GIF or WebP image: the driver decides what a missing
 * image means.
 */
export async function fetchPostImage(url: string, options: PublicFetchOptions = {}): Promise<PostImage | null> {
  try {
    const response = await fetchPublicUrl(url, {}, { allowHttp: true, timeoutMs: 15_000, maxBytes: MAX_POST_IMAGE_BYTES, ...options })
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const mimeType = sniffImageType(bytes)
    return mimeType ? { bytes, mimeType } : null
  }
  catch {
    return null
  }
}

/** How a driver downloads an image given by address. Replaceable per driver, for tests or a local network. */
export type PostImageFetcher = (url: string) => Promise<PostImage | null>

/** Raised when a post's image cannot be read. Carries the same `status` and `body` as a network's own error. */
export class PostImageError extends Error {
  readonly status = 422
  readonly body = ''

  constructor(readonly url: string) {
    super(`Could not read the image at ${url}.`)
    this.name = 'PostImageError'
  }
}

/**
 * The bytes of one attached image: as given, or downloaded from its address.
 * Throws {@link PostImageError} for an address that gives no image, rather
 * than posting without it. Undefined only for an item with neither.
 */
export async function resolvePostImage(
  item: { url?: string, bytes?: Uint8Array, mimeType?: string },
  fetchImage: PostImageFetcher,
): Promise<{ bytes: Uint8Array, mimeType: string } | undefined> {
  if (item.bytes?.length) return { bytes: item.bytes, mimeType: item.mimeType || sniffImageType(item.bytes) || 'image/jpeg' }
  if (!item.url) return undefined
  const fetched = await fetchImage(item.url)
  if (!fetched) throw new PostImageError(item.url)
  return fetched
}

/** Reject invalid video before a network can create an attachment or post. */
export function validatePostVideo(video: PostVideo, images: PublishPostInput['media']): void {
  if (images?.length)
    throw new Error('A video cannot be attached together with images.')
  if (video.mimeType !== 'video/mp4' || !video.bytes.length)
    throw new Error('Attach a non-empty MP4 video.')
  const ratio = video.aspectRatio
  if (ratio && ![ratio.width, ratio.height].every(value => Number.isSafeInteger(value) && value > 0))
    throw new Error('Video width and height must be positive integers.')
}

/** Avoid publishing a text-only post when the requested video cannot be sent. */
export function rejectPostVideo(post: PublishPostInput, network: string): void {
  if (post.video)
    throw new Error(`Video publishing to ${network} is unavailable.`)
}
