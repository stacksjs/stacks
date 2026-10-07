import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REQUIRED_SOCIAL_CREDENTIALS, SOCIAL_CREDENTIAL_FIELDS } from '../src/identities'
import { assertPlatformDeclared, driverOptions, DRIVER_DID_FIELD, publishingDriver, toDriverIdentity } from '../src/publish'

/**
 * The join between a resolved credential and the shape a driver reads.
 *
 * Both halves shipped and nothing connected them, so every caller had to know
 * which config field goes in the `did` slot for which platform
 * (stacksjs/stacks#2873). Getting that mapping wrong does not fail: it posts
 * as the wrong author, or to the wrong instance.
 */

const ALL = ['bluesky', 'twitter', 'linkedin', 'mastodon', 'instagram', 'threads'] as const

describe('DRIVER_DID_FIELD', () => {
  it('names a field the platform actually resolves', () => {
    for (const platform of ALL) {
      const field = DRIVER_DID_FIELD[platform]
      if (field)
        expect(SOCIAL_CREDENTIAL_FIELDS[platform], platform).toContain(field)
    }
  })

  it('maps exactly the platforms whose drivers read identity.did', () => {
    // Read off the drivers rather than restated: the four that dereference
    // `identity.did` are the four that need a mapping, and a fifth appearing
    // without one would post with no author.
    const drivers = join(import.meta.dir, '..', 'src', 'drivers')
    const reads = ALL.filter(p => readFileSync(join(drivers, `${p}.ts`), 'utf8').includes('identity.did'))
    const mapped = ALL.filter(p => DRIVER_DID_FIELD[p] !== null)

    // Bluesky reads `identity.did` too, and supplies it from its own session
    // rather than from configuration, so it is read-but-unmapped on purpose.
    expect(reads).toContain('bluesky')
    expect(mapped.sort()).toEqual(['instagram', 'linkedin', 'mastodon', 'threads'])
    for (const platform of mapped)
      expect(reads, platform).toContain(platform)
  })

  it('requires every mapped field, so the slot is never silently empty', () => {
    for (const platform of ALL) {
      const field = DRIVER_DID_FIELD[platform]
      if (field)
        expect(REQUIRED_SOCIAL_CREDENTIALS[platform], platform).toContain(field)
    }
  })
})

describe('toDriverIdentity', () => {
  it('puts each platform\'s second credential in the did slot', () => {
    expect(toDriverIdentity('linkedin', 'stacksjs', { accessToken: 't', memberUrn: 'urn:li:person:abc' }))
      .toEqual({ handle: 'stacksjs', accessToken: 't', did: 'urn:li:person:abc' })

    expect(toDriverIdentity('mastodon', 'stacks', { accessToken: 't', instanceUrl: 'https://fosstodon.org' }))
      .toEqual({ handle: 'stacks', accessToken: 't', did: 'https://fosstodon.org' })

    expect(toDriverIdentity('instagram', 'stacksjs', { accessToken: 't', accountId: '17841400000000000' }))
      .toEqual({ handle: 'stacksjs', accessToken: 't', did: '17841400000000000' })

    expect(toDriverIdentity('threads', 'stacksjs', { accessToken: 't', userId: '98765' }))
      .toEqual({ handle: 'stacksjs', accessToken: 't', did: '98765' })
  })

  it('does not invent a did for the two platforms that do not take one', () => {
    // Twitter scopes by the token alone, and Bluesky's DID comes from the
    // session it mints. A value from configuration in either slot would be a
    // second source of truth.
    expect(toDriverIdentity('twitter', 'stacksjs', { accessToken: 't', refreshToken: 'r' }))
      .toEqual({ handle: 'stacksjs', accessToken: 't', refreshToken: 'r' })
    expect(toDriverIdentity('bluesky', 'stacks.bsky.social', { identifier: 'x', password: 'y' }))
      .toEqual({ handle: 'stacks.bsky.social' })
  })

  it('carries the refresh token when there is one, and omits it when not', () => {
    expect(toDriverIdentity('linkedin', 'h', { accessToken: 't', memberUrn: 'u', refreshToken: 'r' }).refreshToken).toBe('r')
    expect('refreshToken' in toDriverIdentity('linkedin', 'h', { accessToken: 't', memberUrn: 'u' })).toBe(false)
  })

  it('posts without a handle rather than refusing', () => {
    // The handle only ever builds a permalink. An identity that declares none
    // should still post, and get a post with no URL back.
    expect(toDriverIdentity('mastodon', '', { accessToken: 't', instanceUrl: 'https://m.example' }).handle).toBe('')
    expect(toDriverIdentity('mastodon', '  spaced  ', { accessToken: 't', instanceUrl: 'https://m.example' }).handle).toBe('spaced')
  })

  it('leaves an empty credential out rather than passing it through', () => {
    // A driver checks `if (!identity.accessToken)`, so an empty string and an
    // absent field refuse identically. Omitting it keeps the object honest.
    const identity = toDriverIdentity('linkedin', 'h', { accessToken: '', memberUrn: '' })
    expect(identity).toEqual({ handle: 'h' })
  })
})

describe('driverOptions', () => {
  it('passes a self-hosted PDS through for Bluesky', () => {
    expect(driverOptions('bluesky', { service: 'https://pds.example' })).toEqual({ service: 'https://pds.example' })
  })

  it('pins the LinkedIn API version per identity', () => {
    // LinkedIn dates its API and a tenant can be behind, so the driver's own
    // default is one value for every caller (stacksjs/stacks#2859).
    expect(driverOptions('linkedin', { apiVersion: '202501' })).toEqual({ apiVersion: '202501' })
  })

  it('passes nothing it was not given, so the driver keeps its default', () => {
    for (const platform of ALL)
      expect(driverOptions(platform, { accessToken: 't' }), platform).toEqual({})
  })
})

describe('publishingDriver', () => {
  it('builds a driver for every platform, reporting its own provider', () => {
    for (const platform of ALL) {
      const driver = publishingDriver(platform)
      expect(driver.provider, platform).toBe(platform)
      expect(typeof driver.publish, platform).toBe('function')
      expect(driver.characterLimit, platform).toBeGreaterThan(0)
    }
  })

  it('applies the options it is handed', () => {
    const bluesky = publishingDriver('bluesky', { service: 'https://pds.example' }) as unknown as { service: string }
    expect(bluesky.service).toBe('https://pds.example')

    const linkedin = publishingDriver('linkedin', { apiVersion: '202501' }) as unknown as { apiVersion: string }
    expect(linkedin.apiVersion).toBe('202501')
  })

  it('covers every platform the credential type declares', () => {
    // The switch is exhaustive at compile time; this is the runtime half, so
    // a platform added to the type cannot ship with no driver behind it.
    expect(ALL.length).toBe(Object.keys(SOCIAL_CREDENTIAL_FIELDS).length)
  })
})

describe('assertPlatformDeclared', () => {
  it('allows a platform the identity lists', () => {
    expect(() => assertPlatformDeclared('stacks', 'bluesky', ['bluesky', 'twitter'])).not.toThrow()
  })

  it('refuses one it does not, and says what is listed', () => {
    expect(() => assertPlatformDeclared('stacks', 'mastodon', ['bluesky', 'twitter']))
      .toThrow("Identity 'stacks' is not set up for mastodon. config/socials.ts lists: bluesky, twitter.")
  })

  it('refuses everything for an identity that lists an empty set', () => {
    // `platforms: []` is a deliberate statement that this identity posts
    // nowhere, which is different from not saying.
    expect(() => assertPlatformDeclared('stacks', 'bluesky', [])).toThrow('lists: none')
  })

  it('leaves an identity that declares no platforms unconstrained', () => {
    // What an app with one identity and no list means. The credential
    // resolver still refuses a platform with nothing configured, so this is
    // not a hole.
    for (const platform of ALL)
      expect(() => assertPlatformDeclared('stacks', platform, undefined)).not.toThrow()
  })
})
