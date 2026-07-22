import type { ImageData, ResizeFit } from 'ts-images'
import { blur as applyBlur, decode, encode, resize as applyResize, rotate as applyRotate } from 'ts-images'

export type NativeImageFormat = 'jpeg' | 'png' | 'webp' | 'avif'
export interface NativeEncodeOptions { quality?: number, progressive?: boolean, lossless?: boolean, effort?: number }
export interface NativeResizeOptions { fit?: ResizeFit, withoutEnlargement?: boolean }

export interface NativeImagePipeline {
  resize: (width?: number, height?: number, options?: NativeResizeOptions) => NativeImagePipeline
  jpeg: (options?: NativeEncodeOptions) => NativeImagePipeline
  png: (options?: NativeEncodeOptions) => NativeImagePipeline
  webp: (options?: NativeEncodeOptions) => NativeImagePipeline
  avif: (options?: NativeEncodeOptions) => NativeImagePipeline
  rotate: (degrees?: number) => NativeImagePipeline
  blur: (sigma?: number) => NativeImagePipeline
  withMetadata: () => NativeImagePipeline
  toBuffer: () => Promise<Buffer>
}

class Pipeline implements NativeImagePipeline {
  private operations: Array<(image: ImageData) => ImageData> = []
  private format: NativeImageFormat = 'webp'
  private options: NativeEncodeOptions = { quality: 80 }
  constructor(private readonly input: Uint8Array) {}

  resize(width?: number, height?: number, options: NativeResizeOptions = {}): NativeImagePipeline {
    if (width !== undefined && (!Number.isInteger(width) || width <= 0)) throw new TypeError('Image width must be positive')
    if (height !== undefined && (!Number.isInteger(height) || height <= 0)) throw new TypeError('Image height must be positive')
    if (width === undefined && height === undefined) throw new TypeError('Image resize requires a width or height')
    this.operations.push((image) => {
      if (options.withoutEnlargement !== false && (width === undefined || width >= image.width) && (height === undefined || height >= image.height)) return image
      return applyResize(image, { width, height, fit: options.fit ?? 'inside' })
    })
    return this
  }

  jpeg(options: NativeEncodeOptions = {}): NativeImagePipeline { return this.output('jpeg', options) }
  png(options: NativeEncodeOptions = {}): NativeImagePipeline { return this.output('png', options) }
  webp(options: NativeEncodeOptions = {}): NativeImagePipeline { return this.output('webp', options) }
  avif(options: NativeEncodeOptions = {}): NativeImagePipeline { return this.output('avif', options) }

  rotate(degrees = 90): NativeImagePipeline {
    if (!Number.isFinite(degrees)) throw new TypeError('Image rotation must be finite')
    this.operations.push(image => applyRotate(image, degrees))
    return this
  }

  blur(sigma = 1): NativeImagePipeline {
    if (!Number.isFinite(sigma) || sigma <= 0) throw new TypeError('Image blur sigma must be positive')
    this.operations.push(image => applyBlur(image, sigma))
    return this
  }

  withMetadata(): NativeImagePipeline {
    throw new Error('Native image transforms strip metadata for privacy')
  }

  async toBuffer(): Promise<Buffer> {
    let image = await decode(this.input)
    for (const operation of this.operations) image = operation(image)
    return Buffer.from(await encode(image, this.format, this.options))
  }

  private output(format: NativeImageFormat, options: NativeEncodeOptions): NativeImagePipeline {
    const quality = options.quality ?? 80
    if (!Number.isFinite(quality) || quality < 1 || quality > 100) throw new TypeError('Image quality must be between 1 and 100')
    this.format = format
    this.options = { ...options, quality }
    return this
  }
}

export function transform(pipeline: (image: NativeImagePipeline) => NativeImagePipeline | Promise<NativeImagePipeline>): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return async (input) => {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    return (await pipeline(new Pipeline(bytes))).toBuffer()
  }
}

export function avatar(size = 512, quality = 85): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return transform(image => image.resize(size, size, { fit: 'cover' }).webp({ quality }))
}

export function resize(width: number, height: number, fit: ResizeFit = 'inside'): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return transform(image => image.resize(width, height, { fit }).webp())
}

export function stripMetadata(format: NativeImageFormat = 'webp'): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return transform(image => image[format]())
}
