import process from 'node:process'
import { generateMigrations, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

/*
 * Two steps, and which one failed is the whole diagnostic.
 *
 * This action generates *and* applies, so "it failed" has two very different
 * meanings: the model diff could not be turned into SQL, or the SQL could not
 * be run. Reporting both as one string sends somebody to read their model when
 * the answer is a Postgres error about a table that already exists - which is
 * the ordinary outcome when two processes migrate the same database at once.
 */
const generated = await generateMigrations()

if (generated?.isErr) {
  console.error('Generating migrations failed. The model diff could not be turned into SQL.')
  console.error(String(generated.error?.message ?? generated.error))
  log.error('[stacks] generateMigrations failed', generated.error)
  process.exit(1)
}

const migrated = await runDatabaseMigration()

if (migrated.isErr) {
  /*
   * Said as its own thing rather than through the generic path. The migrations
   * were written; what failed was running them, and the files on disk are now
   * ahead of the database - which is worth knowing before the next attempt
   * generates against a snapshot that already moved.
   */
  console.error('Running migrations failed. The files were written; applying them to the database did not succeed.')
  console.error(String(migrated.error?.message ?? migrated.error))
  log.error('[stacks] runDatabaseMigration failed', migrated.error)
  process.exit(1)
}

process.exit(0)
