import { describe, expect, it } from 'bun:test'
import {
  envName,
  envSegment,
  pickCredentials,
  pickIdentity,
  resolveSocialCredentials,
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
