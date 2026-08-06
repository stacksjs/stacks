import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { validateMigrationDialect } from '../src/commands/migrate'

const created: string[] = []

afterEach(() => {
  for (const dir of created.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('migrate dialect corpus selection', () => {
  it('validates the Vitess corpus instead of the SQLite root corpus', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'stacks-migrate-dialect-'))
    created.push(cwd)
    const root = join(cwd, 'database', 'migrations')
    const vitess = join(root, 'vitess')
    mkdirSync(vitess, { recursive: true })
    writeFileSync(join(root, '0001-create-root.sql'), 'CREATE TABLE root (id INTEGER PRIMARY KEY AUTOINCREMENT);')
    writeFileSync(join(vitess, '0001-create-app.sql'), 'CREATE TABLE app (id BIGINT PRIMARY KEY AUTO_INCREMENT);')

    const previous = process.env.DB_CONNECTION
    const previousSharded = process.env.DB_VITESS_SHARDED
    process.env.DB_CONNECTION = 'vitess'
    process.env.DB_VITESS_SHARDED = 'false'
    try {
      expect(validateMigrationDialect(cwd)).toEqual({ valid: true })
    }
    finally {
      if (previous === undefined) delete process.env.DB_CONNECTION
      else process.env.DB_CONNECTION = previous
      if (previousSharded === undefined) delete process.env.DB_VITESS_SHARDED
      else process.env.DB_VITESS_SHARDED = previousSharded
    }
  })
})
