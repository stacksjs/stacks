import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { encryptValue, generateKeypair } from '../src/crypto'
import { autoLoadEnv, loadEnv } from '../src/plugin'

// Bun natively loads `.env` / `.env.<mode>` into process.env before any
// preload script runs, and it knows nothing about dotenvx-style encryption.
// On an encrypted .env that means process.env already holds raw
// `encrypted:...` ciphertext by the time our plugin loads, which used to make
// loadEnv skip the value it had just decrypted ("already set"). Every secret
// then stayed as ciphertext process-wide with no error at all: config
// validation reported `database.default: got "encrypted:..."`, DB_CONNECTION
// never resolved to a real driver, and auth-table creation reported success
// while writing nowhere.
describe('loadEnv - decrypted values beat pre-set ciphertext', () => {
  let dir: string
  let publicKey: string
  let privateKey: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-precedence-'))
    const keys = generateKeypair()
    publicKey = keys.publicKey
    privateKey = keys.privateKey
  })

  afterEach(() => {
    delete process.env.PRECEDENCE_DB
    delete process.env.PRECEDENCE_PLAIN
    delete process.env.__ENV_LOADED__
    rmSync(dir, { recursive: true, force: true })
  })

  function writeEnvFile(entries: Record<string, string>): void {
    const body = Object.entries(entries).map(([k, v]) => `${k}=${v}`).join('\n')
    writeFileSync(join(dir, '.env.development'), body)
  }

  test('replaces ciphertext that Bun pre-loaded into process.env', () => {
    const ciphertext = encryptValue('sqlite', publicKey)
    writeEnvFile({ PRECEDENCE_DB: ciphertext })

    // Simulate Bun's native dotenv pass having already run.
    process.env.PRECEDENCE_DB = ciphertext

    const { errors } = loadEnv({
      path: ['.env.development'],
      cwd: dir,
      env: 'development',
      privateKey,
      quiet: true,
    })

    expect(errors).toHaveLength(0)
    expect(process.env.PRECEDENCE_DB).toBe('sqlite')
  })

  test('leaves a genuine external override in place', () => {
    writeEnvFile({ PRECEDENCE_PLAIN: encryptValue('from-file', publicKey) })

    // A real shell/CI export is plaintext, not ciphertext — it must win.
    process.env.PRECEDENCE_PLAIN = 'from-shell'

    loadEnv({
      path: ['.env.development'],
      cwd: dir,
      env: 'development',
      privateKey,
      quiet: true,
    })

    expect(process.env.PRECEDENCE_PLAIN).toBe('from-shell')
  })

  test('scrubs stale ciphertext when no private key is configured', () => {
    const ciphertext = encryptValue('sqlite', publicKey)
    writeEnvFile({ PRECEDENCE_DB: ciphertext })
    process.env.PRECEDENCE_DB = ciphertext

    // No privateKey: nothing can be decrypted. The parser skips the
    // entry, and the loader removes the ciphertext Bun may have preloaded
    // so config falls back to defaults instead of validating against an
    // unusable "encrypted:..." string.
    const { loaded } = loadEnv({
      path: ['.env.development'],
      cwd: dir,
      env: 'development',
      quiet: true,
    })

    expect(process.env.PRECEDENCE_DB).toBeUndefined()
    expect(loaded).toBe(0)
  })
})

describe('autoLoadEnv - encrypted environment files', () => {
  let dir: string
  let originalNodeEnv: string | undefined
  let originalAppEnv: string | undefined
  let originalDotenvEnv: string | undefined
  let originalValue: string | undefined

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-auto-load-'))
    originalNodeEnv = process.env.NODE_ENV
    originalAppEnv = process.env.APP_ENV
    originalDotenvEnv = process.env.DOTENV_ENV
    originalValue = process.env.AUTOLOAD_VALUE
    delete process.env.NODE_ENV
    delete process.env.APP_ENV
    delete process.env.DOTENV_ENV
    delete process.env.AUTOLOAD_VALUE
    delete process.env.__ENV_LOADED__
  })

  afterEach(() => {
    const restore = (key: string, value: string | undefined): void => {
      if (value === undefined)
        delete process.env[key]
      else
        process.env[key] = value
    }

    restore('NODE_ENV', originalNodeEnv)
    restore('APP_ENV', originalAppEnv)
    restore('DOTENV_ENV', originalDotenvEnv)
    restore('AUTOLOAD_VALUE', originalValue)
    delete process.env.__ENV_LOADED__
    rmSync(dir, { recursive: true, force: true })
  })

  test('discovers .env.keys and applies environment-specific precedence', () => {
    const keys = generateKeypair()
    writeFileSync(join(dir, '.env.keys'), [
      `DOTENV_PUBLIC_KEY_PRODUCTION="${keys.publicKey}"`,
      `DOTENV_PRIVATE_KEY_PRODUCTION="${keys.privateKey}"`,
    ].join('\n'))
    writeFileSync(join(dir, '.env'), 'AUTOLOAD_VALUE=base')
    writeFileSync(
      join(dir, '.env.production'),
      `AUTOLOAD_VALUE=${encryptValue('production', keys.publicKey)}`,
    )
    process.env.APP_ENV = 'production'

    const result = autoLoadEnv({ cwd: dir, quiet: true })

    expect(result.errors).toHaveLength(0)
    expect(process.env.AUTOLOAD_VALUE).toBe('production')
  })

  test('preserves external overrides unless overload is requested', () => {
    writeFileSync(join(dir, '.env'), 'AUTOLOAD_VALUE=base')
    writeFileSync(join(dir, '.env.production'), 'AUTOLOAD_VALUE=production')
    process.env.NODE_ENV = 'production'
    process.env.AUTOLOAD_VALUE = 'shell'

    autoLoadEnv({ cwd: dir, quiet: true })
    expect(process.env.AUTOLOAD_VALUE).toBe('shell')

    autoLoadEnv({ cwd: dir, quiet: true, overload: true })
    expect(process.env.AUTOLOAD_VALUE).toBe('production')
  })

  test('rejects ciphertext as an environment name', () => {
    writeFileSync(join(dir, '.env.development'), 'AUTOLOAD_VALUE=development')
    process.env.APP_ENV = 'encrypted:not-an-environment-name'

    autoLoadEnv({ cwd: dir, quiet: true })

    expect(process.env.AUTOLOAD_VALUE).toBe('development')
  })
})
