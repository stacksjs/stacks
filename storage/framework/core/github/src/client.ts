export const GITHUB_API = 'https://api.github.com'

export interface GitHubClientOptions {
  token?: string
  apiUrl?: string
  fetch?: typeof globalThis.fetch
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token)
    throw new Error('GITHUB_TOKEN environment variable is required')
  return token
}

function resolveToken(token?: string): string {
  if (token)
    return token
  return getToken()
}

export function ghHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export function githubHeaders(token?: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${resolveToken(token)}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function retryDelay(res: Response, attempt: number): number | null {
  const isRateLimit = res.status === 429
    || (res.status === 403 && (res.headers.get('x-ratelimit-remaining') === '0' || !!res.headers.get('retry-after')))
  if (!isRateLimit)
    return null
  const retryAfterHeader = res.headers.get('retry-after')
  const resetHeader = res.headers.get('x-ratelimit-reset')
  if (retryAfterHeader)
    return Number(retryAfterHeader) * 1000
  if (resetHeader)
    return Math.max(0, Number(resetHeader) * 1000 - Date.now()) + 500
  return 1000 * 2 ** attempt
}

/** Provider-neutral GitHub request helper for both reads and writes. */
export async function githubRequest(
  path: string,
  init: RequestInit = {},
  options: GitHubClientOptions = {},
  attempt = 0,
): Promise<Response> {
  const fetcher = options.fetch ?? globalThis.fetch
  const url = path.startsWith('http') ? path : `${options.apiUrl ?? GITHUB_API}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetcher(url, {
    ...init,
    headers: { ...githubHeaders(options.token), ...init.headers },
  })
  if (response.ok || attempt >= 3)
    return response
  const waitMs = retryDelay(response, attempt)
  if (waitMs === null)
    return response
  await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 30_000)))
  return githubRequest(path, init, options, attempt + 1)
}

export async function githubJson<T>(
  path: string,
  init: RequestInit = {},
  options: GitHubClientOptions = {},
): Promise<T> {
  const response = await githubRequest(path, init, options)
  if (!response.ok) {
    const payload = await response.text()
    let message = payload
    try {
      message = (JSON.parse(payload) as { message?: string }).message || payload
    }
    catch {}
    throw new Error(`GitHub API ${response.status}: ${message || response.statusText}`)
  }
  if (response.status === 204)
    return undefined as T
  return await response.json() as T
}

/**
 * `fetch` against the GitHub API that retries on secondary rate limits.
 *
 * GitHub signals back-off via either a `Retry-After` header (preferred) or
 * an `x-ratelimit-reset` epoch second. The retry budget is bounded so a
 * permanently rate-limited token doesn't hang callers indefinitely.
 */
export async function ghFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: ghHeaders() })
  if (res.ok || attempt >= 3)
    return res

  const isRateLimit
    = res.status === 429
      || (res.status === 403 && (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.get('retry-after')))
  if (!isRateLimit)
    return res

  const retryAfterHeader = res.headers.get('retry-after')
  const resetHeader = res.headers.get('x-ratelimit-reset')
  let waitMs = 1000 * 2 ** attempt
  if (retryAfterHeader)
    waitMs = Number(retryAfterHeader) * 1000
  else if (resetHeader)
    waitMs = Math.max(0, Number(resetHeader) * 1000 - Date.now()) + 500
  await new Promise(r => setTimeout(r, Math.min(waitMs, 30_000)))
  return ghFetch(url, attempt + 1)
}

/**
 * Run `fn` over `items` with at most `limit` concurrent invocations.
 * Result indices match input indices.
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  async function worker(): Promise<void> {
    while (true) {
      const i = next++
      if (i >= items.length)
        return
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
