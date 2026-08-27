import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The migration plan is cached, so which callers opt out of that cache is a
 * correctness property rather than a preference.
 *
 * `revision` is an optimistic-concurrency token: a caller sends back the
 * revision it reviewed, and the server refuses the write if the plan has
 * moved since. Compare that token against a plan computed up to a TTL ago and
 * the gate admits exactly the drift it exists to catch. These read the source
 * because the alternative is standing a database up to prove a call shape.
 */
const directory = import.meta.dir

function source(file: string): string {
  return readFileSync(join(directory, file), 'utf8')
}

describe('migration plan cache wiring', () => {
  it('gates every write on a freshly computed plan', () => {
    const gates = [
      ['migration-operations.ts', 'applyMigrationPlan'],
      ['MigrationReconcileAction.ts', 'MigrationReconcileAction'],
    ] as const

    for (const [file, gate] of gates) {
      const text = source(file)
      const calls = [...text.matchAll(/migrationPlan\(([^)]*)\)/g)]
        .map(match => match[1].trim())
        // The declaration itself, not a call.
        .filter(argument => !argument.startsWith('options:'))

      expect(calls.length, `${gate} should still ask for a plan`).toBeGreaterThan(0)
      for (const argument of calls)
        expect(argument, `${gate} must gate on a fresh plan`).toContain('fresh: true')
    }
  })

  it('lets the read-only index endpoints use the cache', () => {
    for (const file of ['ChangeIndexAction.ts', 'MigrationIndexAction.ts']) {
      const calls = [...source(file).matchAll(/migrationPlan\(([^)]*)\)/g)].map(match => match[1].trim())
      expect(calls.length, `${file} should still ask for a plan`).toBeGreaterThan(0)
      for (const argument of calls)
        expect(argument, `${file} should not force a recomputation per request`).toBe('')
    }
  })

  it('drops the cached state after anything that moves the schema or ledger', () => {
    const text = source('migration-operations.ts')

    // After the migrate subprocess succeeds, and after a real (non-dry-run)
    // ledger reconcile. Either one leaves the cached reading describing a
    // state that no longer exists.
    const invalidations = text.match(/invalidateMigrationPlan\(\)/g) ?? []
    expect(invalidations.length).toBeGreaterThanOrEqual(3)
    expect(text).toContain('reconcileMigrationLedger({ dryRun: false })')
  })
})
