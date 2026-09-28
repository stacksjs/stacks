import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * `countAppliedMigrations()` counts the ledger.
 *
 * It is how `buddy migrate` tells "applied N" from "nothing to migrate": the
 * migrate subprocess counts before and after and hands the difference to the
 * CLI. The count was a Kysely-style `select(eb => eb.fn.count('id'))`, which
 * bun-query-builder rejects, and the error was caught as "no migrations table
 * yet" - so every count was 0 and every run, including one that had just
 * applied two hundred migrations, ended "Nothing to migrate" (smakelo).
 *
 * Run in a child process so the connection it opens is the one it was told to.
 */
describe('countAppliedMigrations', () => {
  it('returns the number of recorded migrations, and 0 before the ledger exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'applied-count-'))
    try {
      const file = join(dir, 'ledger.sqlite')
      const db = new Database(file)
      db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration TEXT NOT NULL UNIQUE)')
      db.run(`INSERT INTO migrations (migration) VALUES ('0000000001-a.sql'), ('0000000002-b.sql'), ('0000000003-c.sql')`)
      db.close()

      const count = (path: string): string => {
        const result = Bun.spawnSync([process.execPath, '-e', `const { countAppliedMigrations } = await import('@stacksjs/database'); console.log('COUNT=' + await countAppliedMigrations()); process.exit(0)`], {
          cwd: join(import.meta.dir, '../../../../..'),
          env: { ...process.env, DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: path },
          stdout: 'pipe',
          stderr: 'pipe',
        })
        return `${result.stdout}`.match(/COUNT=(\d+)/)?.[1] ?? `no count: ${result.stderr}`
      }

      expect(count(file)).toBe('3')
      expect(count(join(dir, 'empty.sqlite'))).toBe('0')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
