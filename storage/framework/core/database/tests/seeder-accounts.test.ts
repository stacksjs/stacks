// stacksjs/stacks#2861 - account foreign keys and composite unique indexes,
// seeded for real into an in-memory SQLite database.
//
// Must pin DB_CONNECTION/DB_DATABASE_PATH before importing src/utils: the
// @stacksjs/env proxy reads process.env lazily and getDb() snapshots the
// connection config on first access. Restored in afterAll so the override
// cannot leak into sibling test files in the same bun process.

const originalDbConnection = process.env.DB_CONNECTION
const originalDbDatabasePath = process.env.DB_DATABASE_PATH
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let releaseDbConfigLock: () => void
const modelsDir = mkdtempSync(join(tmpdir(), 'stacks-seeder-accounts-'))

afterAll(() => {
  if (originalDbConnection === undefined) delete process.env.DB_CONNECTION
  else process.env.DB_CONNECTION = originalDbConnection
  if (originalDbDatabasePath === undefined) delete process.env.DB_DATABASE_PATH
  else process.env.DB_DATABASE_PATH = originalDbDatabasePath
  rmSync(modelsDir, { recursive: true, force: true })
  releaseDbConfigLock?.()
})

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../src/utils')
const { seed, uniqueColumnSets } = await import('../src/seeder')

/**
 * The shape of the app the issue was found in, cut down: accounts, a child
 * that belongs to one (NOT NULL), one that belongs to one optionally, a
 * membership whose pair is unique, and a one-to-one.
 */
const MODELS: Record<string, string> = {
  'User.ts': `export default {
    name: 'User', table: 'users',
    traits: { useSeeder: { count: 4 } },
    attributes: {
      name: { factory: faker => faker.person.fullName() },
      email: { unique: true, factory: faker => faker.internet.email() },
    },
  }`,
  'Team.ts': `export default {
    name: 'Team', table: 'teams',
    traits: { useSeeder: { count: 3 } },
    attributes: { name: { unique: true, factory: faker => faker.company.name() } },
  }`,
  'Repository.ts': `export default {
    name: 'Repository', table: 'repositories',
    traits: { useSeeder: { count: 3 } },
    attributes: { name: { factory: faker => faker.lorem.word() } },
  }`,
  'Star.ts': `export default {
    name: 'Star', table: 'stars',
    traits: { useSeeder: { count: 8 } },
    belongsTo: [{ model: 'Repository', onDelete: 'cascade' }, 'User'],
    attributes: { note: { factory: faker => faker.lorem.word() } },
  }`,
  'Issue.ts': `export default {
    name: 'Issue', table: 'issues',
    traits: { useSeeder: { count: 10 } },
    belongsTo: ['Repository', { model: 'User', foreignKey: 'author_id' }],
    attributes: { title: { factory: faker => faker.lorem.sentence() } },
  }`,
  'TeamMember.ts': `export default {
    name: 'TeamMember', table: 'team_members',
    traits: { useSeeder: { count: 30 } },
    belongsTo: ['Team', 'User'],
    indexes: [{ name: 'team_members_team_user_unique', columns: ['teamId', 'user_id'], unique: true }],
    attributes: { role: { factory: () => 'member' } },
  }`,
  'Profile.ts': `export default {
    name: 'Profile', table: 'profiles',
    traits: { useSeeder: { count: 10 } },
    belongsTo: ['User'],
    attributes: {
      userId: { unique: true, factory: () => null },
      bio: { factory: faker => faker.lorem.sentence() },
    },
  }`,
}

const TABLES = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE)',
  'CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)',
  'CREATE TABLE repositories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)',
  'CREATE TABLE stars (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT, repository_id INTEGER NOT NULL REFERENCES repositories(id), user_id INTEGER NOT NULL REFERENCES users(id))',
  'CREATE TABLE issues (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, repository_id INTEGER REFERENCES repositories(id), author_id INTEGER REFERENCES users(id))',
  'CREATE TABLE team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL)',
  'CREATE UNIQUE INDEX team_members_team_user_unique ON team_members (team_id, user_id)',
  'CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, bio TEXT, user_id INTEGER UNIQUE)',
]

async function rows(table: string): Promise<Record<string, any>[]> {
  return await db.selectFrom(table).selectAll().execute() as Record<string, any>[]
}

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })

  for (const [file, source] of Object.entries(MODELS))
    writeFileSync(join(modelsDir, file), source)
})

beforeEach(async () => {
  for (const table of ['profiles', 'team_members', 'issues', 'stars', 'repositories', 'teams', 'users'])
    await db.unsafe(`DROP TABLE IF EXISTS ${table}`).execute()
  for (const statement of TABLES)
    await db.unsafe(statement).execute()
})

describe('account foreign keys (stacksjs/stacks#2861)', () => {
  it('points at the accounts the same run seeded, on a fresh seed', async () => {
    const summary = await seed({ modelsDir, verbose: false, fresh: true })

    expect(summary.failed).toBe(0)

    const users = new Set((await rows('users')).map(user => user.id))
    expect(users.size).toBe(4)

    // NOT NULL: used to fail the insert and leave the table empty.
    const stars = await rows('stars')
    expect(stars).toHaveLength(8)
    for (const star of stars)
      expect(users.has(star.user_id)).toBe(true)

    // Nullable: used to succeed with every author null.
    const issues = await rows('issues')
    expect(issues).toHaveLength(10)
    for (const issue of issues) {
      expect(users.has(issue.author_id)).toBe(true)
      expect(issue.repository_id).not.toBeNull()
    }
  })

  it('never points at an account that was there before the run', async () => {
    await db.unsafe(`INSERT INTO users (id, name, email) VALUES (1, 'A real person', 'real@example.com')`).execute()

    const summary = await seed({ modelsDir, verbose: false, append: true })
    expect(summary.failed).toBe(0)

    const seeded = (await rows('users')).filter(user => user.id !== 1).map(user => user.id)
    expect(seeded).toHaveLength(4)

    for (const issue of await rows('issues')) {
      expect(issue.author_id).not.toBe(1)
      expect(seeded).toContain(issue.author_id)
    }
    for (const star of await rows('stars'))
      expect(star.user_id).not.toBe(1)
  })

  it('leaves the key empty when no account was seeded, rather than borrowing one', async () => {
    await db.unsafe(`INSERT INTO users (id, name, email) VALUES (1, 'A real person', 'real@example.com')`).execute()

    // Not fresh, not append: the users table has a row, so User is skipped.
    await seed({ modelsDir, verbose: false })

    const issues = await rows('issues')
    expect(issues).toHaveLength(10)
    for (const issue of issues)
      expect(issue.author_id).toBeNull()
  })

  it('uses existing accounts when told the database is a scratch copy', async () => {
    await db.unsafe(`INSERT INTO users (id, name, email) VALUES (1, 'A fixture from last time', 'old@example.com')`).execute()

    await seed({ modelsDir, verbose: false, attachAccounts: true })

    const issues = await rows('issues')
    expect(issues).toHaveLength(10)
    for (const issue of issues)
      expect(issue.author_id).toBe(1)
  })

  it('no longer needs --allow-protected for any of it', async () => {
    const summary = await seed({ modelsDir, verbose: false, fresh: true, allowProtected: false })
    expect(summary.failed).toBe(0)
    expect(await rows('stars')).toHaveLength(8)
  })
})

describe('composite unique indexes (stacksjs/stacks#2861)', () => {
  it('never repeats a pair, and seeds only as many rows as distinct pairs exist', async () => {
    const summary = await seed({ modelsDir, verbose: false, fresh: true })

    const memberships = summary.results.find(result => result.model === 'TeamMember')!
    expect(memberships.success).toBe(true)

    const members = await rows('team_members')
    const pairs = new Set(members.map(member => `${member.team_id}:${member.user_id}`))

    // 3 teams x 4 users: asked for 30, only 12 can exist.
    expect(members).toHaveLength(12)
    expect(pairs.size).toBe(12)
  })

  it('treats a unique foreign key as a one-to-one', async () => {
    await seed({ modelsDir, verbose: false, fresh: true })

    const profiles = await rows('profiles')
    expect(profiles).toHaveLength(4)
    expect(new Set(profiles.map(profile => profile.user_id)).size).toBe(4)
  })

  it('reads model-level unique indexes in either spelling', () => {
    const sets = uniqueColumnSets({
      model: {
        name: 'TeamMember',
        belongsTo: ['Team', 'User'],
        indexes: [
          { name: 'a', columns: ['teamId', 'user_id'], unique: true },
          { name: 'b', columns: ['role'] },
        ],
      } as any,
      attributes: {},
    })

    expect(sets).toEqual([['team_id', 'user_id']])
  })
})
