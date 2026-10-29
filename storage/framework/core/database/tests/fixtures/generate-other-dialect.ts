import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// An app that develops on SQLite and deploys to Postgres keeps two corpora.
// Generating for the one that is not connected must need no database of that
// dialect, and an ordinary generate must say when it left the other behind
// (stacksjs/stacks#2949). Run in a disposable app.
const root = realpathSync(process.env.STACKS_OTHER_DIALECT_ROOT!)
assert.equal(realpathSync(process.cwd()), root)
const sqliteDir = join(root, 'database/migrations')
const postgresDir = join(sqliteDir, 'postgres')
mkdirSync(postgresDir, { recursive: true })
mkdirSync(join(root, 'app/Models'), { recursive: true })

const orm = resolve(import.meta.dir, '../../../orm/src/index.ts')
const validation = resolve(import.meta.dir, '../../../validation/src/schema.ts')
const model = (name: string, table: string) => writeFileSync(join(root, `app/Models/${name}.ts`), `
import { defineModel } from ${JSON.stringify(orm)}
import { schema } from ${JSON.stringify(validation)}
export default defineModel({ name: '${name}', table: '${table}', attributes: { title: { fillable: true, validation: { rule: schema.string().required().max(100) } } } } as const)
`)
model('Widget', 'widgets')

// Every Postgres and MySQL connection setting points here, so any attempt to
// reach a database of the dialect being generated is counted rather than
// landing on whatever server happens to run on this machine.
let connections = 0
const trap = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { open(socket) { connections++; socket.end() }, data() {} } })
const elsewhere = { host: '127.0.0.1', port: trap.port, name: 'generate_other_dialect', database: 'generate_other_dialect', username: 'nobody', password: 'nothing' }

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, getDatabaseDialect, initializeDbConfig } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: join(root, 'app.sqlite') }, postgres: elsewhere, mysql: elsewhere }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } } })
const { dialectsBehindModels, generateMigrations, pendingMigrationOperations, previewPendingMigrations, siblingMigrationDialects } = await import('../../src/migrations')

const sql = (dir: string) => readdirSync(dir).filter(file => file.endsWith('.sql')).sort()
const ok = (result: { isOk: boolean, error?: unknown }) => assert.equal(result.isOk, true, String(result.error))

// Before any snapshot exists, MySQL has no directory of its own and would
// share SQLite's. Refused rather than mixing two dialects in one corpus.
const shared = await generateMigrations({ dialect: 'mysql' })
assert.equal(shared.isErr, true)
assert.match(String((shared as { error: Error }).error.message), /which is the sqlite corpus/)
assert.equal(sql(sqliteDir).length, 0)

// Both corpora start from the models; the Postgres one with no Postgres running.
ok(await generateMigrations())
ok(await generateMigrations({ dialect: 'postgres' }))
assert.equal(sql(sqliteDir).length, 1)
assert.equal(sql(postgresDir).length, 1)
assert.match(readFileSync(join(postgresDir, sql(postgresDir)[0]!), 'utf8'), /"widgets"/)
assert.ok(existsSync(join(root, 'storage/framework/database/model-snapshot.postgres.json')))
assert.deepEqual(await siblingMigrationDialects(), ['postgres'])
assert.deepEqual(await dialectsBehindModels(), [])

// A new model, generated the ordinary way, moves only SQLite and reports Postgres behind.
model('Gadget', 'gadgets')
ok(await generateMigrations())
assert.equal(sql(sqliteDir).length, 2)
assert.equal(sql(postgresDir).length, 1)
assert.deepEqual(await dialectsBehindModels(), ['postgres'])

// A read-only check must inspect the requested committed snapshot, even when
// the development connection uses a different dialect. It must not advance
// either snapshot or connect to the foreign database.
const snapshots = join(root, 'storage/framework/database')
const beforePreview = readdirSync(snapshots).sort().map(file => [file, readFileSync(join(snapshots, file), 'utf8')])
assert.deepEqual((await pendingMigrationOperations({ dialect: 'postgres', fromDb: false })).map(operation => [operation.kind, operation.table]), [['create_table', 'gadgets']])
assert.deepEqual((await previewPendingMigrations({ dialect: 'postgres', fromDb: false })).map(operation => [operation.kind, operation.table]), [['create_table', 'gadgets']])
assert.deepEqual(await pendingMigrationOperations({ fromDb: false }), [])
assert.equal(getDatabaseDialect(), 'sqlite')
assert.deepEqual(readdirSync(snapshots).sort().map(file => [file, readFileSync(join(snapshots, file), 'utf8')]), beforePreview)
assert.equal(sql(sqliteDir).length, 2)
assert.equal(sql(postgresDir).length, 1)
await assert.rejects(() => pendingMigrationOperations({ dialect: 'postgres', fromDb: true }), /attached sqlite database/)
// Intentionally invalid typed API input must fail before any database access.
await assert.rejects(() => pendingMigrationOperations({ dialect: 'not-a-dialect' as never }), /Unknown migration dialect/)
assert.equal(getDatabaseDialect(), 'sqlite')

// --dialect postgres brings it up to date, and the warning goes away.
ok(await generateMigrations({ dialect: 'postgres' }))
assert.equal(sql(postgresDir).length, 2)
assert.match(readFileSync(join(postgresDir, sql(postgresDir)[1]!), 'utf8'), /"gadgets"/)
assert.deepEqual(await dialectsBehindModels(), [])
assert.deepEqual(await pendingMigrationOperations({ dialect: 'postgres', fromDb: false }), [])
// The connected dialect's corpus was not touched by the Postgres run.
assert.equal(sql(sqliteDir).length, 2)

// A dialect with no corpus yet gets one of its own, and the flat SQLite corpus
// keeps its owner: nothing MySQL is written into it.
ok(await generateMigrations({ dialect: 'mysql' }))
const mysqlDir = join(sqliteDir, 'mysql')
assert.deepEqual(sql(mysqlDir).map(file => file.replace(/^\d+-/, '')).sort(), ['create-gadgets-table.sql', 'create-widgets-table.sql'])
assert.match(sql(mysqlDir).map(file => readFileSync(join(mysqlDir, file), 'utf8')).join('\n'), /`gadgets`/)
assert.equal(sql(sqliteDir).length, 2)
assert.equal(sql(postgresDir).length, 2)
assert.deepEqual((await siblingMigrationDialects()).sort(), ['mysql', 'postgres'])

// --from-db diffs the connected database, so it cannot serve another dialect.
const fromDb = await generateMigrations({ dialect: 'postgres', fromDb: true })
assert.equal(fromDb.isErr, true)

// None of it needed a database of the dialect it generated for.
assert.equal(connections, 0, 'generating another dialect connected to a database')

// Control: the trap does count a connection when one is made.
await new Promise<void>((done) => {
  void Bun.connect({ hostname: '127.0.0.1', port: trap.port, socket: { open(socket) { socket.end() }, data() {}, close() { done() }, error() { done() } } })
})
await Bun.sleep(50)
assert.equal(connections, 1)
trap.stop(true)

console.log('other dialect generation OK')
process.exit(0)
