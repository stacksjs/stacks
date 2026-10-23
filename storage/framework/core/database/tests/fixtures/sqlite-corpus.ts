import type { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Run each `.sql` file in `dir` once, in order - what the migration runner
 * does - and return the files that failed.
 *
 * A handful of committed files fail on prerequisites these in-memory harnesses
 * do not stand up (print_devices, notifications). They are unrelated to what
 * the harnesses assert, so a failure skips that file and carries on.
 *
 * A file that fails inside its own BEGIN leaves that transaction open. Bun
 * 1.4.2 let the next file's BEGIN through regardless; 1.4.4 rejects it, so
 * every later file failed too and the corpus silently stopped at the first
 * skip. Rolling back, as the file would have, keeps one skip to one file.
 */
export function applySqliteCorpus(db: Database, dir: string): string[] {
  const failed: string[] = []
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    try {
      db.exec(readFileSync(join(dir, file), 'utf8'))
    }
    catch {
      failed.push(file)
      if (db.inTransaction)
        db.exec('ROLLBACK')
    }
  }
  return failed
}
