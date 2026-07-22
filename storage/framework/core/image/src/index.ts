import type { ImageData, ResizeFit } from 'ts-images'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve } from 'node:path'
import { decode, encode, imageToSplatHash, resize } from 'ts-images'

export type ImageFormat = 'avif' | 'webp' | 'jpeg' | 'png'
export interface ImageVariant { width: number, height: number, bytes: number, format: ImageFormat, mimeType: string, path: string, url: string, cacheKey: string }
export interface ImageManifest { source: { width: number, height: number, hash: string }, variants: ImageVariant[], placeholder: string }
export interface ImageOptions { root?: string, outputDir?: string, publicPath?: string, concurrency?: number, upscale?: boolean }

const mime: Record<ImageFormat, string> = { avif: 'image/avif', webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' }
function integer(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`${name} must be between ${min} and ${max}`)
}

export function resolveImageSource(source: string, root = process.cwd()): string {
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
  private targetQuality = 82
  private options: Required<ImageOptions>

  constructor(private readonly source: string, options: ImageOptions = {}) {
    this.options = { root: options.root ?? process.cwd(), outputDir: options.outputDir ?? resolve('public/media/images'), publicPath: options.publicPath ?? '/media/images', concurrency: options.concurrency ?? 4, upscale: options.upscale ?? false }
  }

  widths(widths: number[]): this { if (!widths.length) throw new TypeError('Image widths are required'); widths.forEach(value => integer('Image width', value, 1, 16_384)); this.targetWidths = [...new Set(widths)].sort((a, b) => a - b); return this }
  formats(formats: ImageFormat[]): this { if (!formats.length) throw new TypeError('Image formats are required'); this.targetFormats = [...new Set(formats)]; return this }
  fit(fit: ResizeFit): this { this.targetFit = fit; return this }
  quality(value: number): this { integer('Image quality', value, 1, 100); this.targetQuality = value; return this }
  output(dir: string, publicPath = '/media/images'): this { this.options.outputDir = resolve(dir); this.options.publicPath = `/${publicPath.replace(/^\/+|\/+$/g, '')}`; return this }

  async generate(): Promise<ImageManifest> {
    integer('Image concurrency', this.options.concurrency, 1, 32)
    const sourcePath = resolveImageSource(this.source, this.options.root)
    const bytes = new Uint8Array(await readFile(sourcePath))
    const hash = createHash('sha256').update(bytes).digest('hex')
    const decoded = await decode(bytes)
    const widths = this.targetWidths.filter(width => this.options.upscale || width <= decoded.width)
    if (!widths.includes(decoded.width)) widths.push(decoded.width)
    const tasks = [...new Set(widths)].sort((a, b) => a - b).flatMap(width => this.targetFormats.map(format => ({ width, format })))
    const variants: ImageVariant[] = []
    let cursor = 0
    await Promise.all(Array.from({ length: Math.min(tasks.length, this.options.concurrency) }, async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor++]
        variants.push(await this.variant(decoded, hash, sourcePath, task.width, task.format))
      }
    }))
    variants.sort((a, b) => a.width - b.width || this.targetFormats.indexOf(a.format) - this.targetFormats.indexOf(b.format))
    return { source: { width: decoded.width, height: decoded.height, hash }, variants, placeholder: Buffer.from(imageToSplatHash(decoded)).toString('base64url') }
  }

  private async variant(source: ImageData, hash: string, sourcePath: string, width: number, format: ImageFormat): Promise<ImageVariant> {
    const output = width === source.width ? source : resize(source, { width, fit: this.targetFit })
    const cacheKey = createHash('sha256').update(`${hash}:${width}:${format}:${this.targetFit}:${this.targetQuality}`).digest('hex')
    const stem = basename(sourcePath, extname(sourcePath)).replace(/[^a-zA-Z0-9_-]/g, '-') || 'image'
    const filename = `${stem}-${width}w-${cacheKey.slice(0, 16)}.${format === 'jpeg' ? 'jpg' : format}`
    const path = resolve(this.options.outputDir, filename)
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
    const [range, ...params] = item.trim().toLowerCase().split(';').map(value => value.trim())
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

export function signImageTransform(path: string, expires: number, secret: string): string { return createHmac('sha256', secret).update(`${path}\n${expires}`).digest('base64url') }
export function verifyImageTransform(path: string, expires: number, signature: string, secret: string, now = Date.now()): boolean {
  if (!Number.isInteger(expires) || expires * 1000 <= now) return false
  const expected = Buffer.from(signImageTransform(path, expires, secret)); const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
