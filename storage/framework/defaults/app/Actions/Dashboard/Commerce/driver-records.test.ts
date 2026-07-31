import { describe, expect, test } from 'bun:test'
import { indexDriverUsers, normalizeDriverRecord } from './driver-records'

describe('driver records', () => {
  const user = { id: 2, name: 'Ada Lovelace', email: 'ada@example.com' }
  const users = indexDriverUsers([user])
  const base = {
    id: 1,
    name: 'Alex Morgan',
    phone: '+1 555 0100',
    vehicle_number: 'VAN-204',
    license: 'D1234567',
    status: 'active',
    user_id: 2,
    created_at: '2026-07-29 10:00:00',
    updated_at: null,
    uuid: null,
  }

  test('normalizes drivers and linked users', () => {
    expect(normalizeDriverRecord(base, users)).toEqual({
      id: 1,
      name: 'Alex Morgan',
      phone: '+1 555 0100',
      vehicle_number: 'VAN-204',
      license: 'D1234567',
      status: 'active',
      user_id: 2,
      user,
      created_at: '2026-07-29T10:00:00.000Z',
      updated_at: '',
      uuid: '',
    })
  })

  test('rejects missing users and unknown statuses', () => {
    expect(() => normalizeDriverRecord(base, new Map()))
      .toThrow('Driver 1.user_id references missing User 2')
    expect(() => normalizeDriverRecord({ ...base, user_id: null, status: 'offline' }, users))
      .toThrow('Driver 1.status must be active or on_delivery or on_break')
  })
})
