/**
 * Geodesy for delivery tracking. Small on purpose: everything here is used on
 * the hot path (a ping arrives every few seconds per driver) and none of it
 * justifies a dependency.
 */

/** Mean Earth radius, metres. */
const EARTH_RADIUS_M = 6_371_008.8

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

export interface Coordinates {
  latitude: number
  longitude: number
}

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than Vincenty: over the few kilometres a delivery covers
 * the difference is centimetres, and a tracking map that is 5cm out is not a
 * tracking map that is wrong.
 */
export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/**
 * Initial bearing in degrees clockwise from true north.
 *
 * Used when a device reports position but no heading, which is common on
 * phones held still: the marker still needs to point somewhere sensible, and
 * the direction of travel between the last two fixes is that somewhere.
 */
export function bearingInDegrees(from: Coordinates, to: Coordinates): number {
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)
  const dLon = toRadians(to.longitude - from.longitude)

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

/**
 * Seconds until arrival, from remaining distance and recent speed.
 *
 * Straight-line distance over ground speed is a floor, not a promise: it
 * ignores every road, light and left turn between here and there. It is
 * multiplied by `detourFactor` to account for the fact that streets are not
 * great circles, and clamped below by `minimumSeconds` so an ETA never reads
 * "arriving now" from two blocks away.
 *
 * Returns null when the driver is stopped, because dividing by zero speed
 * produces Infinity and showing "arriving in ∞ minutes" is worse than showing
 * nothing.
 */
export function estimateSecondsRemaining(
  distanceMeters: number,
  speedMetersPerSecond: number,
  options: { detourFactor?: number, minimumSeconds?: number } = {},
): number | null {
  const detourFactor = options.detourFactor ?? 1.35
  const minimumSeconds = options.minimumSeconds ?? 30

  if (!Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond <= 0.5)
    return null

  const seconds = (distanceMeters * detourFactor) / speedMetersPerSecond

  return Math.max(minimumSeconds, Math.round(seconds))
}

/** True when `point` is within `radiusMeters` of `target`. */
export function isWithin(point: Coordinates, target: Coordinates, radiusMeters: number): boolean {
  return distanceInMeters(point, target) <= radiusMeters
}

/** Whether a pair of coordinates is usable at all. */
export function hasCoordinates(value: Partial<Coordinates> | null | undefined): value is Coordinates {
  return typeof value?.latitude === 'number'
    && typeof value?.longitude === 'number'
    && Number.isFinite(value.latitude)
    && Number.isFinite(value.longitude)
}
