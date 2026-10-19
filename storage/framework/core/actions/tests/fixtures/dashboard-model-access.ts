import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Database } from 'bun:sqlite'

const project = process.env.STACKS_DASHBOARD_ACCESS_PROJECT!
assert.equal(process.cwd(), project)
assert(basename(project).startsWith('stacks-dashboard-model-access-'))
const file = join(project, 'fixture.sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)
await mkdir(join(project, 'app/Models/internal'), { recursive: true })
await mkdir(join(project, 'storage/framework/defaults/app/Models'), { recursive: true })
await mkdir(join(project, 'app/Middleware'), { recursive: true })
const csrf = new URL('../../../../defaults/app/Middleware/Csrf.ts', import.meta.url).pathname
const auth = new URL('../../../../defaults/app/Middleware/Auth.ts', import.meta.url).pathname
await writeFile(join(project, 'app/Middleware/Auth.ts'), `export { default } from ${JSON.stringify(auth)}\n`)
await writeFile(join(project, 'app/Middleware/Csrf.ts'), `export { default } from ${JSON.stringify(csrf)}\nexport * from ${JSON.stringify(csrf)}\n`)
await writeFile(join(project, 'package.json'), '{"name":"dashboard-model-access-fixture"}')
const definition = new URL('../../../orm/src/define-model.ts', import.meta.url).pathname
await writeFile(join(project, 'storage/framework/defaults/app/Models/User.ts'), `import { defineModel } from ${JSON.stringify(definition)}\nexport default defineModel({ name: 'User', table: 'users', traits: { useTimestamps: false }, attributes: { name: { type: 'string' } } } as const)\n`)
for (const [name, table, dashboard] of [
  ['PrivateRecord', 'private_records', { access: false, highlight: true }],
  ['PublicRecord', 'public_records', { enabled: false }],
  // Absent private tables prove generic reads/counts/search never reach their database work.
  ['MissingPrivateRecord', 'missing_private_records', { access: false }],
  ['User', 'private_users', { access: false }],
  ['Subscriber', 'private_subscribers', { access: false }],
] as const) {
  await writeFile(join(project, `app/Models/${name === 'User' ? 'internal/' : ''}${name}.ts`), `import { defineModel } from ${JSON.stringify(definition)}\nexport default defineModel({ ...${JSON.stringify({ name, table, dashboard, ...(name === 'PrivateRecord' ? { ownership: false } : {}), attributes: { name: { type: 'string', fillable: true } } })}, traits: { useTimestamps: false, useApi: true, useSearch: { searchable: ['name'], shape: () => null } } } as const)\n`)
}
const sql = new Database(file)
sql.run('CREATE TABLE private_records (id INTEGER PRIMARY KEY, name TEXT)')
sql.run('CREATE TABLE public_records (id INTEGER PRIMARY KEY, name TEXT)')
sql.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
sql.run("INSERT INTO users (name) VALUES ('framework-user-must-not-be-counted')")
sql.close()
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false } } })
const { configureOrm, releaseOrm } = await import('@stacksjs/query-builder')
configureOrm({ database: file })
const Private = (await import(join(project, 'app/Models/PrivateRecord.ts'))).default
const Public = (await import(join(project, 'app/Models/PublicRecord.ts'))).default
Object.assign(globalThis, { PrivateRecord: Private, PublicRecord: Public })
for (const name of ['MissingPrivateRecord', 'User', 'Subscriber'])
  Object.assign(globalThis, { [name]: (await import(join(project, `app/Models/${name === 'User' ? 'internal/' : ''}${name}.ts`))).default })
const row = await Private.create({ name: 'private-marker' })
await Public.create({ name: 'public-marker' })
assert.equal((await Private.find(row.id)).name, 'private-marker')
const { ensureFrameworkAuthTables } = await import('../../../auth/tests/helpers/auth-schema')
await ensureFrameworkAuthTables()
const { createToken } = await import('../../../auth/src/tokens')
const pair = await createToken(1, 'private-model-api-fixture', ['*'])
const headers = { authorization: `Bearer ${pair.plainTextToken}`, 'content-type': 'application/json' }
const { Action } = await import('@stacksjs/actions/runtime')
const { route: router } = await import('@stacksjs/router')
const Show = (await import('../../../../defaults/app/Actions/Dashboard/Models/ModelShowAction')).default
const Store = (await import('../../../../defaults/app/Actions/Dashboard/Models/ModelStoreAction')).default
const Update = (await import('../../../../defaults/app/Actions/Dashboard/Models/ModelUpdateAction')).default
const Destroy = (await import('../../../../defaults/app/Actions/Dashboard/Models/ModelDestroyAction')).default
const Index = (await import('../../../../defaults/app/Actions/Dashboard/Models/ModelsIndexAction')).default
const Legacy = (await import('../../../../defaults/app/Actions/Dashboard/Models/GetModels')).default
const UserCount = (await import('../../../../defaults/app/Actions/Dashboard/Models/GetUserCount')).default
const SubscriberCount = (await import('../../../../defaults/app/Actions/Dashboard/Models/GetSubscriberCount')).default
const Search = (await import('../../../../defaults/app/Actions/Dashboard/Search/GlobalSearchAction')).default
// Mount the real native generator, including its default auth middleware.
await import('../../../orm/src/routes')
router.get('/generic/{slug}', Show)
router.post('/generic/{slug}', Store)
router.patch('/generic/{slug}/{id}', Update)
router.delete('/generic/{slug}/{id}', Destroy)
router.get('/catalog', Index)
router.get('/legacy', Legacy)
router.get('/search', Search)
router.get('/user-count', UserCount)
router.get('/subscriber-count', SubscriberCount)
router.get('/named', new Action({ name: 'Private domain fixture', async handle() { return { name: (await Private.find(row.id)).name } } }))
for (const nativeRoutes of [false, true]) {
  const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
  const base = `http://127.0.0.1:${server.port}`
  try {
    assert.equal((await fetch(`${base}/api/private_records`)).status, 401, 'generated reads retain default auth')
    assert.equal((await fetch(`${base}/api/private_records`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer invalid-fixture-token' }, body: '{"name":"denied"}' })).status, 401, 'generated writes retain auth')
    const apiRead = await fetch(`${base}/api/private_records/${row.id}`, { headers })
    assert.equal(apiRead.status, 200, 'dashboard exclusion leaves authorized generated reads available')
    assert.equal((await apiRead.json() as { data: { name: string } }).data.name, 'private-marker')
    const apiCreated = await fetch(`${base}/api/private_records`, { method: 'POST', headers, body: '{"name":"api-created"}' })
    assert.equal(apiCreated.status, 201, await apiCreated.clone().text())
    const apiRow = (await apiCreated.json() as { data: { id: number } }).data
    assert.equal((await Private.find(apiRow.id)).name, 'api-created')
    assert.equal((await fetch(`${base}/api/private_records/${apiRow.id}`, { method: 'PATCH', headers, body: '{"name":"api-updated"}' })).status, 200)
    assert.equal((await Private.find(apiRow.id)).name, 'api-updated')
    assert.equal((await fetch(`${base}/api/private_records/${apiRow.id}`, { method: 'DELETE', headers })).status, 204)
    assert.equal(await Private.find(apiRow.id), undefined)
    assert.deepEqual(await (await fetch(`${base}/named`)).json(), { name: 'private-marker' })
    assert.equal((await fetch(`${base}/generic/public-record`)).status, 200, 'enabled:false remains presentation only')
    const createdResponse = await fetch(`${base}/generic/public-record`, { method: 'POST', headers: { authorization: 'Bearer fixture-csrf-exemption', 'content-type': 'application/json' }, body: '{"fields":{"name":"public-created"}}' })
    assert.equal(createdResponse.status, 200)
    const created = await createdResponse.json() as { id: number }
    assert.equal((await Public.find(created.id)).name, 'public-created')
    assert.equal((await fetch(`${base}/generic/public-record/${created.id}`, { method: 'PATCH', headers: { authorization: 'Bearer fixture-csrf-exemption', 'content-type': 'application/json' }, body: '{"fields":{"name":"public-updated"}}' })).status, 200)
    assert.equal((await Public.find(created.id)).name, 'public-updated')
    assert.equal((await fetch(`${base}/generic/public-record/${created.id}`, { method: 'DELETE', headers: { authorization: 'Bearer fixture-csrf-exemption' } })).status, 200)
    assert.equal(await Public.find(created.id), undefined)
    for (const path of ['/user-count', '/subscriber-count', '/generic/missing-private-record'])
      assert.equal((await fetch(base + path)).status, 404, path)
    for (const [method, path] of [['GET', '/generic/private-record'], ['POST', '/generic/private-record'], ['PATCH', '/generic/private-record/1'], ['DELETE', '/generic/private-record/1']]) {
      const response = await fetch(base + path, { method, headers: { authorization: 'Bearer fixture-csrf-exemption', 'content-type': 'application/json' }, ...(method !== 'GET' && method !== 'DELETE' ? { body: '{"fields":{"name":"forged"}}' } : {}) })
      assert.equal(response.status, 404, `${method}: private model must be excluded`)
    }
    const catalog = await (await fetch(`${base}/catalog`)).text()
    assert(!catalog.includes('PrivateRecord'))
    assert(catalog.includes('PublicRecord'))
    assert(!catalog.includes('MissingPrivateRecord') && !catalog.includes('private_users') && !catalog.includes('private_subscribers'))
    const catalogData = JSON.parse(catalog)
    assert(!catalogData.categoryGroups.flatMap((group: { models: Array<{ name: string }> }) => group.models).some((model: { name: string }) => model.name === 'User'), 'nested private User override must suppress its framework catalog entry')
    assert.equal(catalogData.totalModels, 1)
    assert.equal(catalogData.totalRecords, 1)
    const legacy = await (await fetch(`${base}/legacy`)).text()
    assert(!legacy.includes('PrivateRecord'))
    assert(legacy.includes('PublicRecord'))
    const search = await (await fetch(`${base}/search?q=marker`)).text()
    assert(!search.includes('PrivateRecord') && !search.includes('private-marker'))
    assert(search.includes('public-marker'))
    assert(!search.includes('MissingPrivateRecord') && !search.includes('private_users') && !search.includes('private_subscribers'))
    assert.equal((await Private.find(row.id)).name, 'private-marker')
  }
  finally { await server.stop(true) }
}
await closeDatabaseConnection()
releaseOrm()
console.log('dashboard model access OK')
