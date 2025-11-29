/**
 * Database Seeder using bun-query-builder
 *
 * This module provides seeding functionality for the stacks framework
 * powered by bun-query-builder.
 */

import { log } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import {
  freshDatabase,
  runSeeders as qbRunSeeders,
} from 'bun-query-builder'

/**
 * Seed the database using bun-query-builder seeders
 */
export async function seed(): Promise<void> {
  log.info('Seeding database...')

  // Check for custom seeder
  const customSeederPath = path.userDatabasePath('seeder.ts')
  if (fs.existsSync(customSeederPath)) {
    log.info('Custom seeder found')
    await import(customSeederPath)
  }

  // Run bun-query-builder seeders from database/seeders directory
  const seedersDir = path.userDatabasePath('seeders')

  if (fs.existsSync(seedersDir)) {
    await qbRunSeeders({
      seedersDir,
      verbose: true,
    })
  }
  else {
    log.info('No seeders directory found, skipping...')
  }

  log.success('Database seeded')
}

/**
 * Fresh database with seeding
 * Drops all tables, runs migrations, and seeds
 */
export async function freshWithSeed(): Promise<void> {
  log.info('Refreshing database with seeding...')

  const modelsDir = path.userModelsPath()
  const seedersDir = path.userDatabasePath('seeders')

  await freshDatabase({
    modelsDir,
    seedersDir,
    verbose: true,
  })

  log.success('Database refreshed and seeded')
}
