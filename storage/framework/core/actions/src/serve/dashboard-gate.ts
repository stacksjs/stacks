/**
 * Who may see a dashboard page in production.
 *
 * The dev dashboard runs with `auth: false` on purpose - it serves one
 * developer on localhost. Deploying that same server unchanged publishes every
 * staff page to the internet, so this is the piece that has to exist before a
 * dashboard can be exposed at all.
 *
 * DENY BY DEFAULT is the whole design. stx's page middleware
 * (`definePageMeta({ middleware: ['auth'] })`) is opt-in per page, which means
 * a page that forgets the declaration is public - and in the app this was
 * built for, ZERO of eleven dashboard pages declared it. An allowlist of the
 * few pages that must render signed-out is the only shape where forgetting
 * something fails closed.
 *
 * The decision is pure and lives here alone so it can be tested without a
 * server, a database or a browser. `serve/dashboard.ts` only supplies the
 * request and a token validator.
 */

/** What the gate decided, and why. */
export type GateDecision =
  /** Render it: no session needed for this path. */
  | { allow: true, reason: 'public-page' | 'asset' | 'delegated' }
  /** Render it: a valid session was presented. */
  | { allow: true, reason: 'authenticated' }
  /** Send them to sign in. */
  | { allow: false, reason: 'no-session' | 'invalid-session' }

export interface GateOptions {
  /** Page paths that must render for a signed-out visitor. */
  publicPaths?: readonly string[]
}

/**
 * Paths that must work before anyone can possibly be signed in.
 *
 * Deliberately short. `/login` is the page itself; the stx runtime chunks and
 * the favicon are what that page needs in order to render and be usable.
 */
const DEFAULT_PUBLIC_PATHS = ['/login', '/health'] as const

/**
 * A request for a file rather than a page.
 *
 * Assets are allowed through unauthenticated because the sign-in page needs
 * its stylesheet and scripts to render at all, and because a filename is not
 * the data being protected. The test is deliberately narrow: a trailing
 * extension, or one of the runtime's own prefixes. Every extensionless path -
 * which is what a dashboard page looks like - falls through to the gate.
 */
export function isAssetPath(pathname: string): boolean {
  if (pathname.startsWith('/_stx/') || pathname.startsWith('/@'))
    return true

  const last = pathname.slice(pathname.lastIndexOf('/') + 1)
  return last.includes('.')
}

/**
 * Whether this request even reaches the page layer.
 *
 * Anything under `/api/` and every mutating verb belongs to the router, which
 * authenticates on its own terms - a POST to `/login` has to arrive
 * unauthenticated, by definition. Gating those here would either break sign-in
 * or double-gate an endpoint that already returns 401.
 */
export function isDelegatedRequest(method: string, pathname: string): boolean {
  if (pathname === '/api' || pathname.startsWith('/api/'))
    return true

  return method !== 'GET' && method !== 'HEAD'
}

/**
 * Decide whether a dashboard request may be rendered.
 *
 * `validate` resolves a token to its user, or to anything falsy for a token
 * that is forged, expired or revoked - the same check a bearer token gets. It
 * throwing counts as invalid: a malformed token that breaks the lookup is not
 * an authenticated visitor.
 */
export async function decideDashboardAccess(
  request: { method: string, pathname: string, token: string | undefined },
  validate: (token: string) => Promise<unknown>,
  options: GateOptions = {},
): Promise<GateDecision> {
  const publicPaths = options.publicPaths ?? DEFAULT_PUBLIC_PATHS

  if (isDelegatedRequest(request.method, request.pathname))
    return { allow: true, reason: 'delegated' }

  if (isAssetPath(request.pathname))
    return { allow: true, reason: 'asset' }

  // Compared with the trailing slash normalised away, so `/login/` cannot slip
  // past the allowlist and land on the gate, and more importantly so a gated
  // path cannot be reached by adding one.
  const pathname = request.pathname.length > 1 ? request.pathname.replace(/\/+$/, '') : request.pathname
  if (publicPaths.includes(pathname))
    return { allow: true, reason: 'public-page' }

  if (!request.token)
    return { allow: false, reason: 'no-session' }

  try {
    const user = await validate(request.token)
    if (user)
      return { allow: true, reason: 'authenticated' }
  }
  catch {
    // Fall through: an exception is an invalid token, not a pass.
  }

  return { allow: false, reason: 'invalid-session' }
}
