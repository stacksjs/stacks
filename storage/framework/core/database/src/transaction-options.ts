import { getDatabaseDialect } from './utils'

/** Acquire SQLite's writer lock before reading; other providers reject sqliteMode. */
export function sqliteWriteOptions(dialect: ReturnType<typeof getDatabaseDialect> = getDatabaseDialect()): { sqliteMode?: 'immediate' } {
  return dialect === 'sqlite' ? { sqliteMode: 'immediate' } : {}
}

/**
 * Use statement snapshots for short operations whose locks serialize writers.
 * MySQL cannot change isolation inside Bun's transaction callback; SQLite
 * instead reserves its sole writer. Savepoints inherit the parent's isolation.
 */
export function readCommittedTransactionOptions(dialect: ReturnType<typeof getDatabaseDialect> = getDatabaseDialect()): { isolation?: 'read committed' | 'serializable', sqliteMode?: 'immediate' } {
  if (dialect === 'postgres') return { isolation: 'read committed' }
  if (dialect === 'sqlite') return { isolation: 'serializable', sqliteMode: 'immediate' }
  // Explicitly clear a configured isolation override that Bun cannot apply.
  return { isolation: undefined }
}
