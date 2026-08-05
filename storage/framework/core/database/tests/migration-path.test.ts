import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { resolveMigrationDirectory } from '../src/migration-path'

const created: string[] = []

afterEach(() => {
  for (const dir of created.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-migration-path-'))
  created.push(dir)
  return dir
}

describe('dialect migration corpus paths', () => {
  it('keeps the legacy flat corpus for a single SQLite dialect', () => {
    const cwd = workspace()
    expect(resolveMigrationDirectory('sqlite', { cwd })).toBe(join(cwd, 'database', 'migrations'))
  })

  it('isolates a second dialect when another snapshot already exists', () => {
    const cwd = workspace()
    const snapshots = join(cwd, 'storage', 'framework', 'database')
    mkdirSync(snapshots, { recursive: true })
    writeFileSync(join(snapshots, 'model-snapshot.sqlite.json'), '{}')
    expect(resolveMigrationDirectory('vitess', { cwd })).toBe(join(cwd, 'database', 'migrations', 'vitess'))
  })

  it('continues using an existing dialect-specific corpus', () => {
    const cwd = workspace()
    const corpus = join(cwd, 'database', 'migrations', 'postgres')
    mkdirSync(corpus, { recursive: true })
    expect(resolveMigrationDirectory('postgres', { cwd })).toBe(corpus)
  })

  it('honours an explicit relative path', () => {
    const cwd = workspace()
    expect(resolveMigrationDirectory('mysql', { cwd, configured: 'schema/mysql' })).toBe(join(cwd, 'schema', 'mysql'))
  })

  it('lets the environment override the configured default', () => {
    const cwd = workspace()
    const previous = process.env.DB_MIGRATIONS_PATH
    process.env.DB_MIGRATIONS_PATH = 'schema/production'
    try {
      expect(resolveMigrationDirectory('vitess', { cwd, configured: 'database/migrations' }))
        .toBe(join(cwd, 'schema', 'production'))
    }
    finally {
      if (previous === undefined) delete process.env.DB_MIGRATIONS_PATH
      else process.env.DB_MIGRATIONS_PATH = previous
    }
  })
})
