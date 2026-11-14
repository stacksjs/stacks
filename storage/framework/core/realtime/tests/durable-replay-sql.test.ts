import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSqlDurableReplayStore } from '../src/durable-replay-sql'

// Real SQL from the native model generator. No handwritten/runtime schema.
test('SQL append/replay persists sequence and scope independently of process-local stores', async () => {
  const database = new Database(':memory:')
  const corpus = resolve(import.meta.dir, 'fixtures/replay-app/database/migrations')
  for (const file of readdirSync(corpus).filter(name => name.endsWith('.sql')).sort()) database.exec(readFileSync(resolve(corpus, file), 'utf8'))
  const connection = { dialect: 'sqlite' as const, tables: { channels: 'replay_channels', events: 'replay_events' }, scope: { workspace_id: 1, project_id: 1 }, transaction: async <T>(work: (query: (sql: string, values: unknown[]) => Record<string, unknown>[]) => Promise<T>) => {
    database.exec('BEGIN IMMEDIATE')
    try { const result = await work((sql, values) => database.query(sql).all(...values as any[]) as Record<string, unknown>[]); database.exec('COMMIT'); return result }
    catch (error) { database.exec('ROLLBACK'); throw error }
  } }
  try {
    const first = await createSqlDurableReplayStore(connection).append({ channel: 'private-order.1', event: 'created', data: { id: 5 }, idempotencyKey: 'once' })
    const restarted = createSqlDurableReplayStore(connection)
    expect((await restarted.append({ channel: 'private-order.1', event: 'created', data: { id: 5 }, idempotencyKey: 'once' })).duplicate).toBe(true)
    const second = await restarted.append({ channel: 'private-order.1', event: 'updated', data: { id: 5 }, idempotencyKey: 'twice' })
    expect(second.message.seq).toBe(first.message.seq + 1)
    expect((await restarted.replay({ channel: 'private-order.1', after: first.cursor })).messages.map(message => message.event)).toEqual(['updated'])
    const foreign = createSqlDurableReplayStore({ ...connection, scope: { workspace_id: 2, project_id: 2 } })
    expect((await foreign.replay({ channel: 'private-order.1', after: null })).messages).toEqual([])
    expect((await foreign.replay({ channel: 'private-order.1', after: second.cursor })).gap).toBe('incarnation')
    database.query('DELETE FROM replay_events WHERE seq = 1 AND workspace_id = 1').run()
    await expect(restarted.replay({ channel: 'private-order.1', after: null })).rejects.toMatchObject({ code: 'replay_storage_gap' })
  }
  finally { database.close() }
})
