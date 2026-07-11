export const GITHUB_API = 'https://api.github.com'

function getToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token)
    throw new Error('GITHUB_TOKEN environment variable is required')
  return token
}

export function ghHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
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
