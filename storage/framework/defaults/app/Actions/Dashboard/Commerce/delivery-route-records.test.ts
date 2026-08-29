import { describe, expect, test } from 'bun:test'
import {
  indexDeliveryRouteCouriers,
  normalizeDeliveryRouteRecord,
} from './delivery-route-records'

describe('delivery route records', () => {
  const courier = {
    id: 2,
    name: 'Alex Morgan',
    vehicle_number: 'VAN-204',
    status: 'active',
  }
  const couriers = indexDeliveryRouteCouriers([courier])
  const base = {
    id: 1,
    courier: 'Alex Morgan',
    courier_id: 2,
    vehicle: 'VAN-204',
    stops: 8,
    delivery_time: 90,
    total_distance: 42,
    last_active: '2026-07-29 10:00:00',
    created_at: '2026-07-29 09:00:00',
    updated_at: null,
    uuid: null,
  }

  test('normalizes route metrics and the linked courier', () => {
    expect(normalizeDeliveryRouteRecord(base, couriers)).toEqual({
      id: 1,
      courier: 'Alex Morgan',
      courier_id: 2,
      courier_record: courier,
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

  test('rejects missing couriers and fractional operational counts', () => {
    expect(() => normalizeDeliveryRouteRecord(base, new Map()))
      .toThrow('DeliveryRoute 1.courier_id references missing Courier 2')
    expect(() => normalizeDeliveryRouteRecord({ ...base, courier_id: null, stops: 1.5 }, couriers))
      .toThrow('DeliveryRoute 1.stops must be an integer')
  })
})
