import { describe, expect, it } from 'bun:test'
import { effectPresent, migrationEffects, migrationRemovals } from '../src/migration-ledger'

const schema = (indexes: string[]) => ({
  tables: new Set<string>(),
  columns: new Map<string, Set<string>>(),
  indexes: new Set(indexes),
  constraints: new Set<string>(),
  enums: new Set<string>(),
}) as any

/**
 * Older generators prefixed an index with its table even when the declared
 * name already began with it, so a database built then holds
 * `saved_trails_saved_trails_user_trail_unique` for what current migrations
 * declare as `saved_trails_user_trail_unique`. Same index, different spelling.
 *
 * Matching literally made every such index read as absent, and the migration
 * that created it was reported as "pending — will run on the next
 * `buddy migrate`" against tables holding thousands of rows. Found auditing a
 * live 593k-row catalog, where it produced four false pending entries.
 */
describe('index effects across the legacy table-prefix convention', () => {
  it('captures the owning table from CREATE INDEX', () => {
    const [effect] = migrationEffects(
      'CREATE UNIQUE INDEX IF NOT EXISTS "saved_trails_user_trail_unique" ON "saved_trails" ("user_id", "trail_id");',
    )
    expect(effect).toMatchObject({ kind: 'index', name: 'saved_trails_user_trail_unique', table: 'saved_trails' })
  })

  it('finds an index stored under the legacy doubled prefix', () => {
    const effect = { kind: 'index' as const, name: 'user_trail_unique', table: 'saved_trails' }
    expect(effectPresent(effect, schema(['saved_trails_user_trail_unique']))).toBe(true)
  })

  it('still matches an index stored under its exact name', () => {
    const effect = { kind: 'index' as const, name: 'saved_trails_uuid_unique', table: 'saved_trails' }
    expect(effectPresent(effect, schema(['saved_trails_uuid_unique']))).toBe(true)
  })

  it('does not invent a match for an index that is genuinely absent', () => {
    const effect = { kind: 'index' as const, name: 'country_state_index', table: 'trails' }
    // A DIFFERENT index on the same table must not satisfy it.
    expect(effectPresent(effect, schema(['trails_country_state_name_index']))).toBe(false)
    expect(effectPresent(effect, schema([]))).toBe(false)
  })

  it('doubles the prefix even when the name already carries it', () => {
    // The real case from production: the file declares
    // `saved_trails_user_trail_unique` — which already starts with the table —
    // and the database stores `saved_trails_saved_trails_user_trail_unique`.
    // An earlier version of this fix skipped the lookup for already-prefixed
    // names and therefore missed every case that motivated it.
    const effect = { kind: 'index' as const, name: 'saved_trails_user_trail_unique', table: 'saved_trails' }
    expect(effectPresent(effect, schema(['saved_trails_saved_trails_user_trail_unique']))).toBe(true)
  })

  it('handles an index effect with no table at all', () => {
    const effect = { kind: 'index' as const, name: 'some_index' }
    expect(effectPresent(effect, schema(['some_index']))).toBe(true)
    expect(effectPresent(effect, schema([]))).toBe(false)
  })
})

/**
 * An effect on a table a later migration DROPPED is not missing drift.
 *
 * bun-query-builder rebuilds a SQLite table by creating `_qb_tmp_<name>`,
 * copying into it, dropping the original and renaming the scaffold into place -
 * which takes every index the original carried, under whatever name it had at
 * the time. The corpus here has an older migration creating
 * `payments_payments_transaction_id_unique` (a doubled spelling) and a later
 * rebuild replacing it with `payments_transaction_id_unique`, so the schema is
 * exactly right and the older migration reported REVERTED forever.
 *
 * It was 22 of them on a database `buddy migrate:fresh` had just built from the
 * corpus - the one state that has to come out clean, and the state `buddy
 * doctor` failed on.
 */
describe('an index whose table a later migration dropped', () => {
  it('is not counted as reverted', () => {
    const created = migrationEffects('CREATE UNIQUE INDEX "payments_old_unique" ON "payments" ("transaction_id");')
    const index = created.find(effect => effect.kind === 'index')

    expect(index).toBeDefined()
    // The effect has to carry its table, or nothing downstream can tell that
    // dropping `payments` took this index with it.
    expect(index?.table).toBe('payments')

    const removals = migrationRemovals('DROP TABLE "payments";')
    expect(removals).toContainEqual({ kind: 'table', name: 'payments' })
  })
})
