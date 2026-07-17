// Framework-boundary regression guard for bun-query-builder transaction
// routing. Raw SQL issued from a transaction-scoped builder must use the
// reserved transaction connection; sending it through the global pool makes
// rollbacks and row locks (`FOR UPDATE`) ineffective.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { SQL } from 'bun'
import { config, createQueryBuilder, setConfig } from '../src/index'

const originalDialect = config.dialect
const originalDatabase = { ...config.database }
let sql: SQL

beforeAll(() => {
  setConfig({ dialect: 'sqlite', database: { database: ':memory:' } } as any)
  sql = new SQL('sqlite://:memory:')
})

afterAll(async () => {
  await sql.close()
  setConfig({ dialect: originalDialect, database: originalDatabase } as any)
})

describe('transaction-scoped unsafe queries', () => {
  it('rolls back raw writes with the surrounding transaction', async () => {
    const db = createQueryBuilder({ sql }) as any
    await db.unsafe('CREATE TABLE transaction_raw_writes (id INTEGER PRIMARY KEY, name TEXT)')

    await expect(db.transaction(async (trx: any) => {
      await trx.unsafe('INSERT INTO transaction_raw_writes (name) VALUES (?)', ['rollback me'])
      const inside = await trx.unsafe('SELECT name FROM transaction_raw_writes')
      expect(inside).toEqual([{ name: 'rollback me' }])
      throw new Error('rollback raw write')
    })).rejects.toThrow('rollback raw write')

    const after = await db.unsafe('SELECT name FROM transaction_raw_writes')
    expect(after).toEqual([])
  })
})
