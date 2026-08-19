import { describe, expect, it } from 'bun:test'
import { pantryDatabasePackage } from '../src/commands/setup'

describe('setup database dependencies', () => {
  it('pins PostgreSQL to the supported major', () => {
    expect(pantryDatabasePackage('postgres')).toEqual({
      name: 'postgresql.org',
      version: '^17.10',
      service: 'postgres',
    })
  })

  it('pins MySQL to a major too, because its data directory only upgrades', () => {
    // `*` would let an ordinary install move a live cluster to the next major,
    // which MySQL does in place and never undoes.
    expect(pantryDatabasePackage('mysql')).toEqual({
      name: 'mysql.com',
      version: '^9.2',
      service: 'mysql',
    })
  })

  it('returns the configured SQLite package', () => {
    expect(pantryDatabasePackage('sqlite')).toEqual({ name: 'sqlite.org', version: '^3.47.2' })
  })
})
