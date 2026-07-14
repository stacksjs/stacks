import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1951 (follow-up from #1957) — SQLite now boots with
// `foreign_keys = ON`, so `buddy migrate` should surface pre-existing orphan
// rows (child rows pointing at missing parents) at the moment enforcement
// first bites. The scan reuses the read-only `findFkOrphans()` already covered
// by database/tests/fk-orphans.test.ts, so here we only pin the wiring:
// it runs on the `migrate` path and NOT on `migrate:fresh` (which rebuilds
// from scratch and therefore can't carry orphans). Source-shape check, matching
// migrate-guarantees-ordering.test.ts — the command calls process.exit.

describe('buddy migrate FK orphan scan (#1951)', () => {
  const migratePath = resolve(__dirname, '../src/commands/migrate.ts')
  const source = readFileSync(migratePath, 'utf-8')

  const freshIdx = source.indexOf(`.command('migrate:fresh'`)
  const dnsIdx = source.indexOf(`.command('migrate:dns'`)
  const migrateSection = source.slice(0, freshIdx)
  const freshSection = source.slice(freshIdx, dnsIdx)

  it('defines a read-only, non-fatal reportFkOrphans helper', () => {
    expect(source).toContain('async function reportFkOrphans()')
    // reuses the existing read-only scanner rather than re-querying
    expect(source).toContain('findFkOrphans')
    // never deletes data
    expect(source).toContain('migrate never deletes data')
  })

  it('runs the orphan scan on the migrate path', () => {
    expect(migrateSection).toContain('await reportFkOrphans()')
  })

  it('does NOT run the orphan scan on migrate:fresh (rebuilt from scratch)', () => {
    expect(freshSection).not.toContain('await reportFkOrphans()')
  })
})
