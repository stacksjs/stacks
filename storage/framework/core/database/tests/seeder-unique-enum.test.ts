import type { Model } from '@stacksjs/types'
import type { SeederModel } from '../src/seeder'
import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { generateRecords } from '../src/seeder'

/**
 * A unique column that is also an enum (stacksjs/stacks#3363).
 *
 * When a unique value collides on every retry, the seeder appends a suffix so
 * an exhausted pool does not fail the model. On an enum that suffix (`bluesky-3`)
 * is outside the allowed set, so the column's CHECK constraint rejected the
 * whole insert and the model seeded nothing: Postline's SocialDriver asks for
 * 8 rows from 6 providers, and `buddy seed` failed on a fresh database.
 */
const PROVIDERS = ['bluesky', 'mastodon', 'threads', 'x', 'linkedin', 'instagram'] as const

function socialDriver(count: number, fixtures: Array<Record<string, unknown>> = []): SeederModel {
  return {
    name: 'SocialDriver',
    table: 'social_drivers',
    count,
    fixtures,
    attributes: {
      provider: {
        unique: true,
        validation: { rule: schema.enum([...PROVIDERS]) },
        factory: (faker: { helpers: { arrayElement: <T>(values: readonly T[]) => T } }) => faker.helpers.arrayElement(PROVIDERS),
      },
      label: {
        validation: { rule: schema.string() },
        factory: () => 'A social account',
      },
    } as unknown as SeederModel['attributes'],
    model: { name: 'SocialDriver', table: 'social_drivers' } as unknown as Model,
    filePath: '',
    after: [],
    seedable: true,
  }
}

describe('a unique enum column', () => {
  it('seeds only values the enum allows, one row per value at most', async () => {
    const rows = await generateRecords(socialDriver(8))
    const providers = rows.map(row => row.provider)

    for (const provider of providers)
      expect(PROVIDERS as readonly unknown[]).toContain(provider)
    expect(new Set(providers).size).toBe(providers.length)
    // Never more than the enum has values, and a factory drawing at random
    // finds most of them within its retries.
    expect(rows.length).toBeLessThanOrEqual(PROVIDERS.length)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('keeps a fixture row as written', async () => {
    const rows = await generateRecords(socialDriver(1, [{ provider: 'x', label: 'Fixture' }]))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.provider).toBe('x')
  })
})
