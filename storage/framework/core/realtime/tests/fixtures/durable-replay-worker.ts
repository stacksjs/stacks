import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSqlDurableReplayStore } from '../../src/durable-replay-sql'
import type { ReplaySqlQuery } from '../../src/durable-replay-sql'

const [mode, serialized = '{}'] = process.argv.slice(2), input = JSON.parse(serialized)
const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
if (dialect === 'postgres' && (!process.env.DB_DATABASE?.startsWith('stacks_replay_') || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || ''))) throw new Error('Only the owned disposable replay PostgreSQL database is allowed')
if (dialect === 'sqlite' && !process.env.DB_DATABASE_PATH?.includes('stacks_replay_')) throw new Error('Only disposable replay SQLite is allowed')
const sqlite = dialect === 'sqlite' ? new Database(process.env.DB_DATABASE_PATH!) : undefined
if (sqlite) { sqlite.exec('PRAGMA busy_timeout = 15000'); sqlite.exec('PRAGMA foreign_keys = ON') }
const postgres = dialect === 'postgres' ? new SQL({ adapter: 'postgres', hostname: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, max: 1 }) : undefined
const query: ReplaySqlQuery = async (sql, values) => sqlite ? sqlite.query(sql).all(...values as any[]) as Record<string, unknown>[] : await postgres!.unsafe(sql, values)
async function boundary<T>(work: (query: ReplaySqlQuery) => Promise<T>): Promise<T> {
  async function execute(query: ReplaySqlQuery) {
    const result = await work(query)
    if (input.ready) {
      await Bun.write(input.ready, 'checkpoint locked')
      const deadline = Date.now() + 20000
      while (!existsSync(input.release)) { if (Date.now() > deadline) throw new Error('Replay fixture release timed out'); await Bun.sleep(5) }
    }
    if (mode === 'rollback') throw new Error('Intentional transaction rollback')
    return result
  }
  if (input.native) {
    const { db, ensureDatabaseConfigLoaded, resolvedDatabaseConfig } = await import('../../../database/src/runtime')
    await ensureDatabaseConfigLoaded()
    if (resolvedDatabaseConfig().driver !== dialect) throw new Error('Native replay fixture resolved the wrong application database driver')
    return await db.transaction(async tx => await execute(async (sql, values) => await tx.unsafe(sql, values).execute()), dialect === 'sqlite' ? { sqliteMode: 'immediate' } : undefined)
  }
  if (postgres) return await postgres.begin(async connection => await execute(async (sql, values) => await connection.unsafe(sql, values)))
  sqlite!.exec('BEGIN IMMEDIATE')
  try { const result = await execute(query); sqlite!.exec('COMMIT'); return result }
  catch (error) { sqlite!.exec('ROLLBACK'); throw error }
}
const store = createSqlDurableReplayStore({ dialect, transaction: boundary, scope: { workspace_id: input.workspace ?? 1, project_id: input.project ?? 1 }, tables: { channels: 'replay_channels', events: 'replay_events' }, ...(input.policy ?? {}), ...(input.now !== undefined ? { clock: () => input.now } : {}) })
try {
  if (input.started) await Bun.write(input.started, 'worker started')
  let result: unknown
  if (mode === 'migrate') {
    const corpus = resolve(import.meta.dir, 'replay-app/database/migrations', dialect === 'postgres' ? 'postgres' : '.')
    for (const file of readdirSync(corpus).filter(file => file.endsWith('.sql')).sort()) {
      const sql = readFileSync(resolve(corpus, file), 'utf8')
      if (sqlite) sqlite.exec(sql)
      else for (const statement of sql.split(';').map(item => item.trim()).filter(Boolean)) await postgres!.unsafe(statement)
    }
    result = { migrated: true }
  }
  else if (mode === 'read') result = await store.replay({ channel: input.channel ?? 'private-orders.1', after: input.after ?? null, limit: input.limit })
  else if (mode === 'prune') result = await store.prune(input.channel ?? 'private-orders.1')
  else if (mode === 'delete') { await query(dialect === 'postgres' ? 'DELETE FROM replay_channels WHERE workspace_id = $1 AND project_id = $2 AND name = $3' : 'DELETE FROM replay_channels WHERE workspace_id = ? AND project_id = ? AND name = ?', [input.workspace ?? 1, input.project ?? 1, input.channel ?? 'private-orders.1']); result = { deleted: true } }
  else {
    try { result = await store.append({ channel: input.channel ?? 'private-orders.1', event: input.event ?? 'changed', data: input.data ?? { operation: input.operation }, idempotencyKey: input.operation }) }
    catch (error) { if (mode !== 'rollback') throw error; result = { rolledBack: true } }
  }
  console.info(JSON.stringify(result))
}
finally { sqlite?.close(); await postgres?.close() }
