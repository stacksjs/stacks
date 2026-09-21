process.env.APP_ENV = 'test'
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

const { closeDatabaseConnection, db, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')

initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database: ':memory:' } },
  },
})

await db.unsafe('SELECT 1 AS ready').execute()
resetDatabaseConnection()

const rows = await db.unsafe('SELECT 1 AS ready').execute()
if (rows[0]?.ready !== 1)
  throw new Error(`Unexpected query result after reset: ${JSON.stringify(rows)}`)

await closeDatabaseConnection()
const reopened = await db.unsafe('SELECT 1 AS ready').execute()
if (reopened[0]?.ready !== 1)
  throw new Error(`Unexpected query result after close: ${JSON.stringify(reopened)}`)
await closeDatabaseConnection()

console.log('connection-reset-ok')
