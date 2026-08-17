/**
 * Multi-word attributes must be readable under the name the model declared.
 *
 * Attributes are stored under their column name. Every other surface already
 * accepts the declared camelCase spelling — `create({ pollIntervalMinutes })`
 * writes it, `where('pollIntervalMinutes', 30)` queries it, and `ModelRow`
 * types the property as present — but property reads resolved only the column
 * name. `row.pollIntervalMinutes` was therefore `undefined` while typechecking
 * clean, so the mistake was invisible and the value usually disappeared into a
 * `|| default`.
 *
 * Serialization deliberately does NOT change: `ownKeys` still reports column
 * names only, so spreads, `Object.keys`, and JSON responses keep the exact
 * shape they had.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

describe('camelCase attribute accessors', () => {
  let db: Database
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE cc_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT,
      poll_interval_minutes INTEGER,
      last_mention_at TEXT,
      status TEXT
    )`)
  })

  afterAll(() => {
    releaseDbConfigLock()
  })

  const Profile = defineModel({
    name: 'CcProfile',
    table: 'cc_profiles',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      displayName: { type: 'string', fillable: true },
      pollIntervalMinutes: { type: 'number', fillable: true },
      lastMentionAt: { type: 'string', fillable: true, required: false },
      status: { type: 'string', fillable: true },
    },
  } as const)

  async function seed() {
    return await (Profile as any).create({
      displayName: 'Riverside', pollIntervalMinutes: 30,
      lastMentionAt: '2026-08-17T10:00:00.000Z', status: 'active',
    })
  }

  it('reads a multi-word attribute under its declared name', async () => {
    const created = await seed()
    const row = await (Profile as any).find(Number(created.id))

    expect(row.pollIntervalMinutes).toBe(30)
    expect(row.displayName).toBe('Riverside')
    expect(row.lastMentionAt).toBe('2026-08-17T10:00:00.000Z')
  })

  it('still reads the column name, so existing call sites keep working', async () => {
    const created = await seed()
    const row = await (Profile as any).find(Number(created.id))

    expect(row.poll_interval_minutes).toBe(30)
    expect(row.display_name).toBe('Riverside')
  })

  it('resolves through a query chain, not just find()', async () => {
    await seed()
    const row = await (Profile as any).where('status', 'active').first()
    expect(row.pollIntervalMinutes).toBe(30)
  })

  it('reports the declared name from the `in` operator', async () => {
    const created = await seed()
    const row = await (Profile as any).find(Number(created.id))

    expect('pollIntervalMinutes' in row).toBe(true)
    expect('poll_interval_minutes' in row).toBe(true)
    expect('notAnAttribute' in row).toBe(false)
  })

  it('leaves serialization on column names', async () => {
    const created = await seed()
    const row = await (Profile as any).find(Number(created.id))

    // The wire shape must not change: no duplicated camelCase fields in an
    // API response, no surprise growth in payload size.
    expect(Object.keys(row)).toContain('poll_interval_minutes')
    expect(Object.keys(row)).not.toContain('pollIntervalMinutes')
    expect(Object.keys({ ...row })).not.toContain('pollIntervalMinutes')
    expect(JSON.stringify(row)).not.toContain('pollIntervalMinutes')
  })

  it('writes through the declared name to the real column', async () => {
    const created = await seed()
    const row = await (Profile as any).find(Number(created.id))

    row.pollIntervalMinutes = 90
    await row.save()

    const stored = db.query('SELECT poll_interval_minutes FROM cc_profiles WHERE id = ?').get(Number(created.id)) as any
    expect(stored.poll_interval_minutes).toBe(90)
    // and no stray camelCase column was invented
    expect(Object.keys(stored)).not.toContain('pollIntervalMinutes')
  })

  it('returns undefined for a name that is not an attribute', async () => {
    const created = await seed()
    const row = await (Profile as any).find(Number(created.id))
    expect(row.somethingElseEntirely).toBeUndefined()
  })
})
