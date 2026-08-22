import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { config, overridesReady } from '@stacksjs/config'
import { AppleProvider, GoogleProvider } from '../src/drivers'
import {
  configuredSocialProviders,
  isSocialProviderConfigured,
  isSocialProviderName,
  SOCIAL_PROVIDERS,
  socialProvider,
} from '../src/registry'

/**
 * Regression focus: Apple has no clientSecret. Before the registry existed
 * every caller gated providers on `clientId && clientSecret`, so a fully
 * configured Apple was classified as absent and Sign in with Apple could
 * never be offered.
 */

let original: Record<string, any> = {}

/**
 * Wait for the project's own config to land before touching anything.
 *
 * `overridesReady` loads every `~/config/*.ts` in the background and assigns
 * the result over `overrides[key]` - a replacement, not a merge. So a suite
 * that writes `config.services` while that is still in flight has its write
 * thrown away the moment `config/services.ts` resolves, and the failure lands
 * on whichever assertion happened to run after it. Awaiting once here removes
 * the window rather than narrowing it.
 */
beforeAll(async () => {
  await overridesReady.catch(() => undefined)
  original = { ...((config as any).services ?? {}) }
})

/**
 * Replace the services block, by assigning to `config` rather than by mutating
 * the object it hands back.
 *
 * This used to capture `config.services` once and mutate that object in place,
 * and it passed everywhere except CI. `config` is a Proxy whose `get` returns
 * `overrides[prop]` when that is a non-empty object and `defaults[prop]`
 * otherwise - so the object handed back is one of *two* objects, and which one
 * depends on whether the project's `config/*.ts` files have finished loading.
 * Capturing it binds the test to whichever half happened to win at import time;
 * when the other half became authoritative mid-run, every mutation the test had
 * made was on the object nobody was reading, and each assertion expecting a
 * configured provider failed while each expecting an unconfigured one passed.
 *
 * Assigning goes through the `set` trap, which writes into `overrides` - the
 * half `readMerged` prefers - so what is written is what is read.
 *
 * `setServices({})` is the one case that still falls through to `defaults`,
 * because an empty object is exactly what `readMerged` treats as unset. That is
 * the intended reading here: the framework defaults declare the same providers
 * with blank credentials, so nothing is configured either way.
 */
function setServices(next: Record<string, any>): void {
  ;(config as any).services = { ...next }
}

const APPLE = {
  clientId: 'org.example.web',
  teamId: 'TEAM123456',
  keyId: 'KEY1234567',
  privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  redirectUrl: 'https://example.com/api/auth/apple/callback',
}

const GOOGLE = {
  clientId: 'google-client',
  clientSecret: 'google-secret',
  redirectUrl: 'https://example.com/api/auth/google/callback',
}

afterEach(() => setServices(original))

describe('isSocialProviderName', () => {
  test('accepts the drivable providers', () => {
    for (const name of Object.keys(SOCIAL_PROVIDERS))
      expect(isSocialProviderName(name)).toBe(true)
  })

  test('rejects anything else', () => {
    for (const value of ['mastodon', 'nope', '', null, undefined, 42, {}])
      expect(isSocialProviderName(value)).toBe(false)
  })
})

describe('isSocialProviderConfigured', () => {
  test('treats a fully configured Apple as configured, with no clientSecret', () => {
    setServices({ apple: APPLE })
    expect(APPLE).not.toHaveProperty('clientSecret')
    expect(isSocialProviderConfigured('apple')).toBe(true)
  })

  test('requires every Apple signing field', () => {
    for (const missing of ['clientId', 'teamId', 'keyId', 'privateKey', 'redirectUrl']) {
      const partial: Record<string, string> = { ...APPLE }
      delete partial[missing]
      setServices({ apple: partial })
      expect(isSocialProviderConfigured('apple')).toBe(false)
    }
  })

  test('requires a clientSecret for the OAuth2 providers', () => {
    setServices({ google: { ...GOOGLE, clientSecret: '' } })
    expect(isSocialProviderConfigured('google')).toBe(false)

    setServices({ google: GOOGLE })
    expect(isSocialProviderConfigured('google')).toBe(true)
  })

  test('an absent or unknown provider is simply not configured, never a throw', () => {
    setServices({})
    expect(isSocialProviderConfigured('google')).toBe(false)
    expect(isSocialProviderConfigured('mastodon')).toBe(false)
    expect(isSocialProviderConfigured(undefined)).toBe(false)
  })
})

describe('configuredSocialProviders', () => {
  test('returns only the providers that would complete a sign-in', () => {
    setServices({ apple: APPLE, google: GOOGLE, github: { clientId: 'gh' } })
    expect(configuredSocialProviders().map(p => p.name).sort()).toEqual(['apple', 'google'])
  })

  test('is empty when nothing is configured', () => {
    setServices({})
    expect(configuredSocialProviders()).toEqual([])
  })

  test('carries a label and the callback method each provider needs', () => {
    setServices({ apple: APPLE, google: GOOGLE })
    const byName = Object.fromEntries(configuredSocialProviders().map(p => [p.name, p]))

    expect(byName.apple.label).toBe('Apple')
    // Apple mandates response_mode=form_post, so its callback is a POST.
    expect(byName.apple.postCallback).toBe(true)
    expect(byName.google.postCallback).toBe(false)
  })
})

describe('socialProvider', () => {
  test('builds Apple with its signing fields rather than dropping them', () => {
    setServices({ apple: APPLE })
    const provider = socialProvider('apple') as any

    expect(provider).toBeInstanceOf(AppleProvider)
    expect(provider.teamId).toBe(APPLE.teamId)
    expect(provider.keyId).toBe(APPLE.keyId)
    expect(provider.privateKey).toBe(APPLE.privateKey)
  })

  test('builds an OAuth2 provider from its own block', () => {
    setServices({ google: GOOGLE })
    const provider = socialProvider('google') as any

    expect(provider).toBeInstanceOf(GoogleProvider)
    expect(provider.clientId).toBe(GOOGLE.clientId)
    expect(provider.clientSecret).toBe(GOOGLE.clientSecret)
  })

  test('returns null for an unconfigured or unknown provider', () => {
    setServices({ apple: { clientId: 'org.example.web' } })
    expect(socialProvider('apple')).toBeNull()
    expect(socialProvider('google')).toBeNull()
    expect(socialProvider('nope')).toBeNull()
  })
})
