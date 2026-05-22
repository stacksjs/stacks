/**
 * Error-handling helpers (stacksjs/stacks#1875 T-1).
 *
 * Background: a `catch (e: any)` block lets you reach `e.message`
 * without a typecheck — but the thrown value isn't guaranteed to be
 * an `Error`. Strings, numbers, plain objects, and even `null` can
 * be thrown. `e.message` on a string returns `undefined`; on `null`
 * it throws TypeError. `${e}` works but loses stack trace info.
 *
 * These helpers let catch blocks type `e` as `unknown` (the safe
 * TypeScript default) and pull a useful string / stack out without
 * branching at every site.
 */

/**
 * Pull a human-readable message out of an unknown thrown value.
 *
 * Resolution order:
 *   1. `Error.message` — the common case
 *   2. plain-object `.message` — duck-typing for error-like values
 *      from across a serialization boundary (HTTP responses, IPC, etc.)
 *   3. `String(e)` — covers strings, numbers, booleans
 *   4. `'Unknown error'` — for `null` / `undefined` thrown values
 *
 * @example
 * ```ts
 * try {
 *   await someAsyncOp()
 * }
 * catch (e: unknown) {
 *   log.error(`Failed: ${getErrorMessage(e)}`)
 * }
 * ```
 */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (typeof e === 'number' || typeof e === 'boolean') return String(e)
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string')
    return (e as { message: string }).message
  if (e == null) return 'Unknown error'
  // Fall back to String() for everything else (Symbols, etc.). Catches
  // weirder cases without choking on values that don't stringify cleanly.
  try {
    return String(e)
  }
  catch {
    return 'Unknown error'
  }
}

/**
 * Pull a stack trace out of an unknown thrown value, returning
 * `undefined` when one isn't available. Useful for log enrichment
 * without forcing the caller to narrow `e` first.
 */
export function getErrorStack(e: unknown): string | undefined {
  if (e instanceof Error) return e.stack
  if (e && typeof e === 'object' && 'stack' in e && typeof (e as { stack: unknown }).stack === 'string')
    return (e as { stack: string }).stack
  return undefined
}

/**
 * Pull a `.code` string out of an unknown thrown value. Common across
 * AWS SDK errors (`'AlreadyExistsException'`, `'NoSuchEntity'`, …),
 * Node fs errors (`'ENOENT'`, `'EACCES'`, …), and many HTTP-client
 * libraries. Returns `undefined` when the input doesn't carry a
 * string code, so callers can default-handle.
 */
export function getErrorCode(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string')
    return (e as { code: string }).code
  return undefined
}

/**
 * Pull an HTTP-style status code (`.statusCode` or `.status`) out of an
 * unknown thrown value. AWS SDK errors use `.statusCode`; fetch/Node
 * errors often use `.status`. Returns `undefined` when neither is a
 * finite number — same default-handling pattern as `getErrorCode`.
 */
export function getErrorStatusCode(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined
  const obj = e as { statusCode?: unknown, status?: unknown }
  if (typeof obj.statusCode === 'number' && Number.isFinite(obj.statusCode)) return obj.statusCode
  if (typeof obj.status === 'number' && Number.isFinite(obj.status)) return obj.status
  return undefined
}

/**
 * Coerce an unknown thrown value into a real `Error`. The thrown
 * value is preserved on `.cause` (ES2022) when the input was a
 * non-Error so debugging tools can still surface it. Idempotent —
 * passing in an Error returns it unchanged.
 *
 * Use this when downstream APIs require an `Error` instance (e.g.
 * tracing SDKs that want `captureException(Error)`).
 */
export function toError(e: unknown): Error {
  if (e instanceof Error) return e
  return new Error(getErrorMessage(e), { cause: e })
}
