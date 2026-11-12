/**
 * A field asked for as an uploaded file and one asked for as Markdown
 * (stacksjs/stacks#3275), through a real server against real SQLite and a
 * real disk: the form is told how to ask, a chosen file is stored and its
 * address answered, and the Markdown preview is rendered and sanitized.
 *
 * Its own process because the ORM reads its database once, at first import,
 * and storage its root. Spawned by dashboard-model-field-inputs.test.ts.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const database = process.env.DB_DATABASE_PATH
const storageRoot = process.env.STORAGE_ROOT
assert(database)
// Files land under this, never in the checkout's own public/.
assert(storageRoot && storageRoot.includes('stacks-field-inputs-'))

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { buildMigrationPlan, configureOrm, generateSql, loadModels } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady, User } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../../../storage/framework/core/auth/tests/helpers/auth-schema')
const { route } = await import('@stacksjs/router')

await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL, avatar TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP,
  two_factor_secret TEXT, two_factor_enabled INTEGER DEFAULT 0, two_factor_last_used_step INTEGER, stripe_id TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await db.unsafe(`CREATE TABLE gdpr_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, type TEXT NOT NULL, subject_id INTEGER, actor TEXT, status TEXT,
  summary TEXT, occurred_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await ensureFrameworkAuthTables()
// Where the Files page keeps what it knows about a stored file, as the models
// define them: an upload goes through the same pipeline.
const TABLES = ['storage_item_tasks', 'storage_items']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect: 'sqlite' })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-field-inputs-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
try {
  process.chdir(scratch)
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}
await db.insertInto('users').values([{ id: 1, name: 'Ava Stone', email: 'ava@example.com', password: 'h', created_at: sqlDateTime() }] as never).execute()

// The server injects models as globals; the dashboard resolves them there.
;(globalThis as Record<string, unknown>).User = User
;(User as any).dashboard.fields = {
  avatar: { input: 'upload', accept: 'image/*', help: 'Square works best.' },
  name: { input: 'markdown' },
}

const actions = 'Actions/Dashboard/Models'
route.get('/api/dashboard/models/{slug}', `${actions}/ModelShowAction`)
route.post('/api/dashboard/models/{slug}/uploads', `${actions}/ModelUploadAction`).skipCsrf()
route.post('/api/dashboard/markdown', `${actions}/ModelMarkdownAction`).skipCsrf()
route.patch('/api/dashboard/models/{slug}/{id}', `${actions}/ModelUpdateAction`).skipCsrf()
const server: any = await route.serve({ port: 0, hostname: '127.0.0.1' })
const origin = `http://127.0.0.1:${Number(server?.port ?? server?.server?.port)}`

async function answerOf(response: Response): Promise<{ status: number, body: any }> {
  const body = await response.json().catch(() => null)
  if (body && typeof body === 'object')
    delete body.request_id
  return { status: response.status, body }
}
const json = (method: string, path: string, body: unknown) => fetch(`${origin}/api/dashboard/${path}`, { method, headers: { 'accept': 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(answerOf)
function upload(field: string | null, file: File | null): Promise<{ status: number, body: any }> {
  const form = new FormData()
  if (field !== null)
    form.set('field', field)
  if (file)
    form.set('file', file)
  return fetch(`${origin}/api/dashboard/models/user/uploads`, { method: 'POST', headers: { accept: 'application/json' }, body: form }).then(answerOf)
}
/**
 * Every uploaded file under the disk's root, relative to it. Not the previews
 * the Files pipeline makes of them, which it keeps apart under `.variants`.
 */
function stored(directory = join(storageRoot!, 'public'), prefix = ''): string[] {
  if (!existsSync(directory))
    return []
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => prefix !== '' || entry.name !== '.variants')
    .flatMap(entry => entry.isDirectory() ? stored(join(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`])
    .sort()
}
// The smallest PNG there is: one transparent pixel.
const pixel = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), character => character.charCodeAt(0))
const photo = () => new File([pixel], 'My Holiday Photo.png', { type: 'image/png' })

// 1. The form is told how each is asked for, and the list how an upload is shown.
const shown = await (await fetch(`${origin}/api/dashboard/models/user`, { headers: { accept: 'application/json' } })).json() as { updateFields: Array<Record<string, any>>, columnMeta: Array<Record<string, any>> }
const field = (name: string) => shown.updateFields.find(entry => entry.name === name)!
assert.deepEqual([field('avatar').type, field('avatar').accept, field('avatar').help], ['upload', 'image/*', 'Square works best.'])
assert.equal(field('name').type, 'markdown')
assert.equal('accept' in field('name'), false)
assert.deepEqual(shown.columnMeta.find(column => column.name === 'avatar')!.format, { format: 'image' }, 'a field that only takes images is shown as a picture, without being told')
assert.equal(shown.columnMeta.find(column => column.name === 'name')!.format, undefined)
console.log('PASS the form is told how to ask for a file and for Markdown')

// 2. A chosen file is stored where the field keeps its files, under a name of its own.
assert.deepEqual(stored(), [])
const first = await upload('avatar', photo())
assert.equal(first.status, 201, JSON.stringify(first))
assert.match(first.body.path, /^uploads\/users\/avatar\/[\w-]+\.png$/)
assert(!first.body.path.includes('Holiday'), 'not the name it arrived with')
assert.equal(first.body.size, pixel.length)
assert(String(first.body.url).endsWith(first.body.path), `${first.body.url} leads to ${first.body.path}`)
assert.deepEqual(stored(), [first.body.path])
// It went through the pipeline the Files page uses, so it is known there.
assert(((await db.selectFrom('storage_item_tasks').selectAll().execute()) as unknown[]).length > 0)
assert.deepEqual(new Uint8Array(readFileSync(join(storageRoot, 'public', first.body.path))), pixel, 'the bytes that were sent')
// An image is one by its bytes, whatever it was sent as.
assert.equal((await upload('avatar', new File([pixel], 'scan', { type: 'application/octet-stream' }))).status, 201)
// The same file again: another name, not a refusal and not a replacement.
const second = await upload('avatar', photo())
assert.equal(second.status, 201)
assert.notEqual(second.body.path, first.body.path)
assert.equal(stored().length, 3)
console.log('PASS a chosen file is stored under a generated name and its address answered')

// 3. Nothing about the record changed: the address is saved with the form.
const before = (await db.selectFrom('users').selectAll().where('id', '=', 1).executeTakeFirst()) as Record<string, any>
assert.equal(before.avatar, null)
assert.equal((await json('PATCH', 'models/user/1', { fields: { avatar: first.body.url } })).status, 200)
assert.equal(((await db.selectFrom('users').selectAll().where('id', '=', 1).executeTakeFirst()) as Record<string, any>).avatar, first.body.url)
console.log('PASS the record changes when the form is saved, not when the file is chosen')

// 4. What the field does not take is refused, and nothing is stored for it.
const count = stored().length
const refusals: Array<[string, { status: number, body: any }, string]> = [
  ['a kind the field does not accept', await upload('avatar', new File(['name,email'], 'people.csv', { type: 'text/csv' })), 'Avatar takes an image.'],
  ['an image by name only', await upload('avatar', new File(['<script>'], 'photo.png', { type: 'text/html' })), 'Avatar takes an image.'],
  ['a field that is not asked for as a file', await upload('email', photo()), 'User does not take an uploaded file for \'email\'.'],
  ['a field the model does not have', await upload('resume', photo()), 'User does not take an uploaded file for \'resume\'.'],
  ['no field named', await upload(null, photo()), 'Say which field the file is for.'],
  ['no file', await upload('avatar', null), 'Choose a file.'],
  ['a file over the limit', await upload('avatar', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })), 'The file must be 10 MB or smaller.'],
]
for (const [what, answer, message] of refusals) {
  assert.equal(answer.status, 422, `${what}: ${JSON.stringify(answer)}`)
  assert.equal(answer.body.message, message, what)
}
assert.equal(stored().length, count, 'a refused file is not kept')
console.log('PASS a file the field does not take is refused and not kept')

// 5. Markdown reads as it will, and nothing it carries can run.
const preview = await json('POST', 'markdown', { text: '## Hello\n\nSome **bold** text.\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src="x" onerror="alert(1)">' })
assert.equal(preview.status, 200)
assert(preview.body.html.includes('<h2>Hello</h2>') && preview.body.html.includes('<strong>bold</strong>'), preview.body.html)
for (const unsafe of ['<script', 'javascript:', 'onerror'])
  assert(!preview.body.html.includes(unsafe), `${unsafe} is gone: ${preview.body.html}`)
assert.deepEqual(await json('POST', 'markdown', { text: '' }), { status: 200, body: { html: '' } })
assert.equal((await json('POST', 'markdown', { text: 'x'.repeat(100_001) })).status, 422)
assert.equal((await json('POST', 'markdown', { text: ['a'] })).status, 422)
console.log('PASS the Markdown preview is rendered and sanitized')

server?.stop?.()
console.log('field inputs OK')
process.exit(0)
