import { describe, expect, it } from 'bun:test'
import { createdTableName, generatedStatementIsRedundant, indexCommittedMigrations } from '../src/migrations'

describe('createdTableName', () => {
  it('reads the table out of every spelling a corpus uses', () => {
    expect(createdTableName('CREATE TABLE notification_deliveries (id INTEGER)')).toBe('notification_deliveries')
    expect(createdTableName('CREATE TABLE IF NOT EXISTS "notifications" (id INTEGER)')).toBe('notifications')
    expect(createdTableName('  create table `team_members` (id INTEGER)')).toBe('team_members')
    expect(createdTableName('CREATE TABLE [releases] (id INTEGER)')).toBe('releases')
  })

  it('is not fooled by a statement that merely mentions a table', () => {
    expect(createdTableName('ALTER TABLE releases ADD COLUMN tag TEXT')).toBeUndefined()
    expect(createdTableName('UPDATE notification_deliveries SET channel = \'email\'')).toBeUndefined()
    expect(createdTableName('CREATE INDEX idx_releases_tag ON releases (tag)')).toBeUndefined()
  })
})

describe('generatedStatementIsRedundant', () => {
  it('skips a CREATE for a table the corpus already creates, however it is written', () => {
    // The #2323 case. The committed file and the generator do not have to
    // agree on whitespace, quoting, or column order for the table to already
    // exist, and a textual comparison wrote a second CREATE whenever they
    // differed by so much as a space.
    const index = indexCommittedMigrations([
      `CREATE TABLE notification_deliveries (\n  id INTEGER PRIMARY KEY,\n  channel TEXT\n);`,
    ])

    expect(generatedStatementIsRedundant(
      `CREATE TABLE IF NOT EXISTS "notification_deliveries" (id INTEGER PRIMARY KEY, channel TEXT, status TEXT)`,
      index,
    )).toBe(true)
  })

  it('still writes a CREATE for a table nothing has created', () => {
    const index = indexCommittedMigrations(['CREATE TABLE users (id INTEGER);'])

    expect(generatedStatementIsRedundant('CREATE TABLE teams (id INTEGER)', index)).toBe(false)
  })

  it('compares non-CREATE statements on their text, not their table', () => {
    // An ALTER or an UPDATE is only redundant if it is the same statement.
    // Matching those on the table name would drop every later change to a
    // table the corpus happens to create.
    const index = indexCommittedMigrations([
      'CREATE TABLE releases (id INTEGER);\nALTER TABLE releases ADD COLUMN tag TEXT;',
    ])

    expect(generatedStatementIsRedundant('ALTER TABLE releases ADD COLUMN tag TEXT', index)).toBe(true)
    expect(generatedStatementIsRedundant('ALTER TABLE releases ADD COLUMN channel TEXT', index)).toBe(false)
  })

  it('ignores whitespace differences on the statements it matches textually', () => {
    const index = indexCommittedMigrations(['ALTER TABLE  releases   ADD COLUMN tag TEXT;'])

    expect(generatedStatementIsRedundant('ALTER TABLE releases ADD COLUMN tag TEXT', index)).toBe(true)
  })

  it('treats an empty corpus as creating nothing', () => {
    const index = indexCommittedMigrations([])

    expect(index.createdTables.size).toBe(0)
    expect(generatedStatementIsRedundant('CREATE TABLE users (id INTEGER)', index)).toBe(false)
  })

  it('indexes every CREATE in a multi-statement file', () => {
    const index = indexCommittedMigrations([
      'CREATE TABLE a (id INTEGER);\nCREATE TABLE IF NOT EXISTS b (id INTEGER);\nALTER TABLE a ADD COLUMN x TEXT;',
    ])

    expect([...index.createdTables].sort()).toEqual(['a', 'b'])
  })
})
