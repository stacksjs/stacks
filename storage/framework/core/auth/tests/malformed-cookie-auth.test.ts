import { expect, test } from 'bun:test'
import { authCookieName, cookieCheck, logoutCookie, userFromCookie } from '../src/cookie-auth'
import { authMiddleware } from '../src/middleware'
import { requestToken } from '../src/request-token'

for (const value of ['%', '%GG', '%E0%A4%A', '%C0%AF']) {
  const request = new Request('https://example.invalid/account', {
    headers: { cookie: `${authCookieName()}=${value}` },
  })

  test(`${value} is unauthenticated rather than a decoding exception`, async () => {
    expect(requestToken(request)).toBeNull()
    await expect(authMiddleware(request)).rejects.toMatchObject({ statusCode: 401 })
    await expect(userFromCookie(request)).resolves.toBeUndefined()
    await expect(cookieCheck(request)).resolves.toBe(false)
  })

  test(`${value} can be cleared on logout`, async () => {
    const header = await logoutCookie(request)
    expect(header).toContain(`${authCookieName()}=`)
    expect(header).toContain('Max-Age=0')
    expect(header).toContain('Path=/')
    expect(header).toContain('HttpOnly')
  })
}

test('a bearer header still takes priority over a malformed cookie', () => {
  const request = new Request('https://example.invalid/account', {
    headers: { cookie: `${authCookieName()}=%GG`, authorization: 'Bearer fixture-token' },
  })
  expect(requestToken(request)).toBe('fixture-token')
})

test('custom-named malformed cookies can be checked and cleared', async () => {
  const request = new Request('https://example.invalid/account', { headers: { cookie: 'custom_session=%GG' } })
  const options = { name: 'custom_session', path: '/account' }

  await expect(cookieCheck(request, options)).resolves.toBe(false)
  const header = await logoutCookie(request, options)
  expect(header).toContain('custom_session=')
  expect(header).toContain('Path=/account')
  expect(header).toContain('Max-Age=0')
})
