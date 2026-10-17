export enum Response {
  // 1xx Informational
  HTTP_CONTINUE = 100,
  HTTP_SWITCHING_PROTOCOLS = 101,

  // 2xx Success
  HTTP_OK = 200,
  HTTP_CREATED = 201,
  HTTP_ACCEPTED = 202,
  HTTP_NON_AUTHORITATIVE_INFORMATION = 203,
  HTTP_NO_CONTENT = 204,
  HTTP_RESET_CONTENT = 205,
  HTTP_PARTIAL_CONTENT = 206,

  // 3xx Redirection
  HTTP_MULTIPLE_CHOICES = 300,
  HTTP_MOVED_PERMANENTLY = 301,
  HTTP_FOUND = 302,
  HTTP_SEE_OTHER = 303,
  HTTP_NOT_MODIFIED = 304,
  HTTP_USE_PROXY = 305,
  HTTP_UNUSED = 306,
  HTTP_TEMPORARY_REDIRECT = 307,
  HTTP_PERMANENT_REDIRECT = 308,

  // 4xx Client Error
  HTTP_BAD_REQUEST = 400,
  HTTP_UNAUTHORIZED = 401,
  HTTP_PAYMENT_REQUIRED = 402,
  HTTP_FORBIDDEN = 403,
  HTTP_NOT_FOUND = 404,
  HTTP_METHOD_NOT_ALLOWED = 405,
  HTTP_NOT_ACCEPTABLE = 406,
  HTTP_PROXY_AUTHENTICATION_REQUIRED = 407,
  HTTP_REQUEST_TIMEOUT = 408,
  HTTP_CONFLICT = 409,
  HTTP_GONE = 410,
  HTTP_LENGTH_REQUIRED = 411,
  HTTP_PRECONDITION_FAILED = 412,
  HTTP_REQUEST_ENTITY_TOO_LARGE = 413,
  HTTP_REQUEST_URI_TOO_LONG = 414,
  HTTP_UNSUPPORTED_MEDIA_TYPE = 415,
  HTTP_REQUESTED_RANGE_NOT_SATISFIABLE = 416,
  HTTP_EXPECTATION_FAILED = 417,
  HTTP_I_AM_A_TEAPOT = 418,
  HTTP_MISDIRECTED_REQUEST = 421,
  HTTP_UNPROCESSABLE_ENTITY = 422,
  HTTP_LOCKED = 423,
  HTTP_FAILED_DEPENDENCY = 424,
  HTTP_RESERVED_FOR_WEBDAV_ADVANCED_COLLECTIONS_EXPIRED_PROPOSAL = 425,
  HTTP_UPGRADE_REQUIRED = 426,
  HTTP_PRECONDITION_REQUIRED = 428,
  HTTP_TOO_MANY_REQUESTS = 429,
  HTTP_REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
  HTTP_UNAVAILABLE_FOR_LEGAL_REASONS = 451,

  // 5xx Server Error
  HTTP_INTERNAL_SERVER_ERROR = 500,
  HTTP_NOT_IMPLEMENTED = 501,
  HTTP_BAD_GATEWAY = 502,
  HTTP_SERVICE_UNAVAILABLE = 503,
  HTTP_GATEWAY_TIMEOUT = 504,
  HTTP_VERSION_NOT_SUPPORTED = 505,
  HTTP_VARIANT_ALSO_NEGOTIATES_EXPERIMENTAL = 506,
  HTTP_INSUFFICIENT_STORAGE = 507,
  HTTP_LOOP_DETECTED = 508,
  HTTP_NOT_EXTENDED = 510,
  HTTP_NETWORK_AUTHENTICATION_REQUIRED = 511,
}

/**
 * `fetch` wrapper with one budget for requests and retry waits. Honors
 * numeric and HTTP-date `Retry-After` on 429/503 responses.
 *
 * Platform `fetch()` has no timeout. A misbehaving upstream that accepts
 * the connection but never sends bytes leaves the caller hanging forever.
 * Worse, every driver (Stripe webhooks, Twilio, AI providers) shares the
 * same code path, so one slow upstream cascades into stalled queue
 * workers. This wrapper keeps the `fetch(input, init)` API but adds a
 * budget so failure modes stay bounded.
 *
 * @param input  URL or Request, exactly like fetch
 * @param init   RequestInit + { timeoutMs?: number, retry?: number }
 *               - timeoutMs (default 30_000): overall request budget
 *               - retry (default 0): retry count on 429/503
 *
 * The budget ends when response headers arrive; the caller owns subsequent
 * body consumption. Streaming request bodies are sent once, because replaying
 * a consumed stream cannot reproduce the upload. Use buffered bytes for an
 * idempotent upload that needs retries. A Request with a body is also one-shot.
 *
 * @example
 * ```ts
 * const res = await fetchWithBudget('https://api.example.com', {
 *   method: 'POST',
 *   body: JSON.stringify(payload),
 *   timeoutMs: 5000,
 *   retry: 3,
 * })
 * ```
 */
export async function fetchWithBudget(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number, retry?: number } = {},
): Promise<globalThis.Response> {
  const { timeoutMs = 30_000, retry = 0, ...rest } = init
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
    throw new RangeError('timeoutMs must be positive and within the platform timer range')
  if (!Number.isSafeInteger(retry) || retry < 0)
    throw new RangeError('retry must be a non-negative safe integer')

  const ac = new AbortController()
  const caller = rest.signal ?? (input instanceof Request ? input.signal : undefined)
  const signal = caller ? AbortSignal.any([caller, ac.signal]) : ac.signal
  const replayable = !(rest.body instanceof ReadableStream)
    && !(input instanceof Request && input.body !== null)
  const timeoutHandle = setTimeout(() => ac.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
  try {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted()
      const response = await fetch(input, { ...rest, signal })
      if (!replayable || ![429, 503].includes(response.status) || attempt >= retry)
        return response

      const header = response.headers.get('retry-after')?.trim()
      const seconds = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : NaN
      const date = header && /^[a-z]{3}(?:[a-z]*,| )/i.test(header) ? Date.parse(header) : NaN
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Number.isFinite(date) ? Math.max(0, date - Date.now()) : Math.min(2 ** attempt * 1000, 30_000)

      // Release the response before retrying. The same buffered request bytes
      // can be replayed; an unread response must not hold a connection open.
      await response.body?.cancel()
      await waitForRetry(delay, signal)
    }
  }
  finally {
    clearTimeout(timeoutHandle)
  }
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
    const abort = () => {
      finish()
      reject(signal.reason)
    }
    // The deadline aborts this wait if the server asks for longer than the
    // remaining budget. Never shorten Retry-After and send too early.
    const timer = setTimeout(() => {
      finish()
      resolve()
    }, Math.min(delay, 2_147_483_647))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}
