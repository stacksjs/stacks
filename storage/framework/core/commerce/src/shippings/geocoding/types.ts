/**
 * Address to coordinates, for delivery.
 *
 * A delivery needs a point, not a string: without one there is nothing to
 * measure a coverage radius against, nothing to draw on a tracking map, and
 * nothing to compute an ETA from. Every one of those was stubbed until this
 * existed.
 */

export interface GeocodeQuery {
  /** Street line, e.g. "12320 W Pico Blvd". */
  street: string
  /** Apartment, unit, floor. Not sent to the provider: it never helps a lookup. */
  unit?: string
  city?: string
  region?: string
  postalCode?: string
  /** ISO 3166-1 alpha-2. Narrows the search and cuts wrong-continent matches. */
  country?: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  /** The provider's normalised address, worth storing over the raw input. */
  formatted: string
  /**
   * 0 to 1. A rooftop match and a match on the city centre are both "results";
   * only one of them is somewhere a driver can deliver to, and a caller
   * accepting the second silently will ship to the wrong place.
   */
  confidence: number
  /** What the provider actually matched: a building, a street, a postcode, a city. */
  precision: GeocodePrecision
  provider: string
}

export type GeocodePrecision = 'rooftop' | 'street' | 'postal' | 'locality' | 'unknown'

export interface GeocodingDriver {
  readonly name: string
  geocode: (query: GeocodeQuery) => Promise<GeocodeResult | null>
}

export interface GeocodingOptions {
  driver?: GeocodingDriver
  /**
   * Reject anything less precise than this. Defaults to `street`: a delivery
   * to the middle of a postcode is not a delivery.
   */
  minimumPrecision?: GeocodePrecision
  /** Seconds to cache a lookup. Addresses repeat far more than they change. */
  cacheSeconds?: number
}

/** Ordered worst to best, so a minimum can be compared numerically. */
export const PRECISION_RANK: Record<GeocodePrecision, number> = {
  unknown: 0,
  locality: 1,
  postal: 2,
  street: 3,
  rooftop: 4,
}

/** A single line, in the order a geocoder expects to read it. */
export function formatQuery(query: GeocodeQuery): string {
  return [query.street, query.city, query.region, query.postalCode, query.country]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}
