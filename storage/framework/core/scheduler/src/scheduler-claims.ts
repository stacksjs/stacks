/**
 * Per-slot claims for `onOneServer()` (stacksjs/stacks#3152).
 *
 * The advisory lock in `scheduler-lock.ts` is a mutex: it is released when a
 * run ends, so it stops two servers running a task at the same moment, not
 * one slot running once per server. A quick task (a queue dispatch takes
 * milliseconds) finished on server A before server B's tick landed a few
 * hundred ms later, and B took the free lock and ran the slot again.
 *
 * A claim is a row keyed on (task, slot), the time the tick woke for. Every
 * server inserts its own claimant token and the row that went in first wins;
 * the others read back someone else's token and skip the slot. Rows older
 * than a day are pruned on the winner's path.
 *
 * The table is created on first use, as `ensureFeatureFlagTable()` does, with
 * CREATE TABLE IF NOT EXISTS. SQLite and a missing connection stay
 * single-host: the claim always succeeds there, as the lock already warns.
 */

import type { Dialect } from './scheduler-lock'
import { randomUUID } from 'node:crypto'
import { lockFileName, pluckFirstRow } from './scheduler-lock'

export const SCHEDULER_CLAIMS_TABLE = 'scheduler_claims'

/** How long a claim row is kept before the winner of a later slot prunes it. */
export const SCHEDULER_CLAIM_RETENTION_MS = 24 * 60 * 60 * 1000

type AdminDb = { unsafe: (sql: string) => Promise<unknown> }

/** The table's DDL, the same on PostgreSQL and MySQL. */
export function schedulerClaimsTableSql(): string {
  return `CREATE TABLE IF NOT EXISTS ${SCHEDULER_CLAIMS_TABLE} (`
    + 'task VARCHAR(128) NOT NULL,'
    + 'slot BIGINT NOT NULL,'
    + 'claimant CHAR(36) NOT NULL,'
    + 'PRIMARY KEY (task, slot)'
    + ')'
}

const tablesReady = new WeakMap<AdminDb, Promise<void>>()

/**
 * Create the claims table once per connection. Two servers booting together
 * can both run CREATE TABLE IF NOT EXISTS, and PostgreSQL can fail the loser
 * on its catalog's unique index, so a failure is retried once. A failure that
 * survives the retry is not remembered: the next tick tries again.
 */
function ensureClaimsTable(adminDb: AdminDb): Promise<void> {
  let ready = tablesReady.get(adminDb)
  if (!ready) {
    ready = (async () => {
      try {
        await adminDb.unsafe(schedulerClaimsTableSql())
      }
      catch {
        await adminDb.unsafe(schedulerClaimsTableSql())
      }
    })()
    tablesReady.set(adminDb, ready)
    ready.catch(() => tablesReady.delete(adminDb))
  }
  return ready
}

/**
 * Claim `slot` (epoch ms) of `taskName` for this server. Resolves true when
 * this server should run the slot, false when another server claimed it
 * first. Throws when the database cannot answer: a claim that cannot be
 * checked is a failure to run, as a lock that cannot be checked is.
 */
export async function claimSchedulerSlot(
  taskName: string,
  slot: number,
  dialect: Dialect | null,
  adminDb: AdminDb | null,
): Promise<boolean> {
  if (!adminDb || (dialect !== 'postgres' && dialect !== 'mysql'))
    return true

  await ensureClaimsTable(adminDb)

  // The lock file's name: a plain [\w.-] alphabet plus a hash of the full
  // name, so it is safe to inline and two names that sanitize alike differ.
  const task = lockFileName(taskName).replace(/\.lock$/, '')
  const at = Math.trunc(slot)
  const claimant = randomUUID()
  const values = `('${task}', ${at}, '${claimant}')`
  await adminDb.unsafe(dialect === 'postgres'
    ? `INSERT INTO ${SCHEDULER_CLAIMS_TABLE} (task, slot, claimant) VALUES ${values} ON CONFLICT (task, slot) DO NOTHING`
    : `INSERT INTO ${SCHEDULER_CLAIMS_TABLE} (task, slot, claimant) VALUES ${values} ON DUPLICATE KEY UPDATE task = task`)

  const row = pluckFirstRow(await adminDb.unsafe(
    `SELECT claimant FROM ${SCHEDULER_CLAIMS_TABLE} WHERE task = '${task}' AND slot = ${at}`,
  )) as { claimant?: unknown } | null
  const won = typeof row?.claimant === 'string' && row.claimant.trim() === claimant
  if (won) {
    await adminDb.unsafe(
      `DELETE FROM ${SCHEDULER_CLAIMS_TABLE} WHERE task = '${task}' AND slot < ${at - SCHEDULER_CLAIM_RETENTION_MS}`,
    )
  }
  return won
}
