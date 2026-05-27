import { beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { configureOrm, getDatabase } from 'bun-query-builder'
import { defineModel } from '../src/define-model'

// stacksjs/stacks#1917 — `toSearchableObject` used to early-return
// `null` for the boolean `useSearch: true` form (because `typeof true
// === 'boolean'`, not `'object'`), silently no-oping every indexing
// path. This suite pins the boolean branch + the existing object
// branch so that regression cannot reappear.

describe('Mailable.toSearchableObject (stacksjs/stacks#1917)', () => {
  let db: Database

  beforeAll(() => {
    configureOrm({ database: ':memory:' })
    db = getDatabase()
    db.run(`CREATE TABLE simple_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      name TEXT
    )`)
    db.run(`CREATE TABLE rich_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      name TEXT,
      bio TEXT,
      created_at TEXT
    )`)
    db.run(`CREATE TABLE unsearchable_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT
    )`)
  })

  const SimpleUser = defineModel({
    name: 'SimpleUser',
    table: 'simple_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      email: { type: 'string', fillable: true },
      name: { type: 'string', fillable: true },
    },
    traits: {
      // The boolean form — the on-ramp form that the audit issue
      // describes as silently no-oping.
      useSearch: true,
    },
  } as const)

  const RichUser = defineModel({
    name: 'RichUser',
    table: 'rich_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      email: { type: 'string', fillable: true },
      name: { type: 'string', fillable: true },
      bio: { type: 'string', fillable: true },
      created_at: { type: 'string', fillable: true },
    },
    traits: {
      useSearch: {
        searchable: ['name', 'email'],
        displayable: ['id', 'name', 'email'],
        filterable: [],
        sortable: ['created_at'],
      },
    },
  } as const)

  const UnsearchableUser = defineModel({
    name: 'UnsearchableUser',
    table: 'unsearchable_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes: {
      email: { type: 'string', fillable: true },
    },
    // No `useSearch` trait — toSearchableObject should return null.
  } as const)

  it('boolean `useSearch: true` indexes every attribute on the row', async () => {
    const inst = await (SimpleUser as any).create({ email: 'ada@example.com', name: 'Ada' })
    const doc = (inst as any).toSearchableObject()

    expect(doc).not.toBeNull()
    expect(doc.email).toBe('ada@example.com')
    expect(doc.name).toBe('Ada')
    // `id` is stringified — Meilisearch's document IDs must be strings.
    expect(typeof doc.id).toBe('string')
    expect(doc.id).toMatch(/^\d+$/)
  })

  it('object `useSearch` form respects `displayable` whitelist', async () => {
    const inst = await (RichUser as any).create({
      email: 'grace@example.com',
      name: 'Grace',
      bio: 'private — should NOT appear in displayable',
      created_at: '2026-05-27T00:00:00Z',
    })
    const doc = (inst as any).toSearchableObject()

    expect(doc).not.toBeNull()
    expect(doc.email).toBe('grace@example.com')
    expect(doc.name).toBe('Grace')
    // `bio` not in displayable → must NOT be in the indexed doc.
    expect('bio' in doc).toBe(false)
    expect(typeof doc.id).toBe('string')
  })

  it('returns null when the model has no useSearch trait', async () => {
    const inst = await (UnsearchableUser as any).create({ email: 'noindex@example.com' })
    const doc = (inst as any).toSearchableObject()
    expect(doc).toBeNull()
  })
})
