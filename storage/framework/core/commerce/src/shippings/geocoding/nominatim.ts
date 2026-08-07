import type { GeocodePrecision, GeocodeQuery, GeocodeResult, GeocodingDriver } from './types'
import { formatQuery } from './types'

/**
 * OpenStreetMap Nominatim.
 *
 * The default because it needs no account: a Stacks app can take a delivery
 * address on day one without anyone signing up for a mapping platform.
 *
 * It comes with obligations, and they are honoured here rather than left to
 * the caller to discover from a ban:
 *
 *   - A real User-Agent identifying the application. Nominatim blocks generic
 *     ones, and "it worked in development" is how that gets found out.
 *   - At most one request per second, serialised across this process.
 *
 * For volume past a few thousand lookups a day, run your own Nominatim or
 * point `geocoding.driver` at a commercial provider. The interface is two
 * methods wide precisely so that swap is small.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

/** Nominatim's published limit. */
const MIN_REQUEST_INTERVAL_MS = 1000

let lastRequestAt = 0
let queue: Promise<unknown> = Promise.resolve()

/**
 * Serialise requests one second apart.
 *
 * Chained through a single promise rather than a naive sleep so ten concurrent
 * checkouts do not all wait the same second and then fire together, which is
 * the burst the policy exists to prevent.
 */
async function rateLimited<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const since = Date.now() - lastRequestAt
    if (since < MIN_REQUEST_INTERVAL_MS)
      await Bun.sleep(MIN_REQUEST_INTERVAL_MS - since)

    lastRequestAt = Date.now()
    return work()
  })

  // Keep the chain alive even when one link rejects.
  queue = run.then(() => undefined, () => undefined)

  return run
}

/**
 * What Nominatim actually matched, mapped onto something a caller can decide
 * with.
 *
 * The signal that matters is a house number in `address`, not the top-level
 * `addresstype`: a genuine rooftop hit for "12320 W Pico Blvd" comes back as
 * `addresstype: "place"`, `type: "house"`, with the number nested under
 * `address.house_number`. Reading the top level alone scored that as
 * `unknown` and the precision floor then rejected a perfect match.
 */
function precisionFrom(entry: Record<string, unknown>): GeocodePrecision {
  const address = (entry.address ?? {}) as Record<string, unknown>
  const addressType = String(entry.addresstype ?? '')
  const type = String(entry.type ?? '')
  const category = String(entry.category ?? entry.class ?? '')

  if (address.house_number || type === 'house' || type === 'building' || addressType === 'building')
    return 'rooftop'

  if (address.road || category === 'highway' || addressType === 'road')
    return 'street'

  if (addressType === 'postcode' || (address.postcode && !address.road))
    return 'postal'

  if (['city', 'town', 'village', 'suburb', 'neighbourhood'].includes(addressType))
    return 'locality'

  return 'unknown'
}

export interface NominatimOptions {
  /**
   * Identifies your application to Nominatim, per their usage policy. Include
   * a contact address: they use it to reach you before blocking you.
   */
  userAgent?: string
  endpoint?: string
}

export function nominatimDriver(options: NominatimOptions = {}): GeocodingDriver {
  const userAgent = options.userAgent
    ?? `${process.env.APP_NAME ?? 'Stacks'} (${process.env.APP_URL ?? 'stacks-app'})`
  const endpoint = options.endpoint ?? ENDPOINT

  return {
    name: 'nominatim',

    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      const search = formatQuery(query)
      if (!search)
        return null

      const url = new URL(endpoint)
      url.searchParams.set('q', search)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', '1')
      url.searchParams.set('addressdetails', '1')
      if (query.country)
        url.searchParams.set('countrycodes', query.country.toLowerCase())

      const response = await rateLimited(() => fetch(url, {
        headers: { 'user-agent': userAgent, 'accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }))

      if (!response.ok)
        throw new Error(`Nominatim responded ${response.status}`)

      const results = await response.json() as Record<string, unknown>[]
      const entry = results?.[0]
      if (!entry)
        return null

      const latitude = Number(entry.lat)
      const longitude = Number(entry.lon)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        return null

      const precision = precisionFrom(entry)

      return {
        latitude,
        longitude,
        formatted: String(entry.display_name ?? search),
        // Nominatim's `importance` scores notability, not match quality: a
        // famous landmark outranks the house you are delivering to. Precision
        // is the honest signal, so confidence is derived from it.
        confidence: { rooftop: 1, street: 0.8, postal: 0.5, locality: 0.3, unknown: 0.1 }[precision],
        precision,
        provider: 'nominatim',
      }
    },
  }
}
