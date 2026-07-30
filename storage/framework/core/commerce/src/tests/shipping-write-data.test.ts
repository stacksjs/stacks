import { describe, expect, test } from 'bun:test'
import {
  deliveryRouteWriteData,
  digitalDeliveryWriteData,
  driverWriteData,
  licenseKeyWriteData,
  shippingMethodWriteData,
  shippingRateWriteData,
  shippingZoneWriteData,
} from '../shippings/write-data'

describe('commerce shipping write data', () => {
  test('maps camel-case model input to database columns', () => {
    expect(shippingRateWriteData({
      weightFrom: 0,
      weightTo: 10,
      shippingMethodId: 3,
      shippingZoneId: 7,
      rate: 1299,
    })).toEqual({
      weight_from: 0,
      weight_to: 10,
      shipping_method_id: 3,
      shipping_zone_id: 7,
      rate: 1299,
    })
    expect(digitalDeliveryWriteData({
      downloadLimit: null,
      expiryDays: 30,
      requiresLogin: true,
      automaticDelivery: false,
    })).toEqual({
      download_limit: null,
      expiry_days: 30,
      requires_login: true,
      automatic_delivery: false,
    })
  })

  test('accepts database-shaped dashboard payloads', () => {
    expect(shippingMethodWriteData({ base_rate: 500, free_shipping: null })).toEqual({
      base_rate: 500,
      free_shipping: null,
    })
    expect(shippingZoneWriteData({
      postal_codes: '["90210"]',
      shipping_method_id: 2,
    })).toEqual({
      postal_codes: '["90210"]',
      shipping_method_id: 2,
    })
  })

  test('drops identifiers, timestamps, and expanded relationships', () => {
    expect(driverWriteData({
      id: 9,
      uuid: 'immutable',
      created_at: '2026-01-01',
      name: 'Alex',
      vehicleNumber: 'VAN-3',
      delivery_routes: [{ id: 1 }],
    })).toEqual({
      name: 'Alex',
      vehicle_number: 'VAN-3',
    })
    expect(licenseKeyWriteData({
      key: 'AAAA-BBBB-CCCC-DDDD-EEEE',
      expiryDate: '2027-01-01 00:00:00',
      product: { id: 4 },
    })).toEqual({
      key: 'AAAA-BBBB-CCCC-DDDD-EEEE',
      expiry_date: '2027-01-01 00:00:00',
    })
    expect(deliveryRouteWriteData({
      driver: 'Alex',
      driverId: 12,
      deliveryTime: 45,
      lastActive: 123,
      unknown: true,
    })).toEqual({
      driver: 'Alex',
      driver_id: 12,
      delivery_time: 45,
      last_active: 123,
    })
  })
})
