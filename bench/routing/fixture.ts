/**
 * The SQLite fixture the `db-roundtrip` scenario reads.
 *
 * Built by the runner into `bench/routing/.tmp/`, never into the project's own
 * `database/stacks.sqlite`: a benchmark that writes to the development database
 * is a benchmark nobody runs twice.
 *
 * Both sides read the same file. Stacks reaches it through its own query
 * builder (with `DB_DATABASE_PATH` pointed here); the other servers open it
 * with `bun:sqlite` directly, because that is their idiomatic path — none of
 * them ships an ORM. That asymmetry is deliberate and is stated in the README
 * rather than hidden behind a per-framework adapter that would make the
 * comparison look tidier than it is.
 */

import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const FIXTURE_ROWS = 1000

export function createFixture(file: string): void {
  mkdirSync(dirname(file), { recursive: true })

  const db = new Database(file, { create: true })
  try {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('DROP TABLE IF EXISTS bench_items')
    db.exec('CREATE TABLE bench_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')

    // Match the built-in QueryLog model, including its write-side indexes.
    // Stock Stacks logs the SELECT; a missing table measures a failed INSERT.
    db.exec('DROP TABLE IF EXISTS query_logs')
    db.exec(`CREATE TABLE query_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      query TEXT NOT NULL,
      normalized_query TEXT,
      duration REAL DEFAULT 0,
      connection TEXT DEFAULT 'unknown',
      status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'slow')),
      error TEXT,
      executed_at TEXT NOT NULL,
      bindings TEXT,
      trace TEXT,
      model TEXT,
      method TEXT,
      file TEXT,
      line INTEGER,
      memory_usage REAL,
      rows_affected INTEGER,
      transaction_id TEXT,
      tags TEXT,
      affected_tables TEXT,
      indexes_used TEXT,
      missing_indexes TEXT,
      explain_plan TEXT,
      optimization_suggestions TEXT
    )`)
    db.exec('CREATE INDEX query_logs_executed_at_index ON query_logs (executed_at)')
    db.exec('CREATE INDEX query_logs_status_index ON query_logs (status)')
    db.exec('CREATE INDEX query_logs_duration_index ON query_logs (duration)')

    const insert = db.prepare('INSERT INTO bench_items (id, name) VALUES (?, ?)')
    const seed = db.transaction((count: number) => {
      for (let i = 1; i <= count; i++) insert.run(i, `item-${i}`)
    })
    seed(FIXTURE_ROWS)
  }
  finally {
    db.close()
  }
}

/** Reset accumulated diagnostics outside the timed workload, keeping seed rows. */
export function resetFixtureLogs(file: string): void {
  const db = new Database(file)
  try {
    db.exec('DELETE FROM query_logs')
    db.exec("DELETE FROM sqlite_sequence WHERE name = 'query_logs'")
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  }
  finally {
    db.close()
  }
}

/** Wait for the parity probe's asynchronous log write, outside measurement. */
export async function assertFixtureQueryLogged(file: string, timeoutMs = 2000): Promise<void> {
  const db = new Database(file, { readonly: true })
  try {
    const logged = db.query(`SELECT id FROM query_logs
      WHERE ltrim(query) LIKE 'SELECT %' AND query LIKE '%bench!_items%' ESCAPE '!'
        AND status IN ('completed', 'slow') AND error IS NULL LIMIT 1`)
    const deadline = performance.now() + timeoutMs
    while (!logged.get()) {
      if (performance.now() >= deadline)
        throw new Error(`Stacks benchmark SELECT was not persisted in query_logs within ${timeoutMs}ms. Check query logging configuration and the fixture.`)
      await Bun.sleep(10)
    }
  }
  finally {
    db.close()
  }
}

/** Verify warmup plus measured SELECTs after the load generator has stopped. */
export async function assertFixtureQueryCount(file: string, expected: number, timeoutMs = 2000): Promise<number> {
  if (!Number.isSafeInteger(expected) || expected < 0)
    throw new Error('Expected query count must be a non-negative safe integer')
  const db = new Database(file, { readonly: true })
  try {
    const logged = db.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM query_logs
      WHERE ltrim(query) LIKE 'SELECT %' AND query LIKE '%bench!_items%' ESCAPE '!'
        AND status IN ('completed', 'slow') AND error IS NULL`)
    const deadline = performance.now() + timeoutMs
    while (true) {
      const count = logged.get()!.count
      if (count === expected) return count
      if (count > expected || performance.now() >= deadline)
        throw new Error(`Stacks benchmark query logging mismatch: expected ${expected}, found ${count}. Every loaded SELECT must persist exactly once.`)
      await Bun.sleep(10)
    }
  }
  finally {
    db.close()
  }
}
