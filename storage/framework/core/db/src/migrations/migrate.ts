import { generateMigration } from 'bun-query-builder'

export { generateMigration } from 'bun-query-builder'

type Dialect = 'postgres' | 'mysql' | 'sqlite'

export async function generateMigrations(dialect: Dialect): Promise<any> {
  return await generateMigration('./models', {
    dialect,
    apply: true,
    full: true
  })
}
