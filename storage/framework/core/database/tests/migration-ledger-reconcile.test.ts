// stacksjs/stacks#2203 — end-to-end reproduction of the ledger drift.
//
// The unit tests next door cover the classifier in isolation. This one builds
// the actual failure: a database whose schema reflects every migration, a
// ledger still naming the PRE-renumber filenames, and a corpus on disk that has
// been renumbered underneath it. That is the reported state exactly — 24 files,
// 6 ledger rows, ~22 migrations' worth of schema — and the thing worth proving
// is that the audit reads the schema rather than believing the ledger, because
// only the schema can tell "applied, row lost" from "never ran".
//
// Runs against its OWN in-memory SQLite handle, via the audit's injectable
// `run` executor, rather than the process-wide `db`. That shared handle is a
// single connection every test file in the directory takes turns repointing and
// closing (`RangeError: Cannot use a closed database` — the same isolation bug
// that keeps this whole directory out of CI as a unit), and a test that builds a
// specific drift state has no business sharing one anyway.

import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditMigrationLedger, readLedger, reconcileMigrationLedger } from '../src/migration-ledger'

let dir: string
let sqlite: Database

/** The injectable executor the audit and reconciler write through. */
const run = async (sql: string): Promise<any[]> => sqlite.prepare(sql).all() as any[]

const runAudit = (): ReturnType<typeof auditMigrationLedger> =>
  auditMigrationLedger({ dir, dialect: 'sqlite', run })

const runReconcile = (
  extra: { dryRun?: boolean, includePartial?: boolean } = {},
): ReturnType<typeof reconcileMigrationLedger> =>
  reconcileMigrationLedger({ dir, dialect: 'sqlite', run, ...extra })

afterAll(() => {
  sqlite?.close()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

/** The migrations, by logical name, in the order they were originally written. */
const MIGRATIONS: Array<{ logical: string, sql: string }> = [
  { logical: 'create-alert_channels-table', sql: 'CREATE TABLE IF NOT EXISTS "alert_channels" ("id" INTEGER PRIMARY KEY, "name" TEXT)' },
  { logical: 'create-issues-table', sql: 'CREATE TABLE IF NOT EXISTS "issues" ("id" INTEGER PRIMARY KEY, "title" TEXT)' },
  { logical: 'create-error_events-table', sql: 'CREATE TABLE IF NOT EXISTS "error_events" ("id" INTEGER PRIMARY KEY)' },
  { logical: 'create-subscriptions-table', sql: 'CREATE TABLE IF NOT EXISTS "subscriptions" ("id" INTEGER PRIMARY KEY)' },
]

/** The two that had never run, and only surfaced as 500s weeks later. */
const NEVER_RAN: Array<{ logical: string, sql: string }> = [
  { logical: 'add-repository-to-projects', sql: 'ALTER TABLE "projects" ADD COLUMN "repository" TEXT' },
  { logical: 'create-autofix_runs-table', sql: 'CREATE TABLE IF NOT EXISTS "autofix_runs" ("id" INTEGER PRIMARY KEY)' },
]

function write(dirPath: string, ordinal: number, logical: string, sql: string): string {
  const name = `${String(ordinal).padStart(10, '0')}-${logical}.sql`
  writeFileSync(join(dirPath, name), `${sql};\n`)
  return name
}

async function resetLedger(rows: string[]): Promise<void> {
  sqlite.exec('DROP TABLE IF EXISTS migrations')
  sqlite.exec(`CREATE TABLE migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration TEXT NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
  // Bound, not inlined: one of the cases below seeds a deliberately hostile
  // row, and the fixture must be able to plant it without breaking itself.
  const insert = sqlite.prepare('INSERT INTO migrations (migration) VALUES (?)')
  for (const row of rows) insert.run(row)
}

beforeAll(() => {
  sqlite = new Database(':memory:')
  dir = mkdtempSync(join(tmpdir(), 'stacks-ledger-'))
  mkdirSync(dir, { recursive: true })

  // The live schema: every one of the four originals really did run, plus a
  // `projects` table for the ALTER that never did.
  for (const m of MIGRATIONS) sqlite.exec(m.sql)
  sqlite.exec('CREATE TABLE IF NOT EXISTS "projects" ("id" INTEGER PRIMARY KEY)')
})

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
})

describe('migration ledger drift (stacksjs/stacks#2203)', () => {
  /**
   * Renumber the corpus the way regeneration does: same logical migrations,
   * shifted ordinals, plus the two later files that were queued behind them.
   */
  function renumberedCorpus(): { ledgerRows: string[], diskFiles: string[] } {
    // The ledger recorded them at their ORIGINAL ordinals 1..4.
    const ledgerRows = MIGRATIONS.map((m, i) => `${String(i + 1).padStart(10, '0')}-${m.logical}.sql`)

    // Regeneration rewrote the sequence: alert_channels moved to the end.
    const reordered = [MIGRATIONS[1]!, MIGRATIONS[2]!, MIGRATIONS[3]!, MIGRATIONS[0]!]
    const diskFiles = reordered.map((m, i) => write(dir, i + 1, m.logical, m.sql))
    NEVER_RAN.forEach((m, i) => diskFiles.push(write(dir, 5 + i, m.logical, m.sql)))

    return { ledgerRows, diskFiles }
  }

  it('reports the drift instead of trusting the ledger', async () => {
    const { ledgerRows } = renumberedCorpus()
    await resetLedger(ledgerRows)

    const audit = await runAudit()

    expect(audit.supported).toBe(true)
    expect(audit.drift).toBe(true)
    expect(audit.entries).toHaveLength(6)
    expect(audit.recordedCount).toBe(4)

    // The four that DID run, and whose tables exist, but whose ledger rows
    // now name files that are no longer on disk.
    expect(audit.counts.stranded).toBe(4)
    // The two that genuinely never ran.
    expect(audit.counts.pending).toBe(2)
    expect(audit.entries.filter(e => e.status === 'pending').map(e => e.logical).sort())
      .toEqual(['add-repository-to-projects', 'create-autofix_runs-table'])

    // Every ledger row is an orphan, and each one names its renumbered file.
    expect(audit.orphans).toHaveLength(4)
    expect(audit.orphans.every(o => Boolean(o.renamedTo))).toBe(true)
  })

  it('does not confuse a stranded migration with a pending one', async () => {
    // The whole point. A disk-vs-ledger diff alone marks all six as pending;
    // reading the schema is what separates the four that already ran.
    const { ledgerRows } = renumberedCorpus()
    await resetLedger(ledgerRows)

    const audit = await runAudit()
    const stranded = audit.entries.filter(e => e.status === 'stranded').map(e => e.logical).sort()

    expect(stranded).toEqual([
      'create-alert_channels-table',
      'create-error_events-table',
      'create-issues-table',
      'create-subscriptions-table',
    ])
  })

  it('repairs the ledger without running any migration SQL', async () => {
    const { ledgerRows } = renumberedCorpus()
    await resetLedger(ledgerRows)

    const result = await runReconcile()

    // Four rows repointed at their renumbered files; nothing newly recorded,
    // because the remap already covered all four.
    expect(result.remapped).toHaveLength(4)
    expect(result.skipped).toEqual([])

    const ledger = await readLedger(run)
    expect(ledger).toEqual([
      '0000000001-create-issues-table.sql',
      '0000000002-create-error_events-table.sql',
      '0000000003-create-subscriptions-table.sql',
      '0000000004-create-alert_channels-table.sql',
    ])

    // The two that never ran are still absent from the ledger, so `migrate`
    // will pick them up — the actual fix for the reported 500s.
    expect(ledger.some(row => row.includes('add-repository-to-projects'))).toBe(false)
    expect(ledger.some(row => row.includes('create-autofix_runs-table'))).toBe(false)

    // `autofix_runs` was never created, proving reconciliation did not execute
    // a single statement from a migration file.
    const tables = await run(`SELECT name FROM sqlite_master WHERE type='table' AND name='autofix_runs'`)
    expect(tables).toHaveLength(0)
  })

  it('leaves the corpus clean afterwards, apart from the genuinely pending two', async () => {
    const { ledgerRows } = renumberedCorpus()
    await resetLedger(ledgerRows)
    await runReconcile()

    const audit = await runAudit()

    expect(audit.drift).toBe(false)
    expect(audit.orphans).toEqual([])
    expect(audit.counts.stranded).toBe(0)
    expect(audit.counts.applied).toBe(4)
    expect(audit.counts.pending).toBe(2)
  })

  it('records a stranded migration that has no ledger row to repoint', async () => {
    // The other half of recovery: regeneration folded an old ALTER into a
    // CREATE, so no ledger row shares its logical name. The schema still proves
    // it ran, so it gets recorded rather than re-run.
    write(dir, 1, 'create-issues-table', MIGRATIONS[1]!.sql)
    await resetLedger([])

    const result = await runReconcile()

    expect(result.remapped).toEqual([])
    expect(result.recorded).toEqual(['0000000001-create-issues-table.sql'])
    expect(await readLedger(run)).toEqual(['0000000001-create-issues-table.sql'])
  })

  it('refuses to record a data migration it cannot verify', async () => {
    // The shipped corpus contains `revoke-legacy-long-lived-tokens.sql`, a hard
    // `DELETE FROM oauth_access_tokens`. It leaves no schema trace, so
    // recording it on a hunch would skip a revocation that never ran — and
    // re-running it would wipe live tokens a second time. Neither is acceptable
    // automatically, so it stays out of both lists.
    write(dir, 1, 'revoke-legacy-long-lived-tokens', 'DELETE FROM alert_channels WHERE name IS NULL')
    await resetLedger([])

    const audit = await runAudit()
    expect(audit.counts.unverifiable).toBe(1)
    expect(audit.counts.stranded).toBe(0)

    const result = await runReconcile()
    expect(result.recorded).toEqual([])
    expect(result.remapped).toEqual([])
    expect(await readLedger(run)).toEqual([])
  })

  it('refuses a half-applied migration unless explicitly told otherwise', async () => {
    write(dir, 1, 'create-two-tables', 'CREATE TABLE IF NOT EXISTS "issues" ("id" INTEGER);\nCREATE TABLE IF NOT EXISTS "nope" ("id" INTEGER)')
    await resetLedger([])

    const audit = await runAudit()
    expect(audit.counts.partial).toBe(1)

    const refused = await runReconcile()
    expect(refused.recorded).toEqual([])
    expect(refused.skipped).toHaveLength(1)
    expect(refused.skipped[0]!.reason).toContain('1/2 effects present')

    const forced = await runReconcile({ includePartial: true })
    expect(forced.recorded).toEqual(['0000000001-create-two-tables.sql'])
  })

  it('skips a ledger row it cannot safely write, without abandoning the rest', async () => {
    // Ledger rows come out of the database, so they are not guaranteed to look
    // like anything the framework wrote. A row that cannot be inlined safely
    // must not abort the repair partway through and leave the ledger in a worse
    // state than the drift it was called to fix.
    const { ledgerRows } = renumberedCorpus()
    await resetLedger([...ledgerRows, `0000000009-evil'; DROP TABLE issues; --.sql`])

    const result = await runReconcile()

    expect(result.remapped).toHaveLength(4)
    expect(result.skipped.map(s => s.file)).toContain(`0000000009-evil'; DROP TABLE issues; --.sql`)

    // The repair still landed, and the hostile row did nothing.
    const tables = await run(`SELECT name FROM sqlite_master WHERE type='table' AND name='issues'`)
    expect(tables).toHaveLength(1)
  })

  it('reports a clean corpus as clean', async () => {
    const files = MIGRATIONS.map((m, i) => write(dir, i + 1, m.logical, m.sql))
    await resetLedger(files)

    const audit = await runAudit()
    expect(audit.drift).toBe(false)
    expect(audit.counts.applied).toBe(4)
    expect(audit.orphans).toEqual([])
  })

  it('dry run reports the repair without touching the ledger', async () => {
    const { ledgerRows } = renumberedCorpus()
    await resetLedger(ledgerRows)

    const plan = await runReconcile({ dryRun: true })
    expect(plan.remapped).toHaveLength(4)
    expect(await readLedger(run)).toEqual([...ledgerRows].sort())
  })
})
