import process from 'node:process'
import { auditMigrationLedger, previewPendingMigrations, reconcileMigrationLedger } from '@stacksjs/database'

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

export async function migrationPlan() {
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
    summary: {
      pending: operations.length,
      destructive: operations.filter(operation => operation.destructive).length,
      drift: ledger.drift,
      ledgerIssues: ledger.entries.filter(entry => !['applied', 'pending'].includes(entry.status)).length + ledger.orphans.length,
    },
  }
}

export async function applyMigrationPlan(input: { revision: string, confirmation: string }): Promise<{ message: string }> {
  const plan = await migrationPlan()
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
  return { message: `Applied ${plan.operations.length} planned schema operation${plan.operations.length === 1 ? '' : 's'}.` }
}

export async function reconcileMigrationLedgerPlan(apply = false) {
  return await reconcileMigrationLedger({ dryRun: !apply })
}
