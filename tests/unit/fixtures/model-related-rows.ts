/**
 * A record's related rows, managed from its own page (stacksjs/stacks#3270),
 * through a real server against real SQLite: a team's members are added,
 * edited and deleted with what the panel carries, each as one write through
 * the member model's own endpoint.
 *
 * Its own process because the ORM reads its database once, at first import.
 * Spawned by dashboard-model-related-rows.test.ts.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const database = process.env.DB_DATABASE_PATH
assert(database)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { buildMigrationPlan, configureOrm, generateSql, loadModels } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady, Team, TeamInvitation, TeamMember, User } = await import('@stacksjs/orm')
await ormReady
const { route } = await import('@stacksjs/router')
const { modelFormPayload, modelFormValues, modelRelatedAddsHere, modelRelatedRowActions } = await import('../../../storage/framework/defaults/functions/dashboard-model-record')

// The team tables as the models define them.
const TABLES = ['team_invitations', 'team_members', 'teams']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect: 'sqlite' })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-related-rows-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
let statements: string[]
try {
  process.chdir(scratch)
  statements = generateSql(plan)
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}
for (const statement of statements)
  await db.unsafe(statement).execute()
await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL, avatar TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP,
  two_factor_secret TEXT, two_factor_enabled INTEGER DEFAULT 0, two_factor_last_used_step INTEGER, stripe_id TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()

const now = sqlDateTime()
await db.insertInto('users').values([
  { id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'h', created_at: now },
  { id: 2, name: 'Donald Kelly', email: 'donald@example.com', password: 'h', created_at: now },
] as never).execute()
await db.insertInto('teams').values([
  { id: 1, name: 'PrimeSoft', status: 'active', created_at: now },
  { id: 2, name: 'Other', status: 'active', created_at: now },
] as never).execute()
await db.insertInto('team_members').values([
  { id: 1, team_id: 1, user_id: 1, role: 'owner', status: 'active', created_at: now },
  { id: 2, team_id: 2, user_id: 1, role: 'member', status: 'active', created_at: now },
] as never).execute()

// The server injects models as globals; the dashboard resolves them there.
Object.assign(globalThis, { Team, TeamInvitation, TeamMember, User })

// The routes the page uses, as the dashboard registers them. CSRF has its own tests.
const actions = 'Actions/Dashboard/Models'
route.get('/api/dashboard/models/{slug}/{id}/related', `${actions}/ModelRelatedAction`)
route.post('/api/dashboard/models/{slug}', `${actions}/ModelStoreAction`).skipCsrf()
route.patch('/api/dashboard/models/{slug}/{id}', `${actions}/ModelUpdateAction`).skipCsrf()
route.delete('/api/dashboard/models/{slug}/{id}', `${actions}/ModelDestroyAction`).skipCsrf()
const server: any = await route.serve({ port: 0, hostname: '127.0.0.1' })
const origin = `http://127.0.0.1:${Number(server?.port ?? server?.server?.port)}`

async function call(method: string, path: string, body?: unknown): Promise<{ status: number, body: any }> {
  const answer = await fetch(`${origin}/api/dashboard/models/${path}`, {
    method,
    headers: { 'accept': 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const answered = await answer.json().catch(() => null)
  if (answered && typeof answered === 'object')
    delete answered.request_id
  return { status: answer.status, body: answered }
}
const panels = async () => (await call('GET', 'team/1/related')).body.panels as Array<Record<string, any>>
const members = async (team: number) => (await db.selectFrom('team_members').selectAll().where('team_id', '=', team).orderBy('id', 'asc').execute()) as Array<Record<string, any>>

// 1. The panel carries what managing its rows needs, and nothing that would move one.
const [memberPanel, invitationPanel] = await panels()
assert.equal(memberPanel!.model, 'TeamMember')
assert.deepEqual([memberPanel!.canCreate, memberPanel!.canUpdate, memberPanel!.canDestroy], [true, true, true])
assert.deepEqual(memberPanel!.fields.map((field: any) => [field.name, field.type, field.label]), [['userId', 'relation', 'User'], ['role', 'enum', 'Role'], ['status', 'enum', 'Status']], 'the member\'s own fields, without the team: that is this page')
assert.deepEqual(memberPanel!.values, { 1: { user_id: 1, role: 'owner', status: 'active' } })
assert.deepEqual(memberPanel!.rows.map((row: any) => row.id), [1], 'another team\'s member is not listed')
assert.deepEqual(modelRelatedRowActions(memberPanel as any).map(action => action.action), ['view', 'edit', 'delete'])
assert.equal(modelRelatedAddsHere(memberPanel as any), true)
// Invitations cannot be written or edited from the dashboard, only removed.
assert.equal(invitationPanel!.model, 'TeamInvitation')
assert.deepEqual([invitationPanel!.canCreate, invitationPanel!.canUpdate, invitationPanel!.canDestroy], [false, false, true])
assert.deepEqual(invitationPanel!.fields, [])
assert.deepEqual(invitationPanel!.values, {})
assert.deepEqual(modelRelatedRowActions(invitationPanel as any).map(action => action.action), ['view', 'delete'])
assert.equal(modelRelatedAddsHere(invitationPanel as any), false)
console.log('PASS the panel says what can be done to its rows and carries the form for it')

// 2. Add: the form's own values, with this record chosen by the page.
const fields = memberPanel!.fields
const blank = modelFormValues(fields)
assert.deepEqual(blank, { userId: '', role: 'member', status: 'active' }, 'a new row starts from the model\'s defaults')
const added = await call('POST', memberPanel!.slug, { fields: { ...modelFormPayload(fields, { ...blank, userId: '2', role: 'admin' }), [memberPanel!.field]: 1 } })
assert.equal(added.status, 200, JSON.stringify(added))
assert.deepEqual((await members(1)).map(row => [row.user_id, row.role, row.status]), [[1, 'owner', 'active'], [2, 'admin', 'active']])
const listed = (await panels())[0]!
assert.equal(listed.total, 2)
assert.deepEqual(listed.rows.map((row: any) => [row.id, row.user_id, row.role]), [[added.body.id, 'Donald Kelly', 'admin'], [1, 'Ava Stone', 'owner']])
console.log('PASS a row added from the panel belongs to this record')

// 3. Edit: only what changed is sent, and the row stays where it is.
const start = modelFormValues(fields, listed.values[String(added.body.id)])
assert.deepEqual(start, { userId: '2', role: 'admin', status: 'active' })
const changes = modelFormPayload(fields, { ...start, status: 'suspended' }, start)
assert.deepEqual(changes, { status: 'suspended' })
assert.deepEqual(await call('PATCH', `${memberPanel!.slug}/${added.body.id}`, { fields: changes }), { status: 200, body: { ok: true, id: added.body.id, changed: ['status'] } })
assert.deepEqual((await members(1)).map(row => [row.team_id, row.user_id, row.role, row.status]), [[1, 1, 'owner', 'active'], [1, 2, 'admin', 'suspended']])
// A value the model refuses is said on its field, and nothing is written.
const refused = await call('PATCH', `${memberPanel!.slug}/${added.body.id}`, { fields: { role: 'emperor' } })
assert.equal(refused.status, 422)
assert.deepEqual(Object.keys(refused.body.errors), ['role'])
assert.equal((await members(1))[1]!.role, 'admin')
console.log('PASS an edit sends what changed, and a refusal names its field')

// 4. Delete: that row, and only that row.
assert.deepEqual(await call('DELETE', `${memberPanel!.slug}/${added.body.id}`), { status: 200, body: { ok: true, id: added.body.id, anonymized: false } })
assert.deepEqual((await members(1)).map(row => row.id), [1])
assert.deepEqual((await members(2)).map(row => row.id), [2], 'the other team is as it was')
assert.equal((await panels())[0]!.total, 1)
console.log('PASS a row deleted from the panel is gone, and no other')

server?.stop?.()
console.log('related rows OK')
process.exit(0)
