type ShippingRateJsonResponse = ModelRow<typeof ShippingRate>
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping rate by ID
 */
export async function fetchById(id: number): Promise<ShippingRateJsonResponse | undefined> {
  const model = await db
    .selectFrom('shipping_rates')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (model) {
    let shippingZone = null
    let shippingMethod = null

    if (model.shipping_zone_id) {
      shippingZone = await db
        .selectFrom('shipping_zones')
        .where('id', '=', model.shipping_zone_id)
        .selectAll()
        .executeTakeFirst()
    }

    if (model.shipping_method_id) {
      shippingMethod = await db
        .selectFrom('shipping_methods')
        .where('id', '=', model.shipping_method_id)
        .selectAll()
        .executeTakeFirst()
    }

    return {
      ...model,
      shipping_zone: shippingZone,
      shipping_method: shippingMethod,
    } as unknown as ShippingRateJsonResponse
  }

  return undefined
}

/**
 * Fetch all shipping rates with their shipping zones and methods
 */
export async function fetchAll(): Promise<ShippingRateJsonResponse[]> {
  // Fetch all shipping rates
  const models = await db.selectFrom('shipping_rates').selectAll().execute()

  // Get the IDs of all shipping zones and methods
  const shippingZoneIds = models.map((model: any) => model.shipping_zone_id).filter((id: any) => id !== null && id !== undefined)
  const shippingMethodIds = models.map((model: any) => model.shipping_method_id).filter((id: any) => id !== null && id !== undefined)

  let shippingZonesQuery = db.selectFrom('shipping_zones') as any
  let shippingMethodsQuery = db.selectFrom('shipping_methods') as any

  if (shippingZoneIds.length > 0) {
    shippingZonesQuery = shippingZonesQuery.where('id', 'in', shippingZoneIds)
  }

  if (shippingMethodIds.length > 0) {
    shippingMethodsQuery = shippingMethodsQuery.where('id', 'in', shippingMethodIds)
  }

  // Fetch shipping zones and methods for these specific IDs using WHERE IN
  const allShippingZones = await shippingZonesQuery.selectAll().execute()
  const allShippingMethods = await shippingMethodsQuery.selectAll().execute()

  // Group shipping zones and methods by ID
  const shippingZonesById = allShippingZones.reduce((acc: any, zone: any) => {
    acc[zone.id] = zone
    return acc
  }, {} as Record<number, typeof allShippingZones[0]>)

  const shippingMethodsById = allShippingMethods.reduce((acc: any, method: any) => {
    acc[method.id] = method
    return acc
  }, {} as Record<number, typeof allShippingMethods[0]>)

  // Attach shipping zones and methods to each shipping rate
  return models.map((model: any) => ({
    ...model,
    shipping_zone: model.shipping_zone_id ? shippingZonesById[model.shipping_zone_id] : [],
    shipping_method: model.shipping_method_id ? shippingMethodsById[model.shipping_method_id] : [],
  }))
}

/**
 * Get shipping rates by zone
 *
 * @param zoneId Shipping zone identifier
 * @returns List of shipping rates for the specified zone
 */
export async function getRatesByZone(zoneId: number): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('shipping_zone_id', '=', zoneId)
      .orderBy('weight_from')
      .execute()

    return rates as ShippingRateJsonResponse[]
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rates by zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get shipping rate based on weight and zone.
 *
 * **⚠️ Caller-trusted zone (stacksjs/stacks#1879 Co-11).** This
 * function does NOT verify that the `zoneId` actually serves the
 * customer's declared address. A user in NYC can pass a Texas
 * `zoneId` and get cheaper shipping. Use `getRateByWeightAndAddress`
 * below when the request boundary involves untrusted input — it
 * resolves the zone server-side from the address.
 *
 * Kept for back-compat with internal callers that have already
 * resolved the zone (admin tooling, scheduled fulfillment jobs).
 *
 * @param weight Weight in the appropriate unit
 * @param zoneId Shipping zone identifier (caller-trusted)
 * @returns Matching shipping rate or undefined
 */
export async function getRateByWeightAndZone(weight: number, zoneId: number): Promise<ShippingRateJsonResponse | undefined> {
  try {
    const rate = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('shipping_zone_id', '=', zoneId)
      .where('weight_from', '<=', weight)
      .where('weight_to', '>=', weight)
      .executeTakeFirst()

    return rate as ShippingRateJsonResponse | undefined
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rate by weight and zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Shipping address shape used by the safe-by-default lookup helpers
 * (stacksjs/stacks#1879 Co-11). All fields except `countryCode` are
 * optional — zone matching tries them in order of specificity
 * (postal → region → country) and returns the most specific match.
 */
export interface ShippingAddress {
  /** ISO 3166-1 alpha-2 country code (e.g. `'US'`, `'GB'`, `'JP'`). */
  countryCode: string
  /** ISO 3166-2 region/state code (e.g. `'NY'`, `'CA'`, `'TX'`). */
  region?: string
  /** Postal code / ZIP / postcode in the country's convention. */
  postalCode?: string
}

/**
 * Resolve the canonical shipping zone for a delivery address
 * (stacksjs/stacks#1879 Co-11). Walks the zones table looking for
 * the most specific match: postal-code → region → country-only.
 * Returns null when no zone covers the address.
 *
 * The current zones schema stores `countries` as a comma-separated
 * string (per `getZonesByCountry`'s LIKE-query); we use the same
 * convention here. Apps with a normalized zone-country join table
 * can override by replacing this function via the package facade.
 */
export async function resolveZoneForAddress(address: ShippingAddress): Promise<number | null> {
  if (!address?.countryCode) return null
  try {
    // Pull every active zone that mentions the country and pick the
    // most-specific match in memory. The fan-out is bounded (most
    // stores have <100 zones) so the in-memory pass is cheap.
    const zones = await db
      .selectFrom('shipping_zones')
      .selectAll()
      .where('countries', 'like', `%${address.countryCode}%`)
      .where('status', '=', 'active')
      .execute() as Array<{ id: number, regions?: string | null, postal_codes?: string | null }>

    if (zones.length === 0) return null

    // Specificity scoring: postal match > region match > country-only.
    let best: { id: number, score: number } | null = null
    for (const zone of zones) {
      let score = 1 // country-only baseline
      if (address.region && zone.regions && includesToken(zone.regions, address.region))
        score = 2
      if (address.postalCode && zone.postal_codes && includesToken(zone.postal_codes, address.postalCode))
        score = 3
      if (!best || score > best.score)
        best = { id: zone.id, score }
    }
    return best?.id ?? null
  }
  catch {
    return null
  }
}

/**
 * Safer counterpart to `getRateByWeightAndZone`. Resolves the zone
 * server-side from the delivery address, then fetches the rate
 * for that zone. Throws when the address doesn't match any active
 * zone — caller surfaces "we don't ship to your area" to the user.
 *
 * Use this from any HTTP/API boundary where the address is
 * caller-controlled. Internal callers that already have a verified
 * zone can stay on `getRateByWeightAndZone`.
 *
 * @example
 * ```ts
 * const rate = await getRateByWeightAndAddress(2.5, {
 *   countryCode: 'US',
 *   region: 'NY',
 *   postalCode: '10001',
 * })
 * if (!rate) throw new HttpError(404, 'No shipping rate for this address')
 * ```
 */
export async function getRateByWeightAndAddress(
  weight: number,
  address: ShippingAddress,
): Promise<ShippingRateJsonResponse | undefined> {
  const zoneId = await resolveZoneForAddress(address)
  if (zoneId == null) return undefined
  return getRateByWeightAndZone(weight, zoneId)
}

/**
 * Verify that a caller-supplied `zoneId` actually serves the given
 * address. Returns true when the address resolves to the same zone.
 * Use when a flow already has a `zoneId` from earlier and just
 * wants to confirm it wasn't tampered with mid-checkout.
 */
export async function validateZoneMatchesAddress(zoneId: number, address: ShippingAddress): Promise<boolean> {
  const resolved = await resolveZoneForAddress(address)
  return resolved === zoneId
}

/**
 * Match a single value inside a comma-or-pipe-separated string,
 * tolerating whitespace and case. Used because the zones schema
 * stores region/postal lists as plain strings.
 */
function includesToken(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false
  const target = needle.trim().toUpperCase()
  for (const token of haystack.split(/[,|;]/)) {
    if (token.trim().toUpperCase() === target) return true
  }
  return false
}

/**
 * Format shipping rate options for dropdown menus or selectors
 *
 * @returns Array of formatted shipping rate options with id, method, zone, and rate
 */
export async function formatShippingRateOptions(): Promise<{ id: number, shipping_method_id: number, shipping_zone_id: number, rate: number }[]> {
  try {
    const results = await db
      .selectFrom('shipping_rates')
      .select(['id', 'shipping_method_id', 'shipping_zone_id', 'rate'])
      .orderBy('shipping_method_id')
      .execute()

    // Filter out any results with undefined/null values to match the return type
    return results.filter((result: any) =>
      result.shipping_method_id !== null
      && result.shipping_method_id !== undefined
      && result.shipping_zone_id !== null
      && result.shipping_zone_id !== undefined,
    ) as { id: number, shipping_method_id: number, shipping_zone_id: number, rate: number }[]
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format shipping rate options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get shipping rates for a specific method
 *
 * @param methodId The shipping method to filter by
 * @returns List of shipping rates for the specified method
 */
export async function getShippingRatesByMethod(methodId: number): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('shipping_method_id', '=', methodId)
      .orderBy('weight_from')
      .execute()

    return rates as ShippingRateJsonResponse[]
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rates by method: ${error.message}`)
    }

    throw error
  }
}
