import assert from 'node:assert/strict'
import { SQL } from 'bun'

assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(process.env.DB_DATABASE?.startsWith('stacks_cached_plan_'))
assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'postgres',
    connections: { postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } },
    queryLogging: { enabled: false },
  },
})

// A second connection stands in for `buddy migrate` running in another process.
const migrator = new SQL({
  hostname: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
  username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD || undefined, max: 1,
})
const read = () => db.selectFrom('notes').selectAll().where('id', '=', 1).execute() as Promise<Array<Record<string, unknown>>>

try {
  await db.unsafe('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)').execute()
  await db.unsafe('INSERT INTO notes (id, body) VALUES (1, \'first\')').execute()
  assert.deepEqual(Object.keys((await read())[0]!).sort(), ['body', 'id'])

  await migrator.unsafe('ALTER TABLE notes ADD COLUMN extra TEXT')

  // Bun before 1.4.4 kept the prepared `SELECT *` and Postgres rejected it with
  // 0A000 "cached plan must not change result type" on every later run.
  for (const attempt of [1, 2])
    assert.deepEqual(Object.keys((await read())[0]!).sort(), ['body', 'extra', 'id'], `read ${attempt} after ADD COLUMN`)
  console.log('cached plan OK')
}
finally {
  await migrator.close()
}
