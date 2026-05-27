import type { Model } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { buildSeederPayload, factory, generate } from '../src/factory'

/**
 * Tests for `factory.generate(Model, opts)` (stacksjs/stacks#1919).
 *
 * The factory module is a thin glue layer in front of
 * `seedModelDirect` (which itself wraps the legacy `seedModel` insert
 * path already covered by integration.test.ts). The interesting
 * surface area here is the *payload construction*:
 *
 *   - accept both Model-config and `defineModel`-wrapper shapes
 *   - default count from `useSeeder` trait when present, else 10
 *   - merge precedence: per-row `rows` > global `with` > factory
 *   - snake_case keys in overrides so callers can use camelCase
 *
 * `buildSeederPayload` is exported precisely so these rules can be
 * asserted without touching the database.
 */

const Judge: Model = {
  name: 'Judge',
  table: 'judges',
  primaryKey: 'id',
  autoIncrement: true,
  attributes: {
    name: { factory: () => 'Hon. Anonymous' } as any,
    practiceArea: { factory: () => 'civil' } as any,
  },
}

describe('factory.generate — surface', () => {
  test('exposes a callable namespace + the raw generate fn', () => {
    expect(typeof factory.generate).toBe('function')
    expect(typeof generate).toBe('function')
    expect(factory.generate).toBe(generate)
  })

  test('rejects inputs that are not Stacks model definitions', () => {
    // resolveDefinition throws synchronously inside the async fn — assert
    // via Promise rejection.
    expect(buildSeederPayload as any).toThrow // (just confirms the fn shape)
    expect(() => buildSeederPayload({} as any)).toThrow(/expected a Stacks model/)
    expect(() => buildSeederPayload(null as any)).toThrow(/expected a Stacks model/)
    expect(() => buildSeederPayload(undefined as any)).toThrow(/expected a Stacks model/)
  })

  test('accepts a defineModel-style wrapper (`{ _definition: Model }`)', () => {
    const wrapped = { _definition: Judge }
    const payload = buildSeederPayload(wrapped)
    expect(payload.name).toBe('Judge')
    expect(payload.table).toBe('judges')
  })
})

describe('factory.generate — count resolution', () => {
  test('caller-supplied count wins over the model trait', () => {
    const withTrait: Model = { ...Judge, traits: { useSeeder: { count: 100 } } }
    expect(buildSeederPayload(withTrait, { count: 3 }).count).toBe(3)
  })

  test('defaults to useSeeder.count when caller omits count', () => {
    const withTrait: Model = { ...Judge, traits: { useSeeder: { count: 7 } } }
    expect(buildSeederPayload(withTrait).count).toBe(7)
  })

  test('defaults to 10 when neither caller nor trait sets count', () => {
    expect(buildSeederPayload(Judge).count).toBe(10)
  })

  test('caller-supplied rows lengthens count past `count` arg', () => {
    const payload = buildSeederPayload(Judge, {
      count: 2,
      rows: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
    })
    // 4 rows beats count of 2 — the curated rows always make it into
    // the index, even if the caller under-counted.
    expect(payload.count).toBe(4)
    expect(payload.fixtures).toHaveLength(4)
  })
})

describe('factory.generate — override precedence', () => {
  test('`with` overrides apply to every row', () => {
    const payload = buildSeederPayload(Judge, { count: 3, with: { practiceArea: 'appellate' } })
    expect(payload.fixtures).toHaveLength(3)
    for (const row of payload.fixtures) {
      expect(row.practice_area).toBe('appellate')
    }
  })

  test('`rows` per-row overrides beat `with`', () => {
    const payload = buildSeederPayload(Judge, {
      count: 3,
      with: { practiceArea: 'appellate' },
      rows: [
        { name: 'Hon. Roberts', practiceArea: 'constitutional' },
        { name: 'Hon. Sotomayor' }, // practiceArea falls through to `with`
      ],
    })
    expect(payload.fixtures[0]).toEqual({ name: 'Hon. Roberts', practice_area: 'constitutional' })
    expect(payload.fixtures[1]).toEqual({ name: 'Hon. Sotomayor', practice_area: 'appellate' })
    // Third row: no curated row, only `with` — factory output fills the rest.
    expect(payload.fixtures[2]).toEqual({ practice_area: 'appellate' })
  })

  test('camelCase override keys become snake_case columns', () => {
    const payload = buildSeederPayload(Judge, { count: 1, with: { practiceArea: 'civil' } })
    expect(Object.keys(payload.fixtures[0]!)).toContain('practice_area')
    expect(Object.keys(payload.fixtures[0]!)).not.toContain('practiceArea')
  })

  test('empty `with` + empty `rows` → no sparse fixture entries', () => {
    const payload = buildSeederPayload(Judge, { count: 3 })
    // We intentionally leave the array sparse when there's nothing
    // to merge — the legacy walker treats `fixtures[i]` as "fall
    // through to factory output" when undefined.
    expect(payload.fixtures).toHaveLength(0)
  })
})
