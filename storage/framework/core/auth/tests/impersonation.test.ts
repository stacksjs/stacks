import type { ImpersonationSession } from '../src/impersonation'
import { expect, test } from 'bun:test'
import { createImpersonationService } from '../src/impersonation'

function fixture() {
  let row: ImpersonationSession | null = null
  let hash = ''
  let allowed = true
  let chained = false
  let auditAvailable = true
  let accesses = 0
  const service = createImpersonationService({
    async create(session, credentialHash) { row = structuredClone(session); hash = credentialHash },
    async find(credentialHash) { return credentialHash === hash ? row && structuredClone(row) : null },
    async acceptAccess(id, access, now) {
      if (!auditAvailable) throw new Error('Audit unavailable')
      if (row?.id !== id || row.endedAt !== null || row.expiresAt <= now) return false
      accesses++
      return true
    },
    async end(id, actorId, now) { if (row?.id === id && row.actorId === actorId) row.endedAt = now },
  }, {
    async currentActor() { return { userId: 1, sessionId: 'original-session', impersonating: chained } },
    async mayImpersonate() { return allowed },
  })
  return { service, revoke: () => { allowed = false }, chain: () => { chained = true }, failAudit: () => { auditAvailable = false }, accesses: () => accesses, hash: () => hash }
}

test('separate credentials resolve the subject with actor attribution and audit', async () => {
  const f = fixture()
  const { credential } = await f.service.start(2, 'Investigate missing workout')
  expect(f.hash()).not.toBe(credential)
  expect(f.hash()).toMatch(/^[a-f0-9]{64}$/)
  const view = await f.service.resolve(credential, { method: 'GET', path: '/health' })
  expect(view).toMatchObject({ actorId: 1, subjectId: 2, actorSessionId: 'original-session' })
  expect(f.accesses()).toBe(1)
  await f.service.end(credential)
  expect(await f.service.resolve(credential, { method: 'GET', path: '/health' })).toBeNull()
})

test('revoked authority and missing audits deny access', async () => {
  const f = fixture()
  const { credential } = await f.service.start(2, 'Investigate missing workout')
  f.failAudit()
  await expect(f.service.resolve(credential, { method: 'GET', path: '/health' })).rejects.toThrow('Audit unavailable')
  f.revoke()
  expect(await f.service.resolve(credential, { method: 'GET', path: '/health' })).toBeNull()
})

test('nested sessions, self impersonation, mutations and sensitive query logging are rejected', async () => {
  const f = fixture()
  await expect(f.service.start(1, 'Investigate missing workout')).rejects.toThrow()
  const { credential } = await f.service.start(2, 'Investigate missing workout')
  expect(await f.service.resolve(credential, { method: 'POST', path: '/auth/change-password' })).toBeNull()
  expect(await f.service.resolve(credential, { method: 'HEAD', path: '/payments' })).toBeNull()
  expect(await f.service.resolve(credential, { method: 'GET', path: '/health?token=secret' })).toBeNull()
  expect(await f.service.resolve(`${credential}0`, { method: 'GET', path: '/health' })).toBeNull()
  expect(f.accesses()).toBe(0)
  f.chain()
  await expect(f.service.start(3, 'Investigate missing workout')).rejects.toThrow()
})
