/**
 * `row.update(data)` and `row.save()` follow the same rules as `Model.create`
 * and `Model.update(id, data)`.
 *
 * The static writes validate and convert datetimes to the form their column
 * stores. The instance writes reached the query builder's own save with
 * neither, so one model stored `2026-11-17T10:00:00.000` through `create` and
 * `2026-11-17T11:00:00Z` through `row.update`, and loading a row first was a
 * way around every declared rule.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { schema } from '@stacksjs/validation/runtime'
import { defineModel } from '../src/define-model'

describe('instance writes are validated and normalized', () => {
  let db: Database
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE iw_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      seen_at TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const Finding: any = defineModel({
    name: 'IwFinding',
    table: 'iw_findings',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      title: { fillable: true, validation: { rule: schema.string().max(10) } },
      seenAt: { fillable: true, validation: { rule: schema.timestamp() } },
    },
  } as const)

  const stored = (id: unknown) => db.query('SELECT title, seen_at FROM iw_findings WHERE id = ?').get(Number(id)) as any

  it('stores a datetime written through row.update() the way create() stores it', () => {
    const created = Finding.create({ title: 'first', seenAt: '2026-11-17T10:00:00Z' })
    const viaCreate = stored(created.id).seen_at

    const row = Finding.find(created.id)
    row.update({ seenAt: '2026-11-17T10:00:00Z' })
    expect(stored(created.id).seen_at).toBe(viaCreate)
  })

  it('stores a datetime assigned and saved the same way', () => {
    const created = Finding.create({ title: 'second', seenAt: '2026-11-17T10:00:00Z' })
    const viaCreate = stored(created.id).seen_at

    const row = Finding.find(created.id)
    row.seenAt = '2026-11-17T10:00:00Z'
    row.save()
    expect(stored(created.id).seen_at).toBe(viaCreate)
  })

  it('refuses an invalid value through row.update(), row.save() and the quiet variants', () => {
    const created = Finding.create({ title: 'third', seenAt: '2026-11-17T10:00:00Z' })

    const row = Finding.find(created.id)
    expect(() => row.update({ title: 'x'.repeat(50) })).toThrow('IwFinding validation failed: title')
    expect(() => Finding.find(created.id).updateQuietly({ title: 'x'.repeat(50) })).toThrow('validation failed')

    const assigned = Finding.find(created.id)
    assigned.title = 'x'.repeat(50)
    expect(() => assigned.save()).toThrow('validation failed')
    expect(() => assigned.saveQuietly()).toThrow('validation failed')

    expect(stored(created.id).title).toBe('third')
  })

  it('validates only what changed, so an untouched attribute cannot fail an update', () => {
    // A row written before a rule tightened still updates its other fields.
    const id = Number(db.query('INSERT INTO iw_findings (title, seen_at) VALUES (?, ?) RETURNING id').get('far too long a title', '2026-11-17 10:00:00')!.id)
    Finding.find(id).update({ seenAt: '2026-11-18T10:00:00Z' })
    expect(stored(id).title).toBe('far too long a title')
  })

  it('lets withoutValidation through', async () => {
    const created = Finding.create({ title: 'fourth', seenAt: '2026-11-17T10:00:00Z' })
    await Finding.withoutValidation(() => Finding.find(created.id).update({ title: 'x'.repeat(50) }))
    expect(stored(created.id).title).toBe('x'.repeat(50))
  })
})
