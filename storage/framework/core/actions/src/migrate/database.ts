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
/*
 * `--no-generate` (STACKS_MIGRATE_NO_GENERATE) applies committed migration
 * files and derives nothing.
 *
 * A deploy wants this. Generating on the box means the schema that reaches
 * production is whatever the model diff produces there, which is not
 * necessarily the SQL anybody reviewed — a diff can pick a column type, a
 * nullability or a default that no one looked at, and a live database is the
 * wrong place to discover the difference. It also writes files into a release
 * tree that is deleted on the next deploy.
 *
 * Local development still generates by default: that is the whole point of
 * models being the source of truth.
 */
const skipGeneration = process.env.STACKS_MIGRATE_NO_GENERATE === '1'

const generated = skipGeneration ? undefined : await generateMigrations()

if (skipGeneration)
  log.debug('[stacks] migration generation skipped (--no-generate); applying committed files only')

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
