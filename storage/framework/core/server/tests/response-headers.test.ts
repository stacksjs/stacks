import { expect, test } from 'bun:test'
import { applyResponseHeaders } from '../src/response-headers'

const rules = { '/assets/elements/*': { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }, '/health': { 'Cache-Control': 'no-store' } }
test('public modules can load cross-origin without adding CORS to accounts or APIs', () => {
  for (const path of ['/assets/elements/hq-coaching.js', '/assets/elements/runtime.js']) {
    const response = new Response('export {}', { status: 200, headers: { 'Content-Type': 'text/javascript' } })
    expect(applyResponseHeaders(new Request(`https://hq.test${path}`), response, rules)).toBeUndefined()
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Content-Type')).toBe('text/javascript')
  }
  for (const path of ['/api/auth/me', '/brands/example/login', '/assets/elements-private/key', '/health/details']) {
    const response = new Response('private')
    applyResponseHeaders(new Request(`https://hq.test${path}`), response, rules)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(response.headers.get('Cache-Control')).toBeNull()
  }
})
test('exact header rules preserve the response status, body and existing headers', async () => {
  const response = new Response('unavailable', { status: 503, headers: { 'Retry-After': '5' } })
  applyResponseHeaders(new Request('https://hq.test/health?check=1'), response, rules)
  expect(response.status).toBe(503)
  expect(await response.text()).toBe('unavailable')
  expect(response.headers.get('Retry-After')).toBe('5')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})
test('a redirect keeps its Location when an immutable response needs rebuilding', () => {
  const response = Response.redirect('https://hq.test/status', 302)
  const decorated = applyResponseHeaders(new Request('https://hq.test/health'), response, rules) ?? response
  expect(decorated.status).toBe(302)
  expect(decorated.headers.get('Location')).toBe('https://hq.test/status')
  expect(decorated.headers.get('Cache-Control')).toBe('no-store')
})
