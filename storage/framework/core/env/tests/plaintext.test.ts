/**
 * stacksjs/stacks#2241 — Stacks encrypts `.env.<environment>` in place and
 * un-ignores those files so they can be committed. The failure mode is that a
 * value which was never encrypted looks exactly like one that was, and nothing
 * in the toolchain read the difference.
 *
 * It happened here: `.env.production` carried three per-mailbox SMTP passwords
 * and the coming-soon bypass secret in plaintext on a public repository. They
 * were removed in a57c8ed69b (#2211) — note that the commit which *documents*
 * the removal, d3251810ca, is empty; the diff rode along inside its parent.
 *
 * The bar these tests hold the heuristic to: catch all four of those, and flag
 * nothing in the repository as it stands.
 */

import { describe, expect, it } from 'bun:test'
import { isEncryptedValue, plaintextSecrets, SECRET_NAME_PATTERN, trackedEnvFiles } from '../src/plaintext'

describe('isEncryptedValue', () => {
  it('recognises both envelope spellings', () => {
    expect(isEncryptedValue('encrypted:v2:abc')).toBe(true)
    expect(isEncryptedValue('encrypted:abc')).toBe(true)
    expect(isEncryptedValue('enc:abc')).toBe(true)
  })

  it('rejects plaintext and non-strings', () => {
    expect(isEncryptedValue('hunter2')).toBe(false)
    expect(isEncryptedValue('')).toBe(false)
    expect(isEncryptedValue(undefined)).toBe(false)
    expect(isEncryptedValue(null)).toBe(false)
    // Not a prefix — a value that merely mentions the word.
    expect(isEncryptedValue('this is encrypted:ish')).toBe(false)
  })
})

describe('plaintextSecrets', () => {
  it('flags the four secrets from the real incident', () => {
    const leaked = {
      MAIL_PASSWORD_CHRIS: 'a-real-password',
      MAIL_PASSWORD_BLAKE: 'another-one',
      MAIL_PASSWORD_GLENN: 'a-third',
      APP_COMING_SOON_SECRET: 'trailhead',
    }

    expect(plaintextSecrets(leaked).map(f => f.key).sort()).toEqual([
      'APP_COMING_SOON_SECRET',
      'MAIL_PASSWORD_BLAKE',
      'MAIL_PASSWORD_CHRIS',
      'MAIL_PASSWORD_GLENN',
    ])
  })

  it('never carries the value, only the key', () => {
    // A report that quotes the secret writes it into CI logs and terminal
    // scrollback, which is the thing being prevented.
    const findings = plaintextSecrets({ API_SECRET: 'super-secret-value' })

    expect(JSON.stringify(findings)).not.toContain('super-secret-value')
    expect(findings[0]).toEqual({ key: 'API_SECRET', reason: 'plaintext-secret' })
  })

  it('ignores ordinary non-secret configuration', () => {
    // The reason "every value must be encrypted" is unusable: these are the
    // bulk of a real .env.production and none of them is a secret.
    const ordinary = {
      APP_NAME: 'Stacks',
      APP_ENV: 'production',
      APP_URL: 'https://example.com',
      DB_HOST: '127.0.0.1',
      MAIL_HOST: '127.0.0.1',
      DB_PORT: '5432',
    }

    expect(plaintextSecrets(ordinary)).toEqual([])
  })

  it('ignores values that are already encrypted', () => {
    expect(plaintextSecrets({ MAIL_PASSWORD: 'encrypted:v2:abc', API_TOKEN: 'enc:xyz' })).toEqual([])
  })

  it('ignores the dotenvx keypair metadata', () => {
    // Both match the `_KEY` pattern; the public half is public by definition
    // and the private half is never committed.
    expect(plaintextSecrets({
      DOTENV_PUBLIC_KEY: '03abc...',
      DOTENV_PUBLIC_KEY_PRODUCTION: '03def...',
      DOTENV_PRIVATE_KEY_PRODUCTION: 'aabb...',
    })).toEqual([])
  })

  it('ignores empty values and `${VAR}` expansions', () => {
    expect(plaintextSecrets({ API_SECRET: '', DB_PASSWORD: '   ', APP_TOKEN: '${OTHER_TOKEN}' })).toEqual([])
  })

  describe('placeholder rule', () => {
    const example = { MAIL_PASSWORD: 'null', MEILISEARCH_KEY: 'masterKey' }

    it('treats a value identical to .env.example as a documented placeholder', () => {
      // This is what clears the repo's own committed defaults without anyone
      // maintaining an allowlist.
      expect(plaintextSecrets({ MAIL_PASSWORD: 'null', MEILISEARCH_KEY: 'masterKey' }, { placeholders: example }))
        .toEqual([])
    })

    it('flags the same key once its value DIFFERS from the example', () => {
      // The placeholder was replaced with something real — the exact shape of
      // the incident.
      expect(plaintextSecrets({ MAIL_PASSWORD: 'hunter2' }, { placeholders: example }).map(f => f.key))
        .toEqual(['MAIL_PASSWORD'])
    })
  })

  describe('strict mode', () => {
    it('reports ordinary values too, which the default does not', () => {
      const values = { APP_NAME: 'Stacks', DB_HOST: '127.0.0.1' }

      expect(plaintextSecrets(values)).toEqual([])
      expect(plaintextSecrets(values, { strict: true }).map(f => f.reason))
        .toEqual(['plaintext-value', 'plaintext-value'])
    })

    it('still skips encrypted values, expansions and key metadata', () => {
      expect(plaintextSecrets(
        { A: 'encrypted:v2:x', B: '${C}', DOTENV_PUBLIC_KEY: '03ab', D: '' },
        { strict: true },
      )).toEqual([])
    })
  })
})

describe('SECRET_NAME_PATTERN', () => {
  it('matches secret-shaped names', () => {
    for (const key of [
      'MAIL_PASSWORD', 'MAIL_PASSWORD_CHRIS', 'APP_COMING_SOON_SECRET', 'API_TOKEN',
      'STRIPE_SECRET_KEY', 'AWS_ACCESS_KEY_ID', 'DB_PASSWD', 'SENTRY_DSN', 'APP_KEY',
    ]) {
      expect(SECRET_NAME_PATTERN.test(key)).toBe(true)
    }
  })

  it('does not match names that merely contain a keyword as a substring', () => {
    // Anchored on word boundaries, so a URL for an identity provider is not a
    // secret just because "KEY" appears in the vendor's name.
    for (const key of ['KEYCLOAK_URL', 'MONKEY_MODE', 'APP_NAME', 'DB_HOST', 'MAIL_HOST']) {
      expect(SECRET_NAME_PATTERN.test(key)).toBe(false)
    }
  })
})

describe('trackedEnvFiles', () => {
  it('picks env files out of git ls-files output', () => {
    const out = ['README.md', '.env.production', '.env.staging', 'src/index.ts', '.env.development'].join('\n')

    expect(trackedEnvFiles(out).sort()).toEqual(['.env.development', '.env.production', '.env.staging'])
  })

  it('includes .env.development, which no .gitignore rule excludes', () => {
    // A hardcoded production/staging/ci list would have skipped a file that is
    // tracked, and therefore just as public, as the three that are un-ignored.
    expect(trackedEnvFiles('.env.development')).toEqual(['.env.development'])
  })

  it('excludes .env.example - it IS the placeholder reference', () => {
    expect(trackedEnvFiles('.env.example\n.env.production')).toEqual(['.env.production'])
  })

  it('excludes .env.keys, whose presence is a separate and louder problem', () => {
    expect(trackedEnvFiles('.env.keys\n.env.production')).toEqual(['.env.production'])
  })

  it('does not match files that merely start with .env-ish text', () => {
    expect(trackedEnvFiles('.environment.md\nenv.ts\n.env.production')).toEqual(['.env.production'])
  })

  it('returns nothing for empty input, so a non-git checkout skips the check', () => {
    expect(trackedEnvFiles('')).toEqual([])
  })
})
