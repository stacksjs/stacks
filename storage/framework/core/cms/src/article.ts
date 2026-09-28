/**
 * Blog post bodies, published the way Medium publishes them.
 *
 * Markdown renders an image as a bare `<img>` in a paragraph and a link as a
 * link. `renderPostHtml` hands that HTML to ts-medium-editor's article
 * renderer, so every Stacks blog gets, by default:
 *
 * - figures, with `![alt](src "caption")` titles as captions
 * - adjacent images as grids (two side by side; three with the tallest on the
 *   left and two stacked on the right), sized from the real files in
 *   `public/` so nothing is cropped and nothing shifts while loading
 * - lazy loading, async decoding, click-to-zoom
 * - embeds for bare YouTube, Vimeo and HQ.training activity links
 *
 * Both blog paths use it: the BunPress blog (`@stacksjs/actions` blog.ts) and
 * stx-native blogs, which call it from their post view:
 *
 *   const { renderPostHtml, articleHead, articleScript } = require('@stacksjs/cms/article')
 *   post.html = renderPostHtml(html)
 *   // then {!! articleHead() !!} in the head and {!! articleScript() !!} before </body>
 */
import type { ImageSize, RenderArticleOptions } from 'ts-medium-editor/article'
import { existsSync, openSync, readFileSync, readSync, closeSync, statSync } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderArticle } from 'ts-medium-editor/article'

export type { EmbedProvider, ImageSize, RenderArticleOptions } from 'ts-medium-editor/article'

export interface RenderPostOptions extends RenderArticleOptions {
  /** Where `/…` image paths are read from to learn their size. Default `<cwd>/public`. */
  publicDir?: string
}

/**
 * Width and height from an image file's header, without decoding it. Covers
 * PNG, JPEG, GIF, WebP and AVIF, which is every format a blog serves.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (at: number, length: number): string => String.fromCharCode(...bytes.subarray(at, at + length))

  // PNG: IHDR is always the first chunk.
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 3) === 'PNG')
    return { width: view.getUint32(16), height: view.getUint32(20) }

  // GIF: logical screen size, little endian.
  if (bytes.length >= 10 && ascii(0, 3) === 'GIF')
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }

  // WebP: lossy (VP8), lossless (VP8L) or extended (VP8X).
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ')
      return { width: view.getUint16(26, true) & 0x3FFF, height: view.getUint16(28, true) & 0x3FFF }
    if (chunk === 'VP8L') {
      const b = view.getUint32(21, true)
      return { width: (b & 0x3FFF) + 1, height: ((b >> 14) & 0x3FFF) + 1 }
    }
    if (chunk === 'VP8X') {
      const w = bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)
      const h = bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)
      return { width: w + 1, height: h + 1 }
    }
    return null
  }

  // AVIF / HEIF: the first `ispe` (image spatial extents) property box.
  if (bytes.length >= 12 && ascii(4, 4) === 'ftyp') {
    for (let i = 8; i + 16 <= bytes.length; i++) {
      if (bytes[i] === 0x69 && ascii(i, 4) === 'ispe')
        return { width: view.getUint32(i + 8), height: view.getUint32(i + 12) }
    }
    return null
  }

  // JPEG: walk the markers to the first start-of-frame.
  if (bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xFF) {
        i++
        continue
      }
      const marker = bytes[i + 1]!
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        i += 2
        continue
      }
      const length = view.getUint16(i + 2)
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC)
        return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) }
      i += 2 + length
    }
  }

  return null
}

/** The first 64 KB is where every header above lives, AVIF's `ispe` included. */
function readHead(file: string): Uint8Array {
  const fd = openSync(file, 'r')
  try {
    const buffer = new Uint8Array(65536)
    const read = readSync(fd, buffer, 0, buffer.length, 0)
    return buffer.subarray(0, read)
  }
  finally {
    closeSync(fd)
  }
}

const sizeCache = new Map<string, { mtime: number, size: ImageSize | null }>()

/**
 * Resolves `/images/…` style paths against the public directory and reads
 * their size. Remote URLs, and anything that would escape the directory,
 * resolve to null. Cached per file until it changes.
 */
export function publicImageResolver(publicDir: string = join(process.cwd(), 'public')): (src: string) => ImageSize | null {
  const root = normalize(publicDir + sep)
  return (src: string) => {
    if (!src.startsWith('/') || src.startsWith('//'))
      return null
    let path: string
    try {
      path = normalize(join(root, decodeURIComponent(src.split(/[?#]/)[0]!)))
    }
    catch {
      return null
    }
    if (!path.startsWith(root) || !existsSync(path))
      return null
    const mtime = statSync(path).mtimeMs
    const cached = sizeCache.get(path)
    if (cached && cached.mtime === mtime)
      return cached.size
    let size: ImageSize | null = null
    try {
      size = imageSize(readHead(path))
    }
    catch {}
    sizeCache.set(path, { mtime, size })
    return size
  }
}

/** A rendered post body with figures, grids, zoom and embeds. */
export function renderPostHtml(html: string, options: RenderPostOptions = {}): string {
  const { publicDir, ...rest } = options
  return renderArticle(html, { resolveImage: publicImageResolver(publicDir), ...rest })
}

let cachedCss: string | null = null
let cachedScript: string | null = null

function packageFile(relative: string): string {
  // The package exports ESM only, so it is resolved as an import would be.
  const entry = fileURLToPath(import.meta.resolve('ts-medium-editor/article'))
  // .../ts-medium-editor/dist/article/index.js -> .../ts-medium-editor/dist/<relative>
  return join(dirname(dirname(entry)), relative)
}

/** The article stylesheet, as CSS text. */
export function articleCss(): string {
  if (cachedCss === null)
    cachedCss = readFileSync(packageFile('css/article.css'), 'utf-8')
  return cachedCss
}

/** A `<style>` tag carrying the article stylesheet, for a page's head. */
export function articleHead(): string {
  return `<style data-article>${articleCss()}</style>`
}

/**
 * A module `<script>` that turns on click-to-zoom and embed auto-height. The
 * browser build of the article module is inlined, so the page needs no extra
 * request and no bundler.
 */
export function articleScript(): string {
  if (cachedScript === null) {
    const source = readFileSync(packageFile('article/index.js'), 'utf-8')
    // The build ends in one `export { local as name, … }`. Drop it and call
    // mountArticle by whatever local name the bundler gave it.
    const exports = source.match(/export\s*\{([^}]*)\};?\s*$/)
    const binding = exports?.[1]
      ?.split(',')
      .map(part => part.trim().split(/\s+as\s+/))
      .find(([local, name]) => (name ?? local) === 'mountArticle')?.[0]
    // Without the binding the page still works, it just does not zoom.
    cachedScript = exports && binding
      ? `<script type="module">${source.slice(0, exports.index)}\n${binding}()</script>`
      : ''
  }
  return cachedScript
}
