// stacksjs/stacks#2951 - a factory that references another row, seeded for
// real into an in-memory SQLite database.
//
// Must pin DB_CONNECTION/DB_DATABASE_PATH before importing src/utils; see
// seeder-accounts.test.ts. Restored in afterAll.

const originalDbConnection = process.env.DB_CONNECTION
const originalDbDatabasePath = process.env.DB_DATABASE_PATH
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let releaseDbConfigLock: () => void
const scratch = mkdtempSync(join(tmpdir(), 'stacks-seeder-pick-'))

afterAll(() => {
  if (originalDbConnection === undefined) delete process.env.DB_CONNECTION
  else process.env.DB_CONNECTION = originalDbConnection
  if (originalDbDatabasePath === undefined) delete process.env.DB_DATABASE_PATH
  else process.env.DB_DATABASE_PATH = originalDbDatabasePath
  rmSync(scratch, { recursive: true, force: true })
  releaseDbConfigLock?.()
})

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../src/utils')
const { seed } = await import('../src/seeder')

const TABLES = [
  'CREATE TABLE issues (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)',
  'CREATE TABLE pull_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)',
  // Polymorphic: `subject_type` names the table `subject_id` indexes, so no
  // foreign key can describe it.
  'CREATE TABLE reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, emoji TEXT, subject_type TEXT NOT NULL, subject_id INTEGER NOT NULL)',
  'CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT, issue_id INTEGER NOT NULL)',
  'CREATE TABLE timeline_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL)',
]

const ISSUE = (extra = '') => `export default {
  name: 'Issue', table: 'issues',
  traits: { useSeeder: { count: 4${extra} } },
  attributes: { title: { factory: faker => faker.lorem.words(3) } },
}`
const PULL_REQUEST = `export default {
  name: 'PullRequest', table: 'pull_requests',
  traits: { useSeeder: { count: 3 } },
  attributes: { title: { factory: faker => faker.lorem.words(3) } },
}`

function models(files: Record<string, string>): string {
  const dir = mkdtempSync(join(scratch, 'models-'))
  mkdirSync(dir, { recursive: true })
  for (const [file, source] of Object.entries(files))
    writeFileSync(join(dir, file), source)
  return dir
}

async function rows(table: string): Promise<Record<string, any>[]> {
  return await db.selectFrom(table).selectAll().execute() as Record<string, any>[]
}

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } } } })
})

beforeEach(async () => {
  for (const table of ['timeline_entries', 'comments', 'reactions', 'pull_requests', 'issues'])
    await db.unsafe(`DROP TABLE IF EXISTS ${table}`).execute()
  for (const statement of TABLES)
    await db.unsafe(statement).execute()
})

describe('a factory that picks an existing row (stacksjs/stacks#2951)', () => {
  it('seeds a polymorphic reference that points at a row of the type it names', async () => {
    const modelsDir = models({
      'Reaction.ts': `export default {
        name: 'Reaction', table: 'reactions',
        traits: { useSeeder: { count: 12, after: ['Issue', 'PullRequest'] } },
        attributes: {
          emoji: { factory: faker => faker.helpers.arrayElement(['+1', 'heart']) },
          subjectType: { required: true, factory: faker => faker.helpers.arrayElement(['Issue', 'PullRequest']) },
          subjectId: { required: true, factory: (faker, { subjectType }, { pick }) => pick(subjectType) },
        },
      }`,
      'Issue.ts': ISSUE(),
      'PullRequest.ts': PULL_REQUEST,
    })

    const summary = await seed({ modelsDir, verbose: false, fresh: true })
    expect(summary.results.filter(r => !r.success)).toEqual([])

    const ids = {
      Issue: new Set((await rows('issues')).map(row => row.id)),
      PullRequest: new Set((await rows('pull_requests')).map(row => row.id)),
    }
    const reactions = await rows('reactions')
    expect(reactions).toHaveLength(12)
    for (const reaction of reactions)
      expect(ids[reaction.subject_type as 'Issue' | 'PullRequest'].has(reaction.subject_id)).toBe(true)
  })

  it('refuses a pick from a model that seeds later, and says how to order it', async () => {
    // Issue is ordered after Comment, so Comment's pick runs too early.
    const modelsDir = models({
      'Comment.ts': `export default {
        name: 'Comment', table: 'comments',
        traits: { useSeeder: { count: 3 } },
        attributes: {
          body: { factory: faker => faker.lorem.sentence() },
          issueId: { required: true, factory: (faker, attrs, { pick }) => pick('Issue') },
        },
      }`,
      'Issue.ts': ISSUE(`, after: ['Comment']`),
    })

    const summary = await seed({ modelsDir, verbose: false, fresh: true })
    const comment = summary.results.find(r => r.model === 'Comment')!
    expect(comment.success).toBe(false)
    expect(comment.error).toContain('seeds later in this run')
    expect(comment.error).toContain(`Add 'Issue' to Comment's useSeeder.after`)
    expect(await rows('comments')).toHaveLength(0)
  })

  it('refuses a pick from an empty table instead of inventing a value', async () => {
    const modelsDir = models({
      'Comment.ts': `export default {
        name: 'Comment', table: 'comments',
        traits: { useSeeder: { count: 3 } },
        attributes: { issueId: { required: true, factory: (faker, attrs, { pick }) => pick('Issue') } },
      }`,
    })

    const summary = await seed({ modelsDir, verbose: false, fresh: true })
    expect(summary.results[0]!.success).toBe(false)
    expect(summary.results[0]!.error).toContain('issues has no rows')
  })

  it('names the model and column when a factory leaves a required column null', async () => {
    const modelsDir = models({
      'TimelineEntry.ts': `export default {
        name: 'TimelineEntry', table: 'timeline_entries',
        traits: { useSeeder: { count: 3 } },
        attributes: { subjectId: { required: true, factory: () => null } },
      }`,
    })

    const summary = await seed({ modelsDir, verbose: false, fresh: true })
    expect(summary.results[0]!.success).toBe(false)
    expect(summary.results[0]!.error).toContain('TimelineEntry.subjectId: its factory produced null for a required column')
    expect(await rows('timeline_entries')).toHaveLength(0)
  })
})
