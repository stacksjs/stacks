import { setSystemTime } from 'bun:test'

/**
 * Controlling the clock in a test (stacksjs/stacks#2581).
 *
 * Documented in `docs/packages/testing.md` and never implemented, so the sample
 * teaching it imported two names that did not exist.
 *
 * Thin on purpose: `bun:test` already has `setSystemTime`, and these exist
 * because the intent of a test reads better as "freeze time" than as "set the
 * system time to now". The one thing they add over calling it directly is
 * {@link useRealTime} and the insistence on restoring - see below.
 */

/** What a caller may name a moment with. */
export type TimeLike = Date | string | number

function toDate(at: TimeLike): Date {
  const date = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(date.getTime()))
    throw new TypeError(`Not a valid time: ${JSON.stringify(at)}`)
  return date
}

/**
 * Stop the clock, at `at` or at the current moment.
 *
 * **Restore it when the test ends.** The system time is process-wide and bun
 * does not roll it back between test files, so a frozen clock leaks into every
 * later suite in the same run - where it surfaces as a token that is
 * inexplicably expired, or a `created_at` in the wrong year, a long way from
 * the test that caused it.
 *
 * @example
 * ```ts
 * import { afterEach, freezeTime, useRealTime } from '@stacksjs/testing'
 *
 * afterEach(useRealTime)
 *
 * it('expires after an hour', () => {
 *   freezeTime('2024-01-15T10:00:00Z')
 *   // ...
 * })
 * ```
 */
export function freezeTime(at: TimeLike = new Date()): Date {
  const date = toDate(at)
  setSystemTime(date)
  return date
}

/**
 * Move the clock to `at`, leaving it frozen there.
 *
 * The same operation as {@link freezeTime} with an argument; both exist because
 * a test that has already frozen reads better as travelling than as freezing
 * again. Restore with {@link useRealTime}.
 *
 * @example
 * ```ts
 * travelTo(new Date('2024-06-01'))
 * ```
 */
export function travelTo(at: TimeLike): Date {
  return freezeTime(at)
}

/**
 * Hand the clock back to the operating system.
 *
 * Not in the documentation this implements, and that was the documentation's
 * bug: without it the clock stays where the last test put it for the rest of
 * the process.
 */
export function useRealTime(): void {
  setSystemTime()
}
