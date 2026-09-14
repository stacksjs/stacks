import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encryptValue, generateKeypair } from '../src/crypto'
import { decryptEnvValue, resetPrivateKeyCache, resolvePrivateKey } from '../src/plugin'

describe('lazy key cache project context', () => {
  const variables = ['DOTENV_PRIVATE_KEY', 'DOTENV_PRIVATE_KEY_CACHE_FIXTURE']
  let directory: string
  let first: string
  let second: string
  let saved: Array<[string, string | undefined]>

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'env-key-cache-context-'))
    first = join(directory, 'first')
    second = join(directory, 'second')
    mkdirSync(first)
    mkdirSync(second)
    saved = variables.map(key => [key, process.env[key]])
    for (const key of variables) delete process.env[key]
    resetPrivateKeyCache()
  })

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    resetPrivateKeyCache()
    rmSync(directory, { recursive: true, force: true })
  })

  function configure(root: string): ReturnType<typeof generateKeypair> {
    const keys = generateKeypair()
    writeFileSync(join(root, '.env.keys'), `DOTENV_PRIVATE_KEY_CACHE_FIXTURE="${keys.privateKey}"\n`, { mode: 0o600 })
    return keys
  }

  test('decrypts for two projects sharing one environment name', () => {
    const a = configure(first)
    const b = configure(second)

    expect(decryptEnvValue(encryptValue('first-project', a.publicKey), { env: 'cache_fixture', cwd: first })).toBe('first-project')
    expect(decryptEnvValue(encryptValue('second-project', b.publicKey), { env: 'cache_fixture', cwd: second })).toBe('second-project')
    expect(decryptEnvValue(encryptValue('first-again', a.publicKey), { env: 'cache_fixture', cwd: first })).toBe('first-again')
  })

  test('a project without a key does not poison another project lookup', () => {
    const b = configure(second)
    expect(resolvePrivateKey({ env: 'cache_fixture', cwd: first })).toBeUndefined()

    expect(decryptEnvValue(encryptValue('second-project', b.publicKey), { env: 'cache_fixture', cwd: second })).toBe('second-project')
  })

  test('does not return the previous project key for a project without one', () => {
    configure(first)
    expect(resolvePrivateKey({ env: 'cache_fixture', cwd: first })).toBeDefined()

    expect(resolvePrivateKey({ env: 'cache_fixture', cwd: second }) === undefined).toBe(true)
  })

  test('normalizes equivalent project paths and retains warm lookup caching', () => {
    const a = configure(first)
    const ciphertext = encryptValue('first-project', a.publicKey)
    expect(decryptEnvValue(ciphertext, { env: 'cache_fixture', cwd: first })).toBe('first-project')
    unlinkSync(join(first, '.env.keys'))

    expect(decryptEnvValue(ciphertext, { env: 'cache_fixture', cwd: `${first}/../first` })).toBe('first-project')
  })

  test('reset still invalidates the same-project key after rotation', () => {
    configure(first)
    expect(resolvePrivateKey({ env: 'cache_fixture', cwd: first })).toBeDefined()
    const replacement = configure(first)
    resetPrivateKeyCache()

    expect(decryptEnvValue(encryptValue('rotated', replacement.publicKey), { env: 'cache_fixture', cwd: first })).toBe('rotated')
  })
})
