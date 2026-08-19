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

  it('leaves the flat corpus to the dialect that wrote it', () => {
    // The incumbent's whole applied history lives there. Moving it to a
    // subdirectory because a second dialect appeared orphans every file in it,
    // and the runner then tries to create tables that already exist.
    const cwd = workspace()
    const flat = join(cwd, 'database', 'migrations')
    mkdirSync(flat, { recursive: true })
    writeFileSync(join(flat, '0000000001-create-users-table.sql'), 'CREATE TABLE IF NOT EXISTS "users" ("id" BIGSERIAL PRIMARY KEY);')

    const snapshots = join(cwd, 'storage', 'framework', 'database')
    mkdirSync(snapshots, { recursive: true })
    writeFileSync(join(snapshots, 'model-snapshot.postgres.json'), '{}')
    writeFileSync(join(snapshots, 'model-snapshot.mysql.json'), '{}')

    expect(resolveMigrationDirectory('postgres', { cwd })).toBe(flat)

    // And the newcomer still gets its own, which is what this whole function
    // is for: the two corpora are not interchangeable SQL.
    expect(resolveMigrationDirectory('mysql', { cwd })).toBe(join(flat, 'mysql'))
  })

  it('reads the owner off the corpus, so a MySQL-first project keeps its flat one too', () => {
    const cwd = workspace()
    const flat = join(cwd, 'database', 'migrations')
    mkdirSync(flat, { recursive: true })
    writeFileSync(join(flat, '0000000001-create-users-table.sql'), 'CREATE TABLE IF NOT EXISTS `users` (`id` bigint PRIMARY KEY);')

    const snapshots = join(cwd, 'storage', 'framework', 'database')
    mkdirSync(snapshots, { recursive: true })
    writeFileSync(join(snapshots, 'model-snapshot.mysql.json'), '{}')
    writeFileSync(join(snapshots, 'model-snapshot.postgres.json'), '{}')

    expect(resolveMigrationDirectory('mysql', { cwd })).toBe(flat)
    expect(resolveMigrationDirectory('postgres', { cwd })).toBe(join(flat, 'postgres'))
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
