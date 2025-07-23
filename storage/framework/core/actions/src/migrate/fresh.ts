import process from 'node:process'
import { generateMigrations, resetDatabase, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// first, reset the database, if it exists
// const result = await resetDatabase()

// if (result?.isErr()) {
//   console.error(result.error)
//   log.error('generateMigrations failed', result.error)
//   process.exit(1)
// }

// then,generate the migrations
// await generateMigrations()

// finally, migrate the database
await runDatabaseMigration()

process.exit(0)
