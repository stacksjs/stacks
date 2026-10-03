import type { JsonRequest, JsonResponse } from './http'
import type { FetchLike } from './types'
import { CatalogFetchError, fetchJson } from './http'
import { redactSecrets } from './credentials'

/**
 * Authenticated requests to a platform's admin API.
 *
 * On top of `fetchJson` (which names the failing URL), this:
 *
 * - waits out a 429 for as long as `Retry-After` asks (Shopify sends it on
 *   every throttled call; its REST leaky bucket refills at 2 calls a second),
 *   then retries, up to `MAX_RETRIES` times;
 * - turns a 401 or 403 into a message about the credential, saying which
 *   variables to check and where to create them, without ever repeating a
 *   secret: every message is scrubbed of the credential values, including
 *   any a server echoed back in its error body.
 */

export const MAX_RETRIES = 5
/** Shopify asks for 2 seconds; a missing or absurd header falls back to this, capped. */
const DEFAULT_RETRY_SECONDS = 2
const MAX_RETRY_SECONDS = 60

export const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export interface AdminRequestOptions extends JsonRequest {
  fetch: FetchLike
  /** Values to scrub from any message: the credentials and anything derived from them. */
  secrets: string[]
  /** What to tell the operator on a 401/403, e.g. which env vars to check. */
  credentialHelp: string
  /** Appended to other failures, e.g. "Is this a WooCommerce store?". */
  hint?: string
  sleep?: (ms: number) => Promise<void>
}

export class AdminCredentialError extends CatalogFetchError {
  constructor(url: string, message: string, status: number) {
    super(url, message, status)
    this.name = 'AdminCredentialError'
  }
}

function scrub(error: CatalogFetchError, secrets: string[], suffix = ''): CatalogFetchError {
  const message = redactSecrets(`${error.message}${suffix}`, secrets)
  const body = error.body === undefined ? undefined : redactSecrets(error.body, secrets)
  return new CatalogFetchError(redactSecrets(error.url, secrets), message, error.status, body, error.retryAfter)
}

/** One admin API call, with rate-limit retries and credential-aware errors. */
export async function adminRequest<T>(url: string, options: AdminRequestOptions): Promise<JsonResponse<T>> {
  const { fetch: fetcher, secrets, credentialHelp, hint = '', sleep, ...request } = options
  const wait = sleep ?? defaultSleep

  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchJson<T>(url, fetcher, '', request)
    }
    catch (error) {
      if (!(error instanceof CatalogFetchError))
        throw error

      if (error.status === 429 && attempt < MAX_RETRIES) {
        const seconds = error.retryAfter !== undefined && error.retryAfter >= 0 ? error.retryAfter : DEFAULT_RETRY_SECONDS
        await wait(Math.min(seconds, MAX_RETRY_SECONDS) * 1000)
        continue
      }

      if (error.status === 401 || error.status === 403) {
        const reason = error.status === 401
          ? 'The credentials were rejected.'
          : 'The credentials were accepted but lack permission to read this.'
        throw new AdminCredentialError(
          redactSecrets(url, secrets),
          redactSecrets(`${url} responded ${error.status}. ${reason} ${credentialHelp}`, secrets),
          error.status,
        )
      }

      if (error.status === 429)
        throw scrub(error, secrets, ` Still rate limited after ${MAX_RETRIES} retries; re-run later, the import resumes safely.`)

      throw scrub(error, secrets, hint ? ` ${hint}` : '')
    }
  }
}
