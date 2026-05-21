/**
 * CORS configuration types (stacksjs/stacks#1859 H-2).
 *
 * Lives in `@stacksjs/types` so userland `config/cors.ts` files can
 * `import type { CorsConfig } from '@stacksjs/types'` and get full
 * IntelliSense, and so the Cors middleware can read
 * `config.cors` with proper typing instead of an `as any` cast.
 */

/**
 * Raw CORS configuration — every field optional. Defaults fill in
 * any field that's missing when the middleware resolves config.
 *
 * @example
 * ```ts
 * // config/cors.ts
 * import type { CorsConfig } from '@stacksjs/types'
 *
 * export default {
 *   origin: ['https://app.example.com', 'https://admin.example.com'],
 *   credentials: true,
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
 *   maxAge: 600,
 * } satisfies CorsConfig
 * ```
 */
export interface CorsConfig {
  /**
   * Allowed origins.
   *
   * - `'*'` permits any origin (incompatible with `credentials: true`).
   * - A string array enumerates the explicit allow-list; the request's
   *   `Origin` header is reflected verbatim when it matches.
   * - A predicate function lets you implement dynamic allow-lists
   *   (e.g. wildcards, regex, environment-dependent).
   */
  origin?: '*' | string[] | ((origin: string) => boolean)

  /**
   * HTTP methods the server accepts cross-origin. Echoed back in
   * preflight `Access-Control-Allow-Methods` responses.
   */
  methods?: string[]

  /**
   * Request headers the browser is allowed to send cross-origin.
   * Echoed back in preflight `Access-Control-Allow-Headers` responses.
   */
  allowedHeaders?: string[]

  /**
   * Response headers the browser is allowed to expose to JS via
   * `fetch(...).then(r => r.headers.get(...))`. Anything not listed
   * here is hidden from the SPA even though it's on the wire.
   */
  exposedHeaders?: string[]

  /**
   * Whether cookies / Authorization headers may be included
   * cross-origin. **Setting this to `true` is incompatible with
   * `origin: '*'`** — the spec requires an explicit origin.
   */
  credentials?: boolean

  /**
   * How long the browser may cache the preflight response, in
   * seconds. Default 86_400 (24h). Lower values cost more preflights
   * but pick up policy changes faster.
   */
  maxAge?: number
}

/**
 * Resolved CORS configuration with all defaults applied. This is the
 * shape the middleware passes through `applyCorsHeaders` /
 * `buildPreflightResponse`.
 */
export interface ResolvedCorsConfig {
  origin: '*' | string[] | ((origin: string) => boolean)
  methods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number
}
