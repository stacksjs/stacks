import { generateMigration, config } from 'bun-query-builder'

export { generateMigration } from 'bun-query-builder'

export async function generateMigrations(): Promise<any> {
  return await generateMigration('./models', {
    dialect: config.dialect,
    apply: true,
    full: true
  })
}
