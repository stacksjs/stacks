import { describe, expect, test } from 'bun:test'
import { CSRF_COOKIE_NAME, generateCsrfToken, seedCsrfCookieIfMissing } from '../../../defaults/app/Middleware/Csrf'

/**
 * The token has to exist before the page that embeds it is rendered.
 *
 * The router seeded the CSRF cookie on the way *out*, which is right for a
 * single-page app: it reads the cookie and echoes the header on its next
 * request. It is too late for a server-rendered page with forms in it. On a
 * visitor's very first request the page renders before any cookie exists, so
 * its forms carry an empty token and their first submit fails CSRF - the
 * submit most likely to belong to somebody trying the product out.
 *
 * The router now mints the token before the handler runs, pushes it into the
 * request's own cookie header (which is where a template reads cookies from),
 * and hands the same value to the seeding below. These cover the half that can
 * be tested without a live server: that a minted token is the one stored, and
 * that nothing rotates a token somebody is already using.
 */

function response(): Response {
  return new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })
}

function request(cookie?: string): Request {
  return new Request('http://localhost/acme/app', {
    headers: cookie ? { cookie } : {},
  })
}

function cookieOn(res: Response): string {
  return res.headers.get('set-cookie') ?? ''
}

function requestWithKnownTransport(url: string, secure: boolean): Request {
  const req = new Request(url)
  ;(req as unknown as Record<symbol, unknown>)[Symbol.for('@stacksjs/router:csrf-secure-transport')] = secure
  return req
}

describe('seedCsrfCookieIfMissing', () => {
  test('seeds a token when the request carries none', () => {
    const seeded = cookieOn(seedCsrfCookieIfMissing(request(), response()))

    expect(seeded).toContain(`${CSRF_COOKIE_NAME}=`)
    expect(seeded).toContain('SameSite=Lax')
    expect(seeded).toContain('Path=/')
  })

  test('leaves an existing token alone, because it is somebody live session', () => {
    const existing = generateCsrfToken()

    expect(cookieOn(seedCsrfCookieIfMissing(request(`${CSRF_COOKIE_NAME}=${existing}`), response()))).toBe('')
  })

  /**
   * The one that matters. The router puts the minted token into the request's
   * cookie header so the render can read it - which means by the time this
   * runs, the header *does* carry a token. Treating that as "already has one"
   * would skip the response cookie entirely and the browser would store
   * nothing, so the page would embed a token the browser never had.
   */
  test('stores the token the page embedded, even though the header now carries it', () => {
    const minted = generateCsrfToken()
    const seeded = cookieOn(
      seedCsrfCookieIfMissing(request(`${CSRF_COOKIE_NAME}=${minted}`), response(), minted),
    )

    expect(seeded).toContain(`${CSRF_COOKIE_NAME}=${minted}`)
  })

  /**
   * Two independent `randomBytes` calls would put one token in the page and a
   * different one in the browser, which fails exactly like having no token -
   * and is far harder to see.
   */
  test('never invents a second token when one was minted', () => {
    const minted = generateCsrfToken()
    const seeded = cookieOn(seedCsrfCookieIfMissing(request(), response(), minted))

    expect(seeded).toContain(`${CSRF_COOKIE_NAME}=${minted}`)
    expect(seeded.split(`${CSRF_COOKIE_NAME}=`)[1]?.split(';')[0]).toBe(minted)
  })

  /**
   * The one that took a while to see. The stx dev server mints its own token
   * before the render so a first visit's forms are not empty, which means the
   * response arrives here already carrying a Set-Cookie. Appending a second
   * leaves the browser storing the last one and the page embedding the first,
   * and the submit fails exactly as if no token existed.
   */
  test('does not seed over a token the response is already handing out', () => {
    const upstream = generateCsrfToken()
    const res = response()
    res.headers.append('Set-Cookie', `${CSRF_COOKIE_NAME}=${upstream}; Path=/`)

    const seeded = seedCsrfCookieIfMissing(request(), res).headers.getSetCookie()

    expect(seeded).toHaveLength(1)
    expect(seeded[0]).toContain(upstream)
  })

  test('still seeds alongside an unrelated cookie', () => {
    const res = response()
    res.headers.append('Set-Cookie', 'auth-token=abc; Path=/')

    const seeded = seedCsrfCookieIfMissing(request(), res).headers.getSetCookie()

    expect(seeded).toHaveLength(2)
    expect(seeded.join('\n')).toContain(`${CSRF_COOKIE_NAME}=`)
  })

  test.each([
    { name: CSRF_COOKIE_NAME, fallback: false },
    { name: 'csrf-token', fallback: false },
    { name: CSRF_COOKIE_NAME, fallback: true },
    { name: 'csrf-token', fallback: true },
  ])('preserves upstream tokens among multiple cookies: %j', ({ name, fallback }) => {
    const res = response()
    const upstream = 'b'.repeat(64)
    const cookies = ['session=opaque; Expires=Wed, 09 Jun 2027 10:18:14 GMT', `${name}=${upstream}; Path=/`, 'theme=dark']
    for (const cookie of cookies) res.headers.append('Set-Cookie', cookie)
    const readCookies = res.headers.getSetCookie.bind(res.headers)
    if (fallback) Object.defineProperty(res.headers, 'getSetCookie', { value: undefined })

    expect(seedCsrfCookieIfMissing(request(), res, 'a'.repeat(64))).toBe(res)
    expect(readCookies()).toEqual(cookies)
  })

  test('the joined-header fallback still seeds alongside unrelated cookies', () => {
    const res = response()
    res.headers.append('Set-Cookie', 'session=opaque; Expires=Wed, 09 Jun 2027 10:18:14 GMT')
    res.headers.append('Set-Cookie', 'theme=dark')
    const readCookies = res.headers.getSetCookie.bind(res.headers)
    Object.defineProperty(res.headers, 'getSetCookie', { value: undefined })

    seedCsrfCookieIfMissing(request(), res, 'a'.repeat(64))
    expect(readCookies()).toEqual([
      'session=opaque; Expires=Wed, 09 Jun 2027 10:18:14 GMT',
      'theme=dark',
      `${CSRF_COOKIE_NAME}=${'a'.repeat(64)}; Path=/; SameSite=Lax; Max-Age=7200`,
    ])
  })

  test('a token is long enough not to be guessed', () => {
    expect(generateCsrfToken()).toMatch(/^[0-9a-f]{64}$/)
    expect(generateCsrfToken()).not.toBe(generateCsrfToken())
  })

  test('is not Secure over plain HTTP, so localhost still works', () => {
    expect(cookieOn(seedCsrfCookieIfMissing(request(), response()))).not.toContain('Secure')
  })

  test('uses the native server transport hint without consulting the URL', () => {
    const secure = cookieOn(seedCsrfCookieIfMissing(requestWithKnownTransport('http://localhost/acme/app', true), response()))
    const plain = cookieOn(seedCsrfCookieIfMissing(requestWithKnownTransport('https://localhost/acme/app', false), response()))

    expect(secure).toContain('; Secure')
    expect(plain).not.toContain('; Secure')
  })

  /** Not HttpOnly on purpose: a single-page app has to read it to echo it. */
  test('is readable by script, which is what double-submit requires', () => {
    expect(cookieOn(seedCsrfCookieIfMissing(request(), response()))).not.toContain('HttpOnly')
  })
})
