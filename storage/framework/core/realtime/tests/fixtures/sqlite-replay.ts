import { Database, type SQLQueryBindings } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReplaySqlQuery, SqlDurableReplayOptions } from '../../src/durable-replay-sql'

export function sqliteReplayFixture(beforeCommit: () => Promise<void> = async () => {}) {
  const database = new Database(':memory:')
  database.exec('PRAGMA foreign_keys = ON')
  const corpus = resolve(import.meta.dir, 'replay-app/database/migrations')
  for (const file of readdirSync(corpus).filter(name => name.endsWith('.sql')).sort()) database.exec(readFileSync(resolve(corpus, file), 'utf8'))
  const connection: SqlDurableReplayOptions = { dialect: 'sqlite', tables: { channels: 'replay_channels', events: 'replay_events' }, scope: { workspace_id: 1, project_id: 1 }, transaction: async <T>(work: (query: ReplaySqlQuery) => Promise<T>) => {
    database.exec('BEGIN IMMEDIATE')
    try { const result = await work((sql, values) => database.query(sql).all(...values as SQLQueryBindings[]) as Record<string, unknown>[]); await beforeCommit(); database.exec('COMMIT'); return result }
    catch (error) { database.exec('ROLLBACK'); throw error }
  } }
  return { database, connection }
}
