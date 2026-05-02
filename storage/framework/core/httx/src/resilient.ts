/**
 * Resilient HTTP client built on Bun's native `fetch`.
 *
 * Adds the four pieces every production HTTP caller eventually needs:
 *   1. Retries with exponential backoff + jitter
 *   2. Per-request timeout via AbortController
 *   3. Per-host circuit breaker (open after N consecutive failures)
 *   4. Metrics hook so callers can record durations / errors
 *
 * The public surface mirrors `fetch`: {@link HttxClient.get}, `.post`, `.put`,
 * `.patch`, `.delete`. Pass options to override any default per-request.
 *
 * Design notes:
 * - We deliberately do NOT retry on 4xx — those are caller errors and
 *   retrying them just wastes the upstream's budget and makes idempotency
 *   bugs harder to diagnose.
 * - The circuit breaker keys on `host` (not full URL) because the failure
 *   modes we want to short-circuit (DNS, TLS, dead pool) are host-wide.
 * - Backoff jitter is in `[0.5x, 1.5x]` of the deterministic delay so a
 *   thundering-herd of retrying clients doesn't synchronize.
 */

/**
 * One sample of a request's lifecycle, passed to {@link HttxClientOptions.onMetric}.
 *
 * `attempts` counts every attempt including the successful one. `error` is
 * only set when the request ultimately failed (after retries / open circuit).
 */
export interface HttxMetric {
  host: string
  method: string
  url: string
  status?: number
  durationMs: number
  attempts: number
  error?: string
}

/**
 * Fully-configurable per-client defaults. All fields optional; sensible
 * defaults are applied at construction.
 */
export interface HttxClientOptions {
  /** Max retry attempts after the initial try (default: 3). */
  retries?: number
  /** Base delay (ms) for exponential backoff (default: 200). */
  retryBaseMs?: number
  /** Cap on a single backoff sleep (default: 30_000). */
  retryMaxDelayMs?: number
  /** Per-request timeout in ms (default: 30_000). */
  timeoutMs?: number
  /** Consecutive failures before the circuit opens (default: 5). */
  circuitBreakerThreshold?: number
  /** How long the circuit stays open (default: 30_000). */
  circuitBreakerCooldownMs?: number
  /** Optional metric sink — invoked after every request, success or failure. */
  onMetric?: (metric: HttxMetric) => void
  /** Headers merged into every request. */
  defaultHeaders?: Record<string, string>
  /** Custom retry predicate — return true to retry. Overrides default 5xx/network logic. */
  shouldRetry?: (ctx: { error?: unknown, response?: Response, attempt: number }) => boolean
}

/**
 * Per-request overrides on top of the client defaults. Mirrors `RequestInit`
 * but adds the resilience knobs.
 */
export interface HttxRequestOptions extends Omit<RequestInit, 'signal'> {
  /** Override client timeout. */
  timeoutMs?: number
  /** Override client retry count. */
  retries?: number
  /** Caller-provided AbortSignal — composed with the timeout signal. */
  signal?: AbortSignal
}

/** Internal per-host circuit breaker state. */
interface CircuitState {
  failures: number
  /** Epoch ms when the circuit was opened — `0` means closed. */
  openedAt: number
}

/**
 * Thrown when a request is rejected because the circuit breaker for the host
 * is open. Distinct from network/HTTP errors so callers can surface a
 * "service degraded" message without retrying.
 */
export class CircuitBreakerOpenError extends Error {
  readonly host: string
  readonly retryAfterMs: number

  constructor(host: string, retryAfterMs: number) {
    super(`Circuit breaker open for ${host} — retry in ${retryAfterMs}ms`)
    this.name = 'CircuitBreakerOpenError'
    this.host = host
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Compose multiple AbortSignals into one. Polyfilled for environments that
 * lack `AbortSignal.any` (Bun has it, but we guard for safety in older runtimes).
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  // Prefer the standard helper when available — it forwards reasons correctly.
  if (typeof (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any === 'function')
    return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any(signals)

  const controller = new AbortController()
  const onAbort = (ev: Event): void => {
    const target = ev.target as AbortSignal
    controller.abort(target.reason)
  }
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason)
      break
    }
    s.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

/**
 * Sleep helper that respects an external AbortSignal. Cleanly resolves when
 * aborted so a retry loop can exit early on caller cancellation.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    }, { once: true })
  })
}

/**
 * Resilient HTTP client. Build once per service / per long-lived caller so
 * the circuit breaker state is shared across calls to the same host.
 *
 * @example
 * ```ts
 * const httx = new HttxClient({
 *   timeoutMs: 5_000,
 *   retries: 2,
 *   onMetric: (m) => log.info(`http ${m.method} ${m.host} -> ${m.status} (${m.durationMs}ms)`),
 * })
 *
 * const res = await httx.get('https://api.example.com/users/1')
 * const created = await httx.post('https://api.example.com/users', { name: 'Ada' })
 * ```
 */
export class HttxClient {
  private readonly retries: number
  private readonly retryBaseMs: number
  private readonly retryMaxDelayMs: number
  private readonly timeoutMs: number
  private readonly threshold: number
  private readonly cooldownMs: number
  private readonly defaultHeaders: Record<string, string>
  private readonly onMetric?: (metric: HttxMetric) => void
  private readonly customShouldRetry?: HttxClientOptions['shouldRetry']

  // Per-host buckets — keyed by URL.host. Shared across requests by design;
  // that's the whole point of a circuit breaker (state outlives a single call).
  private readonly circuits = new Map<string, CircuitState>()

  constructor(options: HttxClientOptions = {}) {
    this.retries = options.retries ?? 3
    this.retryBaseMs = options.retryBaseMs ?? 200
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 30_000
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.threshold = options.circuitBreakerThreshold ?? 5
    this.cooldownMs = options.circuitBreakerCooldownMs ?? 30_000
    this.defaultHeaders = options.defaultHeaders ?? {}
    this.onMetric = options.onMetric
    this.customShouldRetry = options.shouldRetry
  }

  /**
   * Perform a GET request. Returns the raw `Response` so callers control
   * how to consume the body (`.json()`, `.text()`, streaming, etc.).
   *
   * @example
   * ```ts
   * const res = await httx.get('https://api.example.com/users/1')
   * const user = await res.json()
   * ```
   */
  get(url: string, options?: HttxRequestOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' })
  }

  /**
   * Perform a POST request. If `body` is a plain object/array, it's
   * JSON-stringified and `Content-Type: application/json` is added automatically.
   * Pass a string / Buffer / FormData to send a raw body.
   *
   * @example
   * ```ts
   * await httx.post('https://api.example.com/users', { name: 'Ada' })
   * ```
   */
  post(url: string, body?: unknown, options?: HttxRequestOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'POST', ...this.coerceBody(body, options) })
  }

  /**
   * Perform a PUT request. Body coercion identical to {@link HttxClient.post}.
   *
   * @example
   * ```ts
   * await httx.put('https://api.example.com/users/1', { name: 'Ada Lovelace' })
   * ```
   */
  put(url: string, body?: unknown, options?: HttxRequestOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'PUT', ...this.coerceBody(body, options) })
  }

  /**
   * Perform a PATCH request. Body coercion identical to {@link HttxClient.post}.
   *
   * @example
   * ```ts
   * await httx.patch('https://api.example.com/users/1', { name: 'Ada' })
   * ```
   */
  patch(url: string, body?: unknown, options?: HttxRequestOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'PATCH', ...this.coerceBody(body, options) })
  }

  /**
   * Perform a DELETE request.
   *
   * @example
   * ```ts
   * await httx.delete('https://api.example.com/users/1')
   * ```
   */
  delete(url: string, options?: HttxRequestOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'DELETE' })
  }

  /**
   * Low-level single-call entrypoint. Prefer the verb helpers when possible.
   *
   * @example
   * ```ts
   * await httx.request('https://api.example.com/users/1', { method: 'HEAD' })
   * ```
   */
  async request(url: string, options: HttxRequestOptions = {}): Promise<Response> {
    const method = (options.method ?? 'GET').toUpperCase()
    const host = this.parseHost(url)
    const startedAt = performance.now()
    const maxAttempts = (options.retries ?? this.retries) + 1
    const timeoutMs = options.timeoutMs ?? this.timeoutMs

    // Check circuit before doing any work — fail fast.
    this.assertCircuitClosed(host)

    let lastError: unknown
    let lastResponse: Response | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const timeoutController = new AbortController()
      const timer = setTimeout(
        () => timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
        timeoutMs,
      )

      // Compose caller signal + timeout so either source can cancel the fetch.
      const signal = options.signal
        ? anySignal([options.signal, timeoutController.signal])
        : timeoutController.signal

      try {
        const response = await fetch(url, {
          ...options,
          method,
          headers: { ...this.defaultHeaders, ...options.headers },
          signal,
        })
        lastResponse = response

        // 4xx never retries — those are caller errors. 5xx retries up to budget.
        if (response.status >= 500 && attempt < maxAttempts && this.shouldRetry({ response, attempt })) {
          await sleep(this.backoffDelay(attempt), options.signal)
          continue
        }

        // Successful or terminal-failure response — update circuit + metrics.
        if (response.status >= 500)
          this.recordFailure(host)
        else
          this.recordSuccess(host)

        this.emitMetric({
          host,
          method,
          url,
          status: response.status,
          durationMs: performance.now() - startedAt,
          attempts: attempt,
        })
        return response
      }
      catch (err) {
        lastError = err
        // Network errors / timeouts retry; caller-cancelled aborts do not.
        if (options.signal?.aborted) {
          this.emitMetric({
            host,
            method,
            url,
            durationMs: performance.now() - startedAt,
            attempts: attempt,
            error: 'aborted',
          })
          throw err
        }

        if (attempt < maxAttempts && this.shouldRetry({ error: err, attempt })) {
          await sleep(this.backoffDelay(attempt), options.signal)
          continue
        }

        this.recordFailure(host)
        this.emitMetric({
          host,
          method,
          url,
          durationMs: performance.now() - startedAt,
          attempts: attempt,
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
      finally {
        clearTimeout(timer)
      }
    }

    // Defensive — the loop only exits via return/throw. If we somehow get
    // here, surface whatever we last saw rather than failing silently.
    /* istanbul ignore next */
    if (lastResponse)
      return lastResponse
    /* istanbul ignore next */
    throw lastError ?? new Error('HttxClient: unreachable')
  }

  /** Reset the circuit breaker for a host — useful after manual remediation. */
  resetCircuit(host: string): void {
    this.circuits.delete(host)
  }

  // --- internals ------------------------------------------------------------

  private parseHost(url: string): string {
    try {
      return new URL(url).host
    }
    catch {
      // Relative URLs / malformed inputs get a stable bucket so we still apply
      // some breaker behavior rather than silently disabling it.
      return '__invalid__'
    }
  }

  private assertCircuitClosed(host: string): void {
    const state = this.circuits.get(host)
    if (!state || state.openedAt === 0)
      return

    const elapsed = Date.now() - state.openedAt
    if (elapsed >= this.cooldownMs) {
      // Half-open: allow a single probe through by resetting the counter but
      // keeping past-failure context. If the probe succeeds we close fully
      // via `recordSuccess`; if it fails we re-open in `recordFailure`.
      state.openedAt = 0
      state.failures = this.threshold - 1
      return
    }

    throw new CircuitBreakerOpenError(host, this.cooldownMs - elapsed)
  }

  private recordSuccess(host: string): void {
    this.circuits.delete(host)
  }

  private recordFailure(host: string): void {
    const state = this.circuits.get(host) ?? { failures: 0, openedAt: 0 }
    state.failures += 1
    if (state.failures >= this.threshold && state.openedAt === 0)
      state.openedAt = Date.now()
    this.circuits.set(host, state)
  }

  /**
   * Default retry decision: 5xx responses and network errors are retryable;
   * anything else (including 4xx, which we'll never see here because the
   * caller short-circuits before reaching this) is not. A caller-supplied
   * `shouldRetry` overrides this entirely.
   */
  private shouldRetry(ctx: { error?: unknown, response?: Response, attempt: number }): boolean {
    if (this.customShouldRetry)
      return this.customShouldRetry(ctx)
    if (ctx.response)
      return ctx.response.status >= 500
    return ctx.error !== undefined
  }

  /**
   * Exponential backoff with full jitter in `[0.5x, 1.5x]` of the deterministic
   * delay. Jitter prevents synchronized retry storms from many clients.
   */
  private backoffDelay(attempt: number): number {
    const exp = this.retryBaseMs * 2 ** (attempt - 1)
    const jitter = 0.5 + Math.random()
    return Math.min(Math.floor(exp * jitter), this.retryMaxDelayMs)
  }

  private emitMetric(metric: HttxMetric): void {
    if (!this.onMetric)
      return
    try {
      this.onMetric(metric)
    }
    catch {
      // Metric sinks must never break a request — swallow failures here.
    }
  }

  /**
   * Coerce an arbitrary `body` argument into a fetch-compatible body and
   * default the Content-Type when JSON-serializing.
   */
  private coerceBody(
    body: unknown,
    options?: HttxRequestOptions,
  ): { body?: BodyInit, headers?: Record<string, string> } {
    if (body == null)
      return {}

    // Pass through anything fetch already understands natively.
    if (
      typeof body === 'string'
      || body instanceof ArrayBuffer
      || body instanceof Uint8Array
      || body instanceof FormData
      || body instanceof URLSearchParams
      || body instanceof Blob
      || body instanceof ReadableStream
    ) {
      return { body: body as BodyInit }
    }

    // Plain object / array — JSON encode and set content type if not already set.
    const existingHeaders = options?.headers as Record<string, string> | undefined
    const hasContentType = existingHeaders
      && Object.keys(existingHeaders).some(k => k.toLowerCase() === 'content-type')

    return {
      body: JSON.stringify(body),
      headers: hasContentType ? undefined : { 'Content-Type': 'application/json' },
    }
  }
}

/**
 * Convenience singleton for one-off calls. Prefer constructing your own
 * {@link HttxClient} for any caller that benefits from shared circuit state.
 *
 * @example
 * ```ts
 * import { httx } from '@stacksjs/httx/resilient'
 *
 * const res = await httx.get('https://api.example.com/health')
 * ```
 */
export const httx: HttxClient = new HttxClient()
