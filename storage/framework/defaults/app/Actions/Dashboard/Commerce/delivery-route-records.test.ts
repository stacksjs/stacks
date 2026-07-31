import { describe, expect, test } from 'bun:test'
import {
  indexDeliveryRouteDrivers,
  normalizeDeliveryRouteRecord,
} from './delivery-route-records'

describe('delivery route records', () => {
  const driver = {
    id: 2,
    name: 'Alex Morgan',
    vehicle_number: 'VAN-204',
    status: 'active',
  }
  const drivers = indexDeliveryRouteDrivers([driver])
  const base = {
    id: 1,
    driver: 'Alex Morgan',
    driver_id: 2,
    vehicle: 'VAN-204',
    stops: 8,
    delivery_time: 90,
    total_distance: 42,
    last_active: '2026-07-29 10:00:00',
    created_at: '2026-07-29 09:00:00',
    updated_at: null,
    uuid: null,
  }

  test('normalizes route metrics and the linked driver', () => {
    expect(normalizeDeliveryRouteRecord(base, drivers)).toEqual({
      id: 1,
      driver: 'Alex Morgan',
      driver_id: 2,
      driver_record: driver,
      vehicle: 'VAN-204',
      stops: 8,
      delivery_time: 90,
      total_distance: 42,
      last_active: '2026-07-29T10:00:00.000Z',
      created_at: '2026-07-29T09:00:00.000Z',
      updated_at: '',
      uuid: '',
    })
  })

  test('rejects missing drivers and fractional operational counts', () => {
    expect(() => normalizeDeliveryRouteRecord(base, new Map()))
      .toThrow('DeliveryRoute 1.driver_id references missing Driver 2')
    expect(() => normalizeDeliveryRouteRecord({ ...base, driver_id: null, stops: 1.5 }, drivers))
      .toThrow('DeliveryRoute 1.stops must be an integer')
  })
})
