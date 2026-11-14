import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { persistGeneratedMigrations } from '../src/migrations'
import { databaseExtensionStatements } from '../src/model-extensions'

describe('model-owned database extension prerequisites', () => {
  test('PostgreSQL emits the reviewed prerequisite once, including wrapped ORM models', () => {
    const wrapped = Object.assign(() => {}, { [Symbol.for('stacks.orm.modelDefinition')]: { databaseExtensions: ['vector'] } })
    expect(databaseExtensionStatements([{ databaseExtensions: ['vector'] }, wrapped], 'postgres')).toEqual(['CREATE EXTENSION IF NOT EXISTS vector'])
  })
  test('portable SQLite and MySQL models never receive Postgres extension SQL', () => {
    expect(databaseExtensionStatements([{ databaseExtensions: ['vector'] }], 'sqlite')).toEqual([])
    expect(databaseExtensionStatements([{ databaseExtensions: ['vector'] }], 'mysql')).toEqual([])
    expect(databaseExtensionStatements([{}], 'postgres')).toEqual([])
  })
  test('unknown names and malformed declarations fail before SQL is emitted', () => {
    expect(() => databaseExtensionStatements([{ databaseExtensions: ['vector; DROP TABLE users'] }], 'postgres')).toThrow('Unsupported')
    expect(() => databaseExtensionStatements([{ databaseExtensions: 'vector' }], 'postgres')).toThrow('array')
  })
})

test('persisted extension prerequisite precedes table and later view SQL, and a second generation is a no-op', () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-model-extensions-'))
  const previous = process.env.DB_MIGRATIONS_PATH
  process.env.DB_MIGRATIONS_PATH = directory
  try {
    const statements = [...databaseExtensionStatements([{ databaseExtensions: ['vector'] }], 'postgres'), 'CREATE TABLE documents (id INTEGER PRIMARY KEY, embedding TEXT)', 'CREATE VIEW published_documents AS SELECT id FROM documents']
    expect(persistGeneratedMigrations(statements)).toBe(3)
    const files = readdirSync(directory).sort()
    expect(files[0]).toEndWith('-create-database-extensions.sql')
    expect(readFileSync(join(directory, files[0]!), 'utf8')).not.toContain('CREATE VIEW')
    expect(files[1]).toEndWith('-create-documents-table.sql')
    expect(readFileSync(join(directory, files[2]!), 'utf8')).toContain('CREATE VIEW')
    expect(persistGeneratedMigrations(statements)).toBe(0)
    expect(readdirSync(directory).sort()).toEqual(files)
  }
  finally {
    if (previous === undefined) delete process.env.DB_MIGRATIONS_PATH
    else process.env.DB_MIGRATIONS_PATH = previous
    rmSync(directory, { recursive: true, force: true })
  }
})
