/**
 * Reading a `Result` in a CLI command.
 *
 * This exists because of one mistake made in eighty-six places, and it is the
 * kind that only a helper can actually stop happening again.
 *
 * `Result` carries `isErr` as a **method**, so the natural-looking check
 *
 *     if (result.isErr) { log.error(...); process.exit(1) }
 *
 * reads a function object, which is always truthy. Every command written that
 * way reported failure and exited non-zero on every run - including the runs
 * that did exactly what was asked. `buddy build:core` printed "Failed to build
 * the Stacks core" after building it; `buddy generate:migrations` exited 1
 * after generating them.
 *
 * What that costs is not the wrong exit code, which people stop looking at
 * quickly. It is that a *real* failure then looks exactly like a success, so
 * the one time a command genuinely refuses - a migration that would drop a
 * framework table's columns, say - it is indistinguishable from the ninety-nine
 * runs before it.
 *
 * Both shapes are handled, because not everything passed here is a real
 * `Result`: several commands build their own `{ isErr: boolean, error }` and
 * those are just as valid to ask about.
 */

interface ResultLike {
  isErr?: boolean | (() => boolean)
  error?: unknown
  value?: unknown
}

/**
 * Whether a result - of either shape - is a failure.
 *
 * Declared as a type predicate rather than as `boolean` so it narrows the way
 * `result.isErr()` does. Without that, every call site that goes on to read
 * `result.error` stops compiling, and the fix for a runtime bug would have
 * cost the type safety around it.
 */
export function resultFailed(result: unknown): result is { error?: unknown } {
  if (!result || typeof result !== 'object')
    return false

  const candidate = result as ResultLike

  return typeof candidate.isErr === 'function' ? candidate.isErr() : Boolean(candidate.isErr)
}

/**
 * The message to show, as a sentence rather than as an object.
 *
 * A command that refuses usually names the fix in its message - a dialect
 * mismatch, a model that would drop columns, a missing key - and passing the
 * error as a second argument to a logger throws that away and leaves a bare
 * exit code. This is what gets printed.
 */
export function resultError(result: unknown, fallback = 'Unknown error'): string {
  if (!result || typeof result !== 'object')
    return fallback

  const error = (result as ResultLike).error

  if (error instanceof Error)
    return error.message

  if (typeof error === 'string' && error)
    return error

  return error === undefined || error === null ? fallback : String(error)
}

/**
 * Print a failure and stop.
 *
 * `console.error` rather than the logger, and that is not a style preference.
 * The logger writes asynchronously, so `log.error(message)` immediately
 * followed by `process.exit()` loses the message entirely: the process is gone
 * before the write lands. A command that refuses then produces an exit code and
 * *nothing else*, which is exactly as useless as the bug this module was
 * written for - somebody sees a failure with no reason and goes looking through
 * generated SQL.
 *
 * Returns nothing, because it does not return.
 */
export function reportFailure(result: unknown, fallback?: string): never {
  process.stderr.write(`${resultError(result, fallback)}\n`)
  process.exit(1)
}
