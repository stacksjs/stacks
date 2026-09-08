import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { enhanceRequest, runWithRequest } from '@stacksjs/router'

const root = `${import.meta.dir}/../../../../../..`
const middleware = (await import(process.argv[2] === 'app'
  ? `${root}/app/Middleware/Auth.ts`
  : `${root}/storage/framework/defaults/app/Middleware/Auth.ts`)).default
const auth = await import('@stacksjs/auth')
const { Auth } = await import('@stacksjs/auth/authentication')
const cookie = await import('@stacksjs/auth/cookie')
const sessions = await import('@stacksjs/auth/session-auth')
assert.equal(Auth, auth.Auth)
assert.equal(cookie.authCookieName, auth.authCookieName)
assert.equal(sessions.sessionUser, auth.sessionUser)

const bearerUser = { id: 701, email: 'bearer@example.test' }
const cookieUser = { id: 702, email: 'cookie@example.test' }
const sessionUser = { id: 703, email: 'session@example.test' }
const accessToken = { id: 704, abilities: ['read'] }
const tokenSpy = spyOn(Auth, 'getUserFromToken').mockImplementation(async (token) =>
  (token === 'valid-bearer' ? bearerUser : token === 'valid-cookie' ? cookieUser : undefined) as Awaited<ReturnType<typeof Auth.getUserFromToken>>,
)
const accessSpy = spyOn(Auth, 'currentAccessToken').mockResolvedValue(accessToken as Awaited<ReturnType<typeof Auth.currentAccessToken>>)
const sessionSpy = spyOn(sessions, 'sessionUser').mockImplementation(async id =>
  (id === 'valid-session' ? sessionUser : undefined) as Awaited<ReturnType<typeof sessions.sessionUser>>,
)

try {
  const cookieName = cookie.authCookieName()
  for (const [headers, expected, hasToken] of [
    [{ authorization: 'Bearer valid-bearer', cookie: `${cookieName}=valid-cookie; session_id=valid-session` }, bearerUser, true],
    [{ cookie: `${cookieName}=valid-cookie; session_id=valid-session` }, cookieUser, true],
    [{ cookie: 'session_id=valid-session' }, sessionUser, false],
  ] as const) {
    const req = enhanceRequest(new Request('https://example.test/protected', { headers }) as EnhancedRequest)
    await runWithRequest(req, async () => {
      await middleware.handle(req)
      assert.equal(req._authenticatedUser, expected)
      assert.equal(await auth.Auth.user(), expected)
      assert.equal(req._currentAccessToken, hasToken ? accessToken : undefined)
    })
  }
  for (const headers of [
    {},
    { authorization: 'Bearer invalid', cookie: `${cookieName}=valid-cookie` },
    { cookie: `${cookieName}=invalid; session_id=valid-session` },
    { cookie: 'session_id=invalid' },
  ]) {
    const req = enhanceRequest(new Request('https://example.test/protected', { headers }) as EnhancedRequest)
    await runWithRequest(req, async () => {
      await assert.rejects(() => middleware.handle(req), (error: { status?: number }) => error.status === 401)
      assert.equal(req._authenticatedUser, undefined)
    })
  }
  assert.equal(tokenSpy.mock.calls.length, 4)
  assert.equal(sessionSpy.mock.calls.length, 2)
  console.log('PASS entrypoint identity, credential precedence, request state and refusals')
}
finally {
  tokenSpy.mockRestore()
  accessSpy.mockRestore()
  sessionSpy.mockRestore()
}
