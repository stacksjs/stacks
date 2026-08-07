import type { Coordinates } from '../tracking/geo'
import type { GeocodePrecision, GeocodeQuery, GeocodeResult, GeocodingDriver, GeocodingOptions } from './types'
import { distanceInMeters } from '../tracking/geo'
import { nominatimDriver } from './nominatim'
import { formatQuery, PRECISION_RANK } from './types'

export { nominatimDriver } from './nominatim'
export type {
  GeocodePrecision,
  GeocodeQuery,
  GeocodeResult,
  GeocodingDriver,
  GeocodingOptions,
} from './types'
export { formatQuery, PRECISION_RANK } from './types'

let configured: GeocodingDriver | null = null

/** Swap the provider once, at boot. */
export function setGeocodingDriver(driver: GeocodingDriver): void {
  configured = driver
}

export function geocodingDriver(): GeocodingDriver {
  return configured ?? nominatimDriver()
}

/**
 * Resolve an address to a point.
 *
 * Cached, because addresses repeat far more than they change: the same
 * customer orders from the same flat, and half a building orders from the same
 * street. A cache miss is a network round trip and, on the default provider, a
 * one-second rate-limit wait, so this matters at checkout.
 *
 * Returns null rather than throwing when the address cannot be found or is not
 * precise enough to deliver to. A provider that is down DOES throw: "we cannot
 * check right now" and "that address does not exist" are different answers and
 * a checkout should treat them differently.
 */
export async function geocode(
  query: GeocodeQuery,
  options: GeocodingOptions = {},
): Promise<GeocodeResult | null> {
  const driver = options.driver ?? geocodingDriver()
  const minimum = options.minimumPrecision ?? 'street'
  const key = `geocode:${driver.name}:${formatQuery(query).toLowerCase()}`

  const cached = await readCache(key)
  if (cached !== undefined)
    return cached

  const result = await driver.geocode(query)
  const usable = result && PRECISION_RANK[result.precision] >= PRECISION_RANK[minimum]
    ? result
    : null

  // A negative result is cached too, at a shorter horizon: a typo'd address
  // gets retried on every checkout attempt otherwise, and each retry is
  // another rate-limited round trip.
  await writeCache(key, usable, usable ? (options.cacheSeconds ?? 60 * 60 * 24 * 30) : 60 * 10)

  return usable
}

export interface CoverageCheck {
  covered: boolean
  distanceMeters: number
  /** The origin that came closest, when several were offered. */
  nearest: Coordinates
}

/**
 * Is this address inside the delivery area?
 *
 * A radius from the fulfilling store, which is how a local delivery operation
 * actually thinks about coverage, and cheap enough to run at checkout. Pass
 * every store to find the one that should take the order.
 *
 * `ShippingZone` remains the tool for postcode or region rules; this is for
 * "we deliver within five miles", which no postcode list expresses well.
 */
export function checkCoverage(
  destination: Coordinates,
  origins: readonly Coordinates[],
  radiusMeters: number,
): CoverageCheck | null {
  if (origins.length === 0)
    return null

  let nearest = origins[0] as Coordinates
  let shortest = distanceInMeters(destination, nearest)

  for (const origin of origins.slice(1)) {
    const distance = distanceInMeters(destination, origin)
    if (distance < shortest) {
      shortest = distance
      nearest = origin
    }
  }

  return {
    covered: shortest <= radiusMeters,
    distanceMeters: Math.round(shortest),
    nearest,
  }
}

/**
 * Cache access that degrades to "no cache" rather than failing the lookup.
 *
 * Geocoding has to work in a CLI script and a migration, where the cache
 * driver may not be configured at all. Losing the cache costs a round trip;
 * throwing costs the checkout.
 */
async function readCache(key: string): Promise<GeocodeResult | null | undefined> {
  try {
    const mod = await import('@stacksjs/cache').catch(() => null)
    const cache = (mod as { cache?: { get: (k: string) => Promise<unknown> } } | null)?.cache
    if (!cache)
      return undefined

    const raw = await cache.get(key)
    if (raw === null || raw === undefined)
      return undefined

    // A cached miss is stored as the string 'null' to stay distinguishable
    // from "nothing cached".
    return raw === 'null' ? null : JSON.parse(String(raw)) as GeocodeResult
  }
  catch {
    return undefined
  }
}

async function writeCache(key: string, value: GeocodeResult | null, seconds: number): Promise<void> {
  try {
    const mod = await import('@stacksjs/cache').catch(() => null)
    const cache = (mod as { cache?: { set: (k: string, v: string, ttl?: number) => Promise<unknown> } } | null)?.cache
    if (!cache)
      return

    await cache.set(key, value === null ? 'null' : JSON.stringify(value), seconds)
  }
  catch {
    // Same reasoning as the read.
  }
}
