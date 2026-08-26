import { describe, expect, it } from 'bun:test'
import { migrationRemovals } from '../src/migration-ledger'

/**
 * Widening an index is ordinary history: create `(country, state)`, drop it,
 * create `(country, state, state_name)` in its place. Checked in isolation the
 * first migration's effect is missing from the schema — because the second one
 * removed it on purpose — and it reported as REVERTED, "the effects are gone",
 * permanently and with no command able to clear it.
 *
 * Found on a 593k-row trails catalog whose index was widened to make a region
 * breakdown covering (4.7s -> 0.1s).
 */
describe('removals a migration performs', () => {
  it('parses DROP INDEX', () => {
    expect(migrationRemovals('DROP INDEX IF EXISTS "trails_trails_country_state_index";'))
      .toEqual([{ kind: 'index', name: 'trails_trails_country_state_index' }])
  })

  it('parses DROP TABLE and DROP TYPE', () => {
    expect(migrationRemovals('DROP TABLE IF EXISTS "old_thing";'))
      .toEqual([{ kind: 'table', name: 'old_thing' }])
    expect(migrationRemovals('DROP TYPE IF EXISTS "status_enum";'))
      .toEqual([{ kind: 'enum', name: 'status_enum' }])
  })

  it('parses dropped columns and constraints with their owning table', () => {
    expect(migrationRemovals('ALTER TABLE "users" DROP COLUMN "legacy_flag";'))
      .toEqual([{ kind: 'column', table: 'users', name: 'legacy_flag' }])
    expect(migrationRemovals('ALTER TABLE "users" DROP CONSTRAINT "users_old_check";'))
      .toEqual([{ kind: 'constraint', table: 'users', name: 'users_old_check' }])
  })

  it('ignores CREATE statements entirely', () => {
    expect(migrationRemovals('CREATE INDEX "a_idx" ON "a" ("b");')).toEqual([])
    expect(migrationRemovals('CREATE TABLE "a" ("id" INTEGER);')).toEqual([])
  })

  it('deduplicates a repeated drop', () => {
    expect(migrationRemovals('DROP INDEX "x"; DROP INDEX IF EXISTS "x";')).toHaveLength(1)
  })

  it('does not confuse a dropped index with a table of the same name', () => {
    // The audit keys removals by kind AND name, so this must not report a
    // table removal that would excuse a genuinely missing table.
    const removals = migrationRemovals('DROP INDEX "trails";')
    expect(removals).toEqual([{ kind: 'index', name: 'trails' }])
    expect(removals.some(r => r.kind === 'table')).toBe(false)
  })
})
