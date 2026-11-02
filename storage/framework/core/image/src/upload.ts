import { decode, encode, getMetadata } from 'ts-images'

export interface SanitizedImage {
  bytes: Uint8Array
  width: number
  height: number
  format: 'jpeg' | 'png' | 'webp'
}

/** Bound decoding, apply camera orientation, and publish pixels without private metadata. */
export async function sanitizeImageUpload(bytes: Uint8Array, options: { maxBytes?: number, maxPixels?: number } = {}): Promise<SanitizedImage> {
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024
  const maxPixels = options.maxPixels ?? 40_000_000
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isSafeInteger(maxPixels) || maxPixels <= 0)
    throw new RangeError('Image limits must be positive whole numbers')
  if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new RangeError('Image exceeds the upload byte limit')
  const metadata = await getMetadata(bytes)
  const sourceFormat = String(metadata.format).toLowerCase()
  const format = sourceFormat === 'jpg' ? 'jpeg' : sourceFormat
  if (format !== 'jpeg' && format !== 'png' && format !== 'webp') throw new TypeError('Send a JPEG, PNG or WebP photo')
  if (!Number.isSafeInteger(metadata.width) || !Number.isSafeInteger(metadata.height) || metadata.width <= 0 || metadata.height <= 0 || metadata.width * metadata.height > maxPixels)
    throw new RangeError('Image exceeds the decoded pixel limit')
  const source = await decode(bytes, { applyOrientation: true })
  // Construct only the pixel data. Never forward EXIF, XMP, comments or source metadata.
  const pixels = { width: source.width, height: source.height, data: source.data, colorSpace: source.colorSpace, hasAlpha: source.hasAlpha, bitDepth: source.bitDepth }
  const output = await encode(pixels, format, { quality: 90 })
  if (output.byteLength > maxBytes) throw new RangeError('Normalized image exceeds the upload byte limit')
  return { bytes: output, width: source.width, height: source.height, format }
}
