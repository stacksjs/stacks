/**
 * The error every publishing driver throws when a network answers with a
 * failure (stacksjs/stacks#3379).
 *
 * Each driver kept its own class (`BlueskyApiError`, `TwitterApiError`, ...)
 * with a `status` and the raw `body`, and a message that was the raw body:
 * `Twitter API failed (403): {"detail":...}`. An app that showed the message
 * showed JSON, and an app that wanted to back off had nothing to go on but a
 * string. The classes stay, so `instanceof BlueskyApiError` still works, and
 * all of them are now a `SocialApiError`:
 *
 * - `network`: which driver threw it.
 * - `kind`: what sort of failure it is ({@link classifySocialError}).
 * - `reason`: the network's own sentence, when it gave a readable one.
 * - `retryAfterMs`: how long the network asked to be left alone, when it said.
 * - `message`: the network's reason, not its raw body, which stays on `body`.
 */
import type { SocialErrorKind } from './publish-errors'
import { classifySocialError, networkReason } from './publish-errors'

export type SocialNetwork = 'bluesky' | 'instagram' | 'linkedin' | 'mastodon' | 'threads' | 'twitter'

export interface SocialApiErrorOptions {
  /** How long the network asked to wait before the next attempt, in milliseconds. */
  retryAfterMs?: number
}

export class SocialApiError extends Error {
  /** How long the network asked to wait before the next attempt, in milliseconds, when it said. */
  readonly retryAfterMs?: number

  constructor(
    readonly network: SocialNetwork,
    message: string,
    public status: number,
    public body: string,
    options: SocialApiErrorOptions = {},
  ) {
    super(message)
    this.name = 'SocialApiError'
    if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs
  }

  /** What sort of failure this is. Only `expired` means the account has to sign in again. */
  get kind(): SocialErrorKind {
    return classifySocialError(this).kind
  }

  /** The network's own reason, when it gave a readable one. */
  get reason(): string {
    return networkReason(this.body)
  }
}

/** A header value as a number of milliseconds from `now` until a moment, or undefined. */
function untilMoment(value: string, now: number): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const number = Number(trimmed)
    // A Unix time in seconds (X, Bluesky) rather than a number of seconds to wait.
    return number > 1e9 ? Math.max(0, Math.round(number * 1000 - now)) : Math.round(number * 1000)
  }
  const at = Date.parse(trimmed)
  return Number.isNaN(at) ? undefined : Math.max(0, at - now)
}

/**
 * How long a response asks the caller to wait, in milliseconds, read the way
 * each network says it:
 *
 * - `Retry-After`, seconds or an HTTP date: the standard, on 429 and 503.
 * - `x-rate-limit-reset` (X) and `ratelimit-reset` (Bluesky): a Unix time.
 * - `x-ratelimit-reset` (Mastodon): an ISO 8601 time.
 * - `x-business-use-case-usage` / `x-app-usage` (Meta, for Instagram and
 *   Threads): `estimated_time_to_regain_access`, in minutes.
 *
 * The reset headers come with every answer, so they count only on a rate
 * limit (`rateLimited`): on any other answer they say when a window renews,
 * not that the caller must wait. Meta answers a rate limit with a 400, not a
 * 429, so the caller decides from the classification rather than the status.
 */
export function retryAfterMs(headers: Headers, options: { rateLimited: boolean, now?: number }): number | undefined {
  const now = options.now ?? Date.now()
  const retryAfter = headers.get('retry-after')
  if (retryAfter) {
    const wait = untilMoment(retryAfter, now)
    if (wait !== undefined) return wait
  }
  if (!options.rateLimited) return undefined

  for (const name of ['x-rate-limit-reset', 'ratelimit-reset', 'x-ratelimit-reset']) {
    const value = headers.get(name)
    const wait = value ? untilMoment(value, now) : undefined
    if (wait !== undefined) return wait
  }

  let minutes = 0
  for (const name of ['x-business-use-case-usage', 'x-app-usage']) {
    const value = headers.get(name)
    if (!value) continue
    try {
      const usage = JSON.parse(value) as unknown
      const entries = Array.isArray(usage) ? usage : Object.values((usage ?? {}) as Record<string, unknown>).flat()
      for (const entry of [usage, ...entries]) {
        const estimate = Number((entry as { estimated_time_to_regain_access?: unknown } | null)?.estimated_time_to_regain_access)
        if (Number.isFinite(estimate) && estimate > minutes) minutes = estimate
      }
    }
    catch {}
  }
  return minutes > 0 ? minutes * 60_000 : undefined
}

/**
 * The message and options for a failed answer: `<Label> failed (<status>):
 * <the network's reason>`, falling back to the status text, never the raw
 * body, which the error carries as `body`.
 */
export function apiFailure(label: string, response: Pick<Response, 'status' | 'statusText' | 'headers'>, text: string): [message: string, status: number, body: string, options: SocialApiErrorOptions] {
  const reason = networkReason(text) || response.statusText || 'no reason given'
  const wait = retryAfterMs(response.headers, { rateLimited: classifySocialError({ status: response.status, body: text }).kind === 'rate-limited' })
  return [`${label} failed (${response.status}): ${reason}`, response.status, text, wait === undefined ? {} : { retryAfterMs: wait }]
}
