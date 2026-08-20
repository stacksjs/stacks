import { describe, expect, it } from 'bun:test'
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
