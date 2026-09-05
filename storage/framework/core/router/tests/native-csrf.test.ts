import { beforeEach, describe, expect, test } from 'bun:test'
import { validateCsrfRequest } from '../../../defaults/app/Middleware/Csrf'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

const token = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

beforeEach(() => {
  clearMiddlewareCache()
})

describe('native CSRF request enforcement', () => {
  test.each([
    { label: 'matching header', headers: { cookie: `X-CSRF-Token=${token}`, 'x-csrf-token': token }, body: {}, status: 200 },
    { label: 'form token', headers: { cookie: `X-CSRF-Token=${token}` }, body: { _token: token }, status: 200 },
    { label: 'legacy token', headers: { cookie: `csrf-token=${token}` }, body: { csrf_token: token }, status: 200 },
    { label: 'bearer exemption', headers: { authorization: 'Bearer test-credential' }, body: {}, status: 200 },
    { label: 'missing pair', headers: {}, body: {}, status: 403 },
    { label: 'missing cookie', headers: { 'x-csrf-token': token }, body: {}, status: 403 },
    { label: 'missing submission', headers: { cookie: `X-CSRF-Token=${token}` }, body: {}, status: 403 },
    { label: 'mismatched header', headers: { cookie: `X-CSRF-Token=${token}`, 'x-csrf-token': 'bad-token' }, body: { _token: token }, status: 403 },
    { label: 'non-string body token', headers: { cookie: `X-CSRF-Token=${token}` }, body: { _token: [token] }, status: 403 },
    { label: 'last duplicate wins', headers: { cookie: `X-CSRF-Token=wrong; X-CSRF-Token=${token}`, 'x-csrf-token': token }, body: {}, status: 200 },
    { label: 'last duplicate rejects', headers: { cookie: `X-CSRF-Token=${token}; X-CSRF-Token=wrong`, 'x-csrf-token': token }, body: {}, status: 403 },
    { label: 'canonical beats legacy', headers: { cookie: `X-CSRF-Token=wrong; csrf-token=${token}`, 'x-csrf-token': token }, body: {}, status: 403 },
    { label: 'empty canonical uses legacy', headers: { cookie: `csrf-token=${token}; X-CSRF-Token=`, 'x-csrf-token': token }, body: {}, status: 200 },
    { label: 'legacy duplicate rejects', headers: { cookie: `csrf-token=${token}; csrf-token=wrong`, 'x-csrf-token': token }, body: {}, status: 403 },
    { label: 'exact cookie name required', headers: { cookie: `prefixX-CSRF-Token=${token}; X-CSRF-Token-suffix=${token}`, 'x-csrf-token': token }, body: {}, status: 403 },
    { label: 'whitespace and malformed pairs', headers: { cookie: `other=a=b; malformed; ; X-CSRF-Token = ${token} ; theme=dark`, 'x-csrf-token': token }, body: {}, status: 200 },
  ])('$label', async ({ headers, body, status }) => {
    const router = createStacksRouter()
    let handlerRuns = 0
    router.post('/native-csrf', () => {
      handlerRuns++
      return { ok: true }
    })

    // Exercise both the first module load and the cached middleware path.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await router.handleRequest(new Request('http://localhost/native-csrf', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }))
      expect(response.status).toBe(status)
      expect(handlerRuns).toBe(status === 200 ? attempt + 1 : 0)
      const payload = await response.json()
      if (status === 200)
        expect(payload).toEqual({ ok: true })
      else
        expect(payload.message).toBe('CSRF token mismatch')
    }
  })
})

describe('standalone CSRF validator promise contract', () => {
  test('successful validation returns a promise callers can chain', async () => {
    const request = new Request('http://localhost/native-csrf', {
      method: 'POST',
      headers: { cookie: `X-CSRF-Token=${token}`, 'x-csrf-token': token },
    })
    expect(await validateCsrfRequest(request).then(() => 'accepted')).toBe('accepted')
  })

  test('invalid requests reject the promise instead of throwing at invocation', async () => {
    const request = new Request('http://localhost/native-csrf', { method: 'POST' })
    const validation = validateCsrfRequest(request)
    await expect(validation).rejects.toThrow('CSRF token mismatch')
  })
})
