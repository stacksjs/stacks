import { brotliCompressSync, constants as zlibConstants } from 'node:zlib'
import { Buffer } from 'node:buffer'
import { Middleware } from '@stacksjs/router'

/**
 * Response Compression Middleware
 *
 * Compresses outgoing response bodies with brotli or gzip when the
 * client advertises support via `Accept-Encoding`. The middleware
 * runs at the *end* of the chain — by the time it executes, the
 * action has already produced a response and stored it on the
 * request via `_response`. (We intercept by patching the response
 * after the chain ends — see implementation note below.)
 *
 * IMPORTANT — middleware shape mismatch:
 *   The Stacks middleware runner only invokes `handle()` for
 *   pre-action gating; it has no post-response hook. To compress
 *   the *outgoing* response, this middleware therefore acts as a
 *   marker — its real work is implemented as a *response wrapper*
 *   that the router applies whenever the `compress` middleware is
 *   attached (see Compress.applyToResponse below).
 *
 *   In practice, calling code uses the exported `applyCompression()`
 *   helper directly:
 *
 * @example
 * ```ts
 * import { applyCompression } from '@stacksjs/middleware/Compress'
 *
 * const response = await action.handle(req)
 * return applyCompression(req, response)
 * ```
 *
 * Compression decisions:
 *   - **Skip** if response already has `content-encoding` set.
 *   - **Skip** if body smaller than 1 KB — overhead exceeds savings.
 *   - **Skip** for already-compressed content types (image/*, video/*,
 *     audio/*, application/zip, gzip, octet-stream).
 *   - **Skip** SSE / WebSocket upgrades (`text/event-stream`).
 *   - **Prefer the highest accepted weight**, using brotli on ties. Brotli typically
 *     achieves ~20% better ratios than gzip on HTML/JSON/CSS/JS at
 *     comparable CPU cost — well worth the swap when the client
 *     supports it.
 *   - **Fall back to gzip** for `gzip` clients (universal support).
 *
 * Headers always added when compressed:
 *   - `Content-Encoding: br | gzip`
 *   - `Vary: Accept-Encoding`  (so caches segment by encoding)
 *
 * `Content-Length` is rewritten to the compressed size.
 */

/** Body must exceed this threshold (bytes) to warrant compression. */
const MIN_COMPRESS_BYTES = 1024

/**
 * Content-types that are already compressed (or untouchable). Re-running
 * gzip/brotli over them gains nothing and wastes CPU.
 *
 * Pattern matched as `startsWith` against the lowercased content-type
 * (sans parameters). Intentionally conservative — we'd rather miss a
 * compression opportunity than corrupt a binary stream by double-encoding.
 */
const SKIP_CONTENT_TYPE_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-brotli',
  'application/octet-stream',
  // SSE / streaming pipelines must not be buffered for compression.
  'text/event-stream',
]

type Encoding = 'br' | 'gzip' | null

let lastAcceptEncoding: string | null | undefined
let lastEncoding: Encoding = null

/** Repeated offers reuse one pure result, without retaining a growing cache. */
function pickEncoding(acceptEncoding: string | null): 'br' | 'gzip' | null {
  if (acceptEncoding === lastAcceptEncoding)
    return lastEncoding
  const encoding = parseEncoding(acceptEncoding)
  lastAcceptEncoding = acceptEncoding
  lastEncoding = encoding
  return encoding
}

/** Exact HTTP coding tokens and qualities, with Brotli first on equal weights. */
function parseEncoding(header: string | null): Encoding {
  if (!header)
    return null

  let br: number | undefined
  let gzip: number | undefined
  let identity = 0
  let wildcard = 0
  for (const part of header.split(',')) {
    const separator = part.indexOf(';')
    const name = (separator < 0 ? part : part.slice(0, separator)).trim().toLowerCase()
    if (name !== 'br' && name !== 'gzip' && name !== 'identity' && name !== '*')
      continue

    let quality = 1
    if (separator >= 0) {
      const weight = /^;[\t ]*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)[\t ]*$/i.exec(part.slice(separator))
      quality = weight ? Number(weight[1]) : 0
    }
    if (name === 'br')
      br = quality
    else if (name === 'gzip')
      gzip = quality
    else if (name === 'identity')
      identity = quality
    else
      wildcard = quality
  }
  br ??= wildcard
  gzip ??= wildcard
  if (identity > Math.max(br, gzip))
    return null
  if (br > 0 && br >= gzip)
    return 'br'
  if (gzip > 0)
    return 'gzip'
  return null
}

/** Heuristic: is this content type worth compressing? */
function shouldCompressContentType(contentType: string | null): boolean {
  if (!contentType) return true // unknown → assume text-like
  const separator = contentType.indexOf(';')
  const ct = (separator < 0 ? contentType : contentType.slice(0, separator)).trim().toLowerCase()
  for (const prefix of SKIP_CONTENT_TYPE_PREFIXES) {
    if (ct.startsWith(prefix)) return false
  }
  return true
}

/**
 * Compress a Response if (a) the client supports an encoding, (b) the
 * body is large enough, and (c) the content type isn't already
 * compressed. Returns the original Response unchanged when any of
 * those conditions don't hold.
 *
 * Buffers the entire body in memory — appropriate for the typical
 * JSON/HTML response sizes we're targeting (KB to single-digit MB).
 * For multi-MB streamed responses, the middleware should be skipped
 * (the SSE / event-stream check above handles the most common case).
 * A caller that already knows a conservative UTF-8 byte upper bound may
 * supply it to leave a proven sub-threshold body unconsumed. This must come
 * from the body itself, not an unverified Content-Length header.
 *
 * @example
 * ```ts
 * const response = Response.json({ users: [...] })
 * return await applyCompression(request, response)
 * // → response with `Content-Encoding: br` and a brotli-compressed body
 * ```
 */
export async function applyCompression(request: Request, response: Response, bodySizeUpperBound?: number): Promise<Response> {
  // Already encoded — leave it alone. Re-encoding would corrupt the
  // body, and the client already knows what to expect.
  if (response.headers.get('content-encoding')) return response

  if (bodySizeUpperBound !== undefined && Number.isSafeInteger(bodySizeUpperBound) && bodySizeUpperBound >= 0 && bodySizeUpperBound < MIN_COMPRESS_BYTES)
    return response

  // No body or non-text content streams (SSE, etc.) — skip.
  if (!response.body) return response

  const contentType = response.headers.get('content-type')
  if (!shouldCompressContentType(contentType)) return response

  const encoding = pickEncoding(request.headers.get('accept-encoding'))
  if (!encoding) return response

  // Buffer the body. We need the full payload to compress synchronously
  // (Bun.gzipSync / brotliCompressSync) AND to know the post-compression
  // length for the Content-Length header.
  const bodyBuf = Buffer.from(await response.arrayBuffer())
  if (bodyBuf.byteLength < MIN_COMPRESS_BYTES) {
    // Body too small — re-emit as a fresh Response since we already
    // consumed `response.body` above.
    return new Response(bodyBuf, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  let compressed: Uint8Array<ArrayBuffer>
  if (encoding === 'br') {
    // Brotli quality 5 is the sweet spot for dynamic responses:
    // quality 11 (max) is ~10× slower for ~5% smaller output.
    // 5 is also the Express compression-middleware default.
    compressed = brotliCompressSync(bodyBuf, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
      },
    })
  }
  else {
    // Bun.gzipSync is significantly faster than node:zlib.gzipSync
    // for typical response sizes — used here in preference to
    // node:zlib for the gzip path. Brotli has no Bun-native API yet
    // (as of writing) so we use node:zlib for that branch.
    compressed = Bun.gzipSync(bodyBuf)
  }

  const newHeaders = new Headers(response.headers)
  newHeaders.set('Content-Encoding', encoding)
  newHeaders.set('Content-Length', String(compressed.byteLength))
  // Caches MUST key on Accept-Encoding once we vary the body by it,
  // otherwise a gzip-only proxy serves a brotli body to a gzip-only
  // client and the response is undecodable.
  const existingVary = newHeaders.get('Vary')
  if (existingVary) {
    if (!/\baccept-encoding\b/i.test(existingVary)) {
      newHeaders.set('Vary', `${existingVary}, Accept-Encoding`)
    }
  }
  else {
    newHeaders.set('Vary', 'Accept-Encoding')
  }

  // Both codecs return owned, non-shared bytes accepted directly by Response.
  return new Response(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

/**
 * Marker middleware. The router inspects the route middleware list for
 * `compress` and, when present, runs `applyCompression()` on the final
 * response. The middleware's `handle` is intentionally a no-op:
 * compression must run *after* the action, but the standard middleware
 * pipeline runs *before* it.
 *
 * @example
 * ```ts
 * route.get('/api/large.json', 'Actions/LargePayload').middleware('compress')
 * ```
 */
export default new Middleware({
  name: 'compress',
  // Run last in the pre-action chain so the marker stamp lands close
  // to the action — the post-action wrapper picks it up by name.
  priority: 100,

  handle(request) {
    // Stamp the request so the post-response wrapper knows to compress.
    // This is read by the router's response-finalization step.
    ;request._compress = true
  },
})
