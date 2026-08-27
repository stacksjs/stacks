import process from 'node:process'
import { auditMigrationLedger, previewPendingMigrations, reconcileMigrationLedger } from '@stacksjs/database'
import { cachedComputation } from './cached-computation'

export interface MigrationPlanOperation {
  kind: string
  table: string
  column?: string
  sql?: string
  destructive: boolean
}

export class MigrationOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationOperationError'
  }
}

const destructiveKinds = new Set(['drop_table', 'drop_column', 'alter_column', 'truncate_table'])

export type MigrationPlan = Awaited<ReturnType<typeof computeMigrationPlan>>

/**
 * How long a computed plan may be served to a reader.
 *
 * Building one costs a full model-versus-schema diff plus a ledger audit -
 * measured at 2.3s and 1.4s against 93 models, versus 14ms for a normal
 * dashboard endpoint. `/operations/migrations` and `/operations/changes` both
 * built one per request, so opening either page cost seconds and moving
 * between them paid it twice.
 *
 * Thirty seconds is long enough to cover a page load, a tab switch between
 * the two operations pages, and a couple of refreshes, and short enough that
 * editing a model and reloading shows the new plan without a manual step.
 * Anything that changes the schema from inside the dashboard invalidates
 * explicitly, so the window only ever hides changes made elsewhere.
 */
const PLAN_TTL_MS = 30_000

const planCache = cachedComputation({ ttlMs: PLAN_TTL_MS, compute: () => computeMigrationPlan() })

/**
 * The ledger repair preview, cached on the same terms as the plan.
 *
 * `MigrationIndexAction` asks for both on every request, and a dry-run
 * reconcile reads the same ledger the plan already audited - about 1.3s of
 * the endpoint's cost, for a report that cannot have changed while the plan
 * it sits next to has not.
 */
const reconciliationCache = cachedComputation({
  ttlMs: PLAN_TTL_MS,
  compute: () => reconcileMigrationLedger({ dryRun: true }),
})

/**
 * Drop the cached view of migration state.
 *
 * Applying a migration or reconciling the ledger changes the very state these
 * describe, so holding them for the rest of the TTL would show an operator
 * the work they just did as still pending. Both go together: the plan and the
 * repair preview are two readings of one state, and keeping one while
 * dropping the other would put the page into a shape neither describes.
 */
export function invalidateMigrationPlan(): void {
  planCache.invalidate()
  reconciliationCache.invalidate()
}

async function computeMigrationPlan() {
  const [rawOperations, ledger] = await Promise.all([
    previewPendingMigrations(),
    auditMigrationLedger(),
  ])
  const operations: MigrationPlanOperation[] = rawOperations.map((operation) => ({
    kind: String(operation.kind),
    table: String(operation.table),
    ...('column' in operation && operation.column ? { column: String(operation.column) } : {}),
    ...('sql' in operation && operation.sql ? { sql: String(operation.sql) } : {}),
    destructive: destructiveKinds.has(String(operation.kind)),
  }))
  const revision = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify({ operations, ledger: ledger.entries.map(entry => [entry.file, entry.status]) }))
    .digest('hex')

  return {
    environment: String(process.env.APP_ENV || process.env.NODE_ENV || 'development'),
    dialect: ledger.dialect,
    operations,
    revision,
    applied: ledger.recordedCount,
    ledger,
    // Stamped so a reader can tell how old the plan it is looking at is.
    // Deliberately outside the `revision` hash above: revision identifies the
    // schema state being approved, and must not change just because the same
    // state was computed again a minute later.
    computedAt: new Date().toISOString(),
    summary: {
      pending: operations.length,
      destructive: operations.filter(operation => operation.destructive).length,
      drift: ledger.drift,
      ledgerIssues: ledger.entries.filter(entry => !['applied', 'pending'].includes(entry.status)).length + ledger.orphans.length,
    },
  }
}

/**
 * The model-derived schema plan and the migration ledger's health.
 *
 * Served from a short-lived cache by default. Pass `fresh` when the answer is
 * about to gate a write: `revision` is an optimistic-concurrency token, and
 * comparing a caller's token against a cached plan would let a change that
 * landed during the window through the gate it exists to close.
 */
export async function migrationPlan(options: { fresh?: boolean } = {}): Promise<MigrationPlan> {
  return await planCache.get(options)
}

export async function applyMigrationPlan(input: { revision: string, confirmation: string }): Promise<{ message: string }> {
  const plan = await migrationPlan({ fresh: true })
  if (input.revision !== plan.revision)
    throw new MigrationOperationError('The migration plan changed. Refresh and review the new plan before applying it.')
  if (input.confirmation !== `migrate ${plan.environment}`)
    throw new MigrationOperationError(`Type migrate ${plan.environment} to confirm this schema change.`)
  if (!plan.operations.length)
    return { message: 'The database schema is already current.' }

  const child = Bun.spawn([`${process.cwd()}/buddy`, 'migrate', '--force'], {
    cwd: process.cwd(),
    env: { ...process.env, NO_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0)
    throw new MigrationOperationError(stderr.trim() || stdout.trim() || 'The migration command failed.')
  // The schema just moved, so every cached plan describing the old one is
  // wrong. Without this the operations pages would keep showing the applied
  // work as pending for the rest of the TTL.
  invalidateMigrationPlan()
  return { message: `Applied ${plan.operations.length} planned schema operation${plan.operations.length === 1 ? '' : 's'}.` }
}

export async function reconcileMigrationLedgerPlan(apply = false) {
  // A dry run reports what it would repair and changes nothing, so it is
  // cacheable. A real one rewrites the ledger that the plan's `applied`,
  // `drift` and `ledgerIssues` are read from, so it runs for real every time
  // and drops what the old ledger produced.
  if (!apply)
    return await reconciliationCache.get()

  const result = await reconcileMigrationLedger({ dryRun: false })
  invalidateMigrationPlan()
  return result
}
