/**
 * Team writes that guard on the row's state must not read an affected-row
 * count as the verdict. stacksjs/stacks#2639.
 *
 * MySQL reports rows an UPDATE CHANGED; PostgreSQL and SQLite report rows it
 * MATCHED. `TeamMemberUpdateAction` treated any count other than 1 as "the
 * member changed underneath us" and answered 409, so saving a member with the
 * role and status they already had - a double submit, or any save in the same
 * second as their last write - was refused on MySQL for a member nobody had
 * touched.
 *
 * The action now locks the member before deciding, which makes the count
 * unnecessary. The concurrency case below is the other half of that claim:
 * with the count gone, the lock is the only thing standing between a
 * concurrent ownership transfer and a false success, so it is pinned directly.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TEAM_STATE_WRITES_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-team-state-writes-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_team_state_writes_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

// The team tables as the models define them, for this dialect.
const TABLES = ['team_invitations', 'team_members', 'teams']
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-team-state-writes-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
let statements: string[]
try {
  process.chdir(scratch)
  statements = generateSql(plan)
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}

const memberUpdate = (await import('../../../storage/framework/defaults/app/Actions/Dashboard/Teams/TeamMemberUpdateAction')).default

interface Outcome { status: number, body: any }

/** PATCH /teams/1/members/{memberId}, through the action's own handler. */
async function patch(memberId: number, body: Record<string, unknown>): Promise<Outcome> {
  const params: Record<string, string> = { id: '1', memberId: String(memberId) }
  const result = await memberUpdate.handle({ getParam: (key: string) => params[key], all: () => body } as never)
  if (result instanceof Response)
    return { status: result.status, body: await result.json() }
  return { status: 200, body: result }
}

async function member(id: number): Promise<{ role: string, status: string } | undefined> {
  return await db.selectFrom('team_members').selectAll().where('id', '=', id).executeTakeFirst() as never
}

/**
 * A second connection that makes member 1 an owner inside an open transaction,
 * says READY, holds it, then commits. Its UPDATE takes the row lock first, so
 * whatever this process does to that row next has to reckon with it.
 */
function competingOwnershipTransfer(): { ready: Promise<void>, exited: Promise<number>, output: () => string } {
  const script = `
    const dialect = process.env.DB_CONNECTION
    if (dialect === 'sqlite') {
      const { Database } = await import('bun:sqlite')
      const handle = new Database(process.env.DB_DATABASE_PATH)
      handle.run('PRAGMA busy_timeout = 5000')
      handle.run('BEGIN IMMEDIATE')
      handle.run("UPDATE team_members SET role = 'owner' WHERE id = 1")
      console.log('READY')
      await Bun.sleep(1200)
      try { handle.run('COMMIT'); console.log('COMMITTED') }
      catch (error) { console.log('COMMIT FAILED ' + error.message) }
      handle.close()
    }
    else {
      const sql = new Bun.SQL({ adapter: dialect, hostname: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        database: process.env.DB_DATABASE, username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      await sql.begin(async (tx) => {
        await tx.unsafe("UPDATE team_members SET role = 'owner' WHERE id = 1")
        console.log('READY')
        await Bun.sleep(1200)
      })
      console.log('COMMITTED')
      await sql.close()
    }
  `
  const child = Bun.spawn([process.execPath, '-e', script], { cwd: tmpdir(), env: process.env, stdout: 'pipe', stderr: 'pipe' })
  let out = ''
  let markReady!: () => void
  const ready = new Promise<void>((resolve) => { markReady = resolve })
  ;(async () => {
    for await (const chunk of child.stdout) {
      out += new TextDecoder().decode(chunk)
      if (out.includes('READY'))
        markReady()
    }
  })()
  const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error(`competitor never became ready: ${out}`)), 8000))
  return { ready: Promise.race([ready, timeout]), exited: child.exited, output: () => out }
}

const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()

  await db.insertInto('teams').values({ id: 1, name: 'Acme', status: 'active', member_count: 2 }).execute()
  await db.insertInto('team_members').values({ id: 1, team_id: 1, user_id: 1, role: 'member', status: 'active' }).execute()
  await db.insertInto('team_members').values({ id: 2, team_id: 1, user_id: 2, role: 'owner', status: 'active' }).execute()

  // Frozen so "the same second as the member's last write" is a fact rather
  // than a race. The first save still changes `updated_at` from NULL; every
  // save after it writes exactly what the row already holds.
  const { setSystemTime } = await import('bun:test')
  setSystemTime(new Date('2030-01-02T03:04:05.000Z'))
  try {
    await check('an idempotent save is not a conflict', async () => {
      for (const body of [{ role: 'member' }, { role: 'member' }, {}, { status: 'active' }, { role: 'member', status: 'active' }]) {
        const outcome = await patch(1, body)
        assert.equal(outcome.status, 200, `${dialect}: saving ${JSON.stringify(body)} unchanged answered ${outcome.status} ${JSON.stringify(outcome.body)}`)
        assert.deepEqual(outcome.body, { member: { id: 1, role: 'member', status: 'active' } })
      }
    })

    await check('a real change applies, and repeating it is still a success', async () => {
      assert.equal((await patch(1, { role: 'admin' })).status, 200)
      assert.equal((await member(1))?.role, 'admin')
      assert.equal((await patch(1, { role: 'admin' })).status, 200, `${dialect}: re-applying the role just set must not be a conflict`)
    })
  }
  finally { setSystemTime() }

  await check('the owner is still refused', async () => {
    const outcome = await patch(2, { role: 'admin' })
    assert.equal(outcome.status, 409)
    assert.match(outcome.body.message, /Transfer team ownership/)
    assert.equal((await member(2))?.role, 'owner')
  })

  await check('a concurrent ownership transfer is never reported as our success', async () => {
    await db.updateTable('team_members').set({ role: 'member' }).where('id', '=', 1).execute()

    const competitor = competingOwnershipTransfer()
    await competitor.ready
    const outcome = await patch(1, { role: 'viewer' })
    await competitor.exited
    const stored = await member(1)

    // The safety property, on every dialect: our write must not be reported as
    // applied unless it is what the row now holds. Without the lock, and with
    // the count no longer read, this is exactly what broke: the unlocked read
    // saw 'member', the owner-guarded UPDATE matched nothing, and the action
    // answered 200 for a member who was now the owner.
    if (outcome.status === 200)
      assert.equal(stored?.role, 'viewer', `${dialect}: reported success but the row holds ${stored?.role}`)
    assert.notEqual(stored?.role, 'viewer', `${dialect}: our write landed over a concurrent ownership transfer (competitor: ${competitor.output().trim()})`)

    // On the server dialects the lock makes the outcome exact: our read waits
    // for the transfer to commit, sees the owner, and refuses before writing.
    if (dialect !== 'sqlite') {
      assert.equal(outcome.status, 409, `${dialect}: expected the locked read to see the owner, got ${outcome.status} ${JSON.stringify(outcome.body)}`)
      assert.match(outcome.body.message, /Transfer team ownership/)
      assert.equal(stored?.role, 'owner')
    }
    console.log(`  ${dialect} concurrent transfer: ${outcome.status} ${JSON.stringify(outcome.body)} | stored ${stored?.role} | competitor ${competitor.output().trim().replace(/\s+/g, ' ')}`)
  })

  assert.deepEqual(failures, [], `${dialect}: team state writes must not read an affected-row count as the verdict`)
  console.log('team state writes OK')
}
finally { resetDatabaseConnection() }
