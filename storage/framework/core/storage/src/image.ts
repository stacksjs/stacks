/**
 * Image-processing pipeline for `Storage.put(file, { transform })`
 * (stacksjs/stacks#1856 Stage 5).
 *
 * `sharp` is a native module with a non-trivial install footprint
 * (libvips, platform-specific binaries), so this lives in its own
 * submodule (`@stacksjs/storage/image`) and is lazy-imported. Projects
 * that never upload images don't pay the install cost; projects that
 * do get a one-line addition to their upload action:
 *
 * @example
 * ```ts
 * import { Storage } from '@stacksjs/storage'
 * import { transform } from '@stacksjs/storage/image'
 *
 * await Storage.put(file, {
 *   disk: 'public',
 *   dir: 'avatars',
 *   transform: transform(img => img.resize(512, 512, { fit: 'cover' }).webp({ quality: 85 })),
 * })
 * ```
 *
 * The transformer receives a `sharp.Sharp` instance pre-loaded with the
 * uploaded bytes; whatever it returns is awaited and persisted. Sharp
 * pipelines are chainable — `resize`, `webp`, `jpeg`, `png`, `rotate`,
 * `blur`, `withMetadata`, etc. See https://sharp.pixelplumbing.com.
 */

/**
 * Loose type for the sharp module — declared here so we don't pull the
 * sharp dts into every storage consumer's typecheck graph. Real
 * tooling lookups happen via the lazy import below.
 */
interface SharpFactory {
  (input?: Buffer | Uint8Array): SharpInstance
}

interface SharpInstance {
  toBuffer(): Promise<Buffer>
  resize: (...args: unknown[]) => SharpInstance
  jpeg: (...args: unknown[]) => SharpInstance
  png: (...args: unknown[]) => SharpInstance
  webp: (...args: unknown[]) => SharpInstance
  avif: (...args: unknown[]) => SharpInstance
  gif: (...args: unknown[]) => SharpInstance
  rotate: (...args: unknown[]) => SharpInstance
  blur: (...args: unknown[]) => SharpInstance
  withMetadata: (...args: unknown[]) => SharpInstance
  [k: string]: unknown
}

/**
 * Resolve the sharp factory at first use. Stays cached for the rest of
 * the process lifetime so a long-lived server doesn't re-import on
 * every upload. Throws a clear `Error` with install instructions if
 * sharp isn't on disk — projects that don't need image transforms
 * shouldn't have to install it.
 */
let cachedSharp: SharpFactory | null = null

async function loadSharp(): Promise<SharpFactory> {
  if (cachedSharp) return cachedSharp
  try {
    const mod = await import('sharp')
    cachedSharp = (mod as { default?: SharpFactory }).default ?? (mod as unknown as SharpFactory)
    return cachedSharp!
  }
  catch (err) {
    throw new Error(
      '[storage/image] `sharp` is not installed. Image transforms require it as a peer dependency.\n'
      + '  Install with: `bun add sharp`\n'
      + `  Original load error: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Wrap a Sharp pipeline so it composes with
 * `Storage.put(file, { transform })`. The pipeline function receives a
 * fresh Sharp instance preloaded with the file's bytes; its return
 * value is the final pipeline chain (sharp's methods are chainable so
 * "return img.resize(...)" is the normal shape).
 *
 * The wrapper handles the buffer normalisation + final `.toBuffer()`
 * call so callers don't have to.
 */
export function transform(
  pipeline: (img: SharpInstance) => SharpInstance | Promise<SharpInstance>,
): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return async (input) => {
    const sharp = await loadSharp()
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
    const img = sharp(buf)
    const piped = await pipeline(img)
    return piped.toBuffer()
  }
}

/**
 * Common preset for square avatars — resizes + crops to fit, encodes
 * as WebP at quality 85. Covers the by-far most common
 * `Storage.put(file, { transform: ... })` callsite.
 *
 * @example
 * ```ts
 * import { avatar } from '@stacksjs/storage/image'
 *
 * await Storage.put(file, {
 *   dir: 'avatars',
 *   transform: avatar(512),
 * })
 * ```
 */
export function avatar(size = 512, quality = 85): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return transform(img => img.resize(size, size, { fit: 'cover' }).webp({ quality }))
}

/**
 * Generic resize preset. `fit` defaults to `'inside'` (preserve aspect
 * ratio, don't crop) which is the most common non-avatar case.
 */
export function resize(
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' = 'inside',
): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return transform(img => img.resize(width, height, { fit }))
}

/**
 * Strip EXIF + colour profile + other embedded metadata. Useful when
 * accepting user uploads where you don't want to leak GPS coordinates
 * embedded in phone photos. Pairs well with resize/format presets via
 * the explicit `transform()` form when needed.
 *
 * sharp strips metadata by default unless `withMetadata()` is called;
 * this preset just makes the intent explicit.
 */
export function stripMetadata(): (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Buffer> {
  return transform(img => img)
}
