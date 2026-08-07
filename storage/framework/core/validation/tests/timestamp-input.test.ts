import { describe, expect, it } from 'bun:test'
import { schema } from '../src/schema'

/**
 * `schema.timestamp()` used to accept 32-bit epoch SECONDS and nothing else,
 * which meant it rejected every value the framework's own models produce: 39
 * attributes across the default models validate with it, and their factories
 * emit `toISOString()` or the `YYYY-MM-DD HH:MM:SS` form SQLite returns.
 *
 * It surfaced as a storefront that could not create a cart, because
 * `Cart.expiresAt` failed validation against the output of its own factory.
 */

const rule = schema.timestamp()
const valid = async (value: unknown) => (await rule.validate(value)).valid

describe('schema.timestamp', () => {
  it('accepts what the ORM writes back from SQLite', async () => {
    expect(await valid('2026-08-14 19:12:33')).toBe(true)
    expect(await valid('2026-08-14 19:12:33.482')).toBe(true)
  })

  it('accepts an ISO 8601 string, which is what most factories emit', async () => {
    expect(await valid(new Date().toISOString())).toBe(true)
    expect(await valid('2026-08-14T19:12:33Z')).toBe(true)
  })

  it('accepts a Date', async () => {
    expect(await valid(new Date())).toBe(true)
  })

  it('still accepts epoch seconds, the only thing it used to take', async () => {
    const seconds = Math.floor(Date.now() / 1000)
    expect(await valid(seconds)).toBe(true)
    expect(await valid(String(seconds))).toBe(true)
  })

  it('accepts epoch milliseconds, which Date.now() hands you', async () => {
    // The old 2038 ceiling rejected this outright: read as seconds it lands
    // some fifty thousand years out.
    expect(await valid(Date.now())).toBe(true)
  })

  it('accepts a date past 2038', async () => {
    expect(await valid('2045-01-01T00:00:00Z')).toBe(true)
  })

  it('rejects something that is not an instant at all', async () => {
    expect(await valid('not a date')).toBe(false)
    expect(await valid('tuesday-ish')).toBe(false)
    expect(await valid({})).toBe(false)
    expect(await valid(new Date('nonsense'))).toBe(false)
  })

  it('leaves presence to .required()', async () => {
    // Same contract as every other field factory: an absent optional value is
    // not a format error.
    expect(await valid(null)).toBe(true)

    const required = schema.timestamp().required()
    expect((await required.validate(null)).valid).toBe(false)
  })
})
