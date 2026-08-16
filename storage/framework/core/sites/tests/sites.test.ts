import type { ResolvedSitesOptions, SiteContext, SiteStore } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { currentSite, currentSiteId, requireSite, runWithSite, SiteNotResolvedError } from '../src/context'
import { classifyHost, clearSiteCache, normalizeHost, requestHost, resolveSiteByHost } from '../src/resolver'
import { forSite } from '../src/scoping'
import { toSiteSnapshot } from '../src/snapshot'

const options: ResolvedSitesOptions = {
  enabled: true,
  baseDomain: 'campushq.com',
  platformHosts: ['localhost', 'campushq.com', 'www.campushq.com', 'app.campushq.com'],
  strict: false,
  trustProxyHost: true,
  cacheTtlSeconds: 60,
}

function site(overrides: Partial<SiteContext> = {}): SiteContext {
  return {
    id: 7,
    uuid: 'uuid-7',
    name: 'St Marks',
    subdomain: 'stmarks',
    host: 'stmarks.campushq.com',
    teamId: 3,
    status: 'active',
    settings: {},
    ...overrides,
  }
}

describe('normalizeHost', () => {
  it('lowercases, strips port and trailing dot', () => {
    expect(normalizeHost('StMarks.CampusHQ.com:443')).toBe('stmarks.campushq.com')
    expect(normalizeHost('example.org.')).toBe('example.org')
    expect(normalizeHost('  Example.ORG:8080 ')).toBe('example.org')
  })

  it('handles empty and IPv6 literals', () => {
    expect(normalizeHost(null)).toBe('')
    expect(normalizeHost(undefined)).toBe('')
    expect(normalizeHost('[::1]:3000')).toBe('[::1]')
  })
})

describe('classifyHost', () => {
  it('platform hosts win, including the base domain itself and www', () => {
    expect(classifyHost('campushq.com', options)).toEqual({ kind: 'platform' })
    expect(classifyHost('www.campushq.com', options)).toEqual({ kind: 'platform' })
    expect(classifyHost('localhost', options)).toEqual({ kind: 'platform' })
    expect(classifyHost('', options)).toEqual({ kind: 'platform' })
  })

  it('one-label subdomains of the base domain are site slugs', () => {
    expect(classifyHost('stmarks.campushq.com', options)).toEqual({ kind: 'subdomain', subdomain: 'stmarks' })
  })

  it('multi-label and www subdomains are not slugs', () => {
    expect(classifyHost('a.b.campushq.com', options)).toEqual({ kind: 'platform' })
  })

  it('a configured platform host that looks like a slug stays platform', () => {
    expect(classifyHost('app.campushq.com', options)).toEqual({ kind: 'platform' })
  })

  it('anything else is a custom domain', () => {
    expect(classifyHost('www.stmarks.org', options)).toEqual({ kind: 'custom', domain: 'www.stmarks.org' })
  })
})

describe('requestHost', () => {
  it('prefers x-forwarded-host when trusted, first hop only', () => {
    const headers = new Headers({ 'host': 'localhost:3008', 'x-forwarded-host': 'stmarks.campushq.com, localhost:3000' })
    expect(requestHost(headers, { trustProxyHost: true })).toBe('stmarks.campushq.com')
  })

  it('ignores x-forwarded-host when not trusted', () => {
    const headers = new Headers({ 'host': 'stmarks.campushq.com', 'x-forwarded-host': 'evil.example' })
    expect(requestHost(headers, { trustProxyHost: false })).toBe('stmarks.campushq.com')
  })

  it('falls back to host when no forwarded header', () => {
    const headers = new Headers({ host: 'stmarks.campushq.com:443' })
    expect(requestHost(headers, { trustProxyHost: true })).toBe('stmarks.campushq.com')
  })
})

describe('resolveSiteByHost', () => {
  function storeReturning(bySub: SiteContext | null, byDomain: SiteContext | null, counters?: { sub: number, dom: number }): SiteStore {
    return {
      async bySubdomain() {
        if (counters)
          counters.sub++
        return bySub
      },
      async byDomain() {
        if (counters)
          counters.dom++
        return byDomain
      },
    }
  }

  it('resolves a subdomain through the store', async () => {
    clearSiteCache()
    const resolved = await resolveSiteByHost('stmarks.campushq.com', storeReturning(site(), null), options)
    expect(resolved?.id).toBe(7)
  })

  it('resolves a custom domain through the store', async () => {
    clearSiteCache()
    const resolved = await resolveSiteByHost('www.stmarks.org', storeReturning(null, site({ host: 'www.stmarks.org' })), options)
    expect(resolved?.host).toBe('www.stmarks.org')
  })

  it('returns null for platform hosts without touching the store', async () => {
    clearSiteCache()
    const counters = { sub: 0, dom: 0 }
    const resolved = await resolveSiteByHost('www.campushq.com', storeReturning(site(), site(), counters), options)
    expect(resolved).toBeNull()
    expect(counters.sub + counters.dom).toBe(0)
  })

  it('returns null when disabled', async () => {
    clearSiteCache()
    const resolved = await resolveSiteByHost('stmarks.campushq.com', storeReturning(site(), null), { ...options, enabled: false })
    expect(resolved).toBeNull()
  })

  it('caches by host, including negative results', async () => {
    clearSiteCache()
    const counters = { sub: 0, dom: 0 }
    const store = storeReturning(site(), null, counters)
    await resolveSiteByHost('stmarks.campushq.com', store, options)
    await resolveSiteByHost('stmarks.campushq.com', store, options)
    expect(counters.sub).toBe(1)

    await resolveSiteByHost('unknown.stmarks.org', store, options)
    await resolveSiteByHost('unknown.stmarks.org', store, options)
    expect(counters.dom).toBe(1)
  })
})

describe('site context', () => {
  it('is undefined outside any scope', () => {
    expect(currentSite()).toBeUndefined()
    expect(currentSiteId()).toBeUndefined()
  })

  it('flows through runWithSite', () => {
    runWithSite(site(), () => {
      expect(currentSiteId()).toBe(7)
      expect(requireSite().subdomain).toBe('stmarks')
    })
    expect(currentSite()).toBeUndefined()
  })

  it('requireSite throws a 404-status error without a site', () => {
    try {
      runWithSite(null, () => requireSite())
      expect.unreachable('should have thrown')
    }
    catch (error) {
      expect(error).toBeInstanceOf(SiteNotResolvedError)
      expect((error as SiteNotResolvedError).status).toBe(404)
    }
  })
})

describe('forSite', () => {
  function fakeQuery() {
    const calls: unknown[][] = []
    const qb = {
      calls,
      where(...args: unknown[]) {
        calls.push(args)
        return qb
      },
    }
    return qb
  }

  it('scopes to the ambient site', () => {
    runWithSite(site({ id: 42 }), () => {
      const qb = fakeQuery()
      forSite(qb)
      expect(qb.calls).toEqual([['site_id', '=', 42]])
    })
  })

  it('accepts an explicit site id and column', () => {
    const qb = fakeQuery()
    forSite(qb, 'school_site_id', 9)
    expect(qb.calls).toEqual([['school_site_id', '=', 9]])
  })

  it('throws rather than silently returning an unscoped query', () => {
    const qb = fakeQuery()
    expect(() => forSite(qb)).toThrow(SiteNotResolvedError)
    expect(qb.calls).toHaveLength(0)
  })
})

describe('toSiteSnapshot', () => {
  it('carries identity and settings, drops request specifics', () => {
    const snap = toSiteSnapshot(site({ settings: { theme: 'ivy' } }))
    expect(snap).toEqual({ id: 7, uuid: 'uuid-7', name: 'St Marks', subdomain: 'stmarks', settings: { theme: 'ivy' } })
  })

  it('maps null and undefined to null', () => {
    expect(toSiteSnapshot(null)).toBeNull()
    expect(toSiteSnapshot(undefined)).toBeNull()
  })
})
