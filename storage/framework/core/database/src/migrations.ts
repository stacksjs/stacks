import { path } from '@stacksjs/path'
import { log } from '@stacksjs/logging'
import { err, ok } from '@stacksjs/error-handling'
import { fs } from '@stacksjs/storage'
import { FileMigrationProvider, Migrator } from 'kysely'
import { database } from '@stacksjs/config'
import { db } from './utils'

export const migrator = new Migrator({
  db,

  provider: new FileMigrationProvider({
    fs,
    path,
    // This needs to be an absolute path.
    migrationFolder: path.userMigrationsPath(),
  }),

  migrationTableName: database.migrations,
  migrationLockTableName: database.migrationLocks,
})

export async function runDatabaseMigration() {
  try {
    log.info('Migrating database...')

    const migration = await migrator.migrateToLatest()

    if (migration.error) {
      log.error(migration.error)
      return err(migration.error)
    }

    if (migration.results?.length === 0) {
      log.success('No new migrations were executed')
      return ok('No new migrations were executed')
    }

    if (migration.results) {
      migration.results.forEach(({ migrationName }) => {
        log.info(`Migration Name: ${migrationName}`)
      })

      log.success('Database migrated successfully.')
      return ok(migration)
    }

    log.success('Database migration completed with no new migrations.')
    return ok('Database migration completed with no new migrations.')
  }
  catch (error) {
    console.error('Migration failed:', error)
    return err(error)
  }
}
export interface MigrationOptions {
  name: string
  up: string
}

export function generateMigrationFile(options: MigrationOptions) {
  const { name, up } = options

  const timestamp = new Date().getTime().toString()
  const fileName = `${timestamp}-${name}.ts`
  const filePath = path.userMigrationsPath(fileName)
  const fileContent = `import { Migration } from '@stacksjs/database'

    export default new Migration({
      name: '${name}',
      up: \`
        ${up}
      \`,
    })
  `
  // TODO: use Bun.write
  fs.writeFileSync(filePath, fileContent)

  log.info(`Created migration file: ${fileName}`)
}
