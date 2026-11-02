import { getDatabaseDialect } from './utils'

/** Acquire SQLite's writer lock before reading; other providers reject sqliteMode. */
export function sqliteWriteOptions(dialect = getDatabaseDialect()): { sqliteMode?: 'immediate' } {
  return dialect === 'sqlite' ? { sqliteMode: 'immediate' } : {}
}
