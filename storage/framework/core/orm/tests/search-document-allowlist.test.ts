import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel, projectDocumentsFromTrait } from '../src/define-model'

/**
 * What a `useSearch` model writes to the search engine (stacksjs/stacks#2955).
 *
 * The document is `id` plus the union of the declared field lists, so a column
 * added to a model is not published until somebody names it. With nothing
 * declared, it is the row minus its `hidden` attributes: the boolean form used
 * to write the whole row, password hash included.
 */
describe('the search document is an allow list', () => {
  let releaseDbConfigLock: () => void

  beforeAll(async () => {
    releaseDbConfigLock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run(`CREATE TABLE allowlist_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      is_admin INTEGER,
      password TEXT,
      api_token TEXT,
      created_at TEXT
    )`)
  })

  afterAll(() => {
    // Hand the configureOrm override back before the lock (stacksjs/stacks#2415).
    releaseOrm()
    releaseDbConfigLock()
  })

  const attributes = {
    name: { type: 'string', fillable: true },
    email: { type: 'string', fillable: true },
    is_admin: { type: 'number', fillable: true },
    password: { type: 'string', fillable: true, hidden: true },
    apiToken: { type: 'string', fillable: true, hidden: true },
    created_at: { type: 'string', fillable: true },
  } as const

  const Declared = defineModel({
    name: 'AllowlistUser',
    table: 'allowlist_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes,
    traits: {
      useSearch: {
        displayable: ['id', 'name'],
        searchable: ['name', 'email'],
        filterable: [],
        sortable: ['created_at'],
      },
    },
  } as const) as any

  const Undeclared = defineModel({
    name: 'AllowlistUser',
    table: 'allowlist_users',
    primaryKey: 'id',
    autoIncrement: true,
    attributes,
    traits: { useSearch: true },
  } as const) as any

  const row = { name: 'Ada', email: 'ada@example.com', is_admin: 1, password: '$2b$10$hash', api_token: 'tok', created_at: '2026-10-22' }

  it('indexes id and every declared field, and no column the model did not name', async () => {
    const doc = (await Declared.create(row)).toSearchableObject()

    expect(Object.keys(doc).sort()).toEqual(['created_at', 'email', 'id', 'name'])
  })

  it('includes a searchable or sortable field that displayable leaves out', async () => {
    // Indexing displayable alone meant `email` could not be searched and
    // `created_at` could not be sorted, though the model declared both.
    const doc = (await Declared.create(row)).toSearchableObject()

    expect(doc.email).toBe('ada@example.com')
    expect(doc.created_at).toBe('2026-10-22')
  })

  it('with nothing declared, indexes the row without its hidden attributes, in either spelling', async () => {
    const doc = (await Undeclared.create(row)).toSearchableObject()

    expect('password' in doc).toBe(false)
    expect('api_token' in doc).toBe(false)
    expect(doc.is_admin).toBe(1)
    expect(doc.name).toBe('Ada')
  })

  it('projects a plain row on the bulk path exactly as it projects an instance', async () => {
    const instance = (await Declared.create(row)).toSearchableObject()
    const [plain] = await projectDocumentsFromTrait(
      [{ id: Number(instance.id), ...row }],
      { displayable: ['id', 'name'], searchable: ['name', 'email'], filterable: [], sortable: ['created_at'], hidden: new Set(['password', 'apiToken', 'api_token']) },
    )

    expect(plain).toEqual(instance)
  })

  it('never writes a hidden column on the bulk path when nothing is declared', async () => {
    const [plain] = await projectDocumentsFromTrait([{ id: 9, ...row }], { hidden: new Set(['password', 'apiToken', 'api_token']) })

    expect('password' in plain!).toBe(false)
    expect('api_token' in plain!).toBe(false)
  })
})
