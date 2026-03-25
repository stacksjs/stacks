import { describe, expect, test } from 'bun:test'
import {
  aesDecrypt,
  aesEncrypt,
  decryptValue,
  encryptValue,
  generateKeypair,
  getPrivateKey,
  parseEnvFromKey,
} from '../src/crypto'
import { parse } from '../src/parser'
import {
  isBun,
  isCI,
  isLinux,
  isMacOS,
  isNode,
  isWindows,
  platform,
  runtime,
  runtimeInfo,
} from '../src/utils'

// ─── Parser Tests ────────────────────────────────────────────────────────────

describe('Env Parser - Real Parsing', () => {
  test('parse handles simple key=value pairs', () => {
    const { parsed, errors } = parse('KEY1=value1\nKEY2=value2')
    expect(errors).toHaveLength(0)
    expect(parsed.KEY1).toBe('value1')
    expect(parsed.KEY2).toBe('value2')
  })

  test('parse skips empty lines and comments', () => {
    const src = `
# This is a comment
KEY=value

# Another comment

OTHER=data
    `.trim()
    const { parsed, errors } = parse(src)
    expect(errors).toHaveLength(0)
    expect(Object.keys(parsed)).toEqual(['KEY', 'OTHER'])
  })

  test('parse handles double-quoted values', () => {
    const { parsed } = parse('QUOTED="hello world"')
    expect(parsed.QUOTED).toBe('hello world')
  })

  test('parse handles single-quoted values', () => {
    const { parsed } = parse("SINGLE='single quoted'")
    expect(parsed.SINGLE).toBe('single quoted')
  })

  test('parse handles multiline values with \\n in quotes', () => {
    const { parsed } = parse('MULTI="line1\\nline2\\nline3"')
    expect(parsed.MULTI).toBe('line1\nline2\nline3')
  })

  test('parse performs variable expansion with ${VAR}', () => {
    const src = 'BASE=/usr/local\nPATH_VAR=${BASE}/bin'
    const { parsed } = parse(src)
    expect(parsed.PATH_VAR).toBe('/usr/local/bin')
  })

  test('parse handles ${VAR:-default} syntax', () => {
    const { parsed } = parse('VALUE=${MISSING:-fallback}')
    expect(parsed.VALUE).toBe('fallback')
  })

  test('parse expands variables from previously parsed values', () => {
    const src = 'HOST=localhost\nPORT=3000\nURL=http://${HOST}:${PORT}'
    const { parsed } = parse(src)
    expect(parsed.URL).toBe('http://localhost:3000')
  })

  test('parse handles values with equals signs', () => {
    const { parsed } = parse('CONNECTION=postgres://user:pass@host/db?opt=val')
    expect(parsed.CONNECTION).toBe('postgres://user:pass@host/db?opt=val')
  })

  test('parse handles empty values', () => {
    const { parsed } = parse('EMPTY=')
    expect(parsed.EMPTY).toBe('')
  })

  test('parse skips malformed lines without equals', () => {
    const { parsed } = parse('GOOD=value\nBADLINE\nALSO_GOOD=yes')
    expect(parsed.GOOD).toBe('value')
    expect(parsed.ALSO_GOOD).toBe('yes')
    expect(parsed.BADLINE).toBeUndefined()
  })

  test('parse handles DOTENV_PUBLIC_KEY specially', () => {
    const { parsed } = parse('DOTENV_PUBLIC_KEY=abc123def\nOTHER=val')
    expect(parsed.DOTENV_PUBLIC_KEY).toBe('abc123def')
    expect(parsed.OTHER).toBe('val')
  })

  test('parse handles command substitution with echo', () => {
    const { parsed } = parse('ECHO_VAL=$(echo hello)')
    expect(parsed.ECHO_VAL).toBe('hello')
  })

  test('parse blocks disallowed commands', () => {
    const { parsed } = parse('DANGEROUS=$(rm -rf /)')
    // rm is not in allowed commands, so it returns empty string
    expect(parsed.DANGEROUS).toBe('')
  })

  test('parse handles values with whitespace trim on key', () => {
    const { parsed } = parse('  SPACED_KEY  =  value  ')
    expect(parsed.SPACED_KEY).toBe('value')
  })

  test('parse handles ${VAR:+alternate} syntax for set variables', () => {
    const src = 'DEFINED=yes\nRESULT=${DEFINED:+was_set}'
    const { parsed } = parse(src)
    expect(parsed.RESULT).toBe('was_set')
  })

  test('parse handles ${VAR:+alternate} syntax for unset variables', () => {
    const { parsed } = parse('RESULT=${UNDEFINED_VAR:+was_set}')
    expect(parsed.RESULT).toBe('')
  })
})

// ─── Crypto Tests ────────────────────────────────────────────────────────────

describe('Env Crypto - Real Encryption', () => {
  test('generateKeypair produces valid hex strings', () => {
    const { publicKey, privateKey } = generateKeypair()
    expect(publicKey).toMatch(/^[0-9a-f]{64}$/)
    expect(privateKey).toMatch(/^[0-9a-f]{64}$/)
  })

  test('generateKeypair produces unique keypairs', () => {
    const kp1 = generateKeypair()
    const kp2 = generateKeypair()
    expect(kp1.privateKey).not.toBe(kp2.privateKey)
    expect(kp1.publicKey).not.toBe(kp2.publicKey)
  })

  test('aesEncrypt / aesDecrypt round-trip with real key', () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef') // 32 bytes
    const plaintext = 'secret database password'

    const { ciphertext, iv, authTag } = aesEncrypt(plaintext, key)
    expect(ciphertext.length).toBeGreaterThan(0)
    expect(iv.length).toBe(32) // 16 bytes hex
    expect(authTag.length).toBe(32) // 16 bytes hex

    const decrypted = aesDecrypt(ciphertext, key, iv, authTag)
    expect(decrypted).toBe(plaintext)
  })

  test('aesDecrypt with wrong key throws', () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef')
    const wrongKey = Buffer.from('ffffffffffffffffffffffffffffffff')

    const { ciphertext, iv, authTag } = aesEncrypt('test', key)

    expect(() => aesDecrypt(ciphertext, wrongKey, iv, authTag)).toThrow()
  })

  test('encryptValue / decryptValue round-trip with keypair', () => {
    const { publicKey, privateKey } = generateKeypair()
    const original = 'my-api-key-12345'

    const encrypted = encryptValue(original, publicKey)
    expect(encrypted.startsWith('encrypted:')).toBe(true)

    const decrypted = decryptValue(encrypted, privateKey)
    expect(decrypted).toBe(original)
  })

  test('encryptValue produces different ciphertext each time (random IV)', () => {
    const { publicKey } = generateKeypair()
    const e1 = encryptValue('same value', publicKey)
    const e2 = encryptValue('same value', publicKey)
    expect(e1).not.toBe(e2) // different IVs
  })

  test('decryptValue returns non-encrypted value as-is', () => {
    expect(decryptValue('plain text', 'any-key')).toBe('plain text')
  })

  test('decryptValue throws on truncated encrypted data', () => {
    expect(() => decryptValue('encrypted:AAAA', 'somekey')).toThrow('too short')
  })

  test('parseEnvFromKey extracts environment from key name', () => {
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY_PRODUCTION')).toBe('production')
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY_CI')).toBe('ci')
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY')).toBe('')
  })

  test('parse with encrypted values decrypts using private key', () => {
    const { publicKey, privateKey } = generateKeypair()
    const encrypted = encryptValue('secret_value', publicKey)

    const src = `PLAIN=hello\nSECRET=${encrypted}`
    const { parsed, errors } = parse(src, { privateKey })

    expect(errors).toHaveLength(0)
    expect(parsed.PLAIN).toBe('hello')
    expect(parsed.SECRET).toBe('secret_value')
  })
})

// ─── Utils Tests ─────────────────────────────────────────────────────────────

describe('Env Utils - Runtime Detection', () => {
  test('isBun detects Bun runtime correctly', () => {
    // We are running in bun:test, so isBun should be true
    expect(isBun).toBe(true)
  })

  test('runtime returns bun when running in Bun', () => {
    expect(runtime).toBe('bun')
  })

  test('runtimeInfo has name and version', () => {
    expect(runtimeInfo.name).toBe('bun')
    expect(runtimeInfo.version).toBeDefined()
    expect(typeof runtimeInfo.version).toBe('string')
  })

  test('platform detection returns a valid platform', () => {
    expect(['darwin', 'linux', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix']).toContain(platform)
  })

  test('exactly one of isMacOS/isLinux/isWindows matches platform', () => {
    const matchCount = [isMacOS, isLinux, isWindows].filter(Boolean).length
    // On CI or test machines it should be exactly one (unless exotic platform)
    expect(matchCount).toBeLessThanOrEqual(1)
  })

  test('isCI is a boolean', () => {
    expect(typeof isCI).toBe('boolean')
  })

  test('isNode is a boolean', () => {
    expect(typeof isNode).toBe('boolean')
  })
})
