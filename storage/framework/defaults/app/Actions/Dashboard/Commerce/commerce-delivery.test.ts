import { describe, expect, test } from 'bun:test'
import {
  buildDeliveryOverview,
  deliveryTimestamp,
  formatDeliveryDuration,
} from './commerce-delivery'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('commerce delivery overview', () => {
  test('normalizes numeric and database timestamps', () => {
    expect(deliveryTimestamp('1785326400000')).toBe(1785326400000)
    expect(deliveryTimestamp('1785326400')).toBe(1785326400000)
    expect(deliveryTimestamp('2026-07-29 12:00:00')).toBe(now.getTime())
    expect(() => deliveryTimestamp('invalid')).toThrow('valid Unix or ISO timestamp')
    expect(formatDeliveryDuration(45)).toBe('45 min')
    expect(formatDeliveryDuration(135)).toBe('2h 15m')
  })

  test('builds an active, relation-aware overview from persisted records', () => {
    const result = buildDeliveryOverview(
      [
        { id: 1, name: 'Ground', status: 'draft', base_rate: 900, free_shipping: null },
        { id: 2, name: 'Express', status: 'active', base_rate: 1500, free_shipping: 5000 },
      ],
      [
        {
          id: 1,
          driver_id: 7,
          driver: 'Old Driver Name',
          vehicle: 'Old Vehicle',
          stops: 4,
          delivery_time: 90,
          total_distance: 31,
          last_active: now.getTime() - 60 * 60 * 1000,
        },
        {
          id: 2,
          driver: 'Stale Driver',
          vehicle: 'Van S1',
          stops: 8,
          delivery_time: 180,
          total_distance: 70,
          last_active: now.getTime() - 25 * 60 * 60 * 1000,
        },
      ],
      [
        { id: 1, name: 'Draft Zone', status: 'draft', countries: 'US, CA', regions: 'West' },
        { id: 2, name: 'Active Zone', status: 'active', countries: '["US","CA"]', regions: '["West"]' },
      ],
      [
        { id: 7, name: 'Current Driver', vehicle_number: 'VAN-7', status: 'on_delivery' },
        { id: 8, name: 'Available Driver', vehicle_number: 'VAN-8', status: 'active' },
      ],
      'EUR',
      now,
    )

    expect(result.stats.map(stat => stat.value)).toEqual(['1', '1', '1h 30m', '1'])
    expect(result.routes).toEqual([
      {
        id: 1,
        driver: 'Current Driver',
        vehicle: 'VAN-7',
        stops: 4,
        duration: '1h 30m',
        distance: '31 mi',
        lastActive: now.getTime() - 60 * 60 * 1000,
      },
    ])
    expect(result.methods[0]).toMatchObject({
      name: 'Express',
      status: 'active',
      baseRate: '€15.00',
      freeShipping: '€50.00',
    })
    expect(result.methods[1]?.freeShipping).toBe('Not enabled')
    expect(result.zones[0]).toMatchObject({ name: 'Active Zone', countries: 2, regions: 1 })
    expect(result.drivers).toEqual({
      total: 2,
      active: 1,
      onDelivery: 1,
      onBreak: 0,
    })
  })

  test('rejects corrupt delivery records and missing driver relationships', () => {
    expect(() => buildDeliveryOverview(
      [{ id: 1, name: 'Ground', status: 'active', base_rate: 'free', free_shipping: null }],
      [],
      [],
      [],
      'USD',
      now,
    )).toThrow('ShippingMethod 1.base_rate must be a finite number')

    expect(() => buildDeliveryOverview(
      [],
      [{
        id: 1,
        driver_id: 99,
        driver: 'Recorded driver',
        vehicle: 'Recorded vehicle',
        stops: 1,
        delivery_time: 30,
        total_distance: 5,
        last_active: now.toISOString(),
      }],
      [],
      [],
      'USD',
      now,
    )).toThrow('DeliveryRoute 1.driver_id references missing Driver 99')
  })
})
