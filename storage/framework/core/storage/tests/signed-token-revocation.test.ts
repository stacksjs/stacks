import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { clearRevokedSignedStorageTokens, createSignedStorageToken, revokeSignedStorageToken, verifySignedStorageToken } from '../src/signed-url'

const originalKey = process.env.APP_KEY
beforeEach(() => {
  process.env.APP_KEY = 'storage-revocation-test-key-32-chars'
  clearRevokedSignedStorageTokens()
})
afterEach(() => {
  if (originalKey === undefined) delete process.env.APP_KEY
  else process.env.APP_KEY = originalKey
  clearRevokedSignedStorageTokens()
})

describe('signed storage token revocation', () => {
  test('alternate signature encodings cannot bypass revocation', () => {
    const token = createSignedStorageToken('report.pdf', { expiresIn: 3600 })
    expect(verifySignedStorageToken(token, 'report.pdf').valid).toBe(true)
    revokeSignedStorageToken(token)
    expect(verifySignedStorageToken(token, 'report.pdf').valid).toBe(false)
    expect(verifySignedStorageToken(`${token}=`, 'report.pdf').valid).toBe(false)
  })

  test('revoking a padded bare signature also revokes the canonical token', () => {
    const token = createSignedStorageToken('report.pdf', { expiresIn: 3600 })
    revokeSignedStorageToken(`${token.split('.')[2]}=`)
    expect(verifySignedStorageToken(token, 'report.pdf').reason).toBe('revoked')
  })

  test('capacity exhaustion fails explicitly and keeps unexpired revocations', () => {
    const token = createSignedStorageToken('report.pdf', { expiresIn: 3600 })
    revokeSignedStorageToken(token)
    for (let i = 0; i < 99_999; i++)
      revokeSignedStorageToken(createHash('sha256').update(String(i)).digest('base64url'))
    expect(() => revokeSignedStorageToken(createHash('sha256').update('overflow').digest('base64url'))).toThrow(/capacity/i)
    expect(verifySignedStorageToken(token, 'report.pdf').reason).toBe('revoked')
  }, 15_000)

  test('capacity is reclaimed only after authenticated token expiries pass', () => {
    const realNow = Date.now
    const now = realNow()
    try {
      Date.now = () => now
      for (let i = 0; i < 100_000; i++)
        revokeSignedStorageToken(createSignedStorageToken(`expired/${i}`, { expiresIn: 1 }))
      Date.now = () => now + 2000
      const next = createSignedStorageToken('next.pdf', { expiresIn: 3600 })
      expect(() => revokeSignedStorageToken(next)).not.toThrow()
      expect(verifySignedStorageToken(next, 'next.pdf').reason).toBe('revoked')
    }
    finally { Date.now = realNow }
  }, 15_000)
})
