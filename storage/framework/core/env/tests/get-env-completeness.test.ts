import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getEnv } from '../src/cli'
import { encryptValue, generateKeypair } from '../src/crypto'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-env-completeness-'))
  directories.push(directory)
  writeFileSync(join(directory, '.env.production'), 'BLOB_LOCAL_ROOT=/srv/shared/blobs\nPRIVATE_VALUE="encrypted:v2:controlled-unreadable-ciphertext"\n')
  return directory
}

describe('complete environment reads', () => {
  test('a whole-file read refuses an encrypted value it could not decrypt', () => {
    const result = getEnv(undefined, { cwd: fixture(), file: '.env.production' })
    expect(result.success).toBe(false)
    expect(result.output).toBeUndefined()
    expect(result.error).toContain('PRIVATE_VALUE')
    expect(result.error).not.toContain('controlled-unreadable-ciphertext')
  })

  test('requesting that encrypted key reports decryption rather than absence', () => {
    const result = getEnv('PRIVATE_VALUE', { cwd: fixture(), file: '.env.production' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('decrypt')
  })

  test('a specific plaintext key remains readable without unrelated secrets', () => {
    const result = getEnv('BLOB_LOCAL_ROOT', { cwd: fixture(), file: '.env.production' })
    expect(result).toEqual({ success: true, output: '/srv/shared/blobs' })
  })

  test('a valid file key decrypts the complete environment', () => {
    const directory = fixture()
    const { publicKey, privateKey } = generateKeypair()
    writeFileSync(join(directory, '.env.production'), `PUBLIC_VALUE=public\nPRIVATE_VALUE="${encryptValue('controlled-value', publicKey)}"\n`)
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PRIVATE_KEY_PRODUCTION=${privateKey}\n`, { mode: 0o600 })
    const result = getEnv(undefined, { cwd: directory, file: '.env.production', format: 'json' })
    expect(result.success).toBe(true)
    expect(JSON.parse(result.output!)).toEqual({ PUBLIC_VALUE: 'public', PRIVATE_VALUE: 'controlled-value' })
  })

  test('a valid ciphertext with the wrong key fails without returning its plaintext neighbors', () => {
    const directory = fixture()
    const { publicKey } = generateKeypair()
    const { privateKey } = generateKeypair()
    writeFileSync(join(directory, '.env.production'), `PUBLIC_VALUE=public\nPRIVATE_VALUE="${encryptValue('controlled-value', publicKey)}"\n`)
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PRIVATE_KEY_PRODUCTION=${privateKey}\n`, { mode: 0o600 })
    const result = getEnv(undefined, { cwd: directory, file: '.env.production', format: 'json' })
    expect(result.success).toBe(false)
    expect(result.output).toBeUndefined()
    expect(result.error).not.toContain('controlled-value')
  })
})
