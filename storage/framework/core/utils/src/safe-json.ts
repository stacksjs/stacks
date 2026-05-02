/**
 * Safe JSON wrappers.
 *
 * Bare `JSON.parse(s)` throws `SyntaxError` on malformed input —
 * which 90% of the time is exactly what you want, except in:
 *
 *   - Webhook handlers: a malformed payload should produce a 400, not crash
 *   - Cache reads: a corrupt cache entry should miss, not throw
 *   - Log readers: a bad line should be skipped, not stop the parser
 *   - User-supplied config: a typo should produce a clear "X is invalid" error
 *
 * `safeJsonParse` returns `undefined` for malformed input (or a typed
 * default), so call sites don't need a try/catch ladder around every
 * untrusted input. `safeJsonParseResult` returns a discriminated union
 * for cases where the failure reason matters.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * Parse `text` as JSON, returning `defaultValue` (default: `undefined`)
 * when the input isn't valid JSON.
 *
 * @example
 * ```ts
 * const config = safeJsonParse<Config>(rawText, { mode: 'default' })
 * ```
 */
export function safeJsonParse<T = unknown>(text: unknown, defaultValue?: T): T | undefined {
  if (typeof text !== 'string' || text.length === 0) return defaultValue
  try {
    return JSON.parse(text) as T
  }
  catch {
    return defaultValue
  }
}

/**
 * Result-flavored variant: surfaces *why* a parse failed when callers
 * want to log the difference between "empty input" and "malformed input".
 */
// eslint-disable-next-line pickier/no-unused-vars
export function safeJsonParseResult<T = unknown>(
  text: unknown,
): { ok: true, value: T } | { ok: false, reason: 'not-string' | 'empty' | 'malformed', error?: unknown } {
  if (typeof text !== 'string') return { ok: false, reason: 'not-string' }
  if (text.length === 0) return { ok: false, reason: 'empty' }
  try {
    return { ok: true, value: JSON.parse(text) as T }
  }
  catch (err) {
    return { ok: false, reason: 'malformed', error: err }
  }
}

/**
 * Stringify with cycle and bigint safety.
 *
 * `JSON.stringify` throws on circular refs (rare but real, e.g. logger
 * captures of an Express-style req object) and on bigint values (common
 * with database IDs that overflow Number). This wrapper substitutes
 * `[Circular]` for cycles and converts bigints to strings — same shape
 * downstream consumers expect from a "best-effort serialize this for
 * logs" call.
 */
export function safeJsonStringify(value: unknown, space?: number): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === 'bigint') return v.toString()
      if (v && typeof v === 'object') {
        if (seen.has(v as object)) return '[Circular]'
        seen.add(v as object)
      }
      return v
    },
    space,
  )
}
