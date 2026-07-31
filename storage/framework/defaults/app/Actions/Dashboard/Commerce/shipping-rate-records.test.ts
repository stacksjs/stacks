import { describe, expect, test } from 'bun:test'
import {
  indexShippingRateMethods,
  indexShippingRateZones,
  normalizeShippingRateRecord,
} from './shipping-rate-records'

describe('shipping rate records', () => {
  const methods = indexShippingRateMethods([{ id: 1, name: 'Ground', status: 'active' }])
  const zones = indexShippingRateZones([
    { id: 2, name: 'Domestic', status: 'active', shipping_method_id: 1 },
  ])
  const base = {
    id: 3,
    shipping_method_id: 1,
    shipping_zone_id: 2,
    weight_from: 0,
    weight_to: 10,
    rate: 599,
    created_at: '2026-07-29 10:00:00',
  }

  test('normalizes weight bands and both relationships', () => {
    expect(normalizeShippingRateRecord(base, methods, zones)).toEqual({
      id: 3,
      shipping_method_id: 1,
      shipping_zone_id: 2,
      weight_from: 0,
      weight_to: 10,
      rate: 599,
      shipping_method: { id: 1, name: 'Ground', status: 'active' },
      shipping_zone: { id: 2, name: 'Domestic', status: 'active' },
      created_at: '2026-07-29T10:00:00.000Z',
      updated_at: '',
      uuid: '',
    })
  })

  test('rejects inverted bands and method-zone mismatches', () => {
    expect(() => normalizeShippingRateRecord({ ...base, weight_to: -1 }, methods, zones))
      .toThrow('ShippingRate 3.weight_to must be at least 0')
    const mismatchedZones = indexShippingRateZones([
      { id: 2, name: 'Domestic', status: 'active', shipping_method_id: 9 },
    ])
    expect(() => normalizeShippingRateRecord(base, methods, mismatchedZones))
      .toThrow('ShippingRate 3.shipping_zone_id references ShippingZone 2 assigned to ShippingMethod 9')
  })
})
