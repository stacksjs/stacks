/**
 * The ledger drift message names a repair that fits the drift it found.
 *
 * `buddy migrate:status --reconcile` repoints renumbered rows and records what
 * the schema proves. It never runs SQL from a migration file, so it SKIPS every
 * `reverted` and `partial` entry by design - and doctor recommended it
 * unconditionally.
 *
 * A stale local database made the cost concrete: 18 reverted entries, doctor
 * saying "repair with --reconcile", and reconcile then reporting "Reconciled."
 * and success having fixed exactly one unrelated duplicate row. The drift was
 * still there, and the command that was supposed to fix it said it had
 * (stacksjs/stacks#2203).
 *
 * This pins the branch, not the prose: what matters is that reverted/partial
 * drift never gets sent to reconcile alone.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/commands/doctor.ts', import.meta.url).pathname, 'utf-8')

/** The ledger probe's body, so unrelated advice elsewhere cannot satisfy this. */
function ledgerProbe(): string {
  const start = source.indexOf("await probe(checks, 'Migration ledger'")
  expect(start).toBeGreaterThan(-1)
  const end = source.indexOf('await probe(', start + 10)

  return source.slice(start, end === -1 ? undefined : end)
}

describe('doctor migration-ledger advice', () => {
  it('offers reconcile only when nothing needs re-applying', () => {
    const probe = ledgerProbe()

    // The recommendation is guarded rather than unconditional.
    expect(probe).toContain('counts.reverted + counts.partial')
    expect(probe).toMatch(/needsReapply > 0/)
  })

  it('says plainly that reconcile cannot repair those, and what can', () => {
    const probe = ledgerProbe()

    expect(probe).toContain('cannot repair')
    // Re-applying is the only route for a schema missing what the ledger
    // claims, and it costs data - saying so is the point.
    expect(probe).toContain('migrate:fresh')
    expect(probe).toContain('RESETS DATA')
  })

  it('still names reconcile for the drift it can actually fix', () => {
    // Renumbered rows and orphans are exactly what it exists for; the fix must
    // not throw that away.
    expect(ledgerProbe()).toContain('migrate:status --reconcile')
  })
})
