/**
 * Plans a Postgres regeneration over a hand-written history, in a disposable
 * app (the cwd), for `regenerate-obsolete-history.test.ts`. Dry runs only: no
 * database is touched. Prints one JSON line.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const dir = join(root, 'database/migrations')
mkdirSync(dir, { recursive: true })
mkdirSync(join(root, 'app/Models'), { recursive: true })
const orm = resolve(import.meta.dir, '../../../orm/src/index.ts')
const validation = resolve(import.meta.dir, '../../../validation/src/schema.ts')
writeFileSync(join(root, 'app/Models/Team.ts'), `
import { defineModel } from ${JSON.stringify(orm)}
import { schema } from ${JSON.stringify(validation)}
export default defineModel({ name: 'Team', table: 'teams', traits: { useTimestamps: true }, attributes: {
  name: { fillable: true, unique: true, validation: { rule: schema.string().required().max(100) } },
  status: { fillable: true, default: 'active', validation: { rule: schema.enum(['active', 'paused']) } },
} } as const)
`)

const files: Record<string, string> = {
  '0000000001-create-teams-table.sql': `CREATE TABLE IF NOT EXISTS "teams" ("id" BIGSERIAL PRIMARY KEY, "name" varchar(255) not null);`,
  '0000000002-create-database-types.sql': `DO $stacks$ BEGIN CREATE TYPE "teams_status_type" AS ENUM ('active'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;
ALTER TYPE "teams_status_type" ADD VALUE IF NOT EXISTS 'paused';`,
  '0000000003-alter-teams.sql': `ALTER TABLE "teams" ADD COLUMN "status" "teams_status_type" default 'active';`,
  '0000000004-seed-teams.sql': `INSERT INTO "teams" ("id", "name") VALUES (1, 'Default');`,
  '0000000005-drop-legacy-index.sql': `DROP INDEX IF EXISTS "notification_deliveries_idempotency_key_unique";`,
  '0000000006-clear-plaintext-password-resets.sql': `-- Reset tokens were stored in plain text.\nDELETE FROM "password_resets";`,
  '0000000007-create-plans-table.sql': `CREATE TABLE IF NOT EXISTS "plans" ("id" BIGSERIAL PRIMARY KEY, "name" text);
CREATE INDEX IF NOT EXISTS "plans_name_index" ON "plans" ("name");
INSERT INTO "plans" ("name") VALUES ('Basic');`,
  '0000000008-drop-plans-index.sql': `DROP INDEX IF EXISTS "plans_name_index";`,
}
for (const [file, sql] of Object.entries(files))
  writeFileSync(join(dir, file), sql)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: join(root, 'app.sqlite') } }, queryLogging: { enabled: false } } } as any)
const { regenerateMigrationCorpus } = await import('../../src/migrations')

const replace = await regenerateMigrationCorpus({ dialect: 'postgres', dir, replaceUnmarked: true, dryRun: true })
const keep = await regenerateMigrationCorpus({ dialect: 'postgres', dir, dryRun: true })
if (!replace.isOk || !keep.isOk) {
  console.log(JSON.stringify({ error: String(replace.isOk ? (keep as any).error : replace.error) }))
  process.exit(1)
}
console.log(JSON.stringify({ replace: replace.value, keep: keep.value }))
process.exit(0)
