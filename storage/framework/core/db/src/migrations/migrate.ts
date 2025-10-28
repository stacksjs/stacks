import { generateMigration, config, GenerateMigrationResult } from 'bun-query-builder'
import { userModelsPath } from '@stacksjs/path'

export { generateMigration as generateMigration2 } from 'bun-query-builder'

export async function generateMigrations2(): Promise<GenerateMigrationResult> {
  return await generateMigration(userModelsPath(), {
    dialect: config.dialect,
    apply: true,
    full: true
  })
}
