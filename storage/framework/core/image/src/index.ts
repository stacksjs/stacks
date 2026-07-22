import type { ImageData, ResizeFit } from 'ts-images'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve } from 'node:path'
import { decode, encode, imageToSplatHash, resize } from 'ts-images'

export type ImageFormat = 'avif' | 'webp' | 'jpeg' | 'png'
export interface ImageVariant { width: number, height: number, bytes: number, format: ImageFormat, mimeType: string, path: string, url: string, cacheKey: string }
export interface ImageManifest { source: { width: number, height: number, hash: string }, variants: ImageVariant[], placeholder: string }
export type ImagePreset = 'avatar' | 'content' | 'hero' | 'thumbnail'
export interface ImageStorageAdapter { fileExists: (_path: string) => Promise<boolean>, write: (_path: string, _contents: Uint8Array) => Promise<{ size: number }>, stat: (_path: string) => Promise<{ size: number }>, publicUrl: (_path: string) => Promise<string> }
export interface ImageOptions { root?: string, outputDir?: string, publicPath?: string, concurrency?: number, upscale?: boolean, authorize?: (_source: string, _context?: unknown) => boolean | Promise<boolean>, authorizationContext?: unknown }

const mime: Record<ImageFormat, string> = { avif: 'image/avif', webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' }
function integer(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`${name} must be between ${min} and ${max}`)
}

export function resolveImageSource(source: string, root: string = process.cwd()): string {
  const allowed = resolve(root)
  const candidate = isAbsolute(source) ? resolve(source) : resolve(allowed, source)
  const relation = relative(allowed, candidate)
  if (source.includes('\0') || relation === '..' || relation.startsWith('../') || isAbsolute(relation)) throw new Error('Image source must stay inside the configured root')
  return candidate
}

export class ImageBuilder {
  private targetWidths = [480, 768, 1280, 1920]
  private targetFormats: ImageFormat[] = ['avif', 'webp', 'jpeg']
  private targetFit: ResizeFit = 'inside'
  private targetHeight?: number
  private targetAspectRatio?: number
  private targetPosition: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'center'
  private includeOriginal = true
  private targetStorage?: { adapter: ImageStorageAdapter, prefix: string }
  private targetQuality = 82
  private options: ImageOptions & { root: string, outputDir: string, publicPath: string, concurrency: number, upscale: boolean }

  constructor(private readonly source: string, options: ImageOptions = {}) {
    this.options = { ...options, root: options.root ?? process.cwd(), outputDir: options.outputDir ?? resolve('public/media/images'), publicPath: options.publicPath ?? '/media/images', concurrency: options.concurrency ?? 4, upscale: options.upscale ?? false }
  }

  widths(widths: number[]): this { if (!widths.length) throw new TypeError('Image widths are required'); widths.forEach(value => integer('Image width', value, 1, 16_384)); this.targetWidths = [...new Set(widths)].sort((a, b) => a - b); return this }
  formats(formats: ImageFormat[]): this { if (!formats.length) throw new TypeError('Image formats are required'); this.targetFormats = [...new Set(formats)]; return this }
  fit(fit: ResizeFit): this { this.targetFit = fit; return this }
  height(value: number): this { integer('Image height', value, 1, 16_384); this.targetHeight = value; this.targetAspectRatio = undefined; return this }
  aspectRatio(value: number): this { if (!Number.isFinite(value) || value <= 0 || value > 100) throw new TypeError('Image aspect ratio must be between 0 and 100'); this.targetAspectRatio = value; this.targetHeight = undefined; return this }
  position(value: typeof this.targetPosition): this { this.targetPosition = value; return this }
  preset(value: ImagePreset): this {
    const presets = { avatar: { widths: [64, 128, 256, 512], ratio: 1, fit: 'cover' as const, original: false }, content: { widths: [320, 640, 960, 1280, 1920], fit: 'inside' as const, original: true }, hero: { widths: [640, 1280, 1920, 2560], ratio: 16 / 9, fit: 'cover' as const, original: true }, thumbnail: { widths: [160, 320, 640], ratio: 16 / 9, fit: 'cover' as const, original: false } } as const
    const preset = presets[value]
    this.targetWidths = [...preset.widths]
    this.targetFit = preset.fit
    this.targetAspectRatio = 'ratio' in preset ? preset.ratio : undefined
    this.targetHeight = undefined
    this.includeOriginal = preset.original
    return this
  }
  quality(value: number): this { integer('Image quality', value, 1, 100); this.targetQuality = value; return this }
  output(dir: string, publicPath = '/media/images'): this { this.options.outputDir = resolve(dir); this.options.publicPath = `/${publicPath.replace(/^\/+|\/+$/g, '')}`; return this }
  storage(adapter: ImageStorageAdapter, prefix = 'media/images'): this { this.targetStorage = { adapter, prefix: prefix.replace(/^\/+|\/+$/g, '') }; return this }

  async generate(): Promise<ImageManifest> {
    integer('Image concurrency', this.options.concurrency, 1, 32)
    const sourcePath = resolveImageSource(this.source, this.options.root)
    if (this.options.authorize && !await this.options.authorize(sourcePath, this.options.authorizationContext)) throw new Error('Image delivery is not authorized')
    const bytes = new Uint8Array(await readFile(sourcePath))
    const hash = createHash('sha256').update(bytes).digest('hex')
    const decoded = await decode(bytes)
    const widths = this.targetWidths.filter(width => this.options.upscale || width <= decoded.width)
    if (this.includeOriginal && !widths.includes(decoded.width)) widths.push(decoded.width)
    const tasks = [...new Set(widths)].sort((a, b) => a - b).flatMap(width => this.targetFormats.map(format => ({ width, format })))
    const variants: ImageVariant[] = []
    let cursor = 0
    await Promise.all(Array.from({ length: Math.min(tasks.length, this.options.concurrency) }, async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor++]!
        variants.push(await this.variant(decoded, hash, sourcePath, task.width, task.format))
      }
    }))
    variants.sort((a, b) => a.width - b.width || this.targetFormats.indexOf(a.format) - this.targetFormats.indexOf(b.format))
    return { source: { width: decoded.width, height: decoded.height, hash }, variants, placeholder: Buffer.from(imageToSplatHash(decoded)).toString('base64url') }
  }

  private async variant(source: ImageData, hash: string, sourcePath: string, width: number, format: ImageFormat): Promise<ImageVariant> {
    const height = this.targetHeight ?? (this.targetAspectRatio ? Math.max(1, Math.round(width / this.targetAspectRatio)) : undefined)
    const output = width === source.width && height === undefined ? source : resize(source, { width, height, fit: this.targetFit, position: this.targetPosition })
    if (!this.options.upscale && (output.width > source.width || output.height > source.height)) throw new TypeError(`Image variant ${output.width}x${output.height} would upscale the source`)
    const cacheKey = createHash('sha256').update(`${hash}:${width}:${height ?? 'auto'}:${format}:${this.targetFit}:${this.targetPosition}:${this.targetQuality}`).digest('hex')
    const stem = basename(sourcePath, extname(sourcePath)).replace(/[^a-zA-Z0-9_-]/g, '-') || 'image'
    const filename = `${stem}-${output.width}x${output.height}-${cacheKey.slice(0, 16)}.${format === 'jpeg' ? 'jpg' : format}`
    const path = resolve(this.options.outputDir, filename)
    if (this.targetStorage) {
      const key = this.targetStorage.prefix ? `${this.targetStorage.prefix}/${filename}` : filename
      if (await this.targetStorage.adapter.fileExists(key)) {
        const existing = await this.targetStorage.adapter.stat(key)
        return { width: output.width, height: output.height, bytes: existing.size, format, mimeType: mime[format], path: key, url: await this.targetStorage.adapter.publicUrl(key), cacheKey }
      }
      const encoded = await encode(output, format, { quality: this.targetQuality, progressive: true })
      const written = await this.targetStorage.adapter.write(key, encoded)
      return { width: output.width, height: output.height, bytes: written.size, format, mimeType: mime[format], path: key, url: await this.targetStorage.adapter.publicUrl(key), cacheKey }
    }
    const existing = await stat(path).catch(() => null)
    if (existing) return { width: output.width, height: output.height, bytes: existing.size, format, mimeType: mime[format], path, url: `${this.options.publicPath}/${filename}`, cacheKey }
    const encoded = await encode(output, format, { quality: this.targetQuality, progressive: true })
    await mkdir(this.options.outputDir, { recursive: true })
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, encoded)
    await rename(temporary, path)
    return { width: output.width, height: output.height, bytes: encoded.byteLength, format, mimeType: mime[format], path, url: `${this.options.publicPath}/${filename}`, cacheKey }
  }
}

export function image(source: string, options: ImageOptions = {}): ImageBuilder { return new ImageBuilder(source, options) }

function accepted(accept: string, mimeType: string): number {
  const [type, subtype] = mimeType.split('/')
  let best = 0
  for (const item of accept.split(',')) {
    const [range = '*/*', ...params] = item.trim().toLowerCase().split(';').map(value => value.trim())
    const [acceptedType, acceptedSubtype] = range.split('/')
    if (acceptedType !== '*' && acceptedType !== type || acceptedSubtype !== '*' && acceptedSubtype !== subtype) continue
    const raw = params.find(param => param.startsWith('q='))
    best = Math.max(best, raw ? Number.parseFloat(raw.slice(2)) || 0 : 1)
  }
  return best
}

export function negotiateImageVariant(variants: readonly ImageVariant[], accept = '*/*', width?: number): ImageVariant | undefined {
  const widths = [...new Set(variants.map(item => item.width))].sort((a, b) => a - b)
  const target = width === undefined ? widths.at(-1) : widths.find(value => value >= width) ?? widths.at(-1)
  return variants.filter(item => item.width === target).map((variant, index) => ({ variant, index, q: accepted(accept || '*/*', variant.mimeType) })).filter(item => item.q > 0).sort((a, b) => b.q - a.q || a.index - b.index)[0]?.variant
}

export function imageResponseHeaders(variant: ImageVariant): Record<string, string> {
  return { 'Content-Type': variant.mimeType, 'Content-Length': String(variant.bytes), 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': `"${variant.cacheKey}"`, 'Vary': 'Accept', 'X-Image-Width': String(variant.width), 'X-Image-Height': String(variant.height) }
}

export function signImageTransform(path: string, expires: number, secret: string): string {
  return createHmac('sha256', secret).update(`${path}\n${expires}`).digest('base64url')
}
export function verifyImageTransform(path: string, expires: number, signature: string, secret: string, now: number = Date.now()): boolean {
  if (!Number.isInteger(expires) || expires * 1000 <= now) return false
  const expected = Buffer.from(signImageTransform(path, expires, secret)); const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
