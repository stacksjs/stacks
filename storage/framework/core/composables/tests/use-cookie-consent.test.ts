import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { emptyCategories, parseDecision, useCookieConsent } from '../src/useCookieConsent'

/**
 * Cookie consent (stacksjs/stacks#365).
 *
 * The assertions that matter are the ones about the DEFAULT, because that is
 * where consent implementations fail an audit: anything other than "declined
 * until told otherwise" is wrong, and it is wrong silently.
 */

const KEY = 'test:consent'

/** A localStorage stand-in, since the suite has no DOM. */
function installStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial))
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
  return store
}

beforeEach(() => { installStorage() })
afterEach(() => { delete (globalThis as any).localStorage })

describe('defaults', () => {
  it('declines everything optional until the visitor decides', () => {
    const consent = useCookieConsent({ storageKey: KEY })

    expect(consent.needsDecision.value).toBeTrue()
    expect(consent.allows('analytics')).toBeFalse()
    expect(consent.allows('marketing')).toBeFalse()
    expect(consent.allows('preferences')).toBeFalse()
  })

  it('always allows necessary, decided or not', () => {
    const consent = useCookieConsent({ storageKey: KEY })
    expect(consent.allows('necessary')).toBeTrue()

    consent.declineAll()
    expect(consent.allows('necessary')).toBeTrue()
  })

  it('has no way to ask for a permissive default', () => {
    // `emptyCategories()` is the only starting point, and it is the safe one.
    expect(emptyCategories()).toEqual({
      necessary: true, preferences: false, analytics: false, marketing: false,
    })
  })
})

describe('deciding', () => {
  it('allows only what was accepted', () => {
    const consent = useCookieConsent({ storageKey: KEY })
    consent.accept(['analytics'])

    expect(consent.allows('analytics')).toBeTrue()
    expect(consent.allows('marketing')).toBeFalse()
    expect(consent.needsDecision.value).toBeFalse()
  })

  it('forces necessary true even if a caller passes it as false', () => {
    // Otherwise the rest of the app has to special-case a decision that
    // declines the category which cannot be declined.
    const consent = useCookieConsent({ storageKey: KEY })
    const decided = consent.accept([])
    expect(decided.categories.necessary).toBeTrue()
  })

  it('replaces rather than merges, so a second choice can narrow the first', () => {
    const consent = useCookieConsent({ storageKey: KEY })
    consent.acceptAll()
    consent.accept(['analytics'])

    expect(consent.allows('analytics')).toBeTrue()
    expect(consent.allows('marketing')).toBeFalse()
  })

  it('withdraw forgets the decision and asks again', () => {
    const store = installStorage()
    const consent = useCookieConsent({ storageKey: KEY })
    consent.acceptAll()
    expect(store.has(KEY)).toBeTrue()

    consent.withdraw()
    expect(consent.needsDecision.value).toBeTrue()
    expect(consent.allows('analytics')).toBeFalse()
    expect(store.has(KEY)).toBeFalse()
  })
})

describe('persistence', () => {
  it('restores a stored decision', () => {
    installStorage()
    useCookieConsent({ storageKey: KEY }).accept(['analytics'])

    const revisit = useCookieConsent({ storageKey: KEY })
    expect(revisit.needsDecision.value).toBeFalse()
    expect(revisit.allows('analytics')).toBeTrue()
  })

  it('fires onChange for a decision loaded from storage', () => {
    // The scripts a category gates have to load on a RETURN visit too, not
    // only on the visit that consented.
    installStorage()
    useCookieConsent({ storageKey: KEY }).acceptAll()

    let seen: unknown = 'not called'
    useCookieConsent({ storageKey: KEY, onChange: d => { seen = d } })
    expect((seen as any)?.categories?.analytics).toBeTrue()
  })

  it('re-asks when the policy version changes', () => {
    // Consent to a previous policy is not consent to this one.
    installStorage()
    useCookieConsent({ storageKey: KEY, policyVersion: '1.0' }).acceptAll()

    const afterUpdate = useCookieConsent({ storageKey: KEY, policyVersion: '2.0' })
    expect(afterUpdate.needsDecision.value).toBeTrue()
    expect(afterUpdate.allows('analytics')).toBeFalse()
  })

  it('treats blocked storage as undecided rather than throwing', () => {
    ;(globalThis as any).localStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }

    const consent = useCookieConsent({ storageKey: KEY })
    expect(consent.needsDecision.value).toBeTrue()
    // The decision still applies to this page even though it cannot persist.
    expect(() => consent.acceptAll()).not.toThrow()
    expect(consent.allows('analytics')).toBeTrue()
  })
})

describe('parseDecision', () => {
  it('rejects anything it cannot fully trust', () => {
    for (const raw of [null, '', 'not json', '[]', '"a string"', '{}', '{"categories":{}}'])
      expect(parseDecision(raw, '1.0')).toBeNull()
  })

  it('rejects a decision given under another policy version', () => {
    const stored = JSON.stringify({
      categories: { necessary: true, analytics: true },
      policyVersion: '1.0',
      decidedAt: new Date().toISOString(),
    })
    expect(parseDecision(stored, '2.0')).toBeNull()
  })

  it('rebuilds categories from a known base, so storage cannot invent one', () => {
    const stored = JSON.stringify({
      categories: { necessary: true, analytics: true, sneaky: true },
      policyVersion: '1.0',
      decidedAt: new Date().toISOString(),
    })

    const parsed = parseDecision(stored, '1.0')!
    expect(Object.keys(parsed.categories).sort()).toEqual(['analytics', 'marketing', 'necessary', 'preferences'])
    expect(parsed.categories.analytics).toBeTrue()
  })

  it('reads a missing category as declined, not undefined', () => {
    const stored = JSON.stringify({
      categories: { necessary: true },
      policyVersion: '1.0',
      decidedAt: new Date().toISOString(),
    })
    expect(parseDecision(stored, '1.0')!.categories.marketing).toBeFalse()
  })

  it('only accepts a literal true, not a truthy value', () => {
    const stored = JSON.stringify({
      categories: { necessary: true, analytics: 'yes' },
      policyVersion: '1.0',
      decidedAt: new Date().toISOString(),
    })
    expect(parseDecision(stored, '1.0')!.categories.analytics).toBeFalse()
  })
})
