import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * The dashboard moderates both places a comment can live.
 *
 * `comments` is the model-backed CMS table; `commentables` is the polymorphic
 * table the `commentable` trait writes (`post.addComment(...)`). The dashboard
 * used to read only the first, so every trait comment was invisible to the
 * one screen meant for moderating it. The tables number their rows
 * independently, which is the trap these tests are built around: comment 1
 * exists in both, and each write must reach only the table it names.
 *
 * Env is pinned before any import for the reason spelled out in
 * orm/tests/trait-instance-methods.test.ts: the first config load anywhere in
 * the process decides which database file every later query uses.
 */
const dir = mkdtempSync(join(tmpdir(), 'stacks-dashboard-comments-'))
const dbFile = join(dir, 'dashboard-comments.sqlite')
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = dbFile

const {
  acquireDbConfigLock,
  commentablesTableSql,
  db,
  ensureDatabaseConfigLoaded,
  initializeDbConfig,
  sqlHelpers,
} = await import('@stacksjs/database')

const actions = '../../storage/framework/defaults/app/Actions/Dashboard/Content'
const { default: CommentIndexAction } = await import(`${actions}/CommentIndexAction`)
const { default: CommentUpdateAction } = await import(`${actions}/CommentUpdateAction`)
const { default: CommentDestroyAction } = await import(`${actions}/CommentDestroyAction`)
const {
  commentableStatusFor,
  dashboardStatusForCommentable,
  isMissingTableError,
  isSafeTableName,
  parseCommentSource,
} = await import(`${actions}/comment-input`)

/** The slice of a request these actions read. */
function request(params: Record<string, unknown>, input: Record<string, unknown> = {}): any {
  return {
    getParam: (key: string) => params[key],
    get: (key: string) => input[key],
  }
}

async function json(result: unknown): Promise<any> {
  return result instanceof Response ? await result.json() : result
}

const run = (sql: string, ...params: unknown[]) => (db as any).unsafe(sql, params).execute()
const one = async (sql: string, ...params: unknown[]) => ((await (db as any).unsafe(sql, params).execute()) as any[])[0]

describe('dashboard comment moderation covers commentable-trait comments', () => {
  let release: () => void

  beforeAll(async () => {
    release = await acquireDbConfigLock()
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'testing' },
      database: {
        default: 'sqlite',
        connections: { sqlite: { database: dbFile, prefix: '' }, mysql: {}, postgres: {} },
      },
    })

    await run(`CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)`)
    await run(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`)
    await run(`CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, author_name TEXT, author_email TEXT, content TEXT, body TEXT,
      post_title TEXT, status TEXT DEFAULT 'pending', is_approved INTEGER DEFAULT 0,
      created_at TEXT, updated_at TEXT
    )`)
    await run(commentablesTableSql(sqlHelpers('sqlite')))
  })

  afterAll(() => {
    release?.()
    rmSync(dir, { recursive: true, force: true })
  })

  it('lists both tables newest first, with a key and source that tell overlapping ids apart', async () => {
    await run(`INSERT INTO posts (title) VALUES ('Both Halves')`)
    await run(`INSERT INTO products (name) VALUES ('Trail Shoe')`)
    await run(`INSERT INTO comments (author_name, author_email, content, post_title, status, created_at)
      VALUES ('Legacy Reader', 'legacy@example.com', 'From the CMS form', 'Old Post', 'approved', '2026-09-20 10:00:00')`)
    await run(`INSERT INTO commentables (title, body, status, commentables_id, commentables_type, author_name, author_email, created_at)
      VALUES ('', 'On the post', 'approved', 1, 'posts', 'Ada', 'ada@example.com', '2026-09-26T09:00:00')`)
    await run(`INSERT INTO commentables (title, body, status, commentables_id, commentables_type, user_id, created_at)
      VALUES ('Fit', 'On the product', 'rejected', 1, 'products', 7, '2026-09-21T12:00:00')`)
    await run(`INSERT INTO commentables (title, body, status, commentables_id, commentables_type, created_at)
      VALUES ('', 'On something unknown', 'pending', 5, 'no_such_table', '2026-09-19T08:00:00')`)

    const { comments } = await json(await CommentIndexAction.handle())

    expect(comments.map((c: any) => c.key)).toEqual(['commentables:1', 'commentables:2', 'comments:1', 'commentables:3'])

    const [post, product, legacy, orphan] = comments
    expect(post).toMatchObject({
      source: 'commentables',
      id: 1,
      author_name: 'Ada',
      author_email: 'ada@example.com',
      content: 'On the post',
      post_title: 'Both Halves',
      status: 'approved',
      is_approved: true,
    })
    // A signed-in commenter has no guest name, the trait's `rejected` reads as
    // spam, and a title the caller gave is kept with the body.
    expect(product).toMatchObject({ author_name: 'User #7', post_title: 'Trail Shoe', status: 'spam', content: 'Fit\n\nOn the product' })
    expect(legacy).toMatchObject({ source: 'comments', id: 1, author_name: 'Legacy Reader', post_title: 'Old Post', status: 'approved' })
    // An owner type that is not a table does not fail the list.
    expect(orphan).toMatchObject({ post_title: 'no_such_table #5', status: 'pending' })
  })

  it('moderates a trait comment without touching the CMS comment that shares its id', async () => {
    const spam = await json(await CommentUpdateAction.handle(request({ id: '1' }, { status: 'spam', source: 'commentables' })))
    expect(spam).toMatchObject({ key: 'commentables:1', source: 'commentables', status: 'spam' })

    let trait = await one(`SELECT * FROM commentables WHERE id = 1`)
    expect(trait.status).toBe('rejected')
    expect(Number(trait.rejected_at)).toBeGreaterThan(0)
    expect(trait.approved_at).toBeNull()

    // Trash has nowhere else to go in the trait's vocabulary.
    const trash = await json(await CommentUpdateAction.handle(request({ id: '1' }, { status: 'trash', source: 'commentables' })))
    expect(trash.status).toBe('spam')

    const approved = await json(await CommentUpdateAction.handle(request({ id: '1' }, { status: 'approved', source: 'commentables' })))
    expect(approved.status).toBe('approved')
    trait = await one(`SELECT * FROM commentables WHERE id = 1`)
    expect(trait.status).toBe('approved')
    expect(Number(trait.approved_at)).toBeGreaterThan(0)
    expect(trait.rejected_at).toBeNull()

    const legacy = await one(`SELECT * FROM comments WHERE id = 1`)
    expect(legacy.status).toBe('approved')
    expect(legacy.content).toBe('From the CMS form')
  })

  it('still moderates the CMS table when no source is sent', async () => {
    await json(await CommentUpdateAction.handle(request({ id: '1' }, { status: 'trash' })))

    expect((await one(`SELECT status, is_approved FROM comments WHERE id = 1`))).toMatchObject({ status: 'trash', is_approved: 0 })
    expect((await one(`SELECT status FROM commentables WHERE id = 1`)).status).toBe('approved')
  })

  it('deletes from the table the source names, and only that one', async () => {
    const deleted = await json(await CommentDestroyAction.handle(request({ id: '1' }, { source: 'commentables' })))
    expect(deleted).toMatchObject({ id: 1, source: 'commentables' })

    expect(await one(`SELECT id FROM commentables WHERE id = 1`)).toBeUndefined()
    expect(await one(`SELECT id FROM comments WHERE id = 1`)).toBeDefined()

    const missing = await CommentDestroyAction.handle(request({ id: '1' }, { source: 'commentables' })) as Response
    expect(missing.status).toBe(404)
  })

  it('rejects a source it does not know instead of guessing a table', async () => {
    const update = await CommentUpdateAction.handle(request({ id: '1' }, { status: 'approved', source: 'users' })) as Response
    expect(update.status).toBe(422)

    const destroy = await CommentDestroyAction.handle(request({ id: '1' }, { source: 'users' })) as Response
    expect(destroy.status).toBe(422)
  })

  it('lists no trait comments, rather than failing, when the trait table was never migrated', async () => {
    await run(`DROP TABLE commentables`)

    const { comments } = await json(await CommentIndexAction.handle())
    expect(comments.map((c: any) => c.key)).toEqual(['comments:1'])

    await run(commentablesTableSql(sqlHelpers('sqlite')))
  })
})

describe('dashboard comment input', () => {
  it('reads an absent source as the CMS table and refuses anything else', () => {
    expect(parseCommentSource(undefined)).toBe('comments')
    expect(parseCommentSource('')).toBe('comments')
    expect(parseCommentSource('Commentables')).toBe('commentables')
    expect(parseCommentSource('posts')).toBeUndefined()
  })

  it('maps between the dashboard statuses and the trait statuses', () => {
    expect(commentableStatusFor('approved')).toBe('approved')
    expect(commentableStatusFor('pending')).toBe('pending')
    expect(commentableStatusFor('spam')).toBe('rejected')
    expect(commentableStatusFor('trash')).toBe('rejected')

    expect(dashboardStatusForCommentable('approved')).toBe('approved')
    expect(dashboardStatusForCommentable('rejected')).toBe('spam')
    expect(dashboardStatusForCommentable('pending')).toBe('pending')
    expect(dashboardStatusForCommentable('something else')).toBe('pending')
  })

  it('only treats plain identifiers as owner tables', () => {
    expect(isSafeTableName('posts')).toBe(true)
    expect(isSafeTableName('blog_posts')).toBe(true)
    expect(isSafeTableName('posts; DROP TABLE users')).toBe(false)
    expect(isSafeTableName('"posts"')).toBe(false)
    expect(isSafeTableName('')).toBe(false)
  })

  it('tells a missing table from a missing column', () => {
    expect(isMissingTableError(new Error('no such table: commentables'))).toBe(true)
    expect(isMissingTableError(new Error(`Table 'app.commentables' doesn't exist`))).toBe(true)
    expect(isMissingTableError(new Error('relation "commentables" does not exist'))).toBe(true)
    expect(isMissingTableError(new Error('column "author_name" does not exist'))).toBe(false)
    expect(isMissingTableError(new Error('no such column: author_name'))).toBe(false)
  })
})
