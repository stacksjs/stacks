import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptValue, generateKeypair } from '../src/crypto'
import { autoLoadEnv, decryptEnvValue, loadEnv, resetPrivateKeyCache } from '../src/plugin'

const variables = [
  'APP_ENV', 'NODE_ENV', 'DOTENV_ENV', 'DOTENV_PRIVATE_KEY',
  'DOTENV_PRIVATE_KEY_DEVELOPMENT', 'FALLBACK_VALUE', '__ENV_LOADED__',
] as const

describe('named environment generic-key fallback (#2595)', () => {
  let directory: string
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'env-generic-fallback-'))
    saved = Object.fromEntries(variables.map(key => [key, process.env[key]]))
    for (const key of variables) delete process.env[key]
    process.env.APP_ENV = 'development'
    resetPrivateKeyCache()
  })

  afterEach(() => {
    for (const key of variables) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    resetPrivateKeyCache()
    rmSync(directory, { recursive: true, force: true })
  })

  test('auto-loads encrypted .env with only the generic key in .env.keys', () => {
    const keys = generateKeypair()
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PRIVATE_KEY="${keys.privateKey}"\n`, { mode: 0o600 })
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${encryptValue('configured', keys.publicKey)}\n`)

    const result = autoLoadEnv({ cwd: directory, quiet: true })

    expect(result.errors).toEqual([])
    expect(process.env.FALLBACK_VALUE).toBe('configured')
  })

  test('the lazy reader already decrypts with the same generic key', () => {
    const keys = generateKeypair()
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PRIVATE_KEY="${keys.privateKey}"\n`, { mode: 0o600 })
    expect(decryptEnvValue(encryptValue('configured', keys.publicKey), { cwd: directory })).toBe('configured')
  })

  test('auto-loads with a generic process key when the keys file is absent', () => {
    const keys = generateKeypair()
    process.env.DOTENV_PRIVATE_KEY = keys.privateKey
    const ciphertext = encryptValue('configured', keys.publicKey)
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${ciphertext}\n`)
    // Bun preloads encrypted strings before the framework loader runs.
    process.env.FALLBACK_VALUE = ciphertext

    expect(autoLoadEnv({ cwd: directory, quiet: true }).errors).toEqual([])
    expect(process.env.FALLBACK_VALUE).toBe('configured')
  })

  test.each(['file', 'process'] as const)('prefers the scoped %s key over its generic sibling', (source) => {
    const scoped = generateKeypair()
    const generic = generateKeypair()
    if (source === 'file') {
      writeFileSync(join(directory, '.env.keys'), [
        `DOTENV_PRIVATE_KEY="${generic.privateKey}"`,
        `DOTENV_PRIVATE_KEY_DEVELOPMENT="${scoped.privateKey}"`,
      ].join('\n'), { mode: 0o600 })
    }
    else {
      process.env.DOTENV_PRIVATE_KEY = generic.privateKey
      process.env.DOTENV_PRIVATE_KEY_DEVELOPMENT = scoped.privateKey
    }
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${encryptValue('scoped', scoped.publicKey)}\n`)

    expect(autoLoadEnv({ cwd: directory, quiet: true }).errors).toEqual([])
    expect(process.env.FALLBACK_VALUE).toBe('scoped')
  })

  test('uses a generic key from a custom keys file', () => {
    const keys = generateKeypair()
    writeFileSync(join(directory, 'custom.keys'), `DOTENV_PRIVATE_KEY="${keys.privateKey}"\n`, { mode: 0o600 })
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${encryptValue('custom-file', keys.publicKey)}\n`)

    expect(loadEnv({ cwd: directory, env: 'development', keysFile: 'custom.keys', quiet: true }).errors).toEqual([])
    expect(process.env.FALLBACK_VALUE).toBe('custom-file')
  })

  test('keeps an explicit private key ahead of file and process keys', () => {
    const explicit = generateKeypair()
    const other = generateKeypair()
    process.env.DOTENV_PRIVATE_KEY = other.privateKey
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PRIVATE_KEY="${other.privateKey}"\n`, { mode: 0o600 })
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${encryptValue('explicit', explicit.publicKey)}\n`)

    expect(loadEnv({ cwd: directory, env: 'development', privateKey: explicit.privateKey, quiet: true }).errors).toEqual([])
    expect(process.env.FALLBACK_VALUE).toBe('explicit')
  })

  test('preserves file-key priority over a scoped process key', () => {
    const file = generateKeypair()
    process.env.DOTENV_PRIVATE_KEY_DEVELOPMENT = generateKeypair().privateKey
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PRIVATE_KEY="${file.privateKey}"\n`, { mode: 0o600 })
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${encryptValue('file-first', file.publicKey)}\n`)

    expect(autoLoadEnv({ cwd: directory, quiet: true }).errors).toEqual([])
    expect(process.env.FALLBACK_VALUE).toBe('file-first')
  })

  test('does not retry a generic key when a present scoped key fails decryption', () => {
    const generic = generateKeypair()
    const wrong = generateKeypair()
    writeFileSync(join(directory, '.env.keys'), [
      `DOTENV_PRIVATE_KEY="${generic.privateKey}"`,
      `DOTENV_PRIVATE_KEY_DEVELOPMENT="${wrong.privateKey}"`,
    ].join('\n'), { mode: 0o600 })
    writeFileSync(join(directory, '.env'), `FALLBACK_VALUE=${encryptValue('generic', generic.publicKey)}\n`)

    expect(autoLoadEnv({ cwd: directory, quiet: true }).errors.length).toBeGreaterThan(0)
    expect(process.env.FALLBACK_VALUE).not.toBe('generic')
  })
})
