import type { GeocodeQuery, GeocodingDriver } from '../src/shippings/geocoding'
import { describe, expect, it } from 'bun:test'
import { checkCoverage, formatQuery, geocode, PRECISION_RANK } from '../src/shippings/geocoding'

const SAWTELLE = { latitude: 34.0361, longitude: -118.4453 }
const PICO = { latitude: 34.0281, longitude: -118.4523 }

/** A driver that answers from a script, so no test touches the network. */
function fakeDriver(result: Awaited<ReturnType<GeocodingDriver['geocode']>>, name = 'fake'): GeocodingDriver {
  return { name, geocode: async () => result }
}

describe('formatQuery', () => {
  it('joins the parts a geocoder reads, and drops the empty ones', () => {
    expect(formatQuery({
      street: '12320 W Pico Blvd',
      city: 'Los Angeles',
      region: 'CA',
      postalCode: '90064',
      country: 'US',
    })).toBe('12320 W Pico Blvd, Los Angeles, CA, 90064, US')

    expect(formatQuery({ street: '2304 Sawtelle Blvd', city: '  ' } as GeocodeQuery))
      .toBe('2304 Sawtelle Blvd')
  })

  it('leaves the unit out, because it never helps a lookup', () => {
    const query: GeocodeQuery = { street: '3821 Grand View Blvd', unit: 'Apt 4', city: 'Los Angeles' }
    expect(formatQuery(query)).not.toContain('Apt 4')
  })
})

describe('geocode precision floor', () => {
  const rooftop = {
    latitude: 34.0128,
    longitude: -118.4361,
    formatted: '3821 Grand View Blvd, Los Angeles, CA 90066',
    confidence: 1,
    precision: 'rooftop' as const,
    provider: 'fake',
  }

  it('accepts a match at or above the floor', async () => {
    const result = await geocode(
      { street: '3821 Grand View Blvd', city: 'Los Angeles' },
      { driver: fakeDriver(rooftop, 'fake-rooftop'), minimumPrecision: 'street' },
    )

    expect(result?.latitude).toBeCloseTo(34.0128, 4)
  })

  it('refuses a match on the middle of a postcode', async () => {
    // A delivery to the centroid of 90066 is not a delivery, and returning it
    // silently ships someone's order to a road junction.
    const result = await geocode(
      { street: 'nowhere in particular', postalCode: '90066' },
      { driver: fakeDriver({ ...rooftop, precision: 'postal', confidence: 0.5 }, 'fake-postal'), minimumPrecision: 'street' },
    )

    expect(result).toBeNull()
  })

  it('can be relaxed when a postcode really is enough', async () => {
    const result = await geocode(
      { street: 'somewhere', postalCode: '90066' },
      { driver: fakeDriver({ ...rooftop, precision: 'postal' }, 'fake-postal-ok'), minimumPrecision: 'postal' },
    )

    expect(result).not.toBeNull()
  })

  it('returns null for an address the provider cannot find', async () => {
    const result = await geocode(
      { street: 'not a real street at all' },
      { driver: fakeDriver(null, 'fake-empty') },
    )

    expect(result).toBeNull()
  })

  it('lets a provider outage surface instead of reading as "not found"', async () => {
    // "We cannot check right now" and "that address does not exist" call for
    // different answers at checkout, so the outage must not be swallowed.
    const broken: GeocodingDriver = {
      name: 'broken',
      geocode: async () => { throw new Error('provider unreachable') },
    }

    await expect(geocode({ street: 'anywhere' }, { driver: broken })).rejects.toThrow('provider unreachable')
  })
})

describe('PRECISION_RANK', () => {
  it('orders worst to best so a floor can be compared numerically', () => {
    expect(PRECISION_RANK.rooftop).toBeGreaterThan(PRECISION_RANK.street)
    expect(PRECISION_RANK.street).toBeGreaterThan(PRECISION_RANK.postal)
    expect(PRECISION_RANK.postal).toBeGreaterThan(PRECISION_RANK.locality)
    expect(PRECISION_RANK.locality).toBeGreaterThan(PRECISION_RANK.unknown)
  })
})

describe('checkCoverage', () => {
  const marVista = { latitude: 34.0128, longitude: -118.4361 }

  it('covers an address inside the radius and names the nearest store', () => {
    const check = checkCoverage(marVista, [SAWTELLE, PICO], 5000)

    expect(check?.covered).toBe(true)
    // Pico is the closer of the two rooms to Mar Vista.
    expect(check?.nearest).toEqual(PICO)
    expect(check?.distanceMeters).toBeGreaterThan(0)
  })

  it('refuses an address outside it', () => {
    // Pasadena, well beyond a Westside delivery run.
    const check = checkCoverage({ latitude: 34.1478, longitude: -118.1445 }, [SAWTELLE, PICO], 8000)

    expect(check?.covered).toBe(false)
    expect(check?.distanceMeters).toBeGreaterThan(8000)
  })

  it('has no answer when no store was offered', () => {
    expect(checkCoverage(marVista, [], 5000)).toBeNull()
  })
})

describe('nominatim precision mapping', () => {
  // Regression: a real rooftop hit for "12320 W Pico Blvd" comes back as
  // `addresstype: "place"` with the house number nested under `address`.
  // Reading only the top level scored it `unknown`, the precision floor
  // rejected it, and a perfectly good address geocoded to null.
  it('reads a rooftop match out of the payload Nominatim actually sends', async () => {
    const { nominatimDriver } = await import('../src/shippings/geocoding')

    const payload = [{
      lat: '34.0286050',
      lon: '-118.4515680',
      category: 'place',
      type: 'house',
      addresstype: 'place',
      display_name: '12320, West Pico Boulevard, Los Angeles, California, 90064, United States',
      address: { house_number: '12320', road: 'West Pico Boulevard', city: 'Los Angeles', postcode: '90064' },
    }]

    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch

    try {
      const result = await nominatimDriver().geocode({ street: '12320 W Pico Blvd', city: 'Los Angeles' })

      expect(result?.precision).toBe('rooftop')
      expect(result?.confidence).toBe(1)
      expect(result?.latitude).toBeCloseTo(34.0286, 3)
    }
    finally {
      globalThis.fetch = original
    }
  })

  it('scores a street-level match below a rooftop one', async () => {
    const { nominatimDriver } = await import('../src/shippings/geocoding')

    const payload = [{
      lat: '34.03',
      lon: '-118.45',
      category: 'highway',
      type: 'residential',
      addresstype: 'road',
      display_name: 'West Pico Boulevard, Los Angeles',
      address: { road: 'West Pico Boulevard', city: 'Los Angeles' },
    }]

    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch

    try {
      const result = await nominatimDriver().geocode({ street: 'West Pico Blvd' })
      expect(result?.precision).toBe('street')
    }
    finally {
      globalThis.fetch = original
    }
  })
})
