import type { FetchLike } from './types'

/**
 * The importer's only network primitive.
 *
 * Every failure names the URL that failed. "fetch failed" on its own leaves
 * the operator guessing which of forty pages broke, and whether it was the
 * store, the network or the importer.
 */

export class CatalogFetchError extends Error {
  constructor(
    public readonly url: string,
    message: string,
    public readonly status?: number,
    /** The start of the response body, when the server sent one with an error status. */
    public readonly body?: string,
  ) {
    super(message)
    this.name = 'CatalogFetchError'
  }
}

/** How much of an error response body to keep for the operator. */
const ERROR_BODY_MAX = 2000

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * A store URL as a base to append API paths to.
 *
 * Accepts a bare host (`shop.example.com`), a full URL, or a WordPress install
 * in a subdirectory (`https://example.com/shop`), whose path must be kept for
 * `/wp-json` to resolve. Query string and fragment are dropped.
 */
export function normalizeStoreUrl(input: string): string {
  const raw = input.trim()
  if (!raw)
    throw new TypeError('A store URL is required, e.g. https://shop.example.com')

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`

  let url: URL
  try {
    url = new URL(withScheme)
  }
  catch {
    throw new TypeError(`"${input}" is not a valid store URL`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new TypeError(`"${input}" must be an http(s) URL`)

  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host.toLowerCase()}${path}`
}

/** The lowercased host of a normalized store URL, used to scope identities. */
export function storeHost(storeUrl: string): string {
  return new URL(storeUrl).host.toLowerCase()
}

export interface JsonResponse<T> {
  data: T
  headers: Headers
}

/** A request other than a plain GET: Shopware's Store API takes criteria as a POST body. */
export interface JsonRequest {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  /** Serialized as JSON, with a matching content-type. */
  json?: unknown
}

/** Fetch a URL and parse it as JSON (GET unless `request` says otherwise), or throw a `CatalogFetchError` naming it. */
export async function fetchJson<T = unknown>(url: string, fetcher: FetchLike = fetch, hint = '', request: JsonRequest = {}): Promise<JsonResponse<T>> {
  const suffix = hint ? ` ${hint}` : ''
  const headers: Record<string, string> = { accept: 'application/json', ...request.headers }
  if (request.json !== undefined)
    headers['content-type'] = 'application/json'

  let response: Response
  try {
    response = await fetcher(url, {
      method: request.method ?? (request.json !== undefined ? 'POST' : 'GET'),
      headers,
      ...(request.json !== undefined ? { body: JSON.stringify(request.json) } : {}),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new CatalogFetchError(url, `Could not reach ${url}: ${reason}.${suffix}`)
  }

  if (!response.ok) {
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
    const body = await response.text().catch(() => '')
    throw new CatalogFetchError(url, `${url} responded ${status}.${suffix}`, response.status, body ? body.slice(0, ERROR_BODY_MAX) : undefined)
  }

  const body = await response.text()
  try {
    return { data: JSON.parse(body) as T, headers: response.headers }
  }
  catch {
    const type = response.headers.get('content-type') || 'no content-type'
    throw new CatalogFetchError(url, `${url} did not return JSON (${type}).${suffix}`, response.status)
  }
}
