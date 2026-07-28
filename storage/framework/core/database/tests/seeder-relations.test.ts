import { describe, expect, it } from 'bun:test'
import { chooseRelations } from '../src/seeder'

/**
 * A seeded row has to describe something that could happen.
 *
 * Each `belongsTo` used to be filled independently, so a flight that belongs
 * to both a farm and a field got a random one of each — and the field almost
 * always belonged to a different farm. Every foreign key was satisfied and the
 * row was nonsense: the dashboard listed flights with no field name, because
 * the field it pointed at was not on the farm being displayed.
 */
const FARMS = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
]

const FIELDS = [
  { id: 10, farm_id: 1 },
  { id: 11, farm_id: 1 },
  { id: 12, farm_id: 2 },
  { id: 13, farm_id: 3 },
]

const DRONES = [
  { id: 20, farm_id: 1 },
  { id: 21, farm_id: 2 },
  { id: 22, farm_id: 3 },
]

function fieldFor(id: unknown): { id: number, farm_id: number } {
  return FIELDS.find(field => field.id === id)!
}

describe('chooseRelations', () => {
  it('puts a child on the farm its field belongs to', () => {
    const rows = chooseRelations([
      { column: 'farm_id', rows: FARMS },
      { column: 'field_id', rows: FIELDS },
    ], 200)

    for (const row of rows)
      expect(row.farm_id).toBe(fieldFor(row.field_id).farm_id)
  })

  it('keeps three parents consistent at once', () => {
    const rows = chooseRelations([
      { column: 'farm_id', rows: FARMS },
      { column: 'field_id', rows: FIELDS },
      { column: 'drone_id', rows: DRONES },
    ], 200)

    for (const row of rows) {
      const drone = DRONES.find(candidate => candidate.id === row.drone_id)!
      expect(drone.farm_id).toBe(row.farm_id as number)
      expect(fieldFor(row.field_id).farm_id).toBe(row.farm_id as number)
    }
  })

  it('still spreads children across the parents', () => {
    // Consistency must not collapse into "everything hangs off row 1", which
    // is the other way a seeded graph stops looking like a real one.
    const rows = chooseRelations([
      { column: 'farm_id', rows: FARMS },
      { column: 'field_id', rows: FIELDS },
    ], 200)

    expect(new Set(rows.map(row => row.farm_id)).size).toBeGreaterThan(1)
    expect(new Set(rows.map(row => row.field_id)).size).toBeGreaterThan(2)
  })

  it('falls back to any parent when none agree', () => {
    // A field whose farm is not among the seeded farms should still produce a
    // usable row rather than a null foreign key.
    const rows = chooseRelations([
      { column: 'farm_id', rows: [{ id: 9 }] },
      { column: 'field_id', rows: [{ id: 10, farm_id: 1 }] },
    ], 5)

    for (const row of rows) {
      expect(row.field_id).toBe(10)
      expect(row.farm_id).toBeDefined()
    }
  })

  it('returns nothing when the model has no parents', () => {
    expect(chooseRelations([], 10)).toEqual([])
  })
})

/**
 * Attaching a seeded row to a parent that already exists is the point. Doing
 * it to an *account* is not: on any database that is not a scratch copy those
 * rows are people, and a seeded holding pointed at one hands a farmer fields
 * they have never seen.
 */
describe('account foreign keys', () => {
  it('is not filled from the account table', async () => {
    const { isAccountModel } = await import('../src/seeder')

    expect(isAccountModel('User')).toBe(true)
    expect(isAccountModel('Team')).toBe(true)
    expect(isAccountModel('Farm')).toBe(false)
  })
})

/**
 * A relation key has to be *declared* for the generated REST layer to see it:
 * writable and filterable columns are built from a model's attributes, so an
 * undeclared `farm_id` cannot be set by a POST or filtered with `?farm_id=`.
 * Declaring it used to cost the seeder the relation entirely — the model owned
 * the column, so nothing wired it and every seeded row landed unattached.
 */
describe('declared relation keys', () => {
  it('is filled when the record left it empty', async () => {
    const { chooseRelations } = await import('../src/seeder')
    const rows = chooseRelations([{ column: 'farm_id', rows: [{ id: 7 }] }], 3)

    // What generateRecords does with them: fill only the empty ones.
    const record: Record<string, unknown> = { name: 'Oberer Acker', farm_id: null }
    for (const [column, value] of Object.entries(rows[0]!)) {
      if (record[column] == null)
        record[column] = value
    }

    expect(record.farm_id).toBe(7)
  })

  it('leaves a value an explicit factory produced', () => {
    const record: Record<string, unknown> = { farm_id: 42 }
    for (const [column, value] of Object.entries({ farm_id: 7 })) {
      if (record[column] == null)
        record[column] = value
    }

    expect(record.farm_id).toBe(42)
  })
})
