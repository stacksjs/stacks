/**
 * stacksjs/stacks#2348 - one env file must never hold two key generations.
 *
 * `.env.keys` is gitignored, so it does not exist on a CI runner; the private
 * key arrives as `DOTENV_PRIVATE_KEY_<ENV>` in the environment. Resolving the
 * keypair from `.env.keys` alone meant a committed file with any plaintext line
 * got a brand new keypair: the plaintext values were encrypted under generation
 * 2, the public-key line was replaced with generation 2's, and every value
 * already encrypted under generation 1 was orphaned.
 *
 * Reported as 4 values decrypting and 33 failing, which is that split exactly.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { encryptValue, generateKeypair } from '../src/crypto'
import { encryptEnv, reusableEnvPublicKey, setEnv } from '../src/cli'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-env-2348-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.DOTENV_PRIVATE_KEY_PRODUCTION
})

/** A committed, encrypted `.env.production` plus any hand-written plaintext. */
function writeEnvFile(publicKey: string, encrypted: Record<string, string>, plaintext: Record<string, string> = {}): string {
  const lines = [`DOTENV_PUBLIC_KEY_PRODUCTION="${publicKey}"`, '']
  for (const [k, v] of Object.entries(encrypted))
    lines.push(`${k}="${encryptValue(v, publicKey)}"`)
  for (const [k, v] of Object.entries(plaintext))
    lines.push(`${k}="${v}"`)

  const path = join(dir, '.env.production')
  writeFileSync(path, `${lines.join('\n')}\n`)
  return path
}

function publicKeyIn(path: string): string | undefined {
  return readFileSync(path, 'utf-8').match(/DOTENV_PUBLIC_KEY_PRODUCTION="([^"]+)"/)?.[1]
}

/** Every `KEY="value"` pair, ciphertext or not. */
function valuesIn(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.trim().match(/^([A-Z0-9_]+)="(.*)"$/)
    if (m?.[1] && !m[1].startsWith('DOTENV_PUBLIC_KEY'))
      out[m[1]] = m[2]!
  }
  return out
}

describe('reusableEnvPublicKey', () => {
  test('returns the file key when the file already holds ciphertext', () => {
    const { publicKey } = generateKeypair()
    const content = `DOTENV_PUBLIC_KEY_PRODUCTION="${publicKey}"\nAPP_NAME="${encryptValue('demo', publicKey)}"\n`

    expect(reusableEnvPublicKey(content, 'DOTENV_PUBLIC_KEY_PRODUCTION')).toBe(publicKey)
  })

  test('returns nothing for a scaffolded file whose demo key encrypts nothing', () => {
    // A public key with no ciphertext under it has no history to stay
    // consistent with, and its private half may never have existed.
    const content = 'DOTENV_PUBLIC_KEY_PRODUCTION="x25519-public:demo"\nAPP_NAME="plain"\n'

    expect(reusableEnvPublicKey(content, 'DOTENV_PUBLIC_KEY_PRODUCTION')).toBeUndefined()
  })

  test('returns nothing when the file names no public key', () => {
    expect(reusableEnvPublicKey('APP_NAME="plain"\n', 'DOTENV_PUBLIC_KEY_PRODUCTION')).toBeUndefined()
  })
})

describe('encryptEnv on a CI runner with no .env.keys (#2348)', () => {
  test('keeps the file key, so the file never holds two generations', () => {
    const gen1 = generateKeypair()
    const path = writeEnvFile(gen1.publicKey, { APP_NAME: 'loghq', APP_URL: 'https://loghq.dev' }, { STRIPE_SECRET_KEY: '', MAIL_PASSWORD: '' })

    // No .env.keys: exactly the runner's state.
    expect(existsSync(join(dir, '.env.keys'))).toBe(false)

    const result = encryptEnv({ file: '.env.production', cwd: dir })

    expect(result.success).toBe(true)
    expect(publicKeyIn(path)).toBe(gen1.publicKey)

    // Every value is ciphertext, and all of it under the one key the operator
    // still holds the private half of.
    const values = valuesIn(path)
    expect(Object.keys(values).sort()).toEqual(['APP_NAME', 'APP_URL', 'MAIL_PASSWORD', 'STRIPE_SECRET_KEY'])
    for (const [key, value] of Object.entries(values))
      expect(`${key} ${value.startsWith('encrypted:')}`).toBe(`${key} true`)
  })

  test('does not invent a .env.keys holding a private key it never had', () => {
    const gen1 = generateKeypair()
    writeEnvFile(gen1.publicKey, { APP_NAME: 'loghq' }, { STRIPE_SECRET_KEY: '' })

    encryptEnv({ file: '.env.production', cwd: dir })

    expect(existsSync(join(dir, '.env.keys'))).toBe(false)
  })

  test('the previously encrypted values are left byte-identical', () => {
    const gen1 = generateKeypair()
    const path = writeEnvFile(gen1.publicKey, { APP_NAME: 'loghq' }, { STRIPE_SECRET_KEY: '' })
    const before = valuesIn(path).APP_NAME

    encryptEnv({ file: '.env.production', cwd: dir })

    expect(valuesIn(path).APP_NAME).toBe(before)
  })

  test('still generates a keypair for a file that carries no ciphertext', () => {
    // Nothing to stay consistent with, and the demo key's private half may
    // never have existed, so a fresh keypair is the safe answer here.
    writeFileSync(join(dir, '.env.production'), 'DOTENV_PUBLIC_KEY_PRODUCTION="x25519-public:demo"\nAPP_NAME="loghq"\n')

    expect(encryptEnv({ file: '.env.production', cwd: dir }).success).toBe(true)
    expect(publicKeyIn(join(dir, '.env.production'))).not.toBe('x25519-public:demo')
    expect(existsSync(join(dir, '.env.keys'))).toBe(true)
  })
})

describe('setEnv against a committed file with no local .env.keys (#2348)', () => {
  test('encrypts under the file key rather than rotating it', () => {
    const gen1 = generateKeypair()
    const path = writeEnvFile(gen1.publicKey, { APP_NAME: 'loghq' })

    const result = setEnv('STRIPE_SECRET_KEY', '', { file: '.env.production', cwd: dir })

    expect(result.success).toBe(true)
    expect(publicKeyIn(path)).toBe(gen1.publicKey)
  })

  test('an empty value is stored, not rejected', () => {
    const gen1 = generateKeypair()
    const path = writeEnvFile(gen1.publicKey, { APP_NAME: 'loghq' })

    setEnv('STRIPE_SECRET_KEY', '', { file: '.env.production', cwd: dir, plain: true })

    expect(valuesIn(path).STRIPE_SECRET_KEY).toBe('')
  })

  test('a private key in the environment counts as having one', () => {
    // The runner's actual arrangement: no .env.keys on disk, the private key in
    // DOTENV_PRIVATE_KEY_PRODUCTION.
    const gen1 = generateKeypair()
    process.env.DOTENV_PRIVATE_KEY_PRODUCTION = gen1.privateKey
    const path = writeEnvFile(gen1.publicKey, {})

    setEnv('NEW_KEY', 'value', { file: '.env.production', cwd: dir })

    expect(publicKeyIn(path)).toBe(gen1.publicKey)
  })
})
