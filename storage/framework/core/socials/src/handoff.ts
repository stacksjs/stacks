import type { SessionHandoffPack } from '@stacksjs/composables'
import { buildSessionHandoffUrl } from '@stacksjs/composables'

/**
 * Hand a server-minted session to the browser at the end of a redirect flow
 * (stacksjs/stacks#2236).
 *
 * The package covered the OAuth exchange and stopped at the provider user;
 * `@stacksjs/auth` covered `loginUsingId()`. Nothing bridged them, so apps
 * ended their callback action by returning an HTML page with an inline script
 * that wrote the framework's own storage keys by hand — re-deriving the
 * session format, and needing hand-written escaping so a display name
 * containing a closing script tag could not terminate the block.
 *
 * This returns a plain 302 instead. No HTML, no inline script, so the escaping
 * hazard does not exist and the tokens never appear in a response body that a
 * proxy or a log might retain.
 */
export interface SocialHandoffOptions {
  /** Where to land after the session is established. Default `/`. */
  redirectTo?: string
  /**
   * Hosts an absolute `redirectTo` may point at, beyond the current one.
   *
   * A redirect target that reaches this function from user input — the `state`
   * blob, a `?next=` parameter — is an open redirect, and this one carries a
   * token pack in its fragment. An absolute URL is therefore rejected unless
   * its host is named here.
   */
  allowedHosts?: string[]
}

/**
 * Whether `redirectTo` is safe to send a token pack to.
 *
 * Relative paths are fine. Absolute URLs must match an allowed host. Anything
 * that fails to parse, or uses a scheme other than http(s), is refused —
 * `javascript:` and `data:` targets are how a redirect becomes script
 * execution.
 */
export function isSafeHandoffTarget(redirectTo: string, allowedHosts: string[] = []): boolean {
  if (!redirectTo)
    return false

  // A protocol-relative `//evil.example` is an absolute URL wearing a relative
  // costume — the single most missed case in redirect validation.
  if (redirectTo.startsWith('//'))
    return false

  if (redirectTo.startsWith('/'))
    return true

  try {
    const url = new URL(redirectTo)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return false

    return allowedHosts.includes(url.host)
  }
  catch {
    return false
  }
}

/**
 * The redirect that completes a social sign-in.
 *
 * ```ts
 * const result = await Auth.loginUsingId(user.id)
 * return socialHandoffRedirect({
 *   token: result.token,
 *   refreshToken: result.refreshToken,
 *   user: { id: user.id, email: user.email, name: user.name },
 *   expiresIn: result.expiresIn,
 * }, { redirectTo: '/account' })
 * ```
 *
 * The client completes it with `useAuth().completeSocialLogin()`, which reads
 * the fragment, writes through the storage refs — so the encoding is applied
 * by the same code path as an ordinary login — and strips the fragment.
 *
 * `Cache-Control: no-store` because the Location header carries the pack; a
 * cached 302 would replay someone else's session to the next visitor.
 */
export function socialHandoffRedirect(
  pack: SessionHandoffPack,
  options: SocialHandoffOptions = {},
): Response {
  const redirectTo = options.redirectTo ?? '/'

  if (!isSafeHandoffTarget(redirectTo, options.allowedHosts ?? [])) {
    throw new Error(
      `[socials] refusing to hand a session to ${redirectTo}: `
      + 'relative paths are always allowed; an absolute URL needs its host in allowedHosts.',
    )
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': buildSessionHandoffUrl(redirectTo, pack),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

/**
 * The redirect for a sign-in that did not succeed.
 *
 * Ships alongside the success path because the failure path was the other
 * hand-built inline script in the app that reported this — the same escaping
 * hazard, for a message that often contains provider text.
 *
 * The reason travels as an ordinary query parameter: it carries no credential,
 * and a query is what the destination page can read server-side to render an
 * error.
 */
export function socialHandoffFailureRedirect(
  reason: string,
  options: SocialHandoffOptions = {},
): Response {
  const redirectTo = options.redirectTo ?? '/login'

  if (!isSafeHandoffTarget(redirectTo, options.allowedHosts ?? []))
    throw new Error(`[socials] refusing to redirect to ${redirectTo}`)

  const separator = redirectTo.includes('?') ? '&' : '?'
  const location = `${redirectTo}${separator}social_error=${encodeURIComponent(reason)}`

  return new Response(null, {
    status: 302,
    headers: { 'Location': location, 'Cache-Control': 'no-store' },
  })
}
