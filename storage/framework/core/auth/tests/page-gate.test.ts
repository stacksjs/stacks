import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stxPageAuthMiddleware } from '../src/page-gate'

/**
 * The stx page gate must validate the token, not just see a cookie
 * (stacksjs/stacks#2274). The validator is injected so these run without a
 * database; the default wiring to `Auth.getUserFromToken` is a one-liner in
 * `stxPageAuthMiddleware` itself.
 */

const req = new Request('https://example.com/account')

function ctxWith(cookies: Record<string, string>) {
  const redirects: string[] = []
  return {
    cookies,
    redirects,
    redirect: (to: string) => {
      redirects.push(to)
      return new Response(null, { status: 302, headers: { Location: to } })
    },
  }
}

/** Accepts exactly one token, like a database that holds one session row. */
function validatorAccepting(validToken: string) {
  return async (token: string) => (token === validToken ? { id: 1 } : undefined)
}

describe('stxPageAuthMiddleware', () => {
  it('runs auth and guest at the same priority as the shared API middleware', () => {
    const { auth, guest } = stxPageAuthMiddleware()

    expect(auth.priority).toBe(1)
    expect(guest.priority).toBe(1)
  })

  it('auth redirects when there is no cookie at all', async () => {
    const { auth } = stxPageAuthMiddleware({ validate: validatorAccepting('real') })
    const ctx = ctxWith({})

    const result = await auth(req, ctx)

    expect(result).toBeInstanceOf(Response)
    expect(ctx.redirects).toEqual(['/login'])
  })

  it('auth redirects a forged cookie - existence is not authentication', async () => {
    // This is the #2274 scenario: `document.cookie = 'auth-token=x'`.
    const { auth } = stxPageAuthMiddleware({ validate: validatorAccepting('real') })
    const ctx = ctxWith({ 'auth-token': 'x' })

    const result = await auth(req, ctx)

    expect(result).toBeInstanceOf(Response)
    expect(ctx.redirects).toEqual(['/login'])
  })

  it('auth passes a valid session through', async () => {
    const { auth } = stxPageAuthMiddleware({ validate: validatorAccepting('real') })

    expect(await auth(req, ctxWith({ 'auth-token': 'real' }))).toBeNull()
  })

  it('auth fails closed when validation itself throws', async () => {
    const { auth } = stxPageAuthMiddleware({
      validate: async () => {
        throw new Error('malformed token')
      },
    })
    const ctx = ctxWith({ 'auth-token': 'garbage' })

    expect(await auth(req, ctx)).toBeInstanceOf(Response)
    expect(ctx.redirects).toEqual(['/login'])
  })

  it('guest no longer traps a signed-out visitor holding a stale cookie', async () => {
    // The built-in gate bounced any cookie-holder off /login, valid or not.
    const { guest } = stxPageAuthMiddleware({ validate: validatorAccepting('real') })

    expect(await guest(req, ctxWith({ 'auth-token': 'stale' }))).toBeNull()
  })

  it('guest still bounces a genuinely signed-in visitor home', async () => {
    const { guest } = stxPageAuthMiddleware({ validate: validatorAccepting('real') })

    const result = await guest(req, ctxWith({ 'auth-token': 'real' }))

    expect(result).toBeInstanceOf(Response)
    expect(result?.headers.get('Location')).toBe('/')
  })

  it('honours a custom cookie name and redirect targets', async () => {
    const { auth, guest } = stxPageAuthMiddleware({
      cookieName: 'of_session',
      redirectTo: '/signin',
      home: '/dashboard',
      validate: validatorAccepting('real'),
    })

    const denied = ctxWith({ 'auth-token': 'real' }) // right token, wrong cookie
    expect(await auth(req, denied)).toBeInstanceOf(Response)
    expect(denied.redirects).toEqual(['/signin'])

    expect(await auth(req, ctxWith({ of_session: 'real' }))).toBeNull()

    const bounced = await guest(req, ctxWith({ of_session: 'real' }))
    expect(bounced?.headers.get('Location')).toBe('/dashboard')
  })
})

/**
 * Why there is no `role` entry in this file (stacksjs/stacks#2883).
 *
 * A page gates on a role already, and not from here: both servers build their
 * stx-serve registry as `{ ...loadMiddlewareHandlers(), ...stxPageAuthMiddleware() }`,
 * and the first half is the application's own `app/Middleware.ts` registry -
 * `'role': 'Role'`, `'permission': 'Permission'` and the rest. stx-serve writes
 * the parsed parameters to `request._middlewareParams[name]`, which is exactly
 * what `app/Middleware/Role.ts` reads, so `definePageMeta({ middleware:
 * ['auth', 'role:admin'] })` runs the same class an API route would.
 *
 * Verified against the real registry rather than inferred: `role` and
 * `permission` both resolve in it, and this gate contributes only `auth` and
 * `guest`.
 *
 * The spread order is what makes that fragile. This half wins, so adding a
 * `role` here would not extend the registry, it would REPLACE the app's own -
 * silently taking page role checks away from a project that customised
 * `app/Middleware/Role.ts`. Hence the assertion: this gate overrides the two
 * built-ins it exists to fix, and nothing else.
 */
describe('the page middleware registry', () => {
  const framework = join(import.meta.dir, '..', '..', '..')

  it('contributes only the two built-ins it exists to override', () => {
    // #2274 is why `auth` and `guest` are here: stx-serve's own versions check
    // that the cookie exists and never validate the token.
    expect(Object.keys(stxPageAuthMiddleware()).sort()).toEqual(['auth', 'guest'])
  })

  it.each([
    ['buddy serve', join(framework, 'core', 'buddy', 'src', 'production-server.ts')],
    ['the dev views server', join(framework, 'core', 'actions', 'src', 'dev', 'views.ts')],
  ])('%s spreads the app registry first, so only those two are overridden', (_server, file) => {
    const source = readFileSync(file, 'utf8')
    const app = source.indexOf('...pageMiddleware')
    const gate = source.indexOf('...stxPageAuthMiddleware(')

    expect(app, 'the app registry must be spread').toBeGreaterThan(-1)
    expect(gate, 'the page gate must be spread').toBeGreaterThan(-1)
    expect(app, 'the app registry comes first, so the gate overrides it').toBeLessThan(gate)
  })

  it('loads the app aliases that gate a page by role', () => {
    // The names `definePageMeta({ middleware: [...] })` resolves through the
    // first half of that spread. Read off the defaults, which an app's own
    // `app/Middleware.ts` is merged OVER rather than replacing.
    const aliases = readFileSync(join(framework, 'defaults', 'app', 'Middleware.ts'), 'utf8')

    expect(aliases).toContain(`'role': 'Role'`)
    expect(aliases).toContain(`'permission': 'Permission'`)
  })
})
