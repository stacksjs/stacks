import type { DashboardHqDriverOptions } from '@stacksjs/types'

/**
 * The one way a dashboard section talks to a hosted HQ product.
 *
 * `dashboard-provider.ts` decides *which* provider a section reads from and
 * guarantees that a remote one cannot take the page down. This module is the
 * other half: how a remote read is actually performed, so that each domain
 * driver is a path and a shape rather than its own copy of base-URL joining,
 * header handling and failure translation.
 *
 * Everything here exists to make one of `readThroughProvider`'s three degrade
 * paths real:
 *
 *   it rejects         — an unreachable host, a non-2xx answer, or a body that
 *                        is not JSON, all raised as {@link HqReadError}
 *   it never answers   — a hung connection, aborted at `timeoutMs`. Nothing
 *                        else in the seam imposes a deadline, so without this
 *                        the "never answers" case was documented rather than
 *                        handled: the request simply hung and took the
 *                        section's request with it
 *   the wrong shape    — left to the caller, which knows what its section
 *                        renders; this module parses JSON and no more
 *
 * The read key only ever travels in `Authorization`. A URL is logged by
 * proxies, kept in browser history and attached to error reports, and a
 * read-scoped key is still a credential, so it never becomes a query
 * parameter even though several hosted APIs would accept one.
 */

/** How long a hosted read may take before it is treated as unreachable. */
export const HQ_DEFAULT_TIMEOUT_MS = 10_000

/** The upper bound on a configured timeout, so one cannot hold a section open. */
export const HQ_MAX_TIMEOUT_MS = 60_000

/**
 * A hosted read that did not produce a payload.
 *
 * Carries `status` when the product answered and the answer was not a 2xx, so
 * an operator reading the log can tell a misconfigured key (401/403) from a
 * wrong project id (404) from the product being unwell (5xx). `status` is
 * absent when no answer arrived at all.
 */
export class HqReadError extends Error {
  readonly status?: number
  readonly url: string

  constructor(message: string, url: string, status?: number) {
    super(message)
    this.name = 'HqReadError'
    this.url = url
    this.status = status
  }
}

/** Whether the options carry enough to attempt a read at all. */
export function hqConfigured(options: DashboardHqDriverOptions | null | undefined): boolean {
  return Boolean(options?.baseUrl && options?.token)
}

/**
 * `base` and `path` joined into one URL, with exactly one slash between them.
 *
 * A base URL is hand-written in a config file, so it arrives with or without
 * a trailing slash, and a driver's path is written as a literal that reads
 * best with a leading one. Both spellings have to land on the same address.
 */
export function hqUrl(base: string, path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(path.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '')
      url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/** A configured timeout, clamped so neither a typo nor a zero disables it. */
export function hqTimeout(options: DashboardHqDriverOptions | null | undefined): number {
  const asked = Number(options?.timeoutMs)
  if (!Number.isFinite(asked) || asked <= 0)
    return HQ_DEFAULT_TIMEOUT_MS
  return Math.min(HQ_MAX_TIMEOUT_MS, asked)
}

/**
 * One read from a hosted HQ product, as JSON.
 *
 * Throws {@link HqReadError} for every failure, which is what the caller
 * wants: `readThroughProvider` turns a rejection into the section's empty
 * payload with a reason, so a driver never has to handle a failure itself.
 *
 * `fetchImpl` exists for tests. Nothing in the application passes it.
 */
export async function hqRead<T = unknown>(
  options: DashboardHqDriverOptions | null | undefined,
  path: string,
  query?: Record<string, string | number | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  if (!hqConfigured(options)) {
    // Not a network failure, and worth saying so differently: a section that
    // reads empty because nobody filled in a base URL is a configuration
    // mistake an operator can fix, not an outage to wait out.
    throw new HqReadError('The hosted provider has no baseUrl and token configured.', '')
  }

  const url = hqUrl(options!.baseUrl!, path, query)
  let answer: Response
  try {
    answer = await fetchImpl(url, {
      headers: {
        // The read key, and only here. See the note at the top of this file.
        authorization: `Bearer ${options!.token}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(hqTimeout(options)),
    })
  }
  catch (cause) {
    // An abort and a refused connection are the same thing to a section: no
    // data arrived. They are told apart in the message so the log is useful.
    const aborted = (cause as { name?: string })?.name === 'TimeoutError'
      || (cause as { name?: string })?.name === 'AbortError'
    throw new HqReadError(
      aborted
        ? `The hosted provider did not answer within ${hqTimeout(options)}ms.`
        : `The hosted provider could not be reached: ${(cause as Error)?.message ?? String(cause)}`,
      url,
    )
  }

  if (!answer.ok)
    throw new HqReadError(`The hosted provider answered ${answer.status}.`, url, answer.status)

  try {
    return await answer.json() as T
  }
  catch {
    // A 2xx that is not JSON is usually a sign-in page or a proxy's error
    // document, which is a configuration problem wearing a success code.
    throw new HqReadError('The hosted provider answered with something that is not JSON.', url, answer.status)
  }
}
