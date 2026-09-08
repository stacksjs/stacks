/**
 * Path-parameter sanitization helpers.
 *
 * Route params arrive from the URL as untyped strings and are merged
 * directly into `req.params`. Actions that interpolate those values
 * into filesystem paths or shell commands without first scrubbing
 * them are vulnerable to `..`-traversal, absolute-path takeovers, and
 * null-byte truncation attacks.
 *
 * The router itself can't auto-sanitize every param (some are
 * deliberately path-shaped — file servers, asset proxies, etc.). What
 * we ship instead is a single canonical helper that callers reach for
 * at the boundary where the param meets the filesystem.
 *
 * See stacksjs/stacks#1870 R-12.
 *
 * @example
 * ```ts
 * import { sanitizePathParam } from '@stacksjs/router'
 *
 * const filename = sanitizePathParam(req.params.filename, {
 *   context: 'avatar download',
 * })
 * return new Response(Bun.file(path.appPath(`avatars/${filename}`)))
 * ```
 */

/**
 * Reasons {@link sanitizePathParam} rejects a value. Surfaced via the
 * thrown error so callers can log or branch.
 */
export type PathParamRejection =
  | 'empty'
  | 'not-string'
  | 'absolute-path'
  | 'traversal'
  | 'null-byte'
  | 'control-char'
  | 'too-long'

export interface SanitizePathParamOptions {
  /**
   * Caller-supplied context for the error message (e.g. `'avatar download'`).
   * Goes into the thrown `Error` so log spelunkers know which route param
   * blew up.
   */
  context?: string
  /**
   * Per-call length cap. Defaults to 255 (the conventional filesystem
   * filename ceiling on Linux). Values above this length are rejected
   * before any other check so reused validators don't burn CPU on
   * adversarial input.
   */
  maxLength?: number
  /**
   * When true, allow nested `a/b/c` shapes (still rejecting `..`, absolute
   * paths, and control characters). Default: `false` — most call sites
   * want a single segment.
   */
  allowSlashes?: boolean
}

export class PathParamError extends Error {
  readonly reason: PathParamRejection

  constructor(reason: PathParamRejection, value: unknown, context?: string) {
    const ctx = context ? ` in ${context}` : ''
    super(`[router] Refusing to use ${JSON.stringify(value)} as a path parameter${ctx} - ${reason}`)
    this.name = 'PathParamError'
    this.reason = reason
  }
}

// Written as escapes on purpose. The raw bytes were embedded literally,
// and a literal NUL opening a character-class range is rejected by Bun's
// runtime parser ("Invalid regular expression: range out of order in
// character class") - so importing this module threw before any caller
// could sanitize anything, and it took the framework build down with it.
const CONTROL_CHARS = /[\x00-\x1F\x7F]/

function pathParamRejection(value: string, options: SanitizePathParamOptions): PathParamRejection | undefined {
  if (value.length === 0) {
    return 'empty'
  }
  const maxLength = options.maxLength ?? 255
  if (value.length > maxLength) {
    return 'too-long'
  }
  if (value.includes('\0')) {
    return 'null-byte'
  }
  if (CONTROL_CHARS.test(value)) {
    return 'control-char'
  }
  if (value.startsWith('/') || /^[A-Z]:[\\/]/i.test(value)) {
    return 'absolute-path'
  }
  // `..` as a segment OR `..` adjacent to a separator. Plain `..foo`
  // is fine (a filename starting with two dots). Same logic for both
  // POSIX and Windows separators.
  if (/(^|[\\/])\.\.([\\/]|$)/.test(value)) {
    return 'traversal'
  }
  if (!options.allowSlashes && /[\\/]/.test(value)) {
    return 'traversal'
  }
  return undefined
}

/**
 * Validate and return a path parameter, throwing if it's unsafe to use
 * in filesystem interpolation.
 *
 * The default contract is single-segment: no `/`, no `\`, no `..`, no
 * absolute path, no null bytes, no control characters, length ≤ 255.
 * Pass `allowSlashes: true` for a multi-segment path (still rejects
 * the rest).
 *
 * @throws {PathParamError} when the value fails any check.
 */
export function sanitizePathParam(value: unknown, options: SanitizePathParamOptions = {}): string {
  if (typeof value !== 'string') {
    throw new PathParamError('not-string', value, options.context)
  }
  const reason = pathParamRejection(value, options)
  if (reason) {
    throw new PathParamError(reason, value, options.context)
  }
  return value
}

/**
 * Non-throwing variant. Returns the sanitized value or `null` if any
 * check failed. Use when you want a fast yes/no in a conditional
 * without a try/catch around the throw site.
 */
export function safePathParam(value: unknown, options: SanitizePathParamOptions = {}): string | null {
  try {
    if (typeof value !== 'string' || pathParamRejection(value, options)) {
      return null
    }
    return value
  }
  catch {
    return null
  }
}
