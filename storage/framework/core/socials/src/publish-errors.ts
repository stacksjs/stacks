/**
 * What kind of failure a network answered with.
 *
 * Every driver error carries the network's HTTP `status` and raw `body`, and
 * each one had its own `isAuthError`, most of them `401 || 403`. That treats
 * X refusing a duplicate post, or a token missing one permission, as a token
 * that is no longer good, and an app that disconnects an account on
 * `isAuthError` disconnected one that was working. Bluesky's counted every
 * 400 as well, so an invalid record looked like an expired session.
 *
 * {@link classifySocialError} reads the status and the network's own words
 * and puts the failure in one of a few kinds. Only `expired` means the
 * account must sign in again. Turning a kind into a sentence for a person is
 * the app's business: it knows where its settings live.
 *
 * No imports: it reads `status`, `body` and `message`, which every driver
 * error carries, so it works on any of them and on a plain `Error`.
 */

export type SocialErrorKind
  = | 'expired'
    | 'permission'
    | 'rate-limited'
    | 'duplicate'
    | 'content'
    | 'media'
    | 'temporary'
    | 'unknown'

/** The short sentence a network gives as its reason, when it gives one. */
export function networkReason(body: unknown): string {
  let parsed: any
  try {
    parsed = typeof body === 'string' ? JSON.parse(body) : body
  }
  catch {
    return ''
  }
  if (!parsed || typeof parsed !== 'object') return ''

  const first = Array.isArray(parsed.errors) ? parsed.errors[0] : undefined
  const candidates = [
    parsed.detail,
    parsed.error?.error_user_msg,
    parsed.error?.message,
    parsed.message,
    parsed.error_description,
    // Threads' token endpoints.
    parsed.error_message,
    first?.detail,
    first?.message,
    typeof parsed.error === 'string' ? parsed.error : undefined,
  ]
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.replace(/\s+/g, ' ').trim() : ''
    // A sentence, not a code or a dump: short, with a space, no braces.
    if (text && text.length <= 200 && text.includes(' ') && !/[{}<>]/.test(text)) return text.replace(/[.!]+$/, '')
  }
  return ''
}

function kindOf(status: number, text: string): SocialErrorKind {
  const has = (pattern: RegExp): boolean => pattern.test(text)

  // Meta answers a rate limit with a 400 and "(#4) Application request limit reached" (also #17, #32, #613).
  if (status === 429 || has(/rate.?limit|too many requests|usage cap|throttl|request limit reached/i)) return 'rate-limited'
  if (has(/duplicate|already (?:posted|published|exists)|DUPLICATE_POST/i)) return 'duplicate'
  if (status === 401 || has(/invalid.?token|expired.?token|token (?:has )?(?:expired|been revoked)|session has (?:expired|been invalidated)|OAuthException.*(?:expired|invalid)|REVOKED_ACCESS_TOKEN/i)) return 'expired'
  if (status === 413 || has(/media|image|video|attachment|aspect ratio|file size|unsupported (?:format|type)|blob/i)) return 'media'
  if (status === 403 || has(/permission|scope|not (?:allowed|authorized|permitted)|forbidden|ACCESS_DENIED|insufficient/i)) return 'permission'
  if (status === 408 || status >= 500) return 'temporary'
  if (status === 400 || status === 404 || status === 409 || status === 422) return 'content'
  if (has(/fetch failed|network|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|timed? ?out|socket|aborted/i)) return 'temporary'
  return 'unknown'
}

export interface SocialErrorClassification {
  kind: SocialErrorKind
  /** The network's HTTP status, or 0 when the failure never reached it. */
  status: number
  /** The network's own reason, when it gave a readable one. */
  reason: string
}

/**
 * Classify a publishing failure from any driver.
 *
 * An error without a status is either a network fault (`temporary`) or one a
 * driver raised itself before sending anything ("posts must be 300
 * characters or fewer"), which is `unknown` and whose message is already
 * written for a person.
 */
export function classifySocialError(error: unknown): SocialErrorClassification {
  const source = (error ?? {}) as { status?: unknown, body?: unknown, message?: unknown }
  const status = Number(source.status) || 0
  const own = String(source.message ?? error ?? '')
  const reason = networkReason(source.body)
  const body = typeof source.body === 'string' ? source.body.slice(0, 2000) : ''
  return { kind: kindOf(status, `${reason} ${body} ${status ? '' : own}`), status, reason }
}

/** Whether the failure means the account has to sign in again. */
export function isExpiredSignIn(error: unknown): boolean {
  return classifySocialError(error).kind === 'expired'
}
