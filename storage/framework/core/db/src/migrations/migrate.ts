import { userModelsPath } from '@stacksjs/path'
import { generateMigration } from 'bun-query-builder'

export { generateMigration as generateMigration2 } from 'bun-query-builder'

export async function generateMigrations2(): Promise<any> {
  return await generateMigration(userModelsPath(), {
    dialect: 'postgres',
    apply: true,
    full: true
  })
}

await generateMigrations2()