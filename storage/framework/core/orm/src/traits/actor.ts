/**
 * Who a write is attributed to, and what must never be written down about it.
 *
 * Both trails the framework keeps - `useAudit`'s `model_audits` rows and
 * `useActivityLog`'s `activities` rows - answer the same two questions before
 * they write: which user did this, and which of the model's attributes are safe
 * to record. Two copies of that answer is two chances to disagree about whether
 * `remember_token` is a secret, so there is one.
 */
import { log } from '@stacksjs/logging'

/**
 * Field-name patterns whose values must never reach a trail.
 * Matched case-insensitively against the attribute name, compiled once rather
 * than re-parsed per row.
 */
const SENSITIVE_FIELD_PATTERNS = [
  /^password$/i,
  /^password_hash$/i,
  /^api_key$/i,
  /_token$/i,
  /_secret$/i,
  /^remember_token$/i,
]

/**
 * Module-level actor override, for the runs that have no HTTP request: queue
 * jobs, CLI commands, cron tasks. Set it once at the top of the run and every
 * row written during it carries the same id.
 */
let explicitActorId: number | string | null = null

/**
 * Override the user id attached to subsequent trail rows. Pass `null` to clear
 * it and fall back to the request-derived id.
 */
export function setTrailActor(id: number | string | null): void {
  explicitActorId = id
}

/** The override, for callers that need to know whether one is set. */
export function currentTrailActor(): number | string | null {
  return explicitActorId
}

/**
 * The user id to attribute a write to. In order:
 *
 *   1. the explicit override, for queue and CLI runs
 *   2. the current HTTP request's authenticated user
 *   3. `null` - a system write, which both tables allow
 *
 * Failures are swallowed on purpose. The router is lazily imported because it
 * is not loaded in every runtime that consumes the ORM (CLI build steps,
 * tests), and it imports the ORM in the runtimes where it IS loaded - so a
 * static import here would be a cycle. Not knowing who acted is never a reason
 * to fail the write being described.
 */
export async function resolveTrailActorId(): Promise<number | string | null> {
  if (explicitActorId != null)
    return explicitActorId

  try {
    const mod = await import('@stacksjs/router').catch(() => null)
    if (!mod)
      return null

    const getCurrentRequest = (mod as { getCurrentRequest?: () => unknown }).getCurrentRequest
    if (typeof getCurrentRequest !== 'function')
      return null

    // Middleware sets the user under slightly different names; try the common
    // ones rather than forcing every caller into one shape.
    const request = getCurrentRequest() as { user?: { id?: number | string }, _user?: { id?: number | string } } | null | undefined
    return request?.user?.id ?? request?._user?.id ?? null
  }
  catch {
    return null
  }
}

/**
 * The requesting IP, when there is a request to ask.
 *
 * Same lazy-import reasoning as the actor above, and the same tolerance: an
 * activity row with no address is still worth having.
 */
export async function resolveTrailIp(): Promise<string | null> {
  try {
    const mod = await import('@stacksjs/router').catch(() => null)
    const getCurrentRequest = (mod as { getCurrentRequest?: () => unknown } | null)?.getCurrentRequest
    if (typeof getCurrentRequest !== 'function')
      return null

    const request = getCurrentRequest() as { ip?: () => string | null } | null | undefined
    return typeof request?.ip === 'function' ? (request.ip() ?? null) : null
  }
  catch {
    return null
  }
}

/**
 * A copy of `attributes` with every sensitive field dropped.
 *
 * Never mutates the input: the caller is also using the original to write the
 * row the trail describes.
 */
export function redactSensitive(attributes: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!attributes || typeof attributes !== 'object')
    return null

  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(key)))
      continue
    safe[key] = value
  }
  return safe
}

/** Report a trail write that failed, without letting it fail the write it describes. */
export function reportTrailFailure(trail: string, subject: string, error: unknown): void {
  log.warn(`[orm] ${trail} row write failed for ${subject}: ${(error as Error)?.message ?? String(error)}`)
}
