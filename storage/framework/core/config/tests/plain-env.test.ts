import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { isEncryptedValue } from '@stacksjs/env'
import { defaultsForOverrides } from '../src/overrides'
import { isCiphertext, plainEnv } from '../src/plain-env'
import { validateConfig } from '../src/validators'

const CIPHERTEXT = 'encrypted:v2:eyJ2IjoyLCJlcGsiOiJNQ293QlFZREsyVnVBeUVBN3JWOWhJV0RoM3VSIiwiY2lwaGVydGV4dCI6InBPdG9ldyJ9'

/** Restore whatever the suite's environment held, key by key. */
const touched: Array<[string, string | undefined]> = []

function setEnv(key: string, value: string | undefined): void {
  touched.push([key, process.env[key]])
  if (value === undefined)
    delete process.env[key]
  else
    process.env[key] = value
}

afterEach(() => {
  for (const [key, value] of touched.reverse()) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
  touched.length = 0
})

describe('isCiphertext (stacksjs/stacks#2903)', () => {
  /*
   * The drift guard. This package restates a rule `@stacksjs/env` owns,
   * because it cannot import it at module init, so the copy is only safe for
   * as long as the two agree. Delete a prefix from either and this fails.
   */
  test('agrees with isEncryptedValue from @stacksjs/env', () => {
    const corpus: unknown[] = [
      CIPHERTEXT,
      'encrypted:v1:abc',
      'encrypted:',
      'enc:abc',
      'enc:',
      // Near misses: the prefix has to start the value, and it is case
      // sensitive, because dotenvx writes it lowercase.
      'ENCRYPTED:v2:abc',
      'Enc:abc',
      'not-encrypted:v2:abc',
      ' encrypted:v2:abc',
      'encrypt:abc',
      // Ordinary values, including the two the issue reported.
      '3000',
      'smtp',
      '',
      'postgres://user:pass@host/db',
    ]

    for (const value of corpus)
      expect([value, isCiphertext(value)]).toEqual([value, isEncryptedValue(value as string)])
  })

  test('is false for everything that is not a string', () => {
    for (const value of [undefined, null, 3000, true, {}, []])
      expect(isCiphertext(value)).toBe(false)
  })
})

describe('plainEnv (stacksjs/stacks#2903)', () => {
  test('reads ciphertext as absent, so the default beside it resolves', () => {
    setEnv('STACKS_PLAIN_ENV_PROBE', CIPHERTEXT)
    expect(plainEnv('STACKS_PLAIN_ENV_PROBE')).toBeUndefined()
    expect(plainEnv('STACKS_PLAIN_ENV_PROBE') || 'fallback').toBe('fallback')
  })

  test('passes a usable value through unchanged', () => {
    setEnv('STACKS_PLAIN_ENV_PROBE', 'staging')
    expect(plainEnv('STACKS_PLAIN_ENV_PROBE')).toBe('staging')
  })

  test('reports an unset variable as undefined', () => {
    setEnv('STACKS_PLAIN_ENV_PROBE', undefined)
    expect(plainEnv('STACKS_PLAIN_ENV_PROBE')).toBeUndefined()
  })
})

describe('config built from the environment (stacksjs/stacks#2903)', () => {
  test('falls back rather than carrying ciphertext into app.env', () => {
    setEnv('APP_ENV', CIPHERTEXT)
    expect(defaultsForOverrides().app?.env).toBe('production')
  })

  test('falls back rather than carrying ciphertext into app.name', () => {
    setEnv('APP_NAME', CIPHERTEXT)
    expect(defaultsForOverrides().app?.name).not.toBe(CIPHERTEXT)
  })

  test('still lets a usable value win', () => {
    setEnv('APP_ENV', 'staging')
    expect(defaultsForOverrides().app?.env).toBe('staging')
  })
})

describe('validateConfig on ciphertext (stacksjs/stacks#2903)', () => {
  test('names the encryption rather than the schema rule it tripped', () => {
    const issues = validateConfig({ ports: { frontend: CIPHERTEXT as any } } as any)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toBe('ports.frontend')
    expect(issues[0].message).toContain('still encrypted')
    // The complaint that opened the issue: 300 characters of base64 per line,
    // nine times a command, is how real output gets lost.
    expect(issues[0].message).not.toContain(CIPHERTEXT)
  })

  test('is still an issue, because the value is unusable either way', () => {
    const issues = validateConfig({ email: { default: CIPHERTEXT as any } } as any)
    expect(issues).toHaveLength(1)
  })
})

describe('a boot that skips the env preloader (stacksjs/stacks#2903)', () => {
  /*
   * The only seam that shows the original bug. Inside the repo every `bun`
   * run preloads the env plugin, which scrubs ciphertext out of `process.env`
   * before config reads it, so the defect is invisible here. A fast CLI
   * command skips that preloader, and Bun's own `.env` loading knows nothing
   * about encryption, which is the state this reproduces: cwd outside the
   * repo, so bunfig.toml does not apply, and config imported by absolute path.
   */
  test('resolves a config instead of throwing on an encrypted APP_ENV', async () => {
    const overrides = join(import.meta.dir, '..', 'src', 'overrides.ts')
    const script = `
      const mod = await import(${JSON.stringify(overrides)})
      const config = await mod.overridesReady
      console.log(JSON.stringify({ env: config.app?.env }))
    `

    const proc = Bun.spawn(['bun', '-e', script], {
      cwd: mkdtempSync(join(tmpdir(), 'stacks-plain-env-')),
      env: { ...process.env, APP_ENV: CIPHERTEXT },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    expect({ code, stderr: stderr.slice(0, 600) }).toMatchObject({ code: 0 })
    expect(stdout).not.toContain('encrypted:')
    expect(JSON.parse(stdout.trim().split('\n').pop()!).env).toBe('production')
  }, 30_000)
})
