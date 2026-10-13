import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { apiKeyHint, generateApiKey, hashApiKey } from '../src/api-key'

describe('generateApiKey', () => {
  test('prefixes 32 random bytes and returns its SHA-256 digest and a hint', () => {
    const { key, hash, hint } = generateApiKey('hq_live_')
    expect(key).toMatch(/^hq_live_[\w-]{43}$/)
    expect(hash).toBe(createHash('sha256').update(key).digest('hex'))
    expect(hashApiKey(key)).toBe(hash)
    expect(hint).toBe(`hq_live_${key.slice(8, 12)}…${key.slice(-4)}`)
    expect(generateApiKey('hq_live_').key).not.toBe(key)
  })

  test('refuses fewer than 16 bytes', () => {
    expect(() => generateApiKey('', 8)).toThrow()
  })

  test('a short secret shows only its prefix', () => {
    expect(apiKeyHint('pk_abc', 'pk_')).toBe('pk_…')
    expect(apiKeyHint('abcdefghijkl')).toBe('abcd…ijkl')
  })
})
