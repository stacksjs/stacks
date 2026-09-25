/**
 * The committed model snapshot describes the models as they are.
 *
 * `buddy migrate` diffs the models against
 * `storage/framework/database/model-snapshot.<dialect>.json`, not against a
 * database. When a change to the default models lands without the snapshot,
 * every checkout, and every app `buddy new` scaffolds from this repository,
 * inherits a baseline the models have already moved past. The first
 * `buddy migrate` anywhere then writes the "missing" change as a new
 * migration, numbered one past the newest file, so the same stray appears
 * with the same name in every project.
 *
 * That is what happened with `1789486698555-create-categorizables-table.sql`:
 * 482fa65b98 gave the existing `categorizables` table a model and never added
 * it to the snapshot. The generated CREATE TABLE IF NOT EXISTS was a no-op
 * wherever it ran, since 0000000116 creates the table and the trait-table
 * reconciler adds its owner column, and it was committed into a new app before
 * anyone noticed. 3e62e4b01d did the same to `jobs` and `failed_jobs`.
 *
 * The fix for a failure here is to regenerate the baseline and commit it with
 * the model change: `buddy generate:migrations`, keep the snapshot, and keep
 * the migration only if the corpus does not already produce that schema.
 */

import { describe, expect, it } from 'bun:test'
import { pendingMigrationOperations } from '../src/migrations'

describe('committed model snapshot', () => {
  it('has nothing pending against the models', async () => {
    const operations = await pendingMigrationOperations({ fromDb: false, applyRenames: true })

    expect(operations.map(op => `${op.kind} ${op.table}`)).toEqual([])
  }, 60_000)
})

