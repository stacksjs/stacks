/**
 * A model write inside `transaction()` is part of the transaction
 * (stacksjs/stacks#3269).
 *
 * bun-query-builder binds model calls to the transaction's connection for the
 * length of the callback (stacksjs/bun-query-builder#1212). Stacks wraps every
 * `db.transaction()` callback (`applyTransactionDispatchScope`), and used to
 * bind it with `AsyncLocalStorage.bind`, which restored the context from
 * before that binding: the model writes stayed outside the transaction even
 * on a bun-query-builder that fixed it. Measured with the bind kept: every
 * case below except the commit failed.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const file = join(mkdtempSync(join(tmpdir(), 'stacks-model-tx-')), 'test.sqlite')
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = file
const { db, acquireDbConfigLock, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { defineModel } = await import('../src/define-model')
const { savepoint, transaction } = await import('../src/transaction')
const { configureOrm } = await import('bun-query-builder')

let unlock: () => void
// eslint-disable-next-line ts/no-explicit-any -- a table defined for this file only
let Person: any

beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database: file }, mysql: {}, postgres: {} } } })
  configureOrm({ database: file })
  await db.unsafe('CREATE TABLE model_tx_people (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT)').execute()
  Person = defineModel({ name: 'ModelTxPerson', table: 'model_tx_people', attributes: { name: { fillable: true } } } as never)
})

afterAll(() => unlock?.())

async function names(): Promise<string[]> {
  return (await db.unsafe('SELECT name FROM model_tx_people ORDER BY id').execute()).map((row: { name: string }) => row.name)
}

async function refused(run: () => unknown): Promise<void> {
  await expect((async () => run())()).rejects.toThrow('boom')
}

describe('model writes inside transaction()', () => {
  it('roll back with it', async () => {
    const ada = await Person.create({ name: 'Ada' })
    await refused(() => transaction(async () => {
      await Person.update(ada.id, { name: 'Changed' })
      await Person.create({ name: 'Ghost' })
      throw new Error('boom')
    }))
    expect(await names()).toEqual(['Ada'])
  })

  it('roll back with db.transaction() too, and with a callback that is not async', async () => {
    await refused(() => db.transaction(() => {
      Person.create({ name: 'Ghost' })
      throw new Error('boom')
    }))
    expect(await names()).toEqual(['Ada'])
  })

  it('see what the handle wrote, and the handle sees them', async () => {
    const seen: Record<string, unknown> = {}
    await refused(() => transaction(async (tx) => {
      await tx.updateTable('model_tx_people').set({ name: 'InTx' }).where('name', '=', 'Ada').execute()
      seen.model = (await Person.where('name', 'InTx').first())?.name
      await Person.create({ name: 'Bea' })
      seen.handle = Number(await tx.selectFrom('model_tx_people').where('name', '=', 'Bea').count())
      throw new Error('boom')
    }))
    expect(seen).toEqual({ model: 'InTx', handle: 1 })
    expect(await names()).toEqual(['Ada'])
  })

  it('commit with it', async () => {
    await transaction(async () => {
      await Person.create({ name: 'Cy' })
    })
    expect(await names()).toEqual(['Ada', 'Cy'])
  })

  it('in a savepoint roll back alone', async () => {
    await transaction(async () => {
      await Person.create({ name: 'Outer' })
      await refused(() => savepoint(async () => {
        await Person.create({ name: 'Inner' })
        throw new Error('boom')
      }))
    })
    expect(await names()).toEqual(['Ada', 'Cy', 'Outer'])
  })
})
