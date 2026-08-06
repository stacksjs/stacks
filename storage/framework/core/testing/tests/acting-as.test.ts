/**
 * stacksjs/stacks#2228 — `featureTest().actingAs(user)` attached an
 * `X-Test-Acting-User` header and documented that "the auth middleware checks
 * `X-Test-Acting-User` only when APP_ENV === 'test'". No middleware ever read
 * it; the string appeared only in the package that wrote it. So `actingAs()`
 * was a no-op, every feature test against an `auth`-guarded route 401'd, and
 * there was no supported way to assert an authorization outcome over HTTP.
 *
 * It now mints a REAL token through `Auth.loginUsingId()` and sends it as a
 * bearer, so the request goes through the same middleware path a real client
 * uses. Teaching the middleware the sentinel instead would have put an
 * authenticate-as-anyone header in production code, one misconfigured env var
 * from being a full auth bypass.
 *
 * `@stacksjs/auth` and `@stacksjs/router` are mocked so this exercises the
 * header contract without booting the ORM or a server.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

// `mock.module` is process-wide and bun does not restore it between test
// files, so capture the real namespaces and put them back in afterAll. The
// spread matters: mocking patches the live namespace in place, so a bare
// capture would "restore" the mock itself.
const realRouter = { ...await import('@stacksjs/router') }

afterAll(() => {
  mock.module('@stacksjs/router', () => realRouter)
})

/** Every request the mocked server saw, in order. */
const seen: Request[] = []
let mintedFor: number[] = []

mock.module('@stacksjs/router', () => ({
  ...realRouter,
  serverResponse: async (req: Request) => {
    seen.push(req)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}))

mock.module('@stacksjs/auth', () => ({
  Auth: {
    loginUsingId: async (id: number) => {
      mintedFor.push(id)
      // `null` is the "no such user" contract loginUsingId already has.
      if (id === 404)
        return null
      return { user: { id }, token: `tok_for_${id}`, refreshToken: `refresh_${id}`, expiresIn: 3600 }
    },
  },
}))

const { featureTest } = await import('../src/feature')

beforeEach(() => {
  seen.length = 0
  mintedFor = []
})

const lastHeader = (name: string): string | null => seen.at(-1)!.headers.get(name)

describe('featureTest().actingAs() (#2228)', () => {
  test('sends a real bearer token, not the sentinel header', async () => {
    await featureTest().actingAs({ id: 7 }).get('/api/sites')

    expect(lastHeader('Authorization')).toBe('Bearer tok_for_7')
    // The regression: this is what it used to send instead, and nothing read it.
    expect(lastHeader('X-Test-Acting-User')).toBeNull()
    expect(mintedFor).toEqual([7])
  })

  test('sends no Authorization header when acting as nobody', async () => {
    await featureTest().get('/api/sites')

    expect(lastHeader('Authorization')).toBeNull()
    // A test that never authenticates must not pay for booting auth.
    expect(mintedFor).toEqual([])
  })

  test('mints once and reuses across requests', async () => {
    const client = featureTest().actingAs({ id: 7 })
    await client.get('/api/sites')
    await client.get('/api/sites/1')
    await client.post('/api/sites', { name: 'x' })

    expect(mintedFor).toEqual([7])
    expect(seen).toHaveLength(3)
    expect(seen.every(r => r.headers.get('Authorization') === 'Bearer tok_for_7')).toBe(true)
  })

  test('re-mints when switching user, so the first token is not reused', async () => {
    const client = featureTest().actingAs({ id: 7 })
    await client.get('/api/sites')
    client.actingAs({ id: 9 })
    await client.get('/api/sites')

    expect(mintedFor).toEqual([7, 9])
    expect(lastHeader('Authorization')).toBe('Bearer tok_for_9')
  })

  test('an explicit Authorization header wins over the acting user', async () => {
    // A test passing its own token is deliberately exercising that token.
    await featureTest()
      .actingAs({ id: 7 })
      .withHeaders({ Authorization: 'Bearer handmade' })
      .get('/api/sites')

    expect(lastHeader('Authorization')).toBe('Bearer handmade')
  })

  test('a user that cannot be authenticated fails loudly', async () => {
    // Silently sending no token would resurface as a confusing 401 on the
    // assertion instead of naming the actual cause.
    await expect(featureTest().actingAs({ id: 404 }).get('/api/sites'))
      .rejects.toThrow(/could not authenticate user 404/)
  })

  test('a non-numeric id is rejected before any token is minted', async () => {
    await expect(featureTest().actingAs({ id: 'abc' }).get('/api/sites'))
      .rejects.toThrow(/numeric id/)
    expect(mintedFor).toEqual([])
  })
})
