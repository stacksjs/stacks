import { describe, expect, it } from 'bun:test'
import { canTransition } from '../src/orders/events'
import {
  bearingInDegrees,
  distanceInMeters,
  estimateSecondsRemaining,
  hasCoordinates,
  isWithin,
  orderTrackingChannel,
  routeTrackingChannel,
} from '../src/shippings/tracking'

// Two real West LA points about 1.1km apart: the ERBA storefronts on
// Sawtelle and Pico. Real coordinates rather than round numbers, so a bug
// that only shows up off the equator cannot hide.
const SAWTELLE = { latitude: 34.0361, longitude: -118.4453 }
const PICO = { latitude: 34.0281, longitude: -118.4523 }

describe('distanceInMeters', () => {
  it('measures a known short hop', () => {
    const meters = distanceInMeters(SAWTELLE, PICO)

    expect(meters).toBeGreaterThan(1050)
    expect(meters).toBeLessThan(1150)
  })

  it('is zero for a point against itself', () => {
    expect(distanceInMeters(SAWTELLE, SAWTELLE)).toBe(0)
  })

  it('is symmetric', () => {
    expect(distanceInMeters(SAWTELLE, PICO)).toBeCloseTo(distanceInMeters(PICO, SAWTELLE), 6)
  })

  it('handles the antimeridian without blowing up', () => {
    // Longitudes 179.9 and -179.9 are 0.2 degrees apart, not 359.8.
    const meters = distanceInMeters(
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 },
    )

    expect(meters).toBeLessThan(25_000)
  })
})

describe('bearingInDegrees', () => {
  it('reads due north as 0 and due east as 90', () => {
    expect(bearingInDegrees({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(0, 1)
    expect(bearingInDegrees({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(90, 1)
  })

  it('always returns a value inside one turn', () => {
    const bearing = bearingInDegrees(PICO, SAWTELLE)

    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThan(360)
  })
})

describe('estimateSecondsRemaining', () => {
  it('pads straight-line distance for the fact that streets are not great circles', () => {
    // 1000m at 10m/s is 100s as the crow flies; the detour factor makes it more.
    const seconds = estimateSecondsRemaining(1000, 10)

    expect(seconds).toBeGreaterThan(100)
    expect(seconds).toBeLessThan(200)
  })

  it('returns null for a stationary driver rather than Infinity', () => {
    expect(estimateSecondsRemaining(1000, 0)).toBeNull()
    expect(estimateSecondsRemaining(1000, 0.2)).toBeNull()
  })

  it('never promises an arrival sooner than the floor', () => {
    expect(estimateSecondsRemaining(5, 25)).toBe(30)
  })
})

describe('isWithin / hasCoordinates', () => {
  it('answers the radius question both ways', () => {
    expect(isWithin(SAWTELLE, PICO, 2000)).toBe(true)
    expect(isWithin(SAWTELLE, PICO, 100)).toBe(false)
  })

  it('rejects a half-populated position', () => {
    expect(hasCoordinates(SAWTELLE)).toBe(true)
    expect(hasCoordinates({ latitude: 34.03 })).toBe(false)
    expect(hasCoordinates(null)).toBe(false)
    expect(hasCoordinates({ latitude: Number.NaN, longitude: 0 })).toBe(false)
  })
})

describe('tracking channels', () => {
  it('names one channel per order and per route', () => {
    expect(orderTrackingChannel(42)).toBe('order.42')
    expect(routeTrackingChannel(7)).toBe('delivery-route.7')
  })
})

describe('OUT_FOR_DELIVERY transitions', () => {
  it('is reachable from both a courier handoff and a direct dispatch', () => {
    expect(canTransition('SHIPPED', 'OUT_FOR_DELIVERY')).toBe(true)
    expect(canTransition('PROCESSING', 'OUT_FOR_DELIVERY')).toBe(true)
  })

  it('completes to DELIVERED', () => {
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true)
  })

  it('falls back to SHIPPED when a drop fails and the parcel returns to the depot', () => {
    expect(canTransition('OUT_FOR_DELIVERY', 'SHIPPED')).toBe(true)
  })

  it('still refuses to walk a delivered order backwards', () => {
    expect(canTransition('DELIVERED', 'OUT_FOR_DELIVERY')).toBe(false)
    expect(canTransition('OUT_FOR_DELIVERY', 'PENDING')).toBe(false)
    expect(canTransition('REFUNDED', 'OUT_FOR_DELIVERY')).toBe(false)
  })
})

describe('transitionPath (via the dispatch flow)', () => {
  // A storefront order sits at PENDING until someone accepts it, and
  // PENDING -> OUT_FOR_DELIVERY is not a legal edge. Loading it onto a vehicle
  // IS the accept, so the dispatch path has to walk PROCESSING rather than
  // silently leave the customer's order reading "pending" while a van drives
  // to their door. These assert the edges that walk depends on.
  it('has a two-hop route from a fresh order to the vehicle', () => {
    expect(canTransition('PENDING', 'OUT_FOR_DELIVERY')).toBe(false)
    expect(canTransition('PENDING', 'PROCESSING')).toBe(true)
    expect(canTransition('PROCESSING', 'OUT_FOR_DELIVERY')).toBe(true)
  })

  it('has no route out of a terminal state, one hop or two', () => {
    expect(canTransition('REFUNDED', 'PROCESSING')).toBe(false)
    expect(canTransition('REFUNDED', 'SHIPPED')).toBe(false)
  })
})
