import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

// Generates the Postgres corpus for the framework's own FailedJob model in a
// disposable app, with no Postgres running, and prints it (#3385). Every
// database connection setting points at a socket that only counts, so nothing
// reaches a server that happens to run on this machine.
const root = process.cwd()
const postgresDir = join(root, 'database/migrations/postgres')
mkdirSync(postgresDir, { recursive: true })
mkdirSync(join(root, 'app/Models'), { recursive: true })
const failedJob = resolve(import.meta.dir, '../../../../defaults/app/Models/FailedJob.ts')
writeFileSync(join(root, 'app/Models/FailedJob.ts'), `export { default } from ${JSON.stringify(failedJob)}\n`)

const trap = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { open(socket) { socket.end() }, data() {} } })
const elsewhere = { host: '127.0.0.1', port: trap.port, name: 'instant_columns', database: 'instant_columns', username: 'nobody', password: 'nothing' }

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: join(root, 'app.sqlite') }, postgres: elsewhere, mysql: elsewhere }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } } })
const { generateMigrations } = await import('../../src/migrations')

const result = await generateMigrations({ dialect: 'postgres' })
if (!result.isOk)
  throw result.error
for (const file of readdirSync(postgresDir).filter(file => file.endsWith('.sql')).sort())
  console.log(readFileSync(join(postgresDir, file), 'utf8'))
trap.stop(true)
process.exit(0)
