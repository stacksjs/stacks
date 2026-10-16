import { describe, expect, it } from 'bun:test'
import { services } from '@stacksjs/config'
import { describeStripeAvailability, isStripeConfigured, reportStripeAvailability, stripeAvailability } from '../src/drivers/stripe'

/**
 * stacksjs/stacks#2911 — `stripe` is an optional peer, which Bun does not
 * install, so an app can have a perfectly good secret key and a tree with no
 * SDK in it. `isStripeConfigured()` checked only the key and answered `true`
 * there, which is the one answer that makes it useless: the reason to ask is
 * to find that out.
 */

function withKey<T>(value: string | undefined, run: () => T): T {
  if (!services.stripe)
    throw new Error('Stripe service configuration is missing')

  const original = services.stripe.secretKey
  try {
    services.stripe.secretKey = value as string
    return run()
  }
  finally {
    services.stripe.secretKey = original
  }
}

describe('stripeAvailability', () => {
  it('reports the key and the SDK separately', () => {
    const available = withKey('sk_test_configured', stripeAvailability)
    expect(available).toEqual({ key: true, sdk: expect.any(Boolean) })
    // This repository has the SDK, so the two halves are distinguishable here.
    expect(available.sdk).toBe(true)
  })

  it('does not call a blank or whitespace key configured', () => {
    expect(withKey('', stripeAvailability).key).toBe(false)
    expect(withKey('   ', stripeAvailability).key).toBe(false)
  })
})

describe('isStripeConfigured', () => {
  it('needs both halves, not just the key', () => {
    expect(withKey('sk_test_configured', isStripeConfigured)).toBe(true)
    expect(withKey('', isStripeConfigured)).toBe(false)
  })
})

describe('describeStripeAvailability', () => {
  it('says nothing when Stripe is usable', () => {
    expect(describeStripeAvailability({ key: true, sdk: true })).toBeNull()
  })

  it('names the missing SDK, and how to fix it where it is fixed', () => {
    const reason = describeStripeAvailability({ key: true, sdk: false })!
    expect(reason).toContain('`stripe` package is not installed')
    expect(reason).toContain('bun add stripe')
    expect(reason).not.toContain('STRIPE_SECRET_KEY')
  })

  it('names the missing key', () => {
    const reason = describeStripeAvailability({ key: false, sdk: true })!
    expect(reason).toContain('STRIPE_SECRET_KEY')
    expect(reason).not.toContain('bun add stripe')
  })

  it('names BOTH when both are missing, so the fix is not two deploys', () => {
    // The old proxy checked the key first and stopped there, so an app with
    // neither was told to set STRIPE_SECRET_KEY, and setting it produced a
    // different error.
    const reason = describeStripeAvailability({ key: false, sdk: false })!
    expect(reason).toContain('`stripe` package is not installed')
    expect(reason).toContain('STRIPE_SECRET_KEY')
  })
})

describe('reportStripeAvailability', () => {
  /** Collect what it would have warned, instead of printing it. */
  function reportOn(available: { key: boolean, sdk: boolean }): { reported: string | null, lines: string[] } {
    const lines: string[] = []
    const reported = reportStripeAvailability({ available, warn: message => void lines.push(message) })
    return { reported, lines }
  }

  it('warns when a key is configured and the SDK is missing', () => {
    const { reported, lines } = reportOn({ key: true, sdk: false })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('[stacks]')
    expect(lines[0]).toContain('`stripe` package is not installed')
    // Returned as well as warned, so an entry point can log it its own way.
    expect(reported).toBe(lines[0]!.replace('[stacks] ', ''))
  })

  it('says nothing when Stripe is usable', () => {
    expect(reportOn({ key: true, sdk: true })).toEqual({ reported: null, lines: [] })
  })

  it('says nothing when no key is configured, because the app is not using Stripe', () => {
    // A missing key alone is ordinary in development, and on an app that
    // never chose a payment driver. Warning on it would train people to
    // ignore the line that matters.
    expect(reportOn({ key: false, sdk: false })).toEqual({ reported: null, lines: [] })
    expect(reportOn({ key: false, sdk: true })).toEqual({ reported: null, lines: [] })
  })

  it('reads this process when given nothing to report on', () => {
    // The SDK is present here, so a configured key is usable and silent.
    expect(withKey('sk_test_configured', () => reportStripeAvailability({ warn: () => {} }))).toBeNull()
  })
})
