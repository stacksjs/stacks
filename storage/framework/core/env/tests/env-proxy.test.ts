import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import process from 'node:process'
import { encryptValue, generateKeypair } from '../src/crypto'
import { resetPrivateKeyCache } from '../src/plugin'

describe('@stacksjs/env proxy', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Set up controlled env vars for each test
    process.env.NODE_ENV = 'test'
    process.env.APP_ENV = 'local'
    process.env.TEST_BOOL_TRUE = 'true'
    process.env.TEST_BOOL_FALSE = 'false'
    process.env.APP_PORT = '3000'
    process.env.SOME_STRING = 'hello'
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
  })

  it('env.NODE_ENV returns the correct value', async () => {
    // Re-import to pick up fresh env
    const { env } = await import('../src/index')
    expect(env.NODE_ENV).toBe('test')
  })

  it('auto-coerces "true" string to boolean true', async () => {
    const { env } = await import('../src/index')
    expect(env.TEST_BOOL_TRUE).toBe(true)
  })

  it('auto-coerces "false" string to boolean false', async () => {
    const { env } = await import('../src/index')
    expect(env.TEST_BOOL_FALSE).toBe(false)
  })

  it('auto-coerces numeric PORT suffix to number', async () => {
    const { env } = await import('../src/index')
    expect(env.APP_PORT).toBe(3000)
  })

  it('does not coerce plain numeric strings without known suffix', async () => {
    process.env.SOME_ID = '12345'
    const { env } = await import('../src/index')
    // SOME_ID does not end in _PORT, _TIMEOUT, etc. so stays string
    expect(env.SOME_ID).toBe('12345')
  })

  it('returns undefined for missing env var', async () => {
    const { env } = await import('../src/index')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((env as any).TOTALLY_NONEXISTENT_VAR_XYZ).toBeUndefined()
  })

  it('returns plain string values as-is', async () => {
    const { env } = await import('../src/index')
    expect(env.SOME_STRING).toBe('hello')
  })

  it('env.APP_ENV returns correct value', async () => {
    const { env } = await import('../src/index')
    expect(env.APP_ENV).toBe('local')
  })

  it('process() helper returns env-like object', async () => {
    const { process: envProcess } = await import('../src/index')
    const result = envProcess()
    expect(result).toBeDefined()
    expect(result.NODE_ENV).toBe('test')
  })

  it('validateEnv returns empty array for valid env values', async () => {
    process.env.APP_ENV = 'production'
    const { validateEnv, env } = await import('../src/index')
    const errors = validateEnv(env)
    expect(Array.isArray(errors)).toBe(true)
  })
})

// The env proxy is the chokepoint every `config/*.ts` reads secrets through
// (`env.DB_PASSWORD`, `env.DB_CONNECTION`, ...). Fast CLI commands skip the
// preloader that eagerly decrypts, and app code can read env before it runs,
// so the proxy must decrypt on read — otherwise config receives raw
// `encrypted:...` ciphertext and validation fails with opaque errors.
describe('@stacksjs/env proxy - lazy decryption', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv))
        delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
    resetPrivateKeyCache()
  })

  it('decrypts an encrypted value on read using the environment private key', async () => {
    const { publicKey, privateKey } = generateKeypair()
    process.env.APP_ENV = 'production'
    process.env.DOTENV_PRIVATE_KEY_PRODUCTION = privateKey
    process.env.SECRET_TOKEN = encryptValue('s3cr3t-value', publicKey)
    resetPrivateKeyCache()

    const { env } = await import('../src/index')
    expect(env.SECRET_TOKEN).toBe('s3cr3t-value')
    // Plaintext is memoized back to process.env so it's a one-time cost.
    expect(process.env.SECRET_TOKEN).toBe('s3cr3t-value')
  })

  it('decrypts, then coerces the plaintext (encrypted numeric PORT)', async () => {
    const { publicKey, privateKey } = generateKeypair()
    process.env.APP_ENV = 'production'
    process.env.DOTENV_PRIVATE_KEY_PRODUCTION = privateKey
    process.env.DB_PORT = encryptValue('5432', publicKey)
    resetPrivateKeyCache()

    const { env } = await import('../src/index')
    expect(env.DB_PORT).toBe(5432)
  })

  it('supports the short enc: prefix', async () => {
    const { publicKey, privateKey } = generateKeypair()
    process.env.APP_ENV = 'production'
    process.env.DOTENV_PRIVATE_KEY_PRODUCTION = privateKey
    const full = encryptValue('short-prefix', publicKey)
    process.env.SECRET_SHORT = `enc:${full.slice('encrypted:'.length)}`
    resetPrivateKeyCache()

    const { env } = await import('../src/index')
    expect(env.SECRET_SHORT).toBe('short-prefix')
  })

  it('scrubs encrypted values to undefined when no private key is available', async () => {
    const { publicKey } = generateKeypair()
    process.env.APP_ENV = 'production'
    delete process.env.DOTENV_PRIVATE_KEY
    delete process.env.DOTENV_PRIVATE_KEY_PRODUCTION
    process.env.SECRET_NOKEY = encryptValue('unreachable', publicKey)
    resetPrivateKeyCache()

    const { env } = await import('../src/index')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((env as any).SECRET_NOKEY).toBeUndefined()
  })
})
