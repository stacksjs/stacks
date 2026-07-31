import { describe, expect, test } from 'bun:test'
import {
  indexShippingZoneMethods,
  normalizeShippingZoneRecord,
} from './shipping-zone-records'

describe('shipping zone records', () => {
  const method = { id: 2, name: 'Ground', status: 'active' }
  const methods = indexShippingZoneMethods([method])

  test('normalizes lists and the shipping method relationship', () => {
    expect(normalizeShippingZoneRecord({
      id: 1,
      name: 'Domestic',
      countries: '["US","CA"]',
      regions: 'West, East',
      postal_codes: [],
      shipping_method_id: 2,
      status: 'active',
      created_at: '2026-07-29 10:00:00',
      updated_at: null,
      uuid: null,
    }, methods)).toEqual({
      id: 1,
      name: 'Domestic',
      countries: ['US', 'CA'],
      regions: ['West', 'East'],
      postal_codes: [],
      shipping_method_id: 2,
      status: 'active',
      shipping_method: method,
      created_at: '2026-07-29T10:00:00.000Z',
      updated_at: '',
      uuid: '',
    })
  })

  test('rejects invalid list JSON and missing methods', () => {
    const base = {
      id: 1,
      name: 'Domestic',
      countries: [],
      regions: [],
      postal_codes: [],
      shipping_method_id: 2,
      status: 'active',
      created_at: '2026-07-29 10:00:00',
    }
    expect(() => normalizeShippingZoneRecord({ ...base, countries: '{"US":true}' }, methods))
      .toThrow('ShippingZone 1.countries must be a JSON array or delimited string list')
    expect(() => normalizeShippingZoneRecord({ ...base, shipping_method_id: 9 }, methods))
      .toThrow('ShippingZone 1.shipping_method_id references missing ShippingMethod 9')
  })
})
