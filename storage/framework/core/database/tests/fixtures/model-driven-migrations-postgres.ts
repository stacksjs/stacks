/**
 * A database built from hand-written history, brought under the models:
 * regenerate the corpus, repoint the ledger, align the live schema, and end on
 * a migrate with nothing to run. For `model-driven-migrations-postgres.test.ts`.
 *
 * Runs in a disposable app directory (the cwd) against a scratch database the
 * test creates and drops. Prints `model-driven migrations OK` on success.
 */
import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'

const { DB_HOST: host, DB_DATABASE: name, DB_USERNAME: username, DB_PASSWORD: password, DB_PORT: port } = process.env
assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(name?.startsWith('stacks_model_migrations_'))
assert(host && ['127.0.0.1', 'localhost', '[::1]'].includes(host))

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
writeFileSync(join(root, 'app/Models/TrainerClientAssignment.ts'), `
import { defineModel } from ${JSON.stringify(orm)}
import { schema } from ${JSON.stringify(validation)}
export default defineModel({ name: 'TrainerClientAssignment', table: 'trainer_client_assignments', belongsTo: ['Team'], traits: { useTimestamps: true },
  indexes: [
    { name: 'organization_id_member_user_id_trainer_user_id_unique', columns: ['team_id', 'member_user_id', 'trainer_user_id'], unique: true },
    { name: 'note_index', columns: ['note'] },
  ],
  attributes: {
    memberUserId: { fillable: true, validation: { rule: schema.number() } },
    trainerUserId: { fillable: true, validation: { rule: schema.number() } },
    note: { fillable: true, validation: { rule: schema.string().max(50) } },
  } } as const)
`)

// The hand-written history: legacy index names (one past Postgres's 63-character
// limit), no foreign key, a narrower column, a guarded enum type file, a drop
// of an index nothing builds, a data fix, and reference data.
const old: Record<string, string> = {
  '0000000001-create-teams-table.sql': `CREATE TABLE IF NOT EXISTS "teams" ("id" BIGSERIAL PRIMARY KEY, "name" varchar(255) not null, "created_at" timestamp, "updated_at" timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS "teams_teams_name_unique" ON "teams" ("name");`,
  '0000000002-create-database-types.sql': `DO $stacks$ BEGIN CREATE TYPE "teams_status_type" AS ENUM ('active'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;
ALTER TYPE "teams_status_type" ADD VALUE IF NOT EXISTS 'paused';`,
  '0000000003-alter-teams.sql': `ALTER TABLE "teams" ADD COLUMN "status" "teams_status_type" default 'active';`,
  '0000000004-create-trainer_client_assignments-table.sql': `CREATE TABLE IF NOT EXISTS "trainer_client_assignments" ("id" BIGSERIAL PRIMARY KEY, "member_user_id" integer, "trainer_user_id" integer, "note" varchar(20), "team_id" bigint, "created_at" timestamp, "updated_at" timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS "trainer_client_assignments_trainer_client_assignments_organization_id_member_user_id_trainer_user_id_unique" ON "trainer_client_assignments" ("team_id", "member_user_id", "trainer_user_id");`,
  '0000000005-drop-legacy-index.sql': `DROP INDEX IF EXISTS "notification_deliveries_idempotency_key_unique";`,
  '0000000006-clear-plaintext-password-resets.sql': `-- Tokens were stored in plain text; clear them.\nDELETE FROM "teams" WHERE false;`,
  '0000000007-seed-teams.sql': `INSERT INTO "teams" ("id", "name") VALUES (1, 'Default');`,
}
for (const [file, sql] of Object.entries(old))
  writeFileSync(join(dir, file), sql)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'postgres', connections: { postgres: { name, host, port: Number(port || 5432), username, password } }, queryLogging: { enabled: false } },
} as any)

const { regenerateMigrationCorpus, runDatabaseMigration } = await import('../../src/migrations')
const { reconcileMigrationLedger } = await import('../../src/migration-ledger')
const { alignSchema } = await import('../../src/schema-align')
const probe = new SQL({ adapter: 'postgres', hostname: host, port: Number(port || 5432), username, password, database: name, max: 1 })

try {
  const migrated = await runDatabaseMigration()
  assert(migrated.isOk, String(migrated.isOk ? '' : migrated.error))

  // A. What a regeneration replaces, and why.
  const plan = await regenerateMigrationCorpus({ dialect: 'postgres', replaceUnmarked: true, dryRun: true })
  assert(plan.isOk, String(plan.isOk ? '' : plan.error))
  assert.deepEqual(plan.value.removedObsolete, ['0000000002-create-database-types.sql', '0000000005-drop-legacy-index.sql'])
  assert.deepEqual(plan.value.removedDataOnly, ['0000000006-clear-plaintext-password-resets.sql'])
  assert.deepEqual(plan.value.preservedData, ['0000000007-seed-teams.sql'])
  assert.deepEqual(plan.value.preservedOutOfScope, [])
  assert.equal(plan.value.relocated.length, 1)
  assert.match(plan.value.relocated[0]!.to, /^\d{10}-seed-teams\.sql$/)

  const regenerated = await regenerateMigrationCorpus({ dialect: 'postgres', replaceUnmarked: true })
  assert(regenerated.isOk, String(regenerated.isOk ? '' : regenerated.error))
  const files = readdirSync(dir).filter(file => file.endsWith('.sql')).sort()
  // The seed runs after the corpus that creates its table.
  assert.equal(files.at(-1), plan.value.relocated[0]!.to)

  // B. The ledger follows the regeneration without re-running anything.
  const written = regenerated.value.files.map(file => file.name)
  const fixed = await reconcileMigrationLedger({ regenerated: { removed: regenerated.value.removed, written } })
  assert.deepEqual([...fixed.retired].sort(), [...regenerated.value.removed].sort())
  assert.deepEqual(fixed.remapped, [{ from: '0000000007-seed-teams.sql', to: plan.value.relocated[0]!.to }])
  const typesFile = written.find(file => file.endsWith('create-database-types.sql'))!
  const teamsFile = written.find(file => file.endsWith('create-teams-table.sql'))!
  const assignmentsFile = written.find(file => file.endsWith('create-trainer_client_assignments-table.sql'))!
  // Present under other names - the truncated legacy index included - so recorded.
  assert(fixed.recorded.includes(typesFile) && fixed.recorded.includes(teamsFile), JSON.stringify(fixed))
  // Missing an index entirely, so left to run - after an align.
  assert(fixed.skipped.some(entry => entry.file === assignmentsFile && entry.reason.includes('migrate:align')), JSON.stringify(fixed.skipped))

  // C. Align: an orphan row refuses the foreign key and nothing else.
  await probe.unsafe(`INSERT INTO "trainer_client_assignments" ("team_id", "note") VALUES (999, 'orphan')`)
  const first = await alignSchema({ apply: true })
  assert(first.supported)
  const kinds = first.plan.actions.map(action => `${action.kind} ${action.name}`)
  assert.deepEqual(kinds.sort(), [
    'create-index trainer_client_assignments_note_index',
    'rename-index teams_name_unique',
    'rename-index trainer_client_assignments_organization_id_member_user__186exwq',
    'widen-column note',
  ])
  assert.deepEqual(first.plan.refused.map(action => action.kind), ['add-foreign-key'])
  assert.match(first.plan.refused[0]!.reason, /1 row\(s\) in trainer_client_assignments reference a missing parent/)
  // Narrowing is reported, never applied.
  assert(first.plan.reports.some(report => report.kind === 'type' && report.name === 'name'))

  await probe.unsafe(`DELETE FROM "trainer_client_assignments" WHERE "team_id" = 999`)
  const second = await alignSchema({ apply: true })
  assert.deepEqual(second.plan.actions.map(action => action.kind), ['add-foreign-key'])
  assert.equal(second.applied.length, 1)
  const third = await alignSchema()
  assert.deepEqual(third.plan.actions, [])
  assert.deepEqual(third.plan.refused, [])

  // The regenerated file is now provably applied.
  const after = await reconcileMigrationLedger()
  assert(after.recorded.includes(assignmentsFile), JSON.stringify(after))

  const again = await runDatabaseMigration()
  assert(again.isOk, String(again.isOk ? '' : again.error))
  assert.equal(again.value, 'Nothing to migrate.')

  // One index per declared index - nothing built twice beside a renamed twin.
  const indexes = await probe.unsafe(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'trainer_client_assignments' ORDER BY indexname`) as Array<{ indexname: string }>
  assert.deepEqual(indexes.map(row => row.indexname), [
    'trainer_client_assignments_note_index',
    'trainer_client_assignments_organization_id_member_user__186exwq',
    'trainer_client_assignments_pkey',
  ])
  const teams = await probe.unsafe(`SELECT name FROM teams`) as Array<{ name: string }>
  assert.deepEqual(teams.map(row => row.name), ['Default'])

  console.log('model-driven migrations OK')
}
finally {
  await probe.close()
  resetDatabaseConnection()
}
process.exit(0)
