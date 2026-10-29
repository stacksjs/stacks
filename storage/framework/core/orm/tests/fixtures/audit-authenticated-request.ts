import assert from 'node:assert/strict'

const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: process.env.DB_DATABASE_PATH } }, queryLogging: { enabled: false },
} })
const { applyAudit, setAuditUser } = await import('../../src/traits/audit')
const { applyActivityLog } = await import('../../src/traits/activity-log')
const { setTrailActor } = await import('../../src/traits/actor')
const { runWithRequest } = await import('@stacksjs/router')

try {
  await db.unsafe('CREATE TABLE model_audits (auditable_type TEXT, auditable_id INTEGER, event TEXT, old_values TEXT, new_values TEXT, user_id INTEGER, created_at TEXT)').execute()
  await db.unsafe('CREATE TABLE activities (type TEXT, description TEXT, subject_type TEXT, subject_id INTEGER, properties TEXT, causer TEXT, user_id INTEGER, ip_address TEXT, created_at TEXT)').execute()
  await db.unsafe('CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)').execute()
  const model = {
    async create(row: { id: number, name: string }) {
      await db.insertInto('widgets').values(row).execute()
      return row
    },
  }
  applyAudit(model, 'Widget')
  applyActivityLog(model, 'Widget', 'id', {})
  await runWithRequest({ _authenticatedUser: { id: 42 }, user: () => undefined } as any, () => model.create({ id: 1, name: 'Test' }))
  const audit = await db.selectFrom('model_audits').select(['user_id', 'auditable_id']).executeTakeFirst()
  const activity = await db.selectFrom('activities').select(['user_id', 'subject_id', 'causer']).executeTakeFirst()
  assert.equal(Number(audit?.user_id), 42)
  assert.equal(Number(audit?.auditable_id), 1)
  assert.equal(Number(activity?.user_id), 42)
  assert.equal(Number(activity?.subject_id), 1)
  assert.equal(activity?.causer, 'User:42')
  setTrailActor(77)
  try {
    await runWithRequest({ _authenticatedUser: { id: 43 } } as any, () => model.create({ id: 2, name: 'Separate override' }))
    const nextAudit = await db.selectFrom('model_audits').select('user_id').where('auditable_id', '=', 2).executeTakeFirst()
    assert.equal(Number(nextAudit?.user_id), 43, 'activity override does not replace the audit actor')
  }
  finally { setTrailActor(null) }
  setAuditUser(44)
  try {
    await model.create({ id: 3, name: 'Job' })
    const jobAudit = await db.selectFrom('model_audits').select('user_id').where('auditable_id', '=', 3).executeTakeFirst()
    assert.equal(Number(jobAudit?.user_id), 44)
  }
  finally { setAuditUser(null) }
  console.log('authenticated audit trails OK')
}
finally {
  await resetDatabaseConnection()
}
