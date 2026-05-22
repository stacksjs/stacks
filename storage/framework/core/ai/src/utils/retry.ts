/**
 * Retry helper for AI driver HTTP calls (stacksjs/stacks#1878 A-5).
 *
 * Background: OpenAI / Anthropic / etc. routinely return 429 (rate
 * limit) and 5xx (capacity / overloaded) responses with a
 * `Retry-After` header indicating when the caller should try again.
 * The pre-fix AI drivers threw immediately on any non-2xx, surfacing
 * transient capacity issues as hard user-facing failures.
 *
 * This helper wraps `fetch()` with:
 *   - Honor `Retry-After` (seconds or HTTP-date) for 429 + 503
 *   - Exponential backoff + jitter for other 5xx
 *   - Cap at `maxRetries` attempts (default 3)
 *   - Surface the final non-recoverable response to the caller
 *
 * No retry on 4xx other than 429 — those are caller bugs (bad API
 * key, malformed request) that won't clear with more retries.
 */

/**
 * Configurable retry policy. Defaults are tuned for the typical
 * "Anthropic returned 429, try again in 3s" case without being so
 * aggressive that a permanent outage hangs the request loop for
 * minutes.
 */
export interface RetryConfig {
  /** Max retry attempts (NOT including the initial call). Default: 3. */
  maxRetries?: number
  /** Base delay in ms for exponential backoff. Default: 500. */
  baseDelayMs?: number
  /** Cap on any single delay in ms. Default: 30s. */
  maxDelayMs?: number
}

const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
}

/**
 * Fetch with automatic retry on 429 / 5xx. Returns the final
 * `Response` — the caller checks `.ok` and parses the body as usual.
 *
 * Does NOT retry network-level errors (connection reset, DNS
 * failure) — those throw synchronously and the caller's existing
 * try/catch handles them.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  config: RetryConfig = {},
): Promise<Response> {
  const cfg = { ...DEFAULT_RETRY, ...config }
  let lastResponse: Response | undefined

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    lastResponse = await fetch(input, init)

    // 2xx — done.
    if (lastResponse.ok) return lastResponse

    // Don't retry client errors except 429 (rate limit).
    if (lastResponse.status < 500 && lastResponse.status !== 429)
      return lastResponse

    // Out of retries — return whatever we got so the caller can
    // surface a meaningful error.
    if (attempt === cfg.maxRetries) return lastResponse

    // Decide how long to wait before the next attempt.
    const retryAfterMs = parseRetryAfter(lastResponse.headers.get('Retry-After'))
    const backoff = retryAfterMs ?? exponentialBackoff(attempt, cfg)
    const delay = Math.min(backoff, cfg.maxDelayMs)

    // Drain the body so the connection can be reused (Bun
    // sometimes warns about un-consumed bodies otherwise).
    try {
      await lastResponse.text().catch(() => {})
    }
    catch {
      // ignore
    }

    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // Loop always returns inside; this is unreachable.
  return lastResponse!
}

/**
 * Parse a `Retry-After` header. Accepts either a delta-seconds
 * integer (`'3'`) or an HTTP-date (`'Wed, 21 Oct 2026 07:28:00 GMT'`).
 * Returns null if the header is missing or unparseable.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  // Delta-seconds form.
  const seconds = Number.parseInt(header, 10)
  if (Number.isFinite(seconds) && String(seconds) === header.trim()) {
    return Math.max(0, seconds * 1000)
  }
  // HTTP-date form.
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }
  return null
}

/**
 * Exponential backoff with full jitter. `attempt` is 0-indexed, so
 * the first retry uses `base * 2^0 * rand` = up to base ms; the
 * second uses up to 2*base ms; the third up to 4*base ms; etc.
 *
 * Full jitter (vs equal jitter) is what AWS recommends — spreads
 * herding traffic better when many clients retry the same upstream
 * after a brief outage.
 */
function exponentialBackoff(attempt: number, cfg: Required<RetryConfig>): number {
  const cap = Math.min(cfg.baseDelayMs * 2 ** attempt, cfg.maxDelayMs)
  return Math.random() * cap
}
