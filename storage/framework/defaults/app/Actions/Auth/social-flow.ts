import type { OAuthFlowCookieOptions } from '@stacksjs/socials'

/**
 * Shared by the default social sign-in actions (SocialRedirectAction,
 * SocialCallbackAction, SessionHandoffAction). Not an action itself.
 */

/** A provider round trip: consent screens, 2FA at the provider, a slow phone. */
export const SOCIAL_FLOW_TTL_MS = 10 * 60_000

/** One purpose per provider, so a Google state can never complete an Apple callback. */
export function socialFlowPurpose(provider: string): string {
  return `social:${provider}`
}

/**
 * A provider that returns with a cross-site POST (Apple's `form_post`) only
 * gets the flow cookie back when it is `SameSite=None; Secure`. Everything
 * else returns with a top-level GET, which `Lax` covers.
 */
export function socialFlowCookieOptions(postCallback: boolean): OAuthFlowCookieOptions {
  return { path: '/', sameSite: postCallback ? 'None' : 'Lax' }
}

/**
 * Where a finished sign-in may land: a same-origin path, or nothing.
 *
 * Backslashes and control characters are refused because browsers normalize
 * them while parsing, so `/\evil.example` is an absolute URL to them. `//`
 * is protocol-relative for the same reason.
 */
export function safeSocialReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048)
    return null
  if (!value.startsWith('/') || value.startsWith('//'))
    return null
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001F\u007F]/.test(value))
    return null
  try {
    const parsed = new URL(value, 'https://stacks.invalid')
    if (parsed.origin !== 'https://stacks.invalid')
      return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  catch {
    return null
  }
}
