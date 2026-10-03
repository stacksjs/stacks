import type { StorageAdapter } from '@stacksjs/storage'
import type { StorageItemTask, StorageMetadataStore } from './file-metadata'
import { posix } from 'node:path'
import { resolveMime } from '@stacksjs/storage'
import { bareMime, runTask, StorageTaskSkipped, variantsPathFor } from './file-metadata'

/**
 * File previews for the dashboard file manager (stacksjs/stacks#308).
 *
 * #308 left one question open: render previews on demand at the edge, or make
 * one once and serve it as a normal stored file. This is the second. A preview
 * is a derivative like the image variants and the video renditions, so it goes
 * through the same machinery - a `preview` row in `storage_item_tasks`, a job
 * on the `media` queue, the output written to the same disk under
 * `.variants/<path>/` - and it follows a rename, a delete and a sweep the way
 * they already do.
 *
 * ## What draws, and what is recorded as skipped
 *
 * Only what the framework's own libraries can render. No ffmpeg, no
 * ImageMagick, no headless browser:
 *
 * - **Images** (PNG, JPEG, GIF, BMP, WebP, AVIF) are decoded, scaled to fit
 *   {@link PREVIEW_MAX_EDGE} and encoded as PNG by `ts-images`, entirely in
 *   memory. PNG rather than WebP because `ts-webp` reaches for `cwebp` when one
 *   is installed, and a preview should not depend on what the box happens to
 *   have on its PATH.
 * - **WAV** is drawn as a waveform. Its samples are PCM already, so there is
 *   nothing to decode - the header says where they are.
 * - **TrueType fonts** are drawn as a specimen with the font itself, through
 *   the `ts-images` glyph rasterizer.
 * - **Text** gets a snippet - the first lines, as plain text - rather than an
 *   image. Drawing text needs a font, the framework ships no TrueType face to
 *   draw it with, and a file manager can show twelve lines of text as text.
 *
 * Everything else that has a preview kind is recorded `skipped`, with the
 * reason, at dispatch time and without a queue round trip:
 *
 * - **SVG** is never rasterized. It is markup somebody else wrote, and drawing
 *   attacker-supplied SVG is script execution - `fileInfo` marks it
 *   non-previewable for the same reason.
 * - **Video**: `ts-videos` reads containers itself, but decoding a frame goes
 *   through WebCodecs, which this runtime does not provide.
 * - **Compressed audio** (MP3, AAC, FLAC, Ogg): same, through `@ts-audio`.
 * - **PDF**: there is no homegrown PDF renderer.
 * - **CFF, WOFF and WOFF2 fonts**: the rasterizer reads TrueType outlines only.
 * - **HEIC and TIFF**: no decoder for either.
 *
 * Archives and unknown binaries get no preview row at all - there is nothing to
 * say about a zip that its icon does not already say.
 */

/** The longest edge of a raster preview, in pixels. Twice a file-manager card, for dense screens. */
export const PREVIEW_MAX_EDGE = 320

/** How much of a text file the snippet keeps. */
export const TEXT_PREVIEW_MAX_LINES = 12
export const TEXT_PREVIEW_MAX_COLUMNS = 80

/**
 * Bounds on what the worker will load to draw a preview.
 *
 * A preview is a thumbnail; a 2 GB WAV or a 200-megapixel scan is not worth
 * holding in a worker's memory to make one. Past these the task is skipped
 * with the reason rather than failed - retrying will not make the file smaller.
 */
export const MAX_PREVIEW_SOURCE_BYTES = 128 * 1024 * 1024
export const MAX_PREVIEW_PIXELS = 50_000_000

/** Bytes read from a text file to make its snippet. Enough for the lines kept, with room for long ones. */
const TEXT_HEAD_BYTES = 16 * 1024

export type PreviewRenderer = 'image' | 'waveform' | 'font' | 'text'

/** The stored format of a preview: a PNG for everything drawn, a snippet for text. */
export type PreviewFormat = 'png' | 'txt'

/** What a content type gets: a renderer, or the reason there is none here. */
export type PreviewPlan =
  | { renderer: PreviewRenderer, format: PreviewFormat }
  | { skip: string }

/** A preview, rendered and not yet stored. */
export interface RenderedPreview {
  format: PreviewFormat
  bytes: Uint8Array
  /** Pixel size of a drawn preview; absent for a text snippet. */
  width?: number
  height?: number
}

/** What a finished preview task reports. */
export interface GeneratedPreview {
  path: string
  format: PreviewFormat
  bytes: number
  width?: number
  height?: number
}

/** Image formats `ts-images` decodes. HEIC and TIFF it recognises but cannot decode. */
const DECODABLE_IMAGES = new Set([
  'image/png',
  'image/apng',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/gif',
  'image/bmp',
  'image/x-bmp',
  'image/x-ms-bmp',
  'image/webp',
  'image/avif',
])

const WAV_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'])

const TRUETYPE_TYPES = new Set(['font/ttf', 'font/sfnt', 'application/x-font-ttf', 'application/font-sfnt', 'application/x-font-truetype'])

const TEXT_APPLICATION_TYPES = /^application\/(?:json|ld\+json|xml|yaml|x-yaml|javascript|typescript|x-sh|toml|sql|graphql)$/

/**
 * The content type a file claims to be.
 *
 * What the adapter reports, and when that is nothing useful - the local driver
 * answers `application/octet-stream` for a `.webp`, a `.md` or a `.ttf` - a
 * guess from the extension. A claim either way: the job checks it against the
 * bytes before drawing anything, and a file whose bytes disagree with its name
 * is skipped rather than drawn as whatever the bytes turned out to be.
 */
export function claimedContentType(path: string, reported?: string): string {
  const mime = bareMime(reported)
  if (mime && mime !== 'application/octet-stream')
    return mime
  return bareMime(Bun.file(posix.basename(path)).type) || 'application/octet-stream'
}

/**
 * Whether a file gets a preview, and how.
 *
 * `null` for a type with nothing to preview - archives, unknown binaries - so
 * no row is written. A `skip` is recorded as a skipped task with its reason,
 * which is the answer to "why does this file have no thumbnail".
 */
export function previewPlanFor(contentType: string | undefined): PreviewPlan | null {
  const mime = bareMime(contentType)

  if (mime === 'image/svg+xml')
    return { skip: 'SVG is never rasterized here: it is markup, and drawing attacker-supplied SVG is script execution.' }
  if (DECODABLE_IMAGES.has(mime))
    return { renderer: 'image', format: 'png' }
  if (mime.startsWith('image/'))
    return { skip: `No homegrown decoder reads ${mime}.` }

  if (mime.startsWith('video/'))
    return { skip: 'Drawing a video frame needs a decoder: ts-videos decodes through WebCodecs, which this runtime does not provide.' }

  if (WAV_TYPES.has(mime))
    return { renderer: 'waveform', format: 'png' }
  if (mime.startsWith('audio/'))
    return { skip: `Only uncompressed WAV can be drawn here: decoding ${mime} needs WebCodecs, which this runtime does not provide.` }

  if (mime === 'application/pdf')
    return { skip: 'There is no homegrown PDF renderer to draw a page with.' }

  if (TRUETYPE_TYPES.has(mime))
    return { renderer: 'font', format: 'png' }
  if (mime.startsWith('font/') || /^application\/(?:x-)?font/.test(mime))
    return { skip: 'Only TrueType outlines can be drawn here; CFF, WOFF and WOFF2 fonts are not.' }

  if (mime.startsWith('text/') || TEXT_APPLICATION_TYPES.test(mime))
    return { renderer: 'text', format: 'txt' }

  return null
}

/**
 * Where a file's preview is stored, beside its other derivatives.
 *
 * Derived from the path and the format rather than recorded in a column, so it
 * cannot go stale: the task row says whether a preview was made, this says
 * where. A rename through the dashboard moves the folder with the row.
 */
export function previewPathFor(path: string, format: PreviewFormat = 'png'): string {
  return `${variantsPathFor(path)}/preview.${format}`
}

/**
 * Draw the preview for `bytes`, as `plan` says to.
 *
 * Throws {@link StorageTaskSkipped} when the bytes turn out not to be what the
 * content type claimed, or are past the size bounds; throws anything else when
 * the file is what it claims and is broken, which is a failure worth seeing.
 */
export async function renderPreview(
  bytes: Uint8Array,
  plan: { renderer: PreviewRenderer },
  name = '',
): Promise<RenderedPreview> {
  switch (plan.renderer) {
    case 'image':
      return await renderImage(bytes, name)
    case 'waveform':
      return await renderWaveform(bytes)
    case 'font':
      return await renderFont(bytes)
    case 'text':
      return renderText(bytes, name)
  }
}

/**
 * Make, store and record one file's preview.
 *
 * What `GenerateStoragePreviewJob` runs, separated from it so it can be tested
 * against an in-memory store and a temporary disk. Idempotent: the path is
 * derived, so a re-run overwrites the same file, and the task row is replaced
 * rather than added to.
 */
export async function generateStoragePreview(
  adapter: StorageAdapter,
  store: StorageMetadataStore,
  disk: string,
  path: string,
): Promise<GeneratedPreview | undefined> {
  return await runTask(store, disk, path, 'preview', async () => {
    const plan = previewPlanFor(claimedContentType(path, await adapter.mimeType(path).catch(() => undefined)))
    if (!plan)
      throw new StorageTaskSkipped('Nothing previews this kind of file.')
    if ('skip' in plan)
      throw new StorageTaskSkipped(plan.skip)

    const size = await adapter.fileSize(path)
    if (plan.renderer !== 'text' && size > MAX_PREVIEW_SOURCE_BYTES)
      throw new StorageTaskSkipped(`The file is ${size} bytes; previews are drawn from files up to ${MAX_PREVIEW_SOURCE_BYTES}.`)

    const source = plan.renderer === 'text'
      ? await readHead(adapter, path, TEXT_HEAD_BYTES)
      : new Uint8Array(await adapter.readToBuffer(path))

    const rendered = await renderPreview(source, plan, path)
    const stored = previewPathFor(path, rendered.format)
    await adapter.write(stored, rendered.bytes)

    return {
      path: stored,
      format: rendered.format,
      bytes: rendered.bytes.byteLength,
      width: rendered.width,
      height: rendered.height,
    }
  })
}

/**
 * The URL a finished image preview is served from, or `undefined`.
 *
 * Resolved the way the listing resolves a file's own `url` and `thumbnail`: a
 * public disk serves it at its public URL, and the project's own `public` disk
 * at its path under the site root. A private disk has no URL to give - the same
 * as the original file there - so its previews are not linked, rather than
 * linked to something that answers 403.
 */
export async function previewUrlFor(
  adapter: Pick<StorageAdapter, 'publicUrl'>,
  path: string,
  options: { public: boolean, servesProjectPublic: boolean },
): Promise<string | undefined> {
  if (!options.public)
    return undefined

  const stored = previewPathFor(path, 'png')
  if (options.servesProjectPublic)
    return `/${stored.split('/').map(component => encodeURIComponent(component)).join('/')}`

  try {
    return await adapter.publicUrl(stored)
  }
  catch {
    return undefined
  }
}

/** Whether a file's preview task finished, so there is a preview to point at. */
export function hasPreview(tasks: readonly StorageItemTask[]): boolean {
  return tasks.some(task => task.kind === 'preview' && task.state === 'done')
}

/** The first `limit` bytes of a file, without reading the rest when the adapter can stream. */
async function readHead(adapter: StorageAdapter, path: string, limit: number): Promise<Uint8Array> {
  if (!adapter.getStream)
    return new Uint8Array(await adapter.readToBuffer(path)).subarray(0, limit)

  const reader = (await adapter.getStream(path)).getReader()
  const chunks: Uint8Array[] = []
  let length = 0

  try {
    while (length < limit) {
      const { done, value } = await reader.read()
      if (done || !value)
        break
      chunks.push(value)
      length += value.byteLength
    }
  }
  finally {
    await reader.cancel().catch(() => {})
  }

  const head = new Uint8Array(Math.min(length, limit))
  let offset = 0
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, head.byteLength - offset)
    head.set(chunk.subarray(0, take), offset)
    offset += take
    if (offset >= head.byteLength)
      break
  }
  return head
}

/** Refuse to draw bytes whose signature says they are something other than claimed. */
function assertSniffedAs(bytes: Uint8Array, name: string, accept: (mime: string) => boolean, what: string): void {
  const { mime, source } = resolveMime(bytes, name)
  if (source === 'magic-bytes' && !accept(mime))
    throw new StorageTaskSkipped(`The content is ${mime}, not ${what}; a preview is only drawn when the bytes agree with the name.`)
}

async function renderImage(bytes: Uint8Array, name: string): Promise<RenderedPreview> {
  // SVG cannot reach here through the plan, and this is the second lock on that
  // door: a `.png` whose bytes are SVG is markup, and it is not drawn either.
  assertSniffedAs(bytes, name, mime => DECODABLE_IMAGES.has(mime), 'a raster image this decoder reads')

  const { decode, encode, getMetadata, resize } = await import('ts-images')

  const metadata = await getMetadata(bytes).catch(() => undefined)
  if (metadata && metadata.width * metadata.height > MAX_PREVIEW_PIXELS)
    throw new StorageTaskSkipped(`The image is ${metadata.width}x${metadata.height}; previews are drawn from images up to ${MAX_PREVIEW_PIXELS} pixels.`)

  const source = await decode(bytes)
  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  // Never upscaled: a 64px icon is previewed at 64px, and the card scales it.
  const scaled = scale < 1 ? resize(source, { width, height, fit: 'fill', kernel: 'bilinear' }) : source

  return { format: 'png', bytes: await encode(scaled, 'png'), width: scaled.width, height: scaled.height }
}

interface PcmFormat {
  /** 1 integer PCM, 3 IEEE float. */
  encoding: 1 | 3
  channels: number
  sampleRate: number
  bitsPerSample: number
  dataOffset: number
  dataLength: number
}

/**
 * Where the samples are in a WAV file, from its RIFF header.
 *
 * Skips rather than fails on anything that is not uncompressed PCM - a WAV
 * container can carry ADPCM or even MP3, and drawing those needs a decoder.
 */
export function readWavFormat(bytes: Uint8Array): PcmFormat {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset: number): string => String.fromCharCode(...bytes.subarray(offset, offset + 4))

  if (bytes.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE')
    throw new StorageTaskSkipped('The content is not a RIFF/WAVE file, so there are no samples to draw.')

  let format: Omit<PcmFormat, 'dataOffset' | 'dataLength'> | undefined
  let offset = 12

  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8

    if (id === 'fmt ' && size >= 16 && body + 16 <= bytes.byteLength) {
      let encoding = view.getUint16(body, true)
      // WAVE_FORMAT_EXTENSIBLE carries the real format in its sub-format GUID,
      // whose first two bytes are the classic format code.
      if (encoding === 0xFFFE && size >= 26 && body + 26 <= bytes.byteLength)
        encoding = view.getUint16(body + 24, true)

      if (encoding !== 1 && encoding !== 3)
        throw new StorageTaskSkipped(`This WAV is compressed (format 0x${encoding.toString(16)}); only uncompressed PCM can be drawn here.`)

      format = {
        encoding,
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      }
    }
    else if (id === 'data') {
      if (!format)
        throw new Error('The WAV data chunk comes before its format chunk.')
      return { ...format, dataOffset: body, dataLength: Math.min(size, bytes.byteLength - body) }
    }

    // Chunks are word-aligned: an odd-sized chunk has a pad byte after it.
    offset = body + size + (size % 2)
  }

  throw new Error('The WAV file has no data chunk.')
}

/**
 * Peak amplitude per column, across every channel, from 0 to 1.
 *
 * Computed straight off the bytes rather than by decoding every sample into a
 * float array first: ten minutes of 48 kHz stereo is 28 million samples, and
 * a waveform 320 pixels wide needs one number per pixel.
 */
export function wavPeaks(bytes: Uint8Array, format: PcmFormat, columns: number): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const bytesPerSample = format.bitsPerSample / 8
  const frameSize = bytesPerSample * format.channels
  const valid = (format.encoding === 1 && [8, 16, 24, 32].includes(format.bitsPerSample))
    || (format.encoding === 3 && [32, 64].includes(format.bitsPerSample))

  if (!valid || format.channels < 1 || frameSize === 0)
    throw new StorageTaskSkipped(`A ${format.bitsPerSample}-bit ${format.encoding === 3 ? 'float' : 'integer'} WAV is not a sample layout drawn here.`)

  const frames = Math.floor(format.dataLength / frameSize)
  const peaks: number[] = Array.from({ length: columns }, () => 0)
  if (frames === 0)
    return peaks

  const read = (at: number): number => {
    switch (format.bitsPerSample) {
      case 8: return (view.getUint8(at) - 128) / 128
      case 16: return view.getInt16(at, true) / 32768
      case 24: {
        const value = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16)
        return value / 8388608
      }
      case 32: return format.encoding === 3 ? view.getFloat32(at, true) : view.getInt32(at, true) / 2147483648
      default: return view.getFloat64(at, true)
    }
  }

  for (let frame = 0; frame < frames; frame++) {
    const column = Math.min(columns - 1, Math.floor(frame * columns / frames))
    const base = format.dataOffset + frame * frameSize
    for (let channel = 0; channel < format.channels; channel++) {
      const sample = Math.abs(read(base + channel * bytesPerSample))
      if (Number.isFinite(sample) && sample > peaks[column]!)
        peaks[column] = Math.min(1, sample)
    }
  }

  return peaks
}

async function renderWaveform(bytes: Uint8Array): Promise<RenderedPreview> {
  const format = readWavFormat(bytes)
  const width = PREVIEW_MAX_EDGE
  const height = 120
  const bar = 2
  const gap = 1
  const peaks = wavPeaks(bytes, format, Math.floor(width / (bar + gap)))

  // Normalized to the loudest column, so a quiet recording still has a shape.
  const loudest = Math.max(...peaks, 0) || 1
  const { createImageData, encode, fillRect } = await import('ts-images')
  const canvas = createImageData(width, height, { hasAlpha: true, fill: { r: 245, g: 243, b: 255, a: 255 } })
  const middle = height / 2

  peaks.forEach((peak, index) => {
    const extent = Math.max(1, Math.round((peak / loudest) * (middle - 8)))
    fillRect(canvas, { x: index * (bar + gap), y: Math.round(middle - extent), width: bar, height: extent * 2 }, { r: 124, g: 58, b: 237, a: 255 })
  })

  return { format: 'png', bytes: await encode(canvas, 'png'), width, height }
}

/** The SFNT signatures, so a font the rasterizer cannot read is skipped with a reason rather than failed. */
function assertTrueType(bytes: Uint8Array): void {
  const signature = String.fromCharCode(...bytes.subarray(0, 4))
  if (signature === 'OTTO')
    throw new StorageTaskSkipped('This is an OpenType font with CFF outlines; only TrueType outlines can be drawn here.')
  if (signature === 'wOFF' || signature === 'wOF2')
    throw new StorageTaskSkipped('This is a compressed WOFF font; only uncompressed TrueType can be drawn here.')
  if (signature === 'ttcf')
    throw new StorageTaskSkipped('This is a TrueType collection; only single fonts are drawn here.')
  const truetype = bytes.byteLength >= 4
    && ((bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) || signature === 'true')
  if (!truetype)
    throw new StorageTaskSkipped('The content is not a TrueType font, so there are no outlines to draw.')
}

async function renderFont(bytes: Uint8Array): Promise<RenderedPreview> {
  assertTrueType(bytes)

  const { createImageData, drawText, encode, loadFont } = await import('ts-images')
  // `warnOnVariable` off: a variable font draws its default master, which is a
  // perfectly good specimen, and a warning per upload is noise in a worker log.
  const font = loadFont(bytes, { warnOnVariable: false })

  const width = PREVIEW_MAX_EDGE
  const height = 200
  const canvas = createImageData(width, height, { hasAlpha: true, fill: { r: 255, g: 255, b: 255, a: 255 } })
  const ink = { r: 28, g: 25, b: 23, a: 255 }

  drawText(canvas, { text: 'Aa', font, size: 96, x: 20, y: 110, color: ink })
  drawText(canvas, { text: 'ABCDEFGHIJKLM', font, size: 20, x: 20, y: 150, color: ink, maxWidth: width - 40, maxLines: 1 })
  drawText(canvas, { text: 'abcdefghijklm 0123456789', font, size: 20, x: 20, y: 180, color: ink, maxWidth: width - 40, maxLines: 1 })

  return { format: 'png', bytes: await encode(canvas, 'png'), width, height }
}

/**
 * The first lines of a text file, cleaned for display.
 *
 * Control characters other than tabs are dropped, tabs become two spaces, and
 * each line is cut at {@link TEXT_PREVIEW_MAX_COLUMNS}. The result is plain
 * text for a `<pre>`, never markup - a dashboard interpolates it as text.
 */
export function textSnippet(bytes: Uint8Array): string {
  // A NUL is the cheapest reliable sign of a binary file wearing a text name.
  if (bytes.includes(0))
    throw new StorageTaskSkipped('The content has NUL bytes, so it is binary rather than text.')

  let text = new TextDecoder('utf-8').decode(bytes)
  // A head cut mid-character ends in a replacement character; drop it rather
  // than show a glyph for a byte that was never part of the file's text.
  text = text.replace(/�$/, '').replace(/^﻿/, '')

  return text
    .split(/\r\n|\r|\n/)
    .slice(0, TEXT_PREVIEW_MAX_LINES)
    // eslint-disable-next-line no-control-regex
    .map(line => [...line.replace(/\t/g, '  ').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')].slice(0, TEXT_PREVIEW_MAX_COLUMNS).join('').trimEnd())
    .join('\n')
    .trimEnd()
}

function renderText(bytes: Uint8Array, name: string): RenderedPreview {
  // Text has no signature, so ANY signature match - a PNG, a zip, a PDF named
  // `.txt` - means the bytes are not text.
  assertSniffedAs(bytes, name, () => false, 'text')
  return { format: 'txt', bytes: new TextEncoder().encode(textSnippet(bytes)) }
}
