import { describe, expect, it } from 'bun:test'
import { seedCsrfPageResponse } from '../src/dev/csrf'

describe('development page CSRF seeding', () => {
  it('seeds a CSRF cookie on a first safe page response', async () => {
    const response = await seedCsrfPageResponse(
      new Request('http://localhost/register'),
      new Response('<form></form>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    )

    const cookie = response?.headers.get('set-cookie') || ''
    expect(cookie).toContain('X-CSRF-Token=')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })

  it('does not rewrite unsafe responses', async () => {
    const response = await seedCsrfPageResponse(
      new Request('http://localhost/register', { method: 'POST' }),
      Response.json({ ok: true }),
    )

    expect(response).toBeUndefined()
  })

  it('does not seed cookies on shared client assets', async () => {
    const response = await seedCsrfPageResponse(
      new Request('http://localhost/_stx/runtime.js'),
      new Response('window.stx = {}', {
        headers: { 'content-type': 'application/javascript; charset=utf-8' },
      }),
    )

    expect(response).toBeUndefined()
  })
})
