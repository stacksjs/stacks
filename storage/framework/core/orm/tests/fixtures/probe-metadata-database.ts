import { existsSync } from 'node:fs'
import { getDatabase, releaseOrm } from '@stacksjs/query-builder'

await import('../../src/index')
await import('../../src/routes')

const databasePath = process.env.DB_DATABASE_PATH!
const databaseExistedAfterMetadata = existsSync(databasePath)
const database = getDatabase()
const firstQuery = (database.query('SELECT 1 AS value').get() as { value: number }).value
const foreignKeys = (database.query('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys
console.log(JSON.stringify({ databaseExistedAfterMetadata, firstQuery, foreignKeys, databaseExistsAfterQuery: existsSync(databasePath) }))
releaseOrm()
