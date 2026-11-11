import type { SqlClient, SqlDialect } from './types'
import { placeholder, runSql, tableName } from './sql'

/**
 * One pending or approved connect attempt.
 *
 * The code itself is never stored: `codeHash` is its SHA-256, and
 * `sealedGrant` is the keys encrypted under a key derived from the code. A
 * copy of this table therefore yields neither a code that can be polled nor
 * the keys an approved one is waiting to hand over.
 */
export interface ConnectCodeRecord {
  codeHash: string
  /** The app the CLI named, shown on the approve page. */
  app: string
  status: 'pending' | 'approved'
  sealedGrant: string | null
  /** Epoch milliseconds. */
  expiresAt: number
}

export interface ConnectCodeStore {
  create: (record: ConnectCodeRecord) => Promise<void>
  find: (codeHash: string) => Promise<ConnectCodeRecord | null>
  /** Move a PENDING record to approved. `false` when it is missing or already approved. */
  approve: (codeHash: string, sealedGrant: string) => Promise<boolean>
  /**
   * Take an APPROVED record, removing it. Must be atomic: of two concurrent
   * calls exactly one gets the record, which is what makes a code single-use.
   */
  consume: (codeHash: string) => Promise<ConnectCodeRecord | null>
  /** Drop records that expired before `now` (epoch ms). */
  prune: (now: number) => Promise<void>
}

export function createMemoryConnectCodeStore(): ConnectCodeStore & { records: () => ConnectCodeRecord[] } {
  const records = new Map<string, ConnectCodeRecord>()
  return {
    async create(record) {
      records.set(record.codeHash, { ...record })
    },
    async find(codeHash) {
      const record = records.get(codeHash)
      return record ? { ...record } : null
    },
    async approve(codeHash, sealedGrant) {
      const record = records.get(codeHash)
      if (!record || record.status !== 'pending')
        return false
      records.set(codeHash, { ...record, status: 'approved', sealedGrant })
      return true
    },
    async consume(codeHash) {
      const record = records.get(codeHash)
      if (!record || record.status !== 'approved')
        return null
      records.delete(codeHash)
      return { ...record }
    },
    async prune(now) {
      for (const [hash, record] of records) {
        if (record.expiresAt < now)
          records.delete(hash)
      }
    },
    records: () => [...records.values()].map(record => ({ ...record })),
  }
}

export const CONNECT_CODES_TABLE = 'hq_connect_codes'

export interface ConnectCodesSchemaOptions {
  table?: string
  dialect?: SqlDialect
}

/** The package-owned schema for connect codes, for a migration or `ensureConnectCodesTable`. */
export function connectCodesMigrationSql(options: ConnectCodesSchemaOptions = {}): string[] {
  const table = tableName(options.table ?? CONNECT_CODES_TABLE)
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (`
    + 'code_hash CHAR(64) NOT NULL,'
    + 'app VARCHAR(64) NOT NULL,'
    + 'status VARCHAR(16) NOT NULL,'
    + 'sealed_grant TEXT,'
    + 'claim CHAR(36),'
    + 'expires_at BIGINT NOT NULL,'
    + 'PRIMARY KEY (code_hash)'
    + ')',
  ]
}

export async function ensureConnectCodesTable(client: SqlClient, options: ConnectCodesSchemaOptions = {}): Promise<void> {
  for (const sql of connectCodesMigrationSql(options))
    await runSql(client, sql)
}

/**
 * A `ConnectCodeStore` over `hq_connect_codes`.
 *
 * `approve` and `consume` each win or lose by writing a random claim in a
 * guarded UPDATE and reading it back. That needs neither RETURNING nor an
 * affected-row count, so one implementation is atomic on all three dialects.
 */
export function sqlConnectCodeStore(client: SqlClient, options: ConnectCodesSchemaOptions = {}): ConnectCodeStore {
  const table = tableName(options.table ?? CONNECT_CODES_TABLE)
  const dialect = options.dialect ?? 'sqlite'
  const p = (n: number): string => placeholder(dialect, n)
  const columns = 'code_hash, app, status, sealed_grant, claim, expires_at'

  const toRecord = (row: Record<string, unknown>): ConnectCodeRecord => ({
    codeHash: String(row.code_hash),
    app: String(row.app),
    status: row.status === 'approved' || row.status === 'consumed' ? 'approved' : 'pending',
    sealedGrant: row.sealed_grant == null ? null : String(row.sealed_grant),
    expiresAt: Number(row.expires_at),
  })

  async function row(codeHash: string): Promise<Record<string, unknown> | null> {
    return (await runSql(client, `SELECT ${columns} FROM ${table} WHERE code_hash = ${p(1)} LIMIT 1`, [codeHash]))[0] ?? null
  }

  /** Move a record from one status to another; true only for the caller whose claim landed. */
  async function transition(codeHash: string, from: string, to: string, sealedGrant?: string): Promise<Record<string, unknown> | null> {
    const claim = crypto.randomUUID()
    if (sealedGrant === undefined) {
      await runSql(client, `UPDATE ${table} SET status = ${p(1)}, claim = ${p(2)} WHERE code_hash = ${p(3)} AND status = ${p(4)}`, [to, claim, codeHash, from])
    }
    else {
      await runSql(client, `UPDATE ${table} SET status = ${p(1)}, claim = ${p(2)}, sealed_grant = ${p(3)} WHERE code_hash = ${p(4)} AND status = ${p(5)}`, [to, claim, sealedGrant, codeHash, from])
    }
    const after = await row(codeHash)
    return after && after.status === to && after.claim === claim ? after : null
  }

  return {
    async create(record) {
      await runSql(
        client,
        `INSERT INTO ${table} (code_hash, app, status, sealed_grant, expires_at) VALUES (${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)})`,
        [record.codeHash, record.app, record.status, record.sealedGrant, record.expiresAt],
      )
    },
    async find(codeHash) {
      const found = await row(codeHash)
      // A consumed row is on its way out; to a reader it is already gone.
      return found && found.status !== 'consumed' ? toRecord(found) : null
    },
    async approve(codeHash, sealedGrant) {
      return await transition(codeHash, 'pending', 'approved', sealedGrant) !== null
    },
    async consume(codeHash) {
      const taken = await transition(codeHash, 'approved', 'consumed')
      if (!taken)
        return null
      await runSql(client, `DELETE FROM ${table} WHERE code_hash = ${p(1)}`, [codeHash])
      return toRecord(taken)
    },
    async prune(now) {
      await runSql(client, `DELETE FROM ${table} WHERE expires_at < ${p(1)}`, [now])
    },
  }
}
