/**
 * `Model.createMany()` applies every rule `Model.create()` does.
 *
 * bun-query-builder 0.3 batches createMany into multi-row INSERTs. Before, it
 * was a loop of `this.create()`, which on a Stacks model meant this layer's
 * wrapped `create`: mass assignment, `set:` mutators, casts, encryption and
 * declared validation all ran per record. The batched version builds its rows
 * inside the query builder, so each of those wrappers now handles createMany
 * itself. These read the rows back to show the batch writes what the same
 * records would one at a time.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { schema } from '@stacksjs/validation'
import { defineModel } from '../src/define-model'

describe('createMany goes through the create pipeline', () => {
  let db: Database
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE cmp_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      active INTEGER,
      role TEXT,
      created_at TEXT,
      updated_at TEXT
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const Member = defineModel({
    name: 'CmpMember',
    table: 'cmp_members',
    primaryKey: 'id',
    autoIncrement: true,
    traits: { useTimestamps: true },
    attributes: {
      name: { type: 'string', fillable: true, validation: { rule: schema.string().max(20) } },
      email: { type: 'string', fillable: true },
      active: { type: 'boolean', fillable: true },
      role: { type: 'string', guarded: true },
    },
    set: { email: (attrs: Record<string, unknown>) => String(attrs.email).toLowerCase() },
    casts: { active: 'boolean' },
  } as any) as any

  const rows = (): any[] => db.query('SELECT id, name, email, active, role FROM cmp_members ORDER BY id').all() as any[]

  it('writes every record, and reads them back as model instances', async () => {
    const made = await Member.createMany([
      { name: 'Ada', email: 'ADA@EXAMPLE.COM', active: true },
      { name: 'Grace', email: 'Grace@Example.com', active: false },
    ])
    expect(made).toHaveLength(2)
    expect(made.map((m: any) => m.name)).toEqual(['Ada', 'Grace'])
    expect(made.every((m: any) => Number(m.id) > 0)).toBe(true)
  })

  it('runs set: mutators on each record', () => {
    expect(rows().map(r => r.email)).toEqual(['ada@example.com', 'grace@example.com'])
  })

  it('casts each record on the way in', () => {
    expect(rows().map(r => r.active)).toEqual([1, 0])
  })

  it('refuses a guarded column, like create()', async () => {
    const err = await Member.createMany([{ name: 'Eve', email: 'e@x.co', role: 'admin' }]).then(() => null, (e: any) => e)
    expect(err?.name).toBe('MassAssignmentException')
    expect(rows().some(r => r.name === 'Eve')).toBe(false)
  })

  it('validates every record before writing any', async () => {
    const before = rows().length
    const err = await Member.createMany([
      { name: 'Fine', email: 'f@x.co' },
      { name: 'x'.repeat(50), email: 'long@x.co' },
    ]).then(() => null, (e: any) => e)
    expect(err?.name).toBe('ModelValidationError')
    // The valid first record was not written either: the batch is all or nothing.
    expect(rows().length).toBe(before)
  })

  it('has a quiet variant', () => {
    expect(typeof Member.createManyQuietly).toBe('function')
  })
})
