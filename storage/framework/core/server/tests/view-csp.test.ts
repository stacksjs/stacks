import { describe, expect, test } from 'bun:test'
import { applyViewSecurityHeaders, pageContentSecurityPolicy, resolveViewSecurityRules } from '../src/security-headers'

// stacksjs/stacks#3358. A page CSP, opt-in: every <script> the page carries
// gets a per-response nonce, and the policy allows exactly those. Report-only
// first, so an app sees what would break before it enforces.

const html = '<!doctype html><html><head><script>window.a=1</script><script type="module" src="/app.js"></script><style>b{}</style></head><body><p>x</p></body></html>'
const page = (body = html, type = 'text/html; charset=utf-8'): Response => new Response(body, { headers: { 'Content-Type': type } })
const at = (path = '/login'): Request => new Request(`https://app.example.com${path}`)

async function served(rules: ReturnType<typeof resolveViewSecurityRules>, response = page(), path = '/login'): Promise<{ res: Response, body: string }> {
  const res = applyViewSecurityHeaders(at(path), response, rules) ?? response
  return { res, body: await res.text() }
}

describe('the page CSP', () => {
  test('is off unless the app turns it on', async () => {
    const { res } = await served(resolveViewSecurityRules(undefined, undefined))
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
  })

  test('stamps one fresh nonce on every script, and allows exactly it', async () => {
    const rules = resolveViewSecurityRules({ csp: true }, undefined)
    const first = await served(rules)
    const policy = first.res.headers.get('Content-Security-Policy')!
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1]
    expect(nonce).toBeDefined()
    expect(first.body.split(`nonce="${nonce}"`).length - 1).toBe(2)
    expect(first.body.match(/<script\b/g)?.length).toBe(2)
    expect(first.body).toContain('<style>b{}</style>')
    const second = await served(rules)
    expect(/'nonce-([^']+)'/.exec(second.res.headers.get('Content-Security-Policy')!)?.[1]).not.toBe(nonce)
  })

  test('the default policy', () => {
    const policy = pageContentSecurityPolicy({}, 'abc', false)
    for (const part of ["default-src 'self'", "script-src 'self' 'nonce-abc'", "style-src 'self' 'unsafe-inline'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"])
      expect(policy).toContain(part)
  })

  test('an embeddable path drops frame-ancestors; directives can be added, replaced or removed', () => {
    expect(pageContentSecurityPolicy({}, 'abc', true)).not.toContain('frame-ancestors')
    const policy = pageContentSecurityPolicy({ 'connect-src': ["'self'", 'https://api.example.com'], 'frame-src': ['https://js.stripe.com'], 'form-action': false }, 'abc', false)
    expect(policy).toContain("connect-src 'self' https://api.example.com")
    expect(policy).toContain('frame-src https://js.stripe.com')
    expect(policy).not.toContain('form-action')
    expect(pageContentSecurityPolicy({ 'script-src': ["'self'", 'https://cdn.example.com'] }, 'abc', false)).toContain("script-src 'self' https://cdn.example.com 'nonce-abc'")
  })

  test('report-only sends the report-only header, with a report URI when given', async () => {
    const { res } = await served(resolveViewSecurityRules({ csp: { reportOnly: true, reportUri: '/csp-report' } }, undefined))
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toContain('report-uri /csp-report')
  })

  test('leaves non-HTML responses and a page that set its own policy alone', async () => {
    const rules = resolveViewSecurityRules({ csp: true }, undefined)
    const json = await served(rules, page('{"a":1}', 'application/json'))
    expect(json.res.headers.get('Content-Security-Policy')).toBeNull()
    expect(json.body).toBe('{"a":1}')
    const own = new Response(html, { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'none'" } })
    const kept = await served(rules, own)
    expect(kept.res.headers.get('Content-Security-Policy')).toBe("default-src 'none'")
    expect(kept.body).not.toContain('nonce=')
  })

  test('keeps the status and the other headers', async () => {
    const rules = resolveViewSecurityRules({ csp: true }, 'https://app.example.com')
    const { res } = await served(rules, new Response(html, { status: 404, headers: { 'Content-Type': 'text/html', 'X-Extra': '1' } }))
    expect(res.status).toBe(404)
    expect(res.headers.get('X-Extra')).toBe('1')
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('Strict-Transport-Security')).not.toBeNull()
  })
})
