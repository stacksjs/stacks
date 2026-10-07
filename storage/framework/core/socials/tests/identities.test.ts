import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  envName,
  envSegment,
  pickCredentials,
  pickIdentity,
  REQUIRED_SOCIAL_CREDENTIALS,
  resolveSocialCredentials,
  SOCIAL_CREDENTIAL_FIELDS,
  SocialIdentityError,
} from '../src/identities'
import type { SocialsShape } from '../src/identities'

/**
 * Where a social credential comes from.
 *
 * Six publishing drivers shipped before there was anywhere to declare their
 * credentials, so each was passed in per call and every application invented
 * its own convention (stacksjs/stacks#2873). Identities are named because one
 * application speaks as more than one account, and the thing that must never
 * happen is posting as the wrong one.
 */

const TWO: SocialsShape = {
  identities: {
    'stacks': { platforms: ['bluesky', 'twitter'] },
    'home-lang': { platforms: ['bluesky'] },
  },
}

describe('envSegment', () => {
  it('drops punctuation rather than replacing it', () => {
    // `HOME_LANG_BLUESKY_...` cannot be told apart from an identity called
    // `home` on a platform called `lang`, which is why this is not `_`.
    expect(envSegment('home-lang')).toBe('HOMELANG')
    expect(envSegment('stacks')).toBe('STACKS')
    expect(envSegment('The Open Times')).toBe('THEOPENTIMES')
  })
})

describe('envName', () => {
  it('spells the variable an operator has to set', () => {
    expect(envName('stacks', 'bluesky', 'password')).toBe('SOCIALS_STACKS_BLUESKY_PASSWORD')
    expect(envName('home-lang', 'twitter', 'clientId')).toBe('SOCIALS_HOMELANG_TWITTER_CLIENT_ID')
    expect(envName('stacks', 'twitter', 'refreshToken')).toBe('SOCIALS_STACKS_TWITTER_REFRESH_TOKEN')
  })
})

describe('pickIdentity', () => {
  it('takes the named one', () => {
    expect(pickIdentity(TWO, 'home-lang')).toBe('home-lang')
  })

  it('refuses an unknown name, and says what is declared', () => {
    expect(() => pickIdentity(TWO, 'postline')).toThrow(/Unknown social identity 'postline'.*stacks, home-lang/)
  })

  it('refuses to choose when several are configured and none is named', () => {
    // The whole reason identities are named: picking one by position here
    // would post as an account the caller did not ask for.
    expect(() => pickIdentity(TWO)).toThrow(/2 identities .* and no default/)
  })

  it('takes the only one when there is only one', () => {
    expect(pickIdentity({ identities: { stacks: {} } })).toBe('stacks')
  })

  it('uses the default when one is set', () => {
    expect(pickIdentity({ ...TWO, default: 'stacks' })).toBe('stacks')
  })

  it('refuses a default that is not one of the identities', () => {
    expect(() => pickIdentity({ ...TWO, default: 'typo' })).toThrow(/default: 'typo'.*not one of/)
  })

  it('says so when nothing is configured at all', () => {
    expect(() => pickIdentity({})).toThrow(/declares no identities/)
  })
})

describe('pickCredentials', () => {
  const env = {
    SOCIALS_STACKS_BLUESKY_IDENTIFIER: 'stacks.bsky.social',
    SOCIALS_STACKS_BLUESKY_PASSWORD: 'abcd-efgh-ijkl-mnop',
    SOCIALS_HOMELANG_BLUESKY_IDENTIFIER: 'home.bsky.social',
    SOCIALS_HOMELANG_BLUESKY_PASSWORD: 'qrst-uvwx-yzab-cdef',
  }

  it('reads the convention, per identity', () => {
    expect(pickCredentials(TWO, 'bluesky', 'stacks', env)).toEqual({
      identifier: 'stacks.bsky.social',
      password: 'abcd-efgh-ijkl-mnop',
    })
    expect(pickCredentials(TWO, 'bluesky', 'home-lang', env)).toEqual({
      identifier: 'home.bsky.social',
      password: 'qrst-uvwx-yzab-cdef',
    })
  })

  it('keeps the two identities apart', () => {
    // The failure this guards against is one identity falling back to
    // another's credentials, which would post to the wrong account and look
    // like it worked.
    const stacks = pickCredentials(TWO, 'bluesky', 'stacks', env)
    const home = pickCredentials(TWO, 'bluesky', 'home-lang', env)
    expect(stacks.password).not.toBe(home.password)
  })

  it('omits an optional field rather than setting it empty', () => {
    expect(pickCredentials(TWO, 'bluesky', 'stacks', env)).not.toHaveProperty('service')
  })

  it('trims, so a trailing newline in an env file is not part of the secret', () => {
    const padded = { ...env, SOCIALS_STACKS_BLUESKY_PASSWORD: '  abcd-efgh  \n' }
    expect(pickCredentials(TWO, 'bluesky', 'stacks', padded).password).toBe('abcd-efgh')
  })

  it('lets an inline credential win over the environment', () => {
    const inline: SocialsShape = {
      identities: {
        stacks: { credentials: { bluesky: { identifier: 'from.config', password: 'from-config' } } },
      },
    }
    expect(pickCredentials(inline, 'bluesky', 'stacks', env)).toEqual({
      identifier: 'from.config',
      password: 'from-config',
    })
  })

  it('names the variables to set when a credential is missing', () => {
    try {
      pickCredentials(TWO, 'twitter', 'stacks', env)
      throw new Error('expected pickCredentials to throw')
    }
    catch (error) {
      const message = (error as Error).message
      expect(error).toBeInstanceOf(SocialIdentityError)
      expect(message).toContain('SOCIALS_STACKS_TWITTER_CLIENT_ID')
      expect(message).toContain('SOCIALS_STACKS_TWITTER_ACCESS_TOKEN')
      expect(message).toContain('not configured for twitter')
    }
  })

  it('never puts a credential value in the error', () => {
    // The message is meant to be pasteable into an issue, so a partial
    // configuration must not leak the half that was found.
    const partial = { SOCIALS_STACKS_TWITTER_CLIENT_SECRET: 'super-secret-value' }
    try {
      pickCredentials(TWO, 'twitter', 'stacks', partial)
      throw new Error('expected pickCredentials to throw')
    }
    catch (error) {
      expect((error as Error).message).not.toContain('super-secret-value')
    }
  })
})

describe('the async entry', () => {
  it('delegates to the resolver rather than reimplementing it', async () => {
    // The helper being correct while the public path never reaches it is a
    // shape this repository has shipped more than once, so the async entry is
    // exercised too. Which identities it can see depends on the working
    // directory the test runs from, so this asserts the delegation rather than
    // a particular identity: that whether `config/socials.ts` is actually
    // loaded is guarded in the config package, next to the allowlist that
    // decides it.
    await expect(resolveSocialCredentials('bluesky', 'not-a-brand', {})).rejects.toBeInstanceOf(SocialIdentityError)
    await expect(resolveSocialCredentials('bluesky', 'not-a-brand', {})).rejects.toThrow(/config\/socials\.ts/)
  })
})

/**
 * The credential tables held against the drivers they describe.
 *
 * `SOCIAL_CREDENTIAL_FIELDS` and `REQUIRED_SOCIAL_CREDENTIALS` are the claim
 * that a platform's credentials are complete. A claim nothing checks is a
 * comment, and these were written by reading six drivers: the chance of one
 * being wrong is the whole reason for this block.
 */
describe('the credential tables describe the real drivers', () => {
  const drivers = join(import.meta.dir, '..', 'src', 'drivers')
  const source = (platform: string) => readFileSync(join(drivers, `${platform}.ts`), 'utf8')

  /** `publish()` onwards, which is where a missing credential is refused. */
  function publishBody(platform: string): string {
    const text = source(platform)
    const at = text.indexOf('async publish(')
    expect(at, `${platform}.ts must have a publish()`).toBeGreaterThan(-1)
    return text.slice(at)
  }

  const ALL = ['bluesky', 'twitter', 'linkedin', 'mastodon', 'instagram', 'threads'] as const

  it('covers every driver that ships, and nothing that does not', () => {
    expect(Object.keys(SOCIAL_CREDENTIAL_FIELDS).sort()).toEqual([...ALL].sort())
    expect(Object.keys(REQUIRED_SOCIAL_CREDENTIALS).sort()).toEqual([...ALL].sort())
  })

  it('requires only fields it also reads', () => {
    for (const platform of ALL) {
      for (const field of REQUIRED_SOCIAL_CREDENTIALS[platform])
        expect(SOCIAL_CREDENTIAL_FIELDS[platform], platform).toContain(field)
    }
  })

  it('every field name spells a legal environment variable', () => {
    // `memberUrn` has to reach SOCIALS_STACKS_LINKEDIN_MEMBER_URN. A field
    // whose name does not survive the conversion is a credential an operator
    // cannot set.
    for (const platform of ALL) {
      for (const field of SOCIAL_CREDENTIAL_FIELDS[platform])
        expect(envName('stacks', platform, field)).toMatch(/^SOCIALS_STACKS_[A-Z]+(?:_[A-Z0-9]+)+$/)
    }
  })

  it('names the second credential each token-based driver refuses without', () => {
    // Four drivers read a second value out of `identity.did`: a token alone
    // does not say where or as whom to post. Required alongside the token
    // because each driver throws without it, which is the only authority on
    // the matter.
    //
    // Scanned over the whole driver rather than the publish body: Mastodon
    // reads `identity.did` in an `instanceOf()` helper declared above
    // `publish`, and a narrower scan reported that as the field not being
    // read at all.
    for (const [platform, field, refusal] of [
      ['linkedin', 'memberUrn', 'member URN is required'],
      ['mastodon', 'instanceUrl', 'instance URL is required'],
      ['instagram', 'accountId', 'account id is required'],
      ['threads', 'userId', 'account id is required'],
    ] as const) {
      expect(source(platform), platform).toContain('identity.did')
      expect(source(platform), platform).toContain(refusal)
      expect(REQUIRED_SOCIAL_CREDENTIALS[platform], platform).toContain(field)
      expect(REQUIRED_SOCIAL_CREDENTIALS[platform], platform).toContain('accessToken')
      // And the token itself is refused in `publish`, not merely read.
      expect(publishBody(platform), platform).toMatch(/accessToken|tokenOf\(identity\)/)
    }
  })

  it('does not require a refresh credential to post', () => {
    // An identity holding a live access token posts without the client id and
    // secret, which exist to renew it. Requiring them would refuse a working
    // configuration.
    for (const platform of ['linkedin', 'instagram', 'threads'] as const) {
      expect(SOCIAL_CREDENTIAL_FIELDS[platform], platform).toContain('clientId')
      expect(REQUIRED_SOCIAL_CREDENTIALS[platform], platform).not.toContain('clientId')
      expect(REQUIRED_SOCIAL_CREDENTIALS[platform], platform).not.toContain('clientSecret')
    }
  })

  it('asks Bluesky for an app password rather than a token', () => {
    // The only platform here whose driver mints its own session, so there is
    // nothing short-lived to store and `accessToken` would be the wrong thing
    // to ask an operator for.
    expect(REQUIRED_SOCIAL_CREDENTIALS.bluesky).toEqual(['identifier', 'password'])
    expect(SOCIAL_CREDENTIAL_FIELDS.bluesky).not.toContain('accessToken')
    expect(source('bluesky')).toContain('com.atproto.server.createSession')
  })

  it('resolves each platform from its own variables', () => {
    const one: SocialsShape = { identities: { stacks: {} } }
    const env: Record<string, string> = {}
    for (const platform of ALL) {
      for (const field of SOCIAL_CREDENTIAL_FIELDS[platform])
        env[envName('stacks', platform, field)] = `${platform}-${field}`
    }

    for (const platform of ALL) {
      const resolved = pickCredentials(one, platform, 'stacks', env) as Record<string, string>
      for (const field of SOCIAL_CREDENTIAL_FIELDS[platform])
        expect(resolved[field], `${platform}.${field}`).toBe(`${platform}-${field}`)
    }
  })

  it('names what is missing for every platform, and never a value', () => {
    const one: SocialsShape = { identities: { stacks: {} } }
    for (const platform of ALL) {
      let message = ''
      try {
        pickCredentials(one, platform, 'stacks', {})
      }
      catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
      expect(message, platform).toContain(platform)
      for (const field of REQUIRED_SOCIAL_CREDENTIALS[platform])
        expect(message, `${platform}.${field}`).toContain(envName('stacks', platform, field))
    }
  })
})
