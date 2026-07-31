import { describe, expect, test } from 'bun:test'
import { normalizeDigitalDeliveryRecord } from './digital-delivery-records'

describe('digital delivery records', () => {
  test('normalizes persisted delivery settings', () => {
    expect(normalizeDigitalDeliveryRecord({
      id: 1,
      name: 'Secure download',
      description: 'Authenticated file delivery',
      download_limit: null,
      expiry_days: 30,
      requires_login: 1,
      automatic_delivery: 0,
      status: 'active',
      created_at: '2026-07-29 10:00:00',
      updated_at: null,
      uuid: null,
    })).toEqual({
      id: 1,
      name: 'Secure download',
      description: 'Authenticated file delivery',
      download_limit: null,
      expiry_days: 30,
      requires_login: true,
      automatic_delivery: false,
      status: 'active',
      created_at: '2026-07-29T10:00:00.000Z',
      updated_at: '',
      uuid: '',
    })
  })

  test('rejects invalid limits, flags, and statuses', () => {
    const base = {
      id: 1,
      name: 'Secure download',
      description: 'Authenticated file delivery',
      download_limit: 5,
      expiry_days: 30,
      requires_login: true,
      automatic_delivery: false,
      status: 'active',
      created_at: '2026-07-29 10:00:00',
    }
    expect(() => normalizeDigitalDeliveryRecord({ ...base, download_limit: 1.5 }))
      .toThrow('DigitalDelivery 1.download_limit must be an integer')
    expect(() => normalizeDigitalDeliveryRecord({ ...base, requires_login: 'yes' }))
      .toThrow('DigitalDelivery 1.requires_login must be a boolean')
    expect(() => normalizeDigitalDeliveryRecord({ ...base, status: 'pending' }))
      .toThrow('DigitalDelivery 1.status must be active or inactive')
  })
})
