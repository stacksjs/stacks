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
  const message = errorProperty(e, 'message')
  if (typeof message === 'string') return message
  if (e == null) return 'Unknown error'
  try { return String(e) }
  catch { return 'Unknown error' }
}

/** An unknown thrown value may be a proxy or carry accessors that throw. */
function errorProperty(value: unknown, key: PropertyKey): unknown {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return undefined
  try { return Reflect.get(value, key) }
  catch { return undefined }
}

/**
 * Pull a stack trace out of an unknown thrown value, returning
 * `undefined` when one isn't available. Useful for log enrichment
 * without forcing the caller to narrow `e` first.
 */
export function getErrorStack(e: unknown): string | undefined {
  const stack = errorProperty(e, 'stack')
  return typeof stack === 'string' ? stack : undefined
}

/**
 * Pull a `.code` string out of an unknown thrown value. Common across
 * AWS SDK errors (`'AlreadyExistsException'`, `'NoSuchEntity'`, …),
 * Node fs errors (`'ENOENT'`, `'EACCES'`, …), and many HTTP-client
 * libraries. Returns `undefined` when the input doesn't carry a
 * string code, so callers can default-handle.
 */
export function getErrorCode(e: unknown): string | undefined {
  const code = errorProperty(e, 'code')
  return typeof code === 'string' ? code : undefined
}

/**
 * Pull an HTTP-style status code (`.statusCode` or `.status`) out of an
 * unknown thrown value. AWS SDK errors use `.statusCode`; fetch/Node
 * errors often use `.status`. Returns `undefined` when neither is a
 * finite number — same default-handling pattern as `getErrorCode`.
 */
export function getErrorStatusCode(e: unknown): number | undefined {
  for (const key of ['statusCode', 'status']) {
    const status = errorProperty(e, key)
    if (typeof status === 'number' && Number.isFinite(status)) return status
  }
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
  try { if (e instanceof Error) return e }
  catch { /* Revoked proxies can throw even during instanceof. */ }
  return new Error(getErrorMessage(e), { cause: e })
}
