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

  describe('denormalize cross-table fields (stacksjs/stacks#1918)', () => {
    // Construct a fake model + a fake court-house relation. We do not
    // create a court_houses table because the audit fix is purely
    // path-walking — it reads from the already-loaded `_relations`,
    // never hits the DB itself.
    const Judge = defineModel({
      name: 'Judge',
      table: 'judges',
      primaryKey: 'id',
      autoIncrement: true,
      attributes: {
        name: { type: 'string', fillable: true },
        court_id: { type: 'integer', fillable: true },
      },
      belongsTo: ['CourtHouse'],
      traits: {
        useSearch: {
          searchable: ['name', 'court_name'],
          displayable: ['id', 'name', 'court_name'],
          filterable: [],
          sortable: [],
          denormalize: { court_name: 'court_house.name' },
        },
      },
    } as const)

    beforeAll(() => {
      db.run(`CREATE TABLE judges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        court_id INTEGER
      )`)
    })

    it('walks `denormalize` dot-paths against pre-loaded `_relations`', async () => {
      const judge = await (Judge as any).create({ name: 'Hon. Roberts', court_id: 1 })
      // Simulate `.with('court_house')` having already loaded the
      // relation by populating `_relations` directly. In production
      // the caller does this via the bqb query chain.
      ;(judge as any)._relations = {
        court_house: { _attributes: { name: 'Supreme Court of the United States' } },
      }

      const doc = (judge as any).toSearchableObject()
      expect(doc.name).toBe('Hon. Roberts')
      expect(doc.court_name).toBe('Supreme Court of the United States')
    })

    it('emits null (not undefined) when a denormalized relation is not loaded', async () => {
      const judge = await (Judge as any).create({ name: 'Hon. Kagan', court_id: 1 })
      // `_relations` empty — caller didn't eager-load.
      const doc = (judge as any).toSearchableObject()
      // Meilisearch settings that declare the field as searchable
      // expect every doc to carry it. Explicit null is the contract.
      expect(doc.court_name).toBeNull()
    })

    it('does NOT denormalize when the field exists as an own attribute', async () => {
      // Pre-loaded relation + own attribute → own wins (the row's own
      // column is authoritative). This is the happens-rarely case
      // where a column shadows a relation, but the precedence matters.
      const judge = await (Judge as any).create({ name: 'Hon. Sotomayor', court_id: 1 })
      ;(judge as any)._attributes.court_name = 'literal-on-row'
      ;(judge as any)._relations = {
        court_house: { _attributes: { name: 'should-be-shadowed' } },
      }
      const doc = (judge as any).toSearchableObject()
      expect(doc.court_name).toBe('literal-on-row')
    })
  })
})
