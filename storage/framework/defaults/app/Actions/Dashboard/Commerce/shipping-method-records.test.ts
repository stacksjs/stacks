import { describe, expect, test } from 'bun:test'
import {
  groupShippingMethodZones,
  normalizeShippingMethodRecord,
  shippingMethodIds,
} from './shipping-method-records'

describe('shipping method records', () => {
  test('normalizes methods and their zone summaries', () => {
    const method = {
      id: 1,
      name: 'Ground',
      description: null,
      base_rate: 599,
      free_shipping: null,
      status: 'active',
      created_at: '2026-07-29 10:00:00',
      updated_at: null,
      uuid: null,
    }
    const ids = shippingMethodIds([method])
    const zones = groupShippingMethodZones([
      { id: 2, name: 'Domestic', shipping_method_id: 1 },
    ], ids)
    expect(normalizeShippingMethodRecord(method, zones)).toEqual({
      id: 1,
      name: 'Ground',
      description: '',
      base_rate: 599,
      free_shipping: null,
      status: 'active',
      shipping_zones: [{ id: 2, name: 'Domestic' }],
      created_at: '2026-07-29T10:00:00.000Z',
      updated_at: '',
      uuid: '',
    })
  })

  test('rejects fractional minor units and missing method relationships', () => {
    const method = {
      id: 1,
      name: 'Ground',
      description: '',
      base_rate: 599.5,
      free_shipping: null,
      status: 'active',
      created_at: '2026-07-29 10:00:00',
    }
    expect(() => normalizeShippingMethodRecord(method, new Map()))
      .toThrow('ShippingMethod 1.base_rate must be an integer')
    expect(() => groupShippingMethodZones([
      { id: 2, name: 'Domestic', shipping_method_id: 9 },
    ], new Set([1]))).toThrow('ShippingZone 2.shipping_method_id references missing ShippingMethod 9')
  })
})
