import { Auth } from './authentication'
import { authCookieName } from './cookie-auth'

/**
 * The stx page gate, with the token actually validated.
 *
 * bun-plugin-stx's built-in `auth` / `guest` middleware — the pair behind
 * `definePageMeta({ middleware: ['auth'] })` — checks only that the auth
 * cookie EXISTS. `document.cookie = 'auth-token=x'` in a console satisfied it
 * on every protected page, and a stale cookie trapped a signed-out visitor on
 * `guest` pages (stacksjs/stacks#2274).
 *
 * stx-serve builds its registry as `{ ...builtInMiddleware, ...options.middleware }`,
 * so entries supplied here win over the built-ins by construction. These
 * validate the cookie's token exactly as a bearer token would be — through
 * `Auth.getUserFromToken()`, so a forged, revoked or expired token redirects
 * the same as no token at all.
 *
 * This gates SSR page rendering; API requests validate their own credentials.
 * Both the dev views server and `buddy serve` register it.
 */

interface StxPageContext {
  cookies: Record<string, string>
  /** stx-serve's redirect helper; it appends `?next=<original path>`. */
  redirect: (to: string, status?: number) => Response
}

export interface PageGateOptions {
  /** Cookie carrying the session token. Defaults to {@link authCookieName}. */
  cookieName?: string
  /** Where `auth` sends an unauthenticated visitor. Defaults to `/login`. */
  redirectTo?: string
  /** Where `guest` sends a signed-in visitor. Defaults to `/`. */
  home?: string
  /**
   * Resolves a token to its user, or to undefined for anything invalid.
   * Defaults to `Auth.getUserFromToken` — the same check a bearer gets.
   */
  validate?: (token: string) => Promise<unknown>
}

type StxPageMiddleware = (req: Request, ctx: StxPageContext) => Promise<Response | null>

/**
 * The `middleware` map to pass to stx-serve, overriding its existence-only
 * built-ins with token-validating equivalents.
 */
export function stxPageAuthMiddleware(options: PageGateOptions = {}): Record<'auth' | 'guest', StxPageMiddleware> {
  const redirectTo = options.redirectTo ?? '/login'
  const home = options.home ?? '/'
  const validate = options.validate ?? (token => Auth.getUserFromToken(token))

  async function signedInUser(ctx: StxPageContext): Promise<unknown> {
    const token = ctx.cookies[authCookieName({ name: options.cookieName })]
    if (!token)
      return undefined

    try {
      return await validate(token)
    }
    catch {
      // A malformed token that makes the lookup throw is an invalid token,
      // not an authenticated visitor. Fail closed.
      return undefined
    }
  }

  return {
    auth: async (_req, ctx) => {
      if (await signedInUser(ctx))
        return null

      return ctx.redirect(redirectTo)
    },

    guest: async (_req, ctx) => {
      // Only a VALID session bounces a visitor off a guest page — a stale
      // or forged cookie no longer locks a signed-out browser out of /login.
      if (await signedInUser(ctx))
        return Response.redirect(home, 302)

      return null
    },
  }
}
