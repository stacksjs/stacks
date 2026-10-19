import { clearOAuthFlowCookie, consumeOAuthFlow, issueOAuthFlow, readOAuthFlowCookie } from '@stacksjs/socials'

/**
 * A one-use code that moves a server-side sign-in into a browser.
 *
 * A redirect flow (social sign-in, an emailed link, a native app's sign-in
 * sheet) ends on a server that knows who signed in and a browser that does
 * not hold a session yet. Putting the bearer and refresh tokens in the
 * redirect's URL fragment works, but the fragment lands in browser history,
 * and anyone who later reads it (a shared machine, a sync service, a
 * screenshot) holds a live session.
 *
 * Instead the redirect carries this code. It lives 60 seconds, redeems once,
 * and only for the browser that holds the matching HttpOnly cookie, or, for a
 * native app whose sign-in sheet keeps its own cookies, for the client that
 * holds the verifier behind the challenge it supplied (PKCE-style). The page
 * POSTs the code to `/auth/handoff` and receives the session there.
 */

export const SESSION_HANDOFF_PURPOSE = 'session-handoff'
const HANDOFF_TTL_MS = 60_000

export type SessionHandoffBinding =
  /** An HttpOnly cookie set on the redirect response (browsers). */
  | 'cookie'
  /** The lowercase hex SHA-256 of a verifier the redeeming client holds (native apps). */
  | { challenge: string }

export interface CreateSessionHandoffOptions {
  bindTo: SessionHandoffBinding
  /** Small JSON context returned on redeem (e.g. `{ remembered: true }`). */
  data?: Record<string, unknown>
  /** Cookie path for the binding cookie. Default `/`. */
  cookiePath?: string
}

export interface SessionHandoff {
  /** Put this in the redirect (`socialHandoffCodeRedirect(code)`). */
  code: string
  /** `Set-Cookie` value for the redirect response, or null for a challenge binding. */
  cookie: string | null
  expiresAt: Date
}

export interface RedeemedSessionHandoff {
  userId: number
  data: Record<string, unknown> | null
}

/** Mint a handoff for `userId`. Mint the session itself only on redeem. */
export async function createSessionHandoff(userId: number, options: CreateSessionHandoffOptions): Promise<SessionHandoff> {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new TypeError('[auth] createSessionHandoff needs a positive integer user id.')

  const challenge = typeof options.bindTo === 'object' ? options.bindTo.challenge : undefined
  const issued = await issueOAuthFlow({
    purpose: SESSION_HANDOFF_PURPOSE,
    userId,
    data: options.data,
    ttlMs: HANDOFF_TTL_MS,
    ...(challenge !== undefined ? { challenge } : { bindBrowser: true }),
    cookie: { path: options.cookiePath ?? '/', sameSite: 'Lax' },
  })

  return { code: issued.state, cookie: issued.cookie, expiresAt: issued.expiresAt }
}

/**
 * Redeem a handoff once. `secret` is the binding cookie's value
 * ({@link readSessionHandoffCookie}) or the native client's verifier. Null for
 * an unknown, spent, expired or foreign code.
 */
export async function redeemSessionHandoff(code: unknown, secret: string | null | undefined): Promise<RedeemedSessionHandoff | null> {
  const flow = await consumeOAuthFlow(code, { purpose: SESSION_HANDOFF_PURPOSE, browserSecret: secret })
  if (!flow || flow.userId === null)
    return null
  return { userId: flow.userId, data: flow.data }
}

/** The binding cookie's value for `code` from a `Cookie` header, or ''. */
export function readSessionHandoffCookie(cookieHeader: string | null | undefined, code: string): string {
  return readOAuthFlowCookie(cookieHeader, code)
}

/** A `Set-Cookie` value removing the binding cookie. Send it with every redeem answer. */
export function clearSessionHandoffCookie(code: string, cookiePath = '/'): Promise<string> {
  return clearOAuthFlowCookie(code, { path: cookiePath, sameSite: 'Lax' })
}
