/**
 * Dashboard API client.
 *
 * Every mutating dashboard endpoint sits behind a stateless double-submit
 * CSRF cookie: the server seeds a readable `X-CSRF-Token` cookie on safe
 * requests, and a POST/PATCH/DELETE has to echo it back in a header. Pages
 * were each re-implementing that cookie read inline, which put bare
 * `document.*` access into template scripts and meant a change to the
 * scheme had to be made in every page that writes.
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** JSON request body. Omitted entirely for GET. */
  body?: unknown
  signal?: AbortSignal
}

/** Read the CSRF cookie the server seeds on safe requests. */
function csrfToken(): string | null {
  if (typeof document === 'undefined')
    return null
  const match = document.cookie.match(/(?:^|;\s*)X-CSRF-Token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Call a dashboard API endpoint and return its parsed JSON.
 *
 * Throws on a non-2xx response, using the server's `message` / `error`
 * field when there is one so callers can surface something better than a
 * bare status code.
 */
export async function dashboardApi<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { accept: 'application/json' }

  if (options.body !== undefined)
    headers['content-type'] = 'application/json'

  if (method !== 'GET' && method !== 'HEAD') {
    const token = csrfToken()
    if (token)
      headers['X-CSRF-Token'] = token
  }

  const res = await fetch(path, {
    method,
    headers,
    signal: options.signal,
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  })

  const text = await res.text()
  let payload: any = null
  try {
    payload = text ? JSON.parse(text) : null
  }
  catch {
    payload = null
  }

  if (!res.ok) {
    const detail = payload?.message || payload?.error || `HTTP ${res.status}`
    throw new Error(String(detail))
  }

  return payload as T
}
