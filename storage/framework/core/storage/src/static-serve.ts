import { createHash } from 'node:crypto'
import { extname } from 'node:path'

/**
 * Optional knobs for {@link serveFile}.
 */
export interface ServeFileOptions {
  /**
   * Override the response Content-Type. Defaults to Bun's MIME detection
   * (which falls back to `application/octet-stream` for unknown types).
   */
  contentType?: string
  /**
   * Force a specific Cache-Control header. When omitted the function
   * picks one based on whether the path looks fingerprinted (immutable
   * long-cache) or not (short cache, must-revalidate).
   */
  cacheControl?: string
  /**
   * `max-age` for the non-fingerprinted branch. Default 300s (5 min) —
   * long enough to absorb a refresh storm, short enough that a code-push
   * propagates quickly.
   */
  defaultMaxAge?: number
  /**
   * Set to `false` to skip the ETag computation entirely (useful when
   * you've layered another cache in front and don't want the cost).
   */
  etag?: boolean
}

/**
 * In-process cache of `(path -> { mtime, etag })`. Keeps us from
 * re-hashing the same file on every request — invalidates automatically
 * when the file's mtime changes, which is what every build pipeline
 * (vite, bun build, esbuild) bumps when re-emitting an asset.
 *
 * Bounded loosely via a simple FIFO eviction at 5k entries — anything
 * larger than that suggests you should be serving from a CDN, not Bun.
 */
const etagCache = new Map<string, { mtimeMs: number, etag: string }>()
const ETAG_CACHE_MAX = 5_000

/** Looks like a fingerprinted asset path: `.<8+ hex chars>.<ext>`. */
const FINGERPRINTED = /\.[a-f0-9]{8,}\./

/**
 * Serve a static file with production-grade cache headers:
 *   - Strong ETag (sha256, first 16 hex chars) computed once per
 *     `(path, mtime)` and cached in-process.
 *   - `Last-Modified` from the file's mtime.
 *   - 304 Not Modified when `If-None-Match` matches OR
 *     `If-Modified-Since` is at-or-after mtime (and ETag didn't mismatch).
 *   - `Cache-Control: public, max-age=31536000, immutable` for paths
 *     that look fingerprinted (e.g. `/_assets/foo.abc12345.js`).
 *   - `Cache-Control: public, max-age=300, must-revalidate` for
 *     everything else.
 *
 * Returns a `404` if the file doesn't exist. Other read errors propagate.
 *
 * @example
 * ```ts
 * import { serveFile } from '@stacksjs/storage'
 * import { resolve } from 'node:path'
 *
 * route.get('/assets/:path', async (req) => {
 *   const url = new URL(req.url)
 *   // url.pathname is e.g. /assets/app.abc12345.js
 *   const filePath = resolve('./public', url.pathname.replace(/^\//, ''))
 *   return serveFile(req, filePath)
 * })
 * ```
 */
export async function serveFile(
  req: Request,
  filePath: string,
  options: ServeFileOptions = {},
): Promise<Response> {
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (!exists)
    return new Response('Not Found', { status: 404 })

  // Bun.file().stat() returns Node-style stats. Prefer `mtimeMs` (number)
  // when present, fall back to `mtime` (Date) — Bun has shipped both at
  // various points and we want this to work across versions.
  const stat = await file.stat()
  const mtimeMs = Math.floor(
    typeof stat.mtimeMs === 'number'
      ? stat.mtimeMs
      : stat.mtime?.getTime() ?? Date.now(),
  )
  const lastModified = new Date(mtimeMs).toUTCString()
  const contentType = options.contentType || file.type || guessMime(filePath)

  // ETag: cached per (path, mtime) so we re-hash only when the file
  // genuinely changed. Build the cache key with the full path so two
  // routes serving the same file don't collide (they wouldn't anyway,
  // but explicit is better).
  let etag: string | undefined
  if (options.etag !== false) {
    etag = await computeEtag(filePath, mtimeMs, file)
  }

  // 304 short-circuit. Match ETag *first* — it's cheaper than the date
  // comparison and the strong-validator semantics mean if it matches the
  // body is identical regardless of mtime.
  const ifNoneMatch = req.headers.get('if-none-match')
  if (etag && ifNoneMatch && stripWeak(ifNoneMatch) === etag) {
    return new Response(null, {
      status: 304,
      headers: buildHeaders({ etag, lastModified, contentType, filePath, options, omitContentType: true }),
    })
  }

  const ifModifiedSince = req.headers.get('if-modified-since')
  if (ifModifiedSince) {
    const sinceMs = Date.parse(ifModifiedSince)
    if (!Number.isNaN(sinceMs) && mtimeMs <= sinceMs) {
      return new Response(null, {
        status: 304,
        headers: buildHeaders({ etag, lastModified, contentType, filePath, options, omitContentType: true }),
      })
    }
  }

  return new Response(file, {
    status: 200,
    headers: buildHeaders({ etag, lastModified, contentType, filePath, options }),
  })
}

interface BuildHeadersInput {
  etag?: string
  lastModified: string
  contentType: string
  filePath: string
  options: ServeFileOptions
  omitContentType?: boolean
}

function buildHeaders(input: BuildHeadersInput): Headers {
  const h = new Headers()
  if (!input.omitContentType)
    h.set('Content-Type', input.contentType)
  h.set('Last-Modified', input.lastModified)
  if (input.etag) h.set('ETag', `"${input.etag}"`)
  h.set('Cache-Control', input.options.cacheControl || pickCacheControl(input.filePath, input.options))
  // Static assets are safe to share — explicitly say so for proxies that
  // default to `private` when the auth header was on the request.
  h.set('Vary', 'Accept-Encoding')
  return h
}

function pickCacheControl(filePath: string, options: ServeFileOptions): string {
  if (FINGERPRINTED.test(filePath))
    return 'public, max-age=31536000, immutable'
  const maxAge = options.defaultMaxAge ?? 300
  return `public, max-age=${maxAge}, must-revalidate`
}

async function computeEtag(filePath: string, mtimeMs: number, file: ReturnType<typeof Bun.file>): Promise<string> {
  const cached = etagCache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs) return cached.etag

  const buf = await file.arrayBuffer()
  const etag = createHash('sha256').update(new Uint8Array(buf)).digest('hex').slice(0, 16)

  // FIFO eviction — drop the oldest insertion when full. Map iteration
  // order is insertion order in JS so `keys().next()` gives us the
  // oldest. Cheap and good enough for a per-process cache.
  if (etagCache.size >= ETAG_CACHE_MAX) {
    const firstKey = etagCache.keys().next().value
    if (firstKey !== undefined) etagCache.delete(firstKey)
  }
  etagCache.set(filePath, { mtimeMs, etag })
  return etag
}

/** Strip W/ weak-validator prefix and surrounding quotes from an If-None-Match value. */
function stripWeak(v: string): string {
  let s = v.trim()
  if (s.startsWith('W/')) s = s.slice(2)
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
  return s
}

/** Tiny MIME fallback for a handful of common extensions Bun.file may not type. */
function guessMime(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs': return 'application/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.html':
    case '.htm': return 'text/html; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.webp': return 'image/webp'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.ico': return 'image/x-icon'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    case '.ttf': return 'font/ttf'
    case '.txt': return 'text/plain; charset=utf-8'
    case '.wasm': return 'application/wasm'
    case '.map': return 'application/json; charset=utf-8'
    default: return 'application/octet-stream'
  }
}
