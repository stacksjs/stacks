import { join } from '@stacksjs/path'
import { resetDatabase as resetDatabaseQueryBuilder } from 'bun-query-builder'
import { config } from 'bun-query-builder'

export async function resetDatabase2(): Promise<void> {
  const modelsPath = join(import.meta.dir, 'models')

  await resetDatabaseQueryBuilder(modelsPath, { dialect: config.dialect })

  await resetDatabaseQueryBuilder()
}