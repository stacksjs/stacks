/**
 * A record and its related rows, saved together or not at all
 * (stacksjs/stacks#3315).
 *
 * The edit page sends the record's changed fields and, per related panel,
 * the rows to add, edit and delete, to `PATCH /models/{slug}/{id}/save`.
 * Every write runs in one `transaction()`, so the first refusal takes back
 * the ones before it. These run on a real SQLite database, through real
 * models: a rollback is the database's to do, and a stand-in model could
 * only pretend.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const file = join(mkdtempSync(join(tmpdir(), 'stacks-model-save-')), 'test.sqlite')
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = file
const { db, acquireDbConfigLock, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { defineModel } = await import('../../storage/framework/core/orm/src/define-model')
const { configureOrm } = await import('bun-query-builder')
const { schema } = await import('@stacksjs/validation')
const { default: ModelSaveAction } = await import('../../storage/framework/defaults/app/Actions/Dashboard/Models/ModelSaveAction')

const globals = globalThis as Record<string, unknown>
const names = ['Ledger', 'LedgerEntry']
let unlock: () => void

beforeAll(async () => {
  for (const name of names) {
    if (name in globals)
      throw new Error(`a global named ${name} already exists`)
  }
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database: file }, mysql: {}, postgres: {} } } })
  configureOrm({ database: file })
  await db.unsafe('CREATE TABLE ledgers (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, created_at TEXT, updated_at TEXT)').execute()
  await db.unsafe('CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, ledger_id INTEGER, memo TEXT, amount INTEGER, created_at TEXT, updated_at TEXT)').execute()
  globals.Ledger = defineModel({
    name: 'Ledger',
    table: 'ledgers',
    hasMany: ['LedgerEntry'],
    traits: { useApi: true },
    attributes: { title: { fillable: true, validation: { rule: schema.string().max(12) } } },
  } as never)
  globals.LedgerEntry = defineModel({
    name: 'LedgerEntry',
    table: 'ledger_entries',
    belongsTo: ['Ledger'],
    traits: { useApi: true },
    attributes: {
      // Declared and required, like TeamMember's userId: the panel never shows
      // it, and the server supplies it for every row it creates.
      ledgerId: { fillable: true, required: true, validation: { rule: schema.number().required() } },
      memo: { fillable: true },
      amount: { fillable: true, validation: { rule: schema.number().min(1) } },
    },
  } as never)
})

afterAll(() => {
  for (const name of names)
    delete globals[name]
  unlock?.()
})

async function save(id: number, body: Record<string, unknown>): Promise<{ status: number, body: any }> {
  const request = { getParam: (key: string) => ({ slug: 'ledger', id: String(id) })[key], all: () => body, user: async () => null }
  const result = await ModelSaveAction.handle(request as never)
  if (result instanceof Response)
    return { status: result.status, body: await result.json() }
  return { status: 200, body: result }
}

async function rows(sql: string): Promise<any[]> {
  return await db.unsafe(sql).execute()
}

async function seed(): Promise<{ ledger: number, other: number, kept: number, gone: number, elsewhere: number }> {
  await db.unsafe('DELETE FROM ledger_entries').execute()
  await db.unsafe('DELETE FROM ledgers').execute()
  await db.unsafe('INSERT INTO ledgers (id, title) VALUES (1, \'Spring\'), (2, \'Summer\')').execute()
  await db.unsafe('INSERT INTO ledger_entries (id, ledger_id, memo, amount) VALUES (10, 1, \'Rent\', 500), (11, 1, \'Coffee\', 4), (20, 2, \'Bike\', 300)').execute()
  return { ledger: 1, other: 2, kept: 10, gone: 11, elsewhere: 20 }
}

const everything = async () => ({
  ledgers: await rows('SELECT id, title FROM ledgers ORDER BY id'),
  entries: await rows('SELECT id, ledger_id, memo, amount FROM ledger_entries ORDER BY id'),
})

describe('saving a record and its rows together', () => {
  it('writes the record and every row when all of it is accepted', async () => {
    const { ledger, kept, gone } = await seed()
    const result = await save(ledger, {
      fields: { title: 'Spring 2027' },
      related: [{ slug: 'ledger-entry', create: [{ key: 'new-1', fields: { memo: 'Train', amount: 30 } }], update: [{ id: kept, fields: { amount: 550 } }], destroy: [gone] }],
    })
    expect(result.status).toBe(200)
    expect(result.body.related[0]).toMatchObject({ slug: 'ledger-entry', updated: [kept], destroyed: [gone] })
    expect(result.body.related[0].created[0].key).toBe('new-1')
    const after = await everything()
    expect(after.ledgers[0]).toEqual({ id: 1, title: 'Spring 2027' })
    expect(after.entries.map((row: any) => [row.ledger_id, row.memo, row.amount])).toEqual([[1, 'Rent', 550], [2, 'Bike', 300], [1, 'Train', 30]])
  })

  it('keeps nothing when one new row is refused, and says which row and why', async () => {
    const { ledger, kept, gone } = await seed()
    const before = await everything()
    const result = await save(ledger, {
      fields: { title: 'Spring 2027' },
      related: [{ slug: 'ledger-entry', create: [{ key: 'new-1', fields: { memo: 'Train', amount: 30 } }, { key: 'new-2', fields: { memo: 'Refund', amount: 0 } }], update: [{ id: kept, fields: { amount: 550 } }], destroy: [gone] }],
    })
    expect(result.status).toBe(422)
    expect(result.body.at).toEqual({ operation: 'create', panel: 'ledger-entry', row: 'new-2' })
    expect(Object.keys(result.body.errors ?? {})).toContain('amount')
    expect(await everything()).toEqual(before)
  })

  it('keeps nothing when the record itself is refused', async () => {
    const { ledger, gone } = await seed()
    const before = await everything()
    const result = await save(ledger, { fields: { title: 'A title far too long for it' }, related: [{ slug: 'ledger-entry', destroy: [gone] }] })
    expect(result.status).toBe(422)
    expect(result.body.at).toEqual({ operation: 'update' })
    expect(await everything()).toEqual(before)
  })

  it('refuses a row that belongs to another record, and keeps nothing', async () => {
    const { ledger, elsewhere } = await seed()
    const before = await everything()
    for (const related of [[{ slug: 'ledger-entry', update: [{ id: elsewhere, fields: { amount: 1 } }] }], [{ slug: 'ledger-entry', destroy: [elsewhere] }]]) {
      const result = await save(ledger, { fields: { title: 'Spring 2027' }, related })
      expect(result.status).toBe(404)
      expect(result.body.at.row).toBe(String(elsewhere))
      expect(await everything()).toEqual(before)
    }
  })

  it('puts a new row under this record, and moves no row, whatever the form sent', async () => {
    const { ledger, other, kept } = await seed()
    const result = await save(ledger, {
      related: [{ slug: 'ledger-entry', create: [{ key: 'new-1', fields: { memo: 'Train', amount: 30, ledgerId: other, ledger_id: other } }], update: [{ id: kept, fields: { amount: 600, ledgerId: other, ledger_id: other } }] }],
    })
    expect(result.status).toBe(200)
    const entries = await rows('SELECT id, ledger_id FROM ledger_entries ORDER BY id')
    expect(entries.filter((row: any) => row.id === kept || row.id > 20).map((row: any) => row.ledger_id)).toEqual([ledger, ledger])
  })

  it('refuses a panel the record does not have, before writing anything', async () => {
    const { ledger } = await seed()
    const before = await everything()
    const result = await save(ledger, { fields: { title: 'Spring 2027' }, related: [{ slug: 'user', destroy: [1] }] })
    expect(result.status).toBe(422)
    expect(await everything()).toEqual(before)
  })

  it('refuses an empty save and a malformed one', async () => {
    const { ledger } = await seed()
    expect((await save(ledger, {})).status).toBe(422)
    expect((await save(ledger, { related: [{ slug: 'ledger-entry', update: [{ id: 'x', fields: {} }] }] })).status).toBe(422)
    expect((await save(ledger, { related: [{ slug: 'ledger-entry', update: [{ id: 10, fields: {} }], destroy: [10] }] })).body.message).toContain('both edited and deleted')
  })
})

describe('the edit page saves them that way', () => {
  it('keeps row changes as drafts and sends them with the record, in one request', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordEdit.stx', 'utf8')
    expect(page).toContain('modelRelatedSaveChanges(panels(), drafts())')
    expect(page).toContain('saveModelRecordWithRelated(slug(), recordId(), fields, related)')
    // A row is kept, not written, until the record is saved.
    expect(page).toContain('drafts.set(modelDraftPut(drafts(), current.panel, current.key, rowValues()))')
    expect(page).not.toContain('saveModelRelated(')
    expect(page).not.toContain('deleteModelRecord(')
    // The row form is part of the page, not a dialog over it.
    expect(page).toContain('data-related-draft-editor')
    expect(page).not.toContain('<Modal')
  })
})
