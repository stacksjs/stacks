// One server of the onOneServer() slot test (stacksjs/stacks#3152). Two of
// these share one database, each with its own lock directory, the way two
// hosts would.
//
// tick:   the clock is shifted so the next minute is 150 ms away, and the
//         live timer fires the task for that slot.
// missed: the clock is 30 s past the slot, and runMissed() replays the three
//         slots since three minutes before it.
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const mode = process.env.ONE_SERVER_MODE
const server = process.env.ONE_SERVER_NAME!
const task = process.env.ONE_SERVER_TASK!
const slot = Number(process.env.ONE_SERVER_SLOT)
assert(mode === 'tick' || mode === 'missed')
assert(/^[AB]$/.test(server) && /^[\w-]+$/.test(task) && slot % 60_000 === 0)
assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))

const dialect = process.env.DB_CONNECTION as 'postgres' | 'mysql'
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: { [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } },
  queryLogging: { enabled: false },
} })

const { Schedule } = await import('../../src/schedule')
;(Schedule as unknown as { lockDir: string }).lockDir = mkdtempSync(join(tmpdir(), 'one-server-locks-'))

// Shifted after the imports, which take longer than the 150 ms lead on a
// loaded CI runner: shifted first, the slot had passed by the time the
// schedule started, and the next tick was a minute away.
const realNow = Date.now.bind(Date)
const shift = (mode === 'tick' ? slot - 150 : slot + 30_000) - realNow()
Date.now = () => realNow() + shift

const schedule = new Schedule(async () => {
  await db.unsafe(`INSERT INTO runs (server) VALUES ('${server}')`).execute()
  console.log(`server ${server} ran ${task}`)
}).withName(task).everyMinute().onOneServer().withErrorHandler((error) => {
  console.log(`server ${server} failed: ${error.stack ?? error.message}`)
})

if (mode === 'tick') {
  await Promise.resolve()
  const next = Schedule.listJobs().find(job => job.name === task)?.nextRun
  console.log(`server ${server} next run ${next?.toISOString() ?? 'none'} for slot ${new Date(slot).toISOString()}`)
  await Bun.sleep(3000)
}
else {
  await Promise.resolve()
  console.log(`fired ${await schedule.runMissed({ since: slot - 3 * 60_000 })}`)
}
console.log(`server ${server} done`)
process.exit(0)
