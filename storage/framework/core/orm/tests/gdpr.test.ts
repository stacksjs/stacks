import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * GDPR access, erasure, retention and the processing register
 * (stacksjs/stacks#365), against a real SQLite database.
 *
 * Two subjects share every table, so each assertion that one subject's rows
 * changed is paired with one that the other's did not - "erasure touched the
 * right rows" and "erasure touched only the right rows" are different claims.
 */

const DB_PATH = join(tmpdir(), `stacks-gdpr-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'test'

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const {
  buildProcessingRegister,
  eraseSubject,
  exportSubjectData,
  GdprDeclarationError,
  GdprSubjectNotFoundError,
  pruneRetainedData,
  renderProcessingRegister,
  resolveGdprPlan,
} = await import('../src/gdpr')
const { loadModelRegistry } = await import('../src/model-registry')

async function forceConfig(): Promise<void> {
  const release = await acquireDbConfigLock()
  try {
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'test' },
      database: { default: 'sqlite', connections: { sqlite: { database: DB_PATH, prefix: '' } } },
    })
  }
  finally {
    release()
  }
}

const string = { name: 'string' }
const enumRule = { name: 'enum' }

/** The fixture schema, declared the way an app would declare it. */
const models = {
  User: {
    name: 'User',
    table: 'users',
    traits: { gdpr: { basis: 'contract', purpose: 'Account' } },
    attributes: {
      name: { personal: true, validation: { rule: string } },
      email: { personal: true, unique: true, validation: { rule: string } },
      password: { personal: { export: false }, validation: { rule: string } },
      role: { validation: { rule: string } },
    },
  },
  Customer: {
    name: 'Customer',
    table: 'customers',
    belongsTo: ['User'],
    traits: { gdpr: { basis: 'contract', purpose: 'Orders' } },
    attributes: {
      name: { personal: true, required: true, validation: { rule: string } },
      email: { personal: true, validation: { rule: string } },
      tier: { validation: { rule: string } },
    },
  },
  Order: {
    name: 'Order',
    table: 'orders',
    belongsTo: ['Customer'],
    traits: { gdpr: { subject: { via: 'Customer' }, basis: 'legal_obligation', purpose: 'Tax records' } },
    attributes: {
      deliveryAddress: { personal: true, validation: { rule: string } },
      total: { validation: { rule: { name: 'number' } } },
    },
  },
  OrderNote: {
    name: 'OrderNote',
    table: 'order_notes',
    belongsTo: ['Order'],
    traits: { gdpr: { subject: { via: 'Order' }, erasure: 'delete' } },
    attributes: { body: { personal: true, validation: { rule: string } } },
  },
  SocialAccount: {
    name: 'SocialAccount',
    table: 'social_accounts',
    belongsTo: ['User'],
    traits: { gdpr: { erasure: 'delete' } },
    attributes: { providerEmail: { personal: true, validation: { rule: string } } },
  },
  ConsentEvent: {
    name: 'ConsentEvent',
    table: 'consent_events',
    traits: { gdpr: { subject: { email: 'recipient' }, erasure: 'keep', basis: 'legal_obligation' } },
    attributes: { recipient: { personal: true, required: true, validation: { rule: string } } },
  },
  Visit: {
    name: 'Visit',
    table: 'visits',
    traits: { gdpr: { retention: { days: 30 } } },
    attributes: { ipAddress: { personal: true, validation: { rule: string } } },
  },
  Lead: {
    name: 'Lead',
    table: 'leads',
    traits: { gdpr: { retention: { days: 90, action: 'anonymize', column: 'captured_at' } } },
    attributes: {
      email: { personal: true, required: true, unique: true, validation: { rule: string } },
      source: { validation: { rule: string } },
    },
  },
  // Belongs to a user and says nothing about it: the register must flag it.
  Bookmark: {
    name: 'Bookmark',
    table: 'bookmarks',
    belongsTo: ['User'],
    attributes: { url: { validation: { rule: string } } },
  },
} as const

const SCHEMA = [
  `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), name TEXT NOT NULL, email TEXT, tier TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER REFERENCES customers(id), delivery_address TEXT, total INTEGER, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE order_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER REFERENCES orders(id), body TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE social_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), provider_email TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE consent_events (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL, purpose TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE visits (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT, path TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, source TEXT, captured_at TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, url TEXT, created_at TEXT, updated_at TEXT)`,
  `CREATE TABLE gdpr_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, type TEXT NOT NULL, subject_id INTEGER, actor TEXT, status TEXT NOT NULL, summary TEXT, occurred_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`,
]

const TABLES = ['order_notes', 'orders', 'customers', 'social_accounts', 'consent_events', 'visits', 'leads', 'bookmarks', 'gdpr_requests', 'users']

async function rows(table: string): Promise<Array<Record<string, any>>> {
  return await (db as any).selectFrom(table).selectAll().orderBy('id', 'asc').execute()
}

async function seed(): Promise<void> {
  const q = db as any
  for (const table of TABLES)
    await q.deleteFrom(table).execute()
  await db.unsafe(`DELETE FROM sqlite_sequence`).execute()

  const stamp = '2026-01-01 00:00:00'
  await q.insertInto('users').values({ uuid: 'u-ada', name: 'Ada Lovelace', email: 'ada@example.com', password: 'hash-ada', role: 'admin', created_at: stamp }).execute()
  await q.insertInto('users').values({ uuid: 'u-bob', name: 'Bob Byron', email: 'bob@example.com', password: 'hash-bob', role: 'member', created_at: stamp }).execute()

  await q.insertInto('customers').values({ user_id: 1, name: 'Ada L.', email: 'ada@shop.test', tier: 'gold', created_at: stamp }).execute()
  await q.insertInto('customers').values({ user_id: 2, name: 'Bob B.', email: 'bob@shop.test', tier: 'silver', created_at: stamp }).execute()

  await q.insertInto('orders').values({ customer_id: 1, delivery_address: '1 Analytical Way', total: 1200, created_at: stamp }).execute()
  await q.insertInto('orders').values({ customer_id: 1, delivery_address: '2 Engine Rd', total: 800, created_at: stamp }).execute()
  await q.insertInto('orders').values({ customer_id: 2, delivery_address: '3 Poet Lane', total: 500, created_at: stamp }).execute()

  await q.insertInto('order_notes').values({ order_id: 1, body: 'Leave by the door', created_at: stamp }).execute()
  await q.insertInto('order_notes').values({ order_id: 3, body: 'Ring twice', created_at: stamp }).execute()

  await q.insertInto('social_accounts').values({ user_id: 1, provider_email: 'ada@github.test', created_at: stamp }).execute()
  await q.insertInto('social_accounts').values({ user_id: 2, provider_email: 'bob@github.test', created_at: stamp }).execute()

  await q.insertInto('consent_events').values({ recipient: 'ada@example.com', purpose: 'marketing', created_at: stamp }).execute()
  await q.insertInto('consent_events').values({ recipient: 'bob@example.com', purpose: 'marketing', created_at: stamp }).execute()

  await q.insertInto('bookmarks').values({ user_id: 1, url: 'https://example.com', created_at: stamp }).execute()
}

beforeAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
  await forceConfig()
  for (const statement of SCHEMA)
    await db.unsafe(statement).execute()
})

beforeEach(async () => {
  await forceConfig()
  await seed()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // best effort
    }
  }
})

describe('declarations', () => {
  test('derive the subject link from belongsTo User, and from the User model itself', () => {
    const plan = resolveGdprPlan(models)
    const byName = Object.fromEntries(plan.models.map(model => [model.model, model]))

    expect(plan.problems).toEqual([])
    expect(byName.User!.subject).toEqual({ kind: 'column', columns: ['id'], where: {} })
    expect(byName.Customer!.subject).toEqual({ kind: 'column', columns: ['user_id'], where: {} })
    expect(byName.Order!.subject).toEqual({ kind: 'via', model: 'Customer', foreignKey: 'customer_id' })
    expect(byName.OrderNote!.depth).toBe(2)
    expect(byName.Visit!.subject).toBeNull()
    expect(plan.unclassified).toEqual(['Bookmark'])
  })

  test('a declaration that cannot be honoured is reported, by model, rather than guessed at', () => {
    const plan = resolveGdprPlan({
      Ticket: {
        name: 'Ticket',
        belongsTo: ['User'],
        attributes: { status: { personal: true, required: true, validation: { rule: enumRule } } },
      },
      Stray: {
        name: 'Stray',
        traits: { gdpr: { subject: { via: 'Customer' } } },
        attributes: { note: { personal: true, validation: { rule: string } } },
      },
      Membership: { name: 'Membership', belongsTo: ['User'], traits: { gdpr: {} }, attributes: {} },
      Log: { name: 'Log', traits: { gdpr: { retention: { days: 0 } } }, attributes: {} },
    })

    expect(plan.problems.map(p => p.model).sort()).toEqual(['Log', 'Membership', 'Stray', 'Ticket'])
    expect(plan.problems.find(p => p.model === 'Ticket')!.message).toContain('NOT NULL enum')
  })

  test('every built-in model declaration resolves, and nothing that belongs to a user is unclassified', async () => {
    const defaults = await loadModelRegistry({
      defaultsRoot: join(import.meta.dir, '../../../defaults/app/Models'),
      userRoot: join(tmpdir(), 'stacks-gdpr-no-user-models'),
    })
    const plan = resolveGdprPlan(defaults)

    expect(plan.problems).toEqual([])
    expect(plan.unclassified).toEqual([])
    expect(plan.models.map(model => model.model)).toContain('User')
  })
})

describe('access', () => {
  test('exports declared fields plus ids and timestamps, never an undeclared or unexportable column', async () => {
    const result = await exportSubjectData(1, { models, actor: 'test' })

    expect(result.subject).toEqual({ id: 1 })
    expect(result.data.User).toEqual([
      { id: 1, uuid: 'u-ada', created_at: '2026-01-01 00:00:00', updated_at: null, name: 'Ada Lovelace', email: 'ada@example.com' },
    ])
    // `role` is not personal and `password` is personal but not exported.
    expect(Object.keys(result.data.User![0]!)).not.toContain('role')
    expect(Object.keys(result.data.User![0]!)).not.toContain('password')
    expect(Object.keys(result.data.Customer![0]!)).not.toContain('tier')
    expect(result.processing.Order).toEqual({ purpose: 'Tax records', basis: 'legal_obligation', retentionDays: null })
  })

  test('contains only the subject\'s rows, followed through via chains and email-keyed ledgers', async () => {
    const result = await exportSubjectData('ada@example.com', { models })

    expect(result.data.Customer!.map(row => row.email)).toEqual(['ada@shop.test'])
    expect(result.data.Order!.map(row => row.delivery_address)).toEqual(['1 Analytical Way', '2 Engine Rd'])
    expect(result.data.OrderNote!.map(row => row.body)).toEqual(['Leave by the door'])
    expect(result.data.ConsentEvent!.map(row => row.recipient)).toEqual(['ada@example.com'])
    expect(JSON.stringify(result)).not.toContain('bob')
    // No subject link, so not exported: retention-only and unclassified models.
    expect(result.data.Visit).toBeUndefined()
    expect(result.data.Bookmark).toBeUndefined()
  })

  test('records an access audit row', async () => {
    await exportSubjectData(2, { models, actor: 'api:user:2' })
    const audit = await rows('gdpr_requests')

    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ type: 'access', subject_id: 2, actor: 'api:user:2', status: 'completed' })
    expect(JSON.parse(audit[0]!.summary).models.User).toBe(1)
  })

  test('an unknown subject is an error, not an empty export', async () => {
    await expect(exportSubjectData('nobody@example.com', { models })).rejects.toBeInstanceOf(GdprSubjectNotFoundError)
  })

  test('refuses to run over a declaration it cannot honour', async () => {
    const broken = { ...models, Ticket: { name: 'Ticket', belongsTo: ['User'], attributes: { status: { personal: true, required: true, validation: { rule: enumRule } } } } }
    await expect(exportSubjectData(1, { models: broken })).rejects.toBeInstanceOf(GdprDeclarationError)
  })
})

describe('erasure', () => {
  test('a dry run reports exactly what would change and changes nothing', async () => {
    const before = await Promise.all(TABLES.map(rows))
    const result = await eraseSubject(1, { models, dryRun: true, revokeCredentials: false })
    const after = await Promise.all(TABLES.map(rows))

    expect(after).toEqual(before)
    expect(result.dryRun).toBe(true)
    expect(result.changes.map(({ model, action, matched, changed }) => ({ model, action, matched, changed }))).toEqual([
      { model: 'ConsentEvent', action: 'keep', matched: 1, changed: 0 },
      { model: 'Customer', action: 'anonymize', matched: 1, changed: 1 },
      { model: 'Order', action: 'anonymize', matched: 2, changed: 2 },
      { model: 'OrderNote', action: 'delete', matched: 1, changed: 1 },
      { model: 'SocialAccount', action: 'delete', matched: 1, changed: 1 },
      { model: 'User', action: 'anonymize', matched: 1, changed: 1 },
    ])
  })

  test('anonymizes or deletes per declaration, and leaves every other subject untouched', async () => {
    const bobBefore = {
      user: (await rows('users'))[1],
      customer: (await rows('customers'))[1],
      orders: (await rows('orders')).filter(row => row.customer_id === 2),
      notes: (await rows('order_notes')).filter(row => row.order_id === 3),
      social: (await rows('social_accounts')).filter(row => row.user_id === 2),
    }

    const result = await eraseSubject('ada@example.com', { models, actor: 'cli', revokeCredentials: false })
    expect(result.dryRun).toBe(false)

    const [ada, bob] = await rows('users')
    // Nullable columns become NULL; `role` is not personal and survives.
    expect(ada).toMatchObject({ id: 1, name: null, email: null, password: null, role: 'admin', uuid: 'u-ada' })
    expect(bob).toEqual(bobBefore.user)

    const customers = await rows('customers')
    // NOT NULL and not unique: a placeholder, not NULL.
    expect(customers[0]).toMatchObject({ user_id: 1, name: '[erased]', email: null, tier: 'gold' })
    expect(customers[1]).toEqual(bobBefore.customer)

    const orders = await rows('orders')
    expect(orders.filter(row => row.customer_id === 1).map(row => [row.delivery_address, row.total])).toEqual([[null, 1200], [null, 800]])
    expect(orders.filter(row => row.customer_id === 2)).toEqual(bobBefore.orders)

    expect(await rows('order_notes')).toEqual(bobBefore.notes)
    expect(await rows('social_accounts')).toEqual(bobBefore.social)
    // Kept, by declaration.
    expect((await rows('consent_events')).map(row => row.recipient)).toEqual(['ada@example.com', 'bob@example.com'])
    // Unclassified: erasure does not reach it, which is why the register flags it.
    expect(await rows('bookmarks')).toHaveLength(1)
  })

  test('records the erasure in the audit ledger, without the erased data', async () => {
    await eraseSubject(1, { models, actor: 'cli', revokeCredentials: false })
    const audit = await rows('gdpr_requests')

    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ type: 'erasure', subject_id: 1, actor: 'cli', status: 'completed' })
    expect(audit[0]!.summary).not.toContain('ada')
    expect(JSON.parse(audit[0]!.summary).changes).toContainEqual({ model: 'Order', action: 'anonymize', matched: 2, changed: 2 })
  })

  test('is idempotent: a second run finds nothing left to change', async () => {
    await eraseSubject(1, { models, revokeCredentials: false })
    const afterFirst = await Promise.all(TABLES.filter(t => t !== 'gdpr_requests').map(rows))

    const second = await eraseSubject(1, { models, revokeCredentials: false })
    const afterSecond = await Promise.all(TABLES.filter(t => t !== 'gdpr_requests').map(rows))

    expect(afterSecond).toEqual(afterFirst)
    expect(second.changes.every(change => change.changed === 0)).toBe(true)
  })

  test('a unique NOT NULL column gets a placeholder unique to the row', async () => {
    const leads = {
      ...models,
      Lead: { ...models.Lead, belongsTo: ['User'], traits: { gdpr: { erasure: 'anonymize' } } },
    }
    await db.unsafe(`ALTER TABLE leads ADD COLUMN user_id INTEGER`).execute().catch(() => {})
    await (db as any).insertInto('leads').values({ email: 'ada@lead.test', user_id: 1, source: 'ads' }).execute()
    await (db as any).insertInto('leads').values({ email: 'ada2@lead.test', user_id: 1, source: 'ads' }).execute()

    await eraseSubject(1, { models: leads, revokeCredentials: false })

    expect((await rows('leads')).map(row => row.email)).toEqual(['erased-1', 'erased-2'])
    await (db as any).deleteFrom('leads').execute()
  })

  test('rolls back every change, audit row included, when one write fails', async () => {
    // Declares a personal column the table does not have: the anonymize
    // UPDATE fails after earlier models were already written in the transaction.
    const broken = {
      ...models,
      User: { ...models.User, attributes: { ...models.User.attributes, nickname: { personal: true, validation: { rule: string } } } },
    }
    const before = await Promise.all(TABLES.map(rows))

    await expect(eraseSubject(1, { models: broken, revokeCredentials: false })).rejects.toThrow()

    expect(await Promise.all(TABLES.map(rows))).toEqual(before)
  })
})

describe('retention', () => {
  const now = new Date('2026-06-01T12:00:00.000Z')

  beforeEach(async () => {
    const q = db as any
    // Both timestamp spellings the tables hold: the database clock's and the framework's.
    await q.insertInto('visits').values({ ip_address: '10.0.0.1', path: '/old', created_at: '2026-04-01 08:00:00' }).execute()
    await q.insertInto('visits').values({ ip_address: '10.0.0.2', path: '/edge', created_at: '2026-05-02T11:00:00.000' }).execute()
    await q.insertInto('visits').values({ ip_address: '10.0.0.3', path: '/edge-inside', created_at: '2026-05-02 13:00:00' }).execute()
    await q.insertInto('visits').values({ ip_address: '10.0.0.4', path: '/new', created_at: '2026-05-31T09:00:00.000' }).execute()
    await q.insertInto('visits').values({ ip_address: '10.0.0.5', path: '/undated', created_at: null }).execute()

    await q.insertInto('leads').values({ email: 'old@lead.test', source: 'fair', captured_at: '2026-01-15 00:00:00' }).execute()
    await q.insertInto('leads').values({ email: 'new@lead.test', source: 'fair', captured_at: '2026-05-15 00:00:00' }).execute()
  })

  test('prunes only rows past the policy, measured to the hour across timestamp spellings', async () => {
    const result = await pruneRetainedData({ models, now })

    // The cutoff is 2026-05-02T12:00Z: 11:00 that day is expired, 13:00 is not.
    expect((await rows('visits')).map(row => row.path)).toEqual(['/edge-inside', '/new', '/undated'])
    expect(result.changes.find(change => change.model === 'Visit')).toMatchObject({ action: 'delete', matched: 2, changed: 2 })
  })

  test('anonymizes in place when the policy says so, and only the expired rows', async () => {
    await pruneRetainedData({ models, now })
    const leads = await rows('leads')

    expect(leads.map(row => [row.email, row.source])).toEqual([[`erased-${leads[0]!.id}`, 'fair'], ['new@lead.test', 'fair']])
  })

  test('a dry run changes nothing and records nothing; a real run records once', async () => {
    const before = await rows('visits')
    const dry = await pruneRetainedData({ models, now, dryRun: true })

    expect(await rows('visits')).toEqual(before)
    expect(dry.changes.find(change => change.model === 'Visit')!.changed).toBe(2)
    expect(await rows('gdpr_requests')).toHaveLength(0)

    await pruneRetainedData({ models, now })
    const again = await pruneRetainedData({ models, now })
    const audit = await rows('gdpr_requests')

    expect(again.changes.every(change => change.changed === 0)).toBe(true)
    expect(audit.map(row => row.type)).toEqual(['retention'])
  })

  test('reports a declared table this database does not have, instead of failing the whole run', async () => {
    const extra = { ...models, Ghost: { name: 'Ghost', table: 'ghosts', traits: { gdpr: { retention: { days: 1 } } }, attributes: {} } }
    const result = await pruneRetainedData({ models: extra, now })

    expect(result.skipped).toEqual(['ghosts'])
    expect(result.changes.find(change => change.model === 'Visit')!.changed).toBe(2)
  })
})

describe('processing register', () => {
  test('is derived from the declarations and byte-stable', () => {
    const plan = resolveGdprPlan(models)
    const first = renderProcessingRegister(buildProcessingRegister(plan))
    const second = renderProcessingRegister(buildProcessingRegister(resolveGdprPlan({ ...models })))

    expect(second).toBe(first)
    expect(first).toContain('| Order | `orders` | via Customer (`customer_id`) | `delivery_address` | anonymize | - | legal_obligation | Tax records |')
    expect(first).toContain('| User | `users` | `id` | `name`, `email`, `password` (not exported) | anonymize | - | contract | Account |')
    expect(first).toContain('| Lead | `leads` | none (not reachable by access or erasure) | `email` | - | anonymize after 90 days (`captured_at`) | - | - |')
    expect(first).toContain('- Bookmark')
    expect(first).not.toMatch(/[\u2013\u2014]/)
  })

  test('renders the same register as JSON', () => {
    const register = buildProcessingRegister(resolveGdprPlan(models))
    const parsed = JSON.parse(renderProcessingRegister(register, 'json'))

    expect(parsed.unclassified).toEqual(['Bookmark'])
    expect(parsed.entries.map((entry: { model: string }) => entry.model)).toEqual(
      ['ConsentEvent', 'Customer', 'Lead', 'Order', 'OrderNote', 'SocialAccount', 'User', 'Visit'],
    )
  })
})
