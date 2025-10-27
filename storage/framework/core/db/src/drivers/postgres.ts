import { generateMigrations } from '../migrations'

export async function generateMigrationsForMysql() {
  await generateMigrations('postgres')
}