import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1915 D-2 — Postgres pivot table created_at must
// be `timestamptz`, matching the parent table convention (#1876 D-5).
// Pre-fix the pivot drifted to plain `timestamp` (no TZ) while the
// parent used `timestamptz`, so cross-table joins on created_at
// returned mismatched values for the same instant.
//
// The fix is a literal-string change in the migration generator, so
// the regression guard is a literal-string check.

describe('Postgres pivot tables use timestamptz for created_at (stacksjs/stacks#1915)', () => {
  const driverPath = resolve(__dirname, '../src/drivers/postgres.ts')
  const source = readFileSync(driverPath, 'utf-8')

  it('createPivotTableMigration emits timestamptz, not plain timestamp', () => {
    // Find the createPivotTableMigration block. We grep for the
    // function header and pull a generous window after it to scope
    // the assertion away from other functions that also emit
    // timestamptz (parent createTableMigration at :275, etc).
    const fnIdx = source.indexOf('async function createPivotTableMigration')
    expect(fnIdx).toBeGreaterThan(-1)
    // Walk to the next top-level `^async function` or `^function`
    // declaration after this one — that bounds the block.
    const after = source.slice(fnIdx)
    const nextFnRel = after.slice(1).search(/\n(?:async\s+)?function\s/)
    const block = nextFnRel === -1 ? after : after.slice(0, nextFnRel + 1)

    // Pivot table's created_at addColumn must use timestamptz.
    expect(block).toMatch(/addColumn\('created_at',\s*'timestamptz'/)
    // And must NOT use plain 'timestamp' for created_at (the
    // pre-fix bug). Allow other 'timestamp' string occurrences in
    // the block (e.g., a comment) but not the addColumn call.
    expect(block).not.toMatch(/addColumn\('created_at',\s*'timestamp'\b/)
  })
})
