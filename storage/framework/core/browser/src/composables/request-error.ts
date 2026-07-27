/**
 * Turn a failed request, or a thrown exception, into something worth showing
 * a person.
 *
 * The pattern this replaces is `catch (err) { error.set(err.message) }`. It
 * looks like error handling and is actually a passthrough: whatever the
 * runtime happened to say lands in the UI. A sign-in form built that way
 * greeted people with `auth is not defined` - a programmer's ReferenceError,
 * rendered as if it were advice - and told them nothing about what to do next.
 *
 * Two rules follow from that:
 *
 *  1. A message written by our own API for a person (`Incorrect email or
 *     password`) is the best thing to show, so prefer it.
 *  2. A message produced by the JavaScript runtime is never shown. It names
 *     an identifier or a property in our source; to a visitor it is noise, and
 *     it leaks internals. Those become a generic sentence, and the original is
 *     kept on the result so the caller can log it.
 */

/** The error shapes a Stacks API returns. */
export interface ApiErrorBody {
  /** Human-readable summary, e.g. `Incorrect email or password`. */
  message?: string
  /** Short machine-ish label, e.g. `Validation failed`, `Forbidden`. */
  error?: string
  /** Per-field validation messages. */
  errors?: Record<string, string[] | string>
  success?: boolean
}

export interface UserFacingError {
  /** One sentence, safe and useful to display. */
  message: string
  /** Per-field messages, present for validation failures. */
  fields?: Record<string, string>
  /**
   * True when the cause is a defect rather than something the person can act
   * on. Callers should log `cause` when this is set.
   */
  unexpected: boolean
  /** The original error or body, for logging. Never rendered. */
  cause?: unknown
}

/**
 * Runtime errors name our source, not the user's problem. `auth is not
 * defined`, `Cannot read properties of undefined (reading 'login')`,
 * `x.map is not a function` are all in this family.
 */
function isRuntimeDefect(error: unknown): boolean {
  return error instanceof ReferenceError
    || error instanceof SyntaxError
    || error instanceof RangeError
    || (error instanceof TypeError && !isNetworkFailure(error))
}

/**
 * `fetch` rejects with a TypeError when the request never completed - offline,
 * DNS failure, connection reset, CORS. Distinguishable from a programming
 * TypeError only by its message, which browsers word differently.
 */
function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError))
    return false
  const message = error.message.toLowerCase()
  return message.includes('fetch')
    || message.includes('network')
    || message.includes('load failed')
    || message.includes('connection')
}

/** Flatten `{ password: ['too short'] }` to `{ password: 'too short' }`. */
function flattenFieldErrors(errors: ApiErrorBody['errors']): Record<string, string> | undefined {
  if (!errors || typeof errors !== 'object')
    return undefined

  const out: Record<string, string> = {}
  for (const [field, value] of Object.entries(errors)) {
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first === 'string' && first.trim())
      out[field] = first.trim()
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * A body message is worth showing only if the API wrote it for a person.
 * `Validation failed` and `Forbidden` are labels for a log line, and shown on
 * their own they tell a visitor nothing about what to change.
 */
const UNHELPFUL_LABELS = new Set([
  'validation failed',
  'forbidden',
  'unauthorized',
  'unauthenticated',
  'bad request',
  'not found',
  'internal server error',
  'error',
  // Accurate, and meaningless to the person reading it. The status fallback
  // says the actionable thing instead: reload the page.
  'csrf token mismatch',
  'invalid csrf token',
  'token mismatch',
])

function usableMessage(body?: ApiErrorBody): string | undefined {
  for (const candidate of [body?.message, body?.error]) {
    if (typeof candidate !== 'string')
      continue
    const trimmed = candidate.trim()
    if (trimmed && !UNHELPFUL_LABELS.has(trimmed.toLowerCase()))
      return trimmed
  }
  return undefined
}

/** Fallback wording per status, used when the body carries nothing usable. */
function messageForStatus(status: number, fields?: Record<string, string>): { message: string, unexpected: boolean } {
  if (status === 401)
    return { message: 'Those details did not match an account. Check them and try again.', unexpected: false }

  // The CSRF middleware answers 403 on a stale or missing double-submit
  // cookie, which is the overwhelmingly common 403 in a browser session. A
  // reload mints a fresh token, so say that rather than "Forbidden".
  if (status === 403)
    return { message: 'Your session expired. Refresh the page and try again.', unexpected: false }

  if (status === 404)
    return { message: 'That is not available anymore.', unexpected: false }

  if (status === 409)
    return { message: 'That conflicts with something that already exists.', unexpected: false }

  if (status === 422) {
    // One field is worth naming inline; several is a list the form shows.
    const only = fields && Object.keys(fields).length === 1 ? Object.values(fields)[0] : undefined
    return { message: only ?? 'Some details need fixing before this can be saved.', unexpected: false }
  }

  if (status === 429)
    return { message: 'Too many attempts. Wait a moment, then try again.', unexpected: false }

  if (status >= 500)
    return { message: 'Something went wrong on our end. Try again in a moment.', unexpected: true }

  return { message: 'That request could not be completed. Try again.', unexpected: status >= 500 }
}

/**
 * Describe a non-OK HTTP response.
 *
 * @example
 * ```ts
 * const res = await fetch('/api/login', { method: 'POST', body })
 * if (!res.ok) {
 *   const failure = describeResponseError(res.status, await res.json())
 *   error.set(failure.message)
 * }
 * ```
 */
export function describeResponseError(status: number, body?: ApiErrorBody | null): UserFacingError {
  const fields = flattenFieldErrors(body?.errors)
  const fromBody = usableMessage(body ?? undefined)
  const fallback = messageForStatus(status, fields)

  return {
    message: fromBody ?? fallback.message,
    ...(fields && { fields }),
    unexpected: fallback.unexpected && !fromBody,
    cause: body ?? undefined,
  }
}

/**
 * Describe something thrown while making a request.
 *
 * A runtime defect never reaches the returned `message`. That is the whole
 * point: `auth is not defined` is a bug report, and it belongs in the console,
 * not in front of the person trying to sign in.
 *
 * @example
 * ```ts
 * catch (err) {
 *   const failure = describeThrownError(err)
 *   if (failure.unexpected)
 *     console.error('[login]', failure.cause)
 *   error.set(failure.message)
 * }
 * ```
 */
export function describeThrownError(error: unknown): UserFacingError {
  if (isNetworkFailure(error)) {
    return {
      message: 'Could not reach the server. Check your connection and try again.',
      unexpected: false,
      cause: error,
    }
  }

  if (isRuntimeDefect(error)) {
    return {
      message: 'Something went wrong on our end. Try again in a moment.',
      unexpected: true,
      cause: error,
    }
  }

  // An Error thrown deliberately by our own code carries a message meant to be
  // read. Anything non-Error (a thrown string, a rejected object) is not
  // trustworthy prose, so it gets the generic sentence.
  if (error instanceof Error && error.message.trim()) {
    return { message: error.message.trim(), unexpected: false, cause: error }
  }

  return {
    message: 'Something went wrong. Try again in a moment.',
    unexpected: true,
    cause: error,
  }
}
