/**
 * stacksjs/stacks#2489 - the plain `DOTENV_PUBLIC_KEY` name.
 *
 * #2348 established that one env file must never hold two key generations, and
 * `reusableEnvPublicKey` enforced it. But every guard looked for the SUFFIXED
 * name, `DOTENV_PUBLIC_KEY_PRODUCTION`. `dotenvx` also accepts the plain
 * `DOTENV_PUBLIC_KEY`, and real projects use it.
 *
 * Against such a file the key appeared absent, so `env:set` generated a fresh
 * keypair, prepended a SECOND declaration, wrote a `.env.keys` holding only the
 * new private half, and stranded every value already encrypted under the
 * original key. Same failure as #2348, reached through a different door.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { decryptValue, encryptValue, generateKeypair } from '../src/crypto'
import { envHasCiphertext, envPublicKeyNames, setEnv } from '../src/cli'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-env-2489-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.DOTENV_PRIVATE_KEY_PRODUCTION
})

/** A file declaring its key under the PLAIN name, with ciphertext under it. */
function plainKeyFile(publicKey: string, values: Record<string, string>): string {
  const lines = [`DOTENV_PUBLIC_KEY="${publicKey}"`, '']
  for (const [k, v] of Object.entries(values))
    lines.push(`${k}="${encryptValue(v, publicKey)}"`)

  const path = join(dir, '.env.production')
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf-8')
  return path
}

function valueOf(path: string, key: string): string {
  const line = readFileSync(path, 'utf-8').split('\n').find(l => l.startsWith(`${key}=`))
  return (line ?? '').slice(key.length + 1).replace(/^["']|["']$/g, '')
}

describe('a file declaring the plain DOTENV_PUBLIC_KEY', () => {
  test('keeps its existing values readable when another is added', () => {
    const { publicKey, privateKey } = generateKeypair()
    const path = plainKeyFile(publicKey, { EXISTING: 'original' })

    const result = setEnv('ADDED', 'second', { file: path, cwd: dir })
    expect(result.success).toBe(true)

    // The whole point. Before the fix this threw, because ADDED landed under a
    // freshly generated key and EXISTING stayed under the original.
    expect(decryptValue(valueOf(path, 'EXISTING'), privateKey)).toBe('original')
    expect(decryptValue(valueOf(path, 'ADDED'), privateKey)).toBe('second')
  })

  test('does not rotate the key', () => {
    const { publicKey } = generateKeypair()
    const path = plainKeyFile(publicKey, { EXISTING: 'original' })

    setEnv('ADDED', 'second', { file: path, cwd: dir })

    expect(valueOf(path, 'DOTENV_PUBLIC_KEY')).toBe(publicKey)
  })

  test('does not add a second key declaration', () => {
    const { publicKey } = generateKeypair()
    const path = plainKeyFile(publicKey, { EXISTING: 'original' })

    setEnv('ADDED', 'second', { file: path, cwd: dir })

    // Two declarations naming different keys is what made the damage
    // intermittent: later runs reused the suffixed one and looked stable.
    const declarations = readFileSync(path, 'utf-8')
      .split('\n')
      .filter(l => l.trim().startsWith('DOTENV_PUBLIC_KEY'))
    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toContain('DOTENV_PUBLIC_KEY=')
  })
})

describe('the keys file location', () => {
  test('is written beside the env file, not beside the process', () => {
    // It resolved against the CWD, so `--file ../other/.env` wrote keys into
    // whatever directory you were standing in - landing on that project's own
    // `.env.keys` and replacing private halves it still needed.
    const nested = mkdtempSync(join(tmpdir(), 'stacks-env-2489-elsewhere-'))
    try {
      const path = join(nested, '.env.production')
      writeFileSync(path, 'HELLO=world\n', 'utf-8')

      setEnv('SECRET', 'value', { file: path, cwd: dir })

      expect(existsSync(join(nested, '.env.keys'))).toBe(true)
      expect(existsSync(join(dir, '.env.keys'))).toBe(false)
    }
    finally { rmSync(nested, { recursive: true, force: true }) }
  })
})

describe('refusing to strand values', () => {
  test('fails rather than generating a key for a file that already has ciphertext', () => {
    // No declaration and no reachable private key: there is no way to add a
    // value that keeps the existing ones readable, so the honest answer is to
    // refuse. A round-trip check on the NEW value would have passed here.
    const { publicKey } = generateKeypair()
    const path = join(dir, '.env.production')
    writeFileSync(path, `EXISTING="${encryptValue('original', publicKey)}"\n`, 'utf-8')

    const result = setEnv('ADDED', 'second', { file: path, cwd: dir })

    expect(result.success).toBe(false)
    expect(result.error).toContain('already contains encrypted values')
    // And it left the file alone.
    expect(readFileSync(path, 'utf-8')).not.toContain('ADDED=')
  })

  test('still writes plaintext when asked, since that strands nothing', () => {
    const { publicKey } = generateKeypair()
    const path = join(dir, '.env.production')
    writeFileSync(path, `EXISTING="${encryptValue('original', publicKey)}"\n`, 'utf-8')

    expect(setEnv('ADDED', 'second', { file: path, cwd: dir, plain: true }).success).toBe(true)
  })
})

describe('the helpers the guards rest on', () => {
  test('both accepted names are recognised, suffixed first', () => {
    expect(envPublicKeyNames('.env.production')).toEqual(['DOTENV_PUBLIC_KEY_PRODUCTION', 'DOTENV_PUBLIC_KEY'])
    expect(envPublicKeyNames('.env')).toEqual(['DOTENV_PUBLIC_KEY'])
  })

  test('ciphertext is detected regardless of which key name declared it', () => {
    expect(envHasCiphertext('A="encrypted:v2:abc"\n')).toBe(true)
    expect(envHasCiphertext('A="plain"\n')).toBe(false)
    expect(envHasCiphertext('# A="encrypted:v2:abc"\n')).toBe(false)
  })
})
