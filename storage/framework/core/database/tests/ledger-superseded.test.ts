import { describe, expect, it } from 'bun:test'
import { planLedgerRemap } from '../src/migration-ledger'

/**
 * A renumbering rewrites the numeric prefix and leaves the logical name alone.
 * When the new spelling gets recorded without the old one being removed, the
 * ledger holds two rows for one migration.
 *
 * The planner used to file the stale row under `dropped` — reported to the
 * operator as "no counterpart; migration deleted?" — which was both the wrong
 * diagnosis and permanently unclearable: reconciling refuses to touch a
 * dropped row, so the drift warning never went away. Found on a production
 * ledger carrying 103 rows for 99 files.
 */
describe('ledger rows left behind by a renumbering', () => {
  const disk = ['0000000085-create-content_reports-table.sql']

  it('calls a stale duplicate superseded, not dropped', () => {
    const plan = planLedgerRemap(
      ['0000000085-create-content_reports-table.sql', '0000000092-create-content_reports-table.sql'],
      disk,
    )
    expect(plan.superseded).toEqual(['0000000092-create-content_reports-table.sql'])
    expect(plan.dropped).toEqual([])
    expect(plan.remap).toEqual([])
  })

  it('still calls a genuinely missing migration dropped', () => {
    const plan = planLedgerRemap(['0000000099-create-vanished-table.sql'], disk)
    expect(plan.dropped).toEqual(['0000000099-create-vanished-table.sql'])
    expect(plan.superseded).toEqual([])
  })

  it('prefers remapping when the new spelling is NOT yet recorded', () => {
    // Nothing claims the disk file, so the row is repointed rather than
    // pruned — remapping keeps the record, pruning would destroy it.
    const plan = planLedgerRemap(['0000000092-create-content_reports-table.sql'], disk)
    expect(plan.remap).toEqual([
      { from: '0000000092-create-content_reports-table.sql', to: '0000000085-create-content_reports-table.sql' },
    ])
    expect(plan.superseded).toEqual([])
    expect(plan.dropped).toEqual([])
  })

  it('does not treat an ambiguous logical name as superseded', () => {
    // Two disk files share the logical name, so which one the row refers to is
    // unknowable — that stays a human's call.
    const plan = planLedgerRemap(
      ['0000000092-create-content_reports-table.sql'],
      ['0000000085-create-content_reports-table.sql', '0000000086-create-content_reports-table.sql'],
    )
    expect(plan.ambiguous).toEqual(['0000000092-create-content_reports-table.sql'])
    expect(plan.superseded).toEqual([])
  })

  it('leaves a correctly-recorded row completely alone', () => {
    const plan = planLedgerRemap(disk, disk)
    expect(plan).toEqual({ remap: [], ambiguous: [], dropped: [], superseded: [] })
  })
})
