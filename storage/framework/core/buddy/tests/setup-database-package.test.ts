import { describe, expect, it } from 'bun:test'
import { pantryDatabasePackage } from '../src/commands/setup'

describe('setup database dependencies', () => {
  it('pins PostgreSQL to the supported major', () => {
    expect(pantryDatabasePackage('postgres')).toEqual({ name: 'postgresql.org', version: '^17.10' })
  })

  it('returns the configured SQLite package', () => {
    expect(pantryDatabasePackage('sqlite')).toEqual({ name: 'sqlite.org', version: '^3.47.2' })
  })
})
