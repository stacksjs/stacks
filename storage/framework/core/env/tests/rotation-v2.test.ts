import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { rotateKeypair } from '../src/cli'
import { aesEncrypt, decryptValue } from '../src/crypto'
import { parse } from '../src/parser'

const directories: string[] = []

function legacyEncrypt(value: string, privateKey: string): string {
  const publicValue = createHash('sha256').update(Buffer.from(privateKey, 'hex')).digest()
  const key = createHash('sha256').update(publicValue).digest()
  const encrypted = aesEncrypt(value, key)
  return `encrypted:${Buffer.concat([
    Buffer.from(encrypted.iv, 'hex'),
    Buffer.from(encrypted.authTag, 'hex'),
    Buffer.from(encrypted.ciphertext, 'hex'),
  ]).toString('base64')}`
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe('version 2 key rotation', () => {
  it('migrates legacy ciphertext without leaving plaintext or temporary files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-env-rotation-'))
    directories.push(directory)
    const legacyPrivate = 'a4547dcd9d3429615a3649bb79e87edb62ee6a74b007075e9141ae44f5fb412c'
    const legacyPublic = createHash('sha256').update(Buffer.from(legacyPrivate, 'hex')).digest('hex')
    writeFileSync(join(directory, '.env.keys'), `DOTENV_PUBLIC_KEY="${legacyPublic}"\nDOTENV_PRIVATE_KEY="${legacyPrivate}"\n`, { mode: 0o600 })
    writeFileSync(join(directory, '.env'), `DOTENV_PUBLIC_KEY="${legacyPublic}"\nSECRET="${legacyEncrypt('rotate-me', legacyPrivate)}"\n`, { mode: 0o600 })

    const result = rotateKeypair({ cwd: directory })
    expect(result.success).toBe(true)
    const envContents = readFileSync(join(directory, '.env'), 'utf8')
    const keysContents = readFileSync(join(directory, '.env.keys'), 'utf8')
    expect(envContents).not.toContain('rotate-me')
    expect(envContents).toContain('encrypted:v2:')
    expect(keysContents).toContain('x25519-public:')
    expect(keysContents).toContain('x25519-private:')
    expect(readdirSync(directory).filter(name => name.endsWith('.rotate'))).toEqual([])
    const { parsed: keys } = parse(keysContents)
    const encrypted = envContents.match(/^SECRET="([^"]+)"$/m)?.[1]
    expect(encrypted).toBeDefined()
    expect(decryptValue(encrypted!, keys.DOTENV_PRIVATE_KEY!)).toBe('rotate-me')
  })
})
