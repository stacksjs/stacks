import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { encryptValue, generateKeypair } from '../src/crypto'
import { loadEnv } from '../src/plugin'

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

  test('leaves ciphertext untouched when no private key is configured', () => {
    const ciphertext = encryptValue('sqlite', publicKey)
    writeEnvFile({ PRECEDENCE_DB: ciphertext })
    process.env.PRECEDENCE_DB = ciphertext

    // No privateKey: nothing can be decrypted, so there is no better value to
    // install and the ciphertext must not be counted as an applied variable.
    const { loaded } = loadEnv({
      path: ['.env.development'],
      cwd: dir,
      env: 'development',
      quiet: true,
    })

    expect(process.env.PRECEDENCE_DB).toBe(ciphertext)
    expect(loaded).toBe(0)
  })
})
