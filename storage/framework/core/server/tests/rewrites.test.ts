import { describe, expect, it } from 'bun:test'
import { describeRewriteRules, resolveRewrite, resolveRewriteRules } from '../src/rewrites'

describe('resolveRewriteRules', () => {
  it('keeps an exact rule as written', () => {
    const rules = resolveRewriteRules({ '/sitemap.xml': '/api/sitemap.xml' })
    expect(rules.get('/sitemap.xml')).toEqual({ from: '/sitemap.xml', to: '/api/sitemap.xml', prefix: false })
  })

  it('stores a prefix rule without its star, so lookups stay a map read', () => {
    const rules = resolveRewriteRules({ '/sitemap-trails-*': '/api/sitemap-trails-*' })
    expect(rules.get('/sitemap-trails-')).toEqual({
      from: '/sitemap-trails-',
      to: '/api/sitemap-trails-',
      prefix: true,
    })
  })

  it('drops a rule that points at itself, which would proxy in a circle', () => {
    expect(resolveRewriteRules({ '/feed.xml': '/feed.xml' }).size).toBe(0)
  })

  it('ignores a source already under /api, where a rewrite means nothing', () => {
    expect(resolveRewriteRules({ '/api/sitemap.xml': '/api/v2/sitemap.xml' }).size).toBe(0)
  })

  it('drops malformed entries rather than refusing to boot', () => {
    const rules = resolveRewriteRules({ 'sitemap.xml': '/api/sitemap.xml', '/ok': '/api/ok', '/bad': '' })
    expect([...rules.keys()]).toEqual(['/ok'])
  })

  it('treats a trailing slash as insignificant', () => {
    const rules = resolveRewriteRules({ '/well-known/': '/api/well-known/' })
    expect(rules.get('/well-known')?.to).toBe('/api/well-known')
  })
})

describe('resolveRewrite', () => {
  const rules = resolveRewriteRules({
    '/sitemap.xml': '/api/sitemap.xml',
    '/sitemap-trails-*': '/api/sitemap-trails-*',
    '/feed/*': '/api/feed/*',
    '/feed/legacy.xml': '/api/v1/legacy.xml',
  })

  it('rewrites an exact path', () => {
    expect(resolveRewrite('/sitemap.xml', rules)).toBe('/api/sitemap.xml')
  })

  it('carries the remainder of a prefix match onto the target', () => {
    expect(resolveRewrite('/sitemap-trails-1.xml', rules)).toBe('/api/sitemap-trails-1.xml')
    expect(resolveRewrite('/sitemap-trails-24.xml', rules)).toBe('/api/sitemap-trails-24.xml')
  })

  it('lets an exact rule win over a prefix that also matches', () => {
    // The point of the carve-out: one path inside a rewritten subtree goes
    // somewhere else, and the subtree rule must not swallow it.
    expect(resolveRewrite('/feed/legacy.xml', rules)).toBe('/api/v1/legacy.xml')
    expect(resolveRewrite('/feed/current.xml', rules)).toBe('/api/feed/current.xml')
  })

  it('leaves anything unmatched alone', () => {
    expect(resolveRewrite('/trails', rules)).toBeUndefined()
    expect(resolveRewrite('/sitemap.xml.bak', rules)).toBeUndefined()
    expect(resolveRewrite('/', rules)).toBeUndefined()
  })

  it('is a no-op with no rules, so an app that declares none pays nothing', () => {
    expect(resolveRewrite('/sitemap.xml')).toBeUndefined()
    expect(resolveRewrite('/sitemap.xml', resolveRewriteRules())).toBeUndefined()
  })

  it('prefers the longest prefix when several match', () => {
    const nested = resolveRewriteRules({ '/a/*': '/api/short', '/a/b/*': '/api/long' })
    expect(resolveRewrite('/a/b/c', nested)).toBe('/api/long/c')
    expect(resolveRewrite('/a/z', nested)).toBe('/api/short/z')
  })

  it('appends a bare remainder for a rule with no path separator', () => {
    // `/section/*` and `/prefix-*` are both prefix rules but read differently:
    // the first normalises its trailing slash away, so the remainder keeps its
    // separator, while the second is a literal string prefix. Chunked files
    // (`/sitemap-trails-1.xml`) need the second.
    const rules = resolveRewriteRules({ '/part-*': '/api/part-*' })
    expect(resolveRewrite('/part-7.xml', rules)).toBe('/api/part-7.xml')
  })
})

describe('describeRewriteRules', () => {
  it('renders the rules the way they were written', () => {
    const rules = resolveRewriteRules({ '/sitemap.xml': '/api/sitemap.xml', '/s-*': '/api/s-*' })
    expect(describeRewriteRules(rules)).toBe('/sitemap.xml → /api/sitemap.xml, /s-* → /api/s-*')
  })

  it('says nothing when there is nothing to say', () => {
    expect(describeRewriteRules(resolveRewriteRules())).toBe('')
  })
})
