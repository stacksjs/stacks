import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_CAMPAIGN_TRANSITIONS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-campaign-transitions-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_campaign_transitions_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

// The campaigns table as the model defines it, for this dialect.
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const models = await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') })
const plan = buildMigrationPlan(models, { dialect })
plan.tables = plan.tables.filter(table => table.table === 'campaigns' || table.table === 'email_lists')
assert.deepEqual(plan.tables.map(table => table.table).sort(), ['campaigns', 'email_lists'])
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
const scratch = mkdtempSync(join(tmpdir(), 'stacks-campaign-transitions-sql-'))
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

const { CampaignStateConflictError, campaignDeliverySnapshot, campaigns } = await import('../../src/campaigns')
const { lists } = await import('../../src/lists')

async function seed(status: string, updatedAt: string | null, scheduledAt: string | null): Promise<number> {
  await db.insertInto('campaigns').values({
    uuid: crypto.randomUUID(), name: `campaign-${status}`, type: 'email', status,
    scheduled_at: scheduledAt, created_at: sqlDateTime(), updated_at: updatedAt,
  } as never).execute()
  const rows = await db.selectFrom('campaigns').selectAll().execute() as Array<{ id: number }>
  return Number(rows[rows.length - 1].id)
}

/** The updated_at the competing cancel writes, so its write is recognisable afterwards. */
const WINNER_UPDATED_AT = '2031-05-05 05:05:05'

/**
 * A second connection that cancels campaign `id` inside an open transaction,
 * says READY, holds the row for a moment, then commits.
 */
function competingCancel(id: number): { ready: Promise<void>, exited: Promise<number>, output: () => string } {
  const script = `
    const dialect = process.env.DB_CONNECTION
    const statement = "UPDATE campaigns SET status = 'cancelled', updated_at = '${WINNER_UPDATED_AT}' WHERE id = ${id}"
    if (dialect === 'sqlite') {
      const { Database } = await import('bun:sqlite')
      const handle = new Database(process.env.DB_DATABASE_PATH)
      handle.run('PRAGMA busy_timeout = 5000')
      handle.run('BEGIN IMMEDIATE')
      handle.run(statement)
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
        await tx.unsafe(statement)
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

  // The compare-and-set matches on the timestamps this snapshot carries, so
  // they have to come back in the format the column was written in. MySQL
  // hands these columns back as Date objects, and a stringified Date is not a
  // datetime any of these databases accept.
  await check('snapshot timestamps stay in the stored format', async () => {
    const id = await seed('scheduled', sqlDateTime(), sqlDateTime())
    const snapshot = campaignDeliverySnapshot(await campaigns.find(id))
    for (const [field, value] of [['updatedAt', snapshot.updatedAt], ['scheduledAt', snapshot.scheduledAt]] as const) {
      assert(value, `${field} should be present`)
      assert.match(value!, /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/, `${dialect}: ${field} is "${value}"`)
    }
  })

  await check('cancel a scheduled campaign that carries both timestamps', async () => {
    const id = await seed('scheduled', sqlDateTime(), sqlDateTime())
    const after = await campaigns.cancel(id)
    assert.equal((after as Record<string, unknown> | undefined)?.status, 'cancelled')
  })

  await check('cancel a campaign whose updated_at is null', async () => {
    const id = await seed('scheduled', null, sqlDateTime())
    await campaigns.cancel(id)
    const row = await db.selectFrom('campaigns').selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown>
    assert.equal(row.status, 'cancelled')
  })

  // The compare-and-set has to match the row it snapshotted and write the
  // target state onto it, leaving the rest of the row alone.
  await check('the transition writes the target state onto the matched row', async () => {
    const seeded = '2020-01-01T00:00:00.000'
    const scheduled = '2020-06-01T12:00:00.000'
    const id = await seed('scheduled', seeded, scheduled)
    await campaigns.cancel(id)
    const row = await db.selectFrom('campaigns').selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown>
    assert.equal(row.status, 'cancelled')
    assert.equal(campaignDeliverySnapshot(row).scheduledAt?.slice(0, 19), scheduled.slice(0, 19), 'scheduled_at is carried over unchanged')
    assert.notEqual(campaignDeliverySnapshot(row).updatedAt?.slice(0, 19), seeded.slice(0, 19), 'updated_at is stamped by the transition')
  })

  // sendNow, schedule and cancel all move a campaign through one compare-and-set,
  // transitionCampaignDelivery. These go through cancel because it is the one
  // that does not dispatch a job, not because the others are exempt: schedule()
  // re-submitted for the same time is the same no-op, and for sendNow the
  // concurrent case below is what would otherwise send a campaign twice.

  // stacksjs/stacks#2639. Cancelling a campaign that is already cancelled
  // writes the status, scheduled_at and (second-precision) updated_at it
  // already holds, so MySQL, which counts rows CHANGED, reported 0 and a double
  // click on "cancel" threw CampaignStateConflictError. The clock is frozen so
  // "the same second" is a fact rather than a race.
  const { setSystemTime } = await import('bun:test')
  setSystemTime(new Date('2030-01-02T03:04:05.000Z'))
  try {
    await check('cancelling twice within one second is not a conflict', async () => {
      const id = await seed('scheduled', sqlDateTime(), sqlDateTime())
      await campaigns.cancel(id)
      const again = await campaigns.cancel(id)
      assert.equal((again as Record<string, unknown> | undefined)?.status, 'cancelled', `${dialect}: the second cancel must succeed`)
    })
  }
  finally { setSystemTime() }

  // The other half. A transition that loses a race must be reported as a
  // conflict, never as its own success: for sendNow a false success is a
  // second SendCampaignJob, so a campaign goes out twice. Here a second
  // connection cancels first, inside an open transaction it holds while ours
  // runs. That is also why a zero count cannot simply be re-read and accepted
  // when the row "already holds the target": the winner's row holds it too.
  await check('a transition that loses a race is a conflict, not a success', async () => {
    const id = await seed('scheduled', sqlDateTime(new Date(Date.now() - 60_000)), sqlDateTime())
    const competitor = competingCancel(id)
    await competitor.ready
    let raised: unknown
    try { await campaigns.cancel(id) }
    catch (error) { raised = error }
    await competitor.exited
    const row = await db.selectFrom('campaigns').selectAll().where('id', '=', id).executeTakeFirst() as Record<string, unknown>

    assert(raised, `${dialect}: our cancel reported success after the competitor had already moved the campaign (competitor: ${competitor.output().trim()})`)
    // The conflict the caller can act on, on every dialect. A raw storage error
    // here is a regression too: wrapping SQLite's single UPDATE in a
    // transaction turns this into SQLITE_BUSY, which a caller maps to a 500.
    assert(raised instanceof CampaignStateConflictError, `${dialect}: expected CampaignStateConflictError, got ${String(raised)}`)
    assert.equal(row.status, 'cancelled')
    // Compared to the second: the dialects render the same instant with a T or
    // a space, and with or without milliseconds.
    assert.equal(campaignDeliverySnapshot(row).updatedAt?.slice(0, 19).replace('T', ' '), WINNER_UPDATED_AT, 'the winner\'s write stands')
    console.log(`  ${dialect} lost race: ${raised instanceof Error ? raised.name : String(raised)} | competitor ${competitor.output().trim().replace(/\s+/g, ' ')}`)
  })

  // lists.archive() reports how many lists it archived. Its SET is only
  // `status = 'archived'`, so archiving a list that is already archived
  // writes nothing new at any time of day, and MySQL, which counts rows
  // CHANGED, reported 0 where PostgreSQL and SQLite report 1 (#2639).
  await check('archiving an archived list still reports the list', async () => {
    await db.insertInto('email_lists').values({ name: `list-${dialect}`, slug: `list-${dialect}`, status: 'active' } as never).execute()
    const rows = await db.selectFrom('email_lists').selectAll().execute() as Array<{ id: number }>
    const id = Number(rows[rows.length - 1].id)
    assert.equal(await lists.archive(id), 1)
    assert.equal(await lists.archive(id), 1, `${dialect}: archiving an archived list must still report it`)
  })

  assert.deepEqual(failures, [], `${dialect}: campaign delivery transitions must run`)
  console.log('campaign transitions OK')
}
finally { resetDatabaseConnection() }
