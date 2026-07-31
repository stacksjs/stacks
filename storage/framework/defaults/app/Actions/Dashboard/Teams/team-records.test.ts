import { describe, expect, test } from 'bun:test'
import {
  changedRows,
  hashInvitationToken,
  invitationExpiresAt,
  invitationStatus,
  invitationUrl,
  normalizeInvitationEmail,
  normalizeInvitationRole,
  parsePositiveId,
} from './team-records'

describe('team records', () => {
  test('normalizes ids, email addresses, and assignable roles', () => {
    expect(parsePositiveId('42')).toBe(42)
    expect(parsePositiveId('0')).toBeNull()
    expect(parsePositiveId('4.2')).toBeNull()
    expect(normalizeInvitationEmail('  Teammate@Example.COM ')).toBe('teammate@example.com')
    expect(normalizeInvitationEmail('not-an-email')).toBeNull()
    expect(normalizeInvitationRole(' ADMIN ')).toBe('admin')
    expect(normalizeInvitationRole('owner')).toBeNull()
  })

  test('normalizes update counts across supported database drivers', () => {
    expect(changedRows({ changes: 1 })).toBe(1)
    expect(changedRows({ affectedRows: 2 })).toBe(2)
    expect(changedRows([{ numUpdatedRows: 3n }])).toBe(3)
    expect(changedRows(null)).toBe(0)
  })

  test('hashes invitation bearers and builds an encoded acceptance URL', () => {
    expect(hashInvitationToken('invite-token')).toBe('f9e3c47d452a8fab2dc56ef07d766534cb2cd31c5f63de7107412acc65daa5b8')
    expect(invitationUrl('https://example.com/', 'a token')).toBe('https://example.com/team-invitations/a%20token')
  })

  test('derives expiry timestamps and expired display state deterministically', () => {
    const now = new Date('2026-07-30T12:00:00.000Z')
    expect(invitationExpiresAt(now, 7)).toBe('2026-08-06 12:00:00')
    expect(invitationStatus('pending', '2026-07-31 12:00:00', now)).toBe('pending')
    expect(invitationStatus('pending', '2026-07-29 12:00:00', now)).toBe('expired')
    expect(invitationStatus('accepted', '2026-07-29 12:00:00', now)).toBe('accepted')
  })
})
