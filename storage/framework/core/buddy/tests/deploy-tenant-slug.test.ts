import { describe, expect, it } from 'bun:test'

/**
 * Tenant slug collisions on a shared box.
 *
 * A tenant's slug names the files its deploy OWNS: the rpx gateway fragment
 * `/etc/rpx/sites.d/<slug>.json` and its per-tenant cert units. The fragment is
 * replaced wholesale, and it carries the gateway's global TLS block as well as
 * that project's routes.
 *
 * So a tenant whose slug matches the box owner's rewrites the owner's fragment:
 * every one of the owner's routes replaced by the tenant's single route, and
 * TLS broken for every domain on the box. That is not hypothetical — a
 * storefront that kept the template's default slug ('stacks') took stacksjs.com
 * down exactly this way, along with the other tenants' HTTPS.
 *
 * These cover the decision itself. The guard's two halves are: refuse when the
 * slug equals the attach target, and refuse when the fragment already on the
 * box serves domains this project does not declare.
 */

/** The slug-equality half of the guard. */
function collidesWithOwner(slug: string, attachTo: string): boolean {
  return slug === attachTo
}

/**
 * The fragment-ownership half: which domains would be dropped by writing our
 * fragment over the one already there.
 */
function orphanedDomains(existing: string[], declared: string[]): string[] {
  const ours = new Set(declared.map(d => d.toLowerCase()))
  return existing
    .map(d => d.toLowerCase())
    .filter(domain => !ours.has(domain) && !ours.has(domain.replace(/^www\./, '')))
}

describe('tenant slug vs box owner', () => {
  it('refuses the exact collision that caused the outage', () => {
    expect(collidesWithOwner('stacks', 'stacks')).toBe(true)
  })

  it('allows a tenant that named itself', () => {
    expect(collidesWithOwner('erbamarkets', 'stacks')).toBe(false)
    expect(collidesWithOwner('openfarming', 'stacks')).toBe(false)
  })
})

describe('fragment ownership', () => {
  it('flags the owner routes a colliding deploy would delete', () => {
    // What actually happened: erbamarkets declared one domain and the fragment
    // it was about to replace served all of stacksjs.com's.
    const existing = ['stacksjs.com', 'www.stacksjs.com', 'dashboard.stacksjs.com']
    const declared = ['erba.stacksjs.com']

    expect(orphanedDomains(existing, declared)).toEqual([
      'stacksjs.com',
      'www.stacksjs.com',
      'dashboard.stacksjs.com',
    ])
  })

  it('is silent on a redeploy of the same project', () => {
    const existing = ['openfarm.ing', 'www.openfarm.ing']
    const declared = ['openfarm.ing', 'www.openfarm.ing']

    expect(orphanedDomains(existing, declared)).toEqual([])
  })

  it('treats a www record as covered by its apex', () => {
    // A tenant declares the apex and the deploy adds www itself, so a www-only
    // difference is not somebody else's domain.
    expect(orphanedDomains(['www.erba.stacksjs.com'], ['erba.stacksjs.com'])).toEqual([])
  })

  it('is silent on a first deploy, where nothing is there yet', () => {
    expect(orphanedDomains([], ['erba.stacksjs.com'])).toEqual([])
  })

  it('compares case-insensitively', () => {
    expect(orphanedDomains(['StacksJS.com'], ['erba.stacksjs.com'])).toEqual(['stacksjs.com'])
  })
})
