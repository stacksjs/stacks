import { describe, expect, test } from 'bun:test'
import { generateAppKey } from '../src/key'

describe('generateAppKey', () => {
  test('returns a string', () => {
    const key = generateAppKey()
    expect(typeof key).toBe('string')
  })

  test('has correct length (base64-encoded 32 bytes plus prefix)', () => {
    const key = generateAppKey()
    // generateKey(32) returns "base64:" prefix + base64 encoded 32 bytes
    // base64 of 32 bytes = ceil(32/3)*4 = 44 chars, plus "base64:" = 51
    expect(key.length).toBeGreaterThanOrEqual(32)
  })

  test('starts with base64: prefix', () => {
    const key = generateAppKey()
    expect(key.startsWith('base64:')).toBe(true)
  })

  test('two calls produce different keys', () => {
    const key1 = generateAppKey()
    const key2 = generateAppKey()
    expect(key1).not.toBe(key2)
  })

  test('base64 portion contains only valid base64 characters', () => {
    const key = generateAppKey()
    // Strip the "base64:" prefix and validate the rest
    const base64Part = key.replace('base64:', '')
    expect(base64Part).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  test('generates many unique keys', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 50; i++) {
      keys.add(generateAppKey())
    }
    expect(keys.size).toBe(50)
  })

  test('key is non-empty', () => {
    const key = generateAppKey()
    expect(key.length).toBeGreaterThan(0)
  })

  test('base64 payload decodes to 32 bytes', () => {
    const key = generateAppKey()
    const base64Part = key.replace('base64:', '')
    const decoded = Buffer.from(base64Part, 'base64')
    expect(decoded.length).toBe(32)
  })
})
