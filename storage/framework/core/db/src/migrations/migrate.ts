import { generateMigration, config } from 'bun-query-builder'

export { generateMigration as generateMigration2 } from 'bun-query-builder'

export async function generateMigrations2(): Promise<any> {
  return await generateMigration('./models', {
    dialect: config.dialect,
    apply: true,
    full: true
  })
}
