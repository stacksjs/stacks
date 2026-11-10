/**
 * An author edit changes only the fields it sent (stacksjs/stacks#3010).
 *
 * Its own process, because `AuthorUpdateAction` reaches `Author` through the
 * ORM, the ORM loads a CMS model only while the feature is on, and CMS ships
 * off: the test runner's boot has already decided the models before a test
 * file could turn it on. Prints `author partial update: passed`.
 */
import assert from 'node:assert/strict'

const { enableFeature } = await import('@stacksjs/config')
enableFeature('cms')

const { configureOrm, getDatabase } = await import('bun-query-builder')
configureOrm({ database: ':memory:' })
const { ormReady } = await import('@stacksjs/orm')
await ormReady

const db = getDatabase()
db.run(`CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name TEXT, email TEXT, user_id INTEGER,
  created_at TEXT, updated_at TEXT
)`)
db.run(`INSERT INTO authors (name, email) VALUES ('Grace Hopper', 'grace@example.com')`)
const { id } = db.query(`SELECT id FROM authors WHERE email = 'grace@example.com'`).get() as { id: number }

const { default: AuthorUpdateAction } = await import('../../../storage/framework/defaults/app/Actions/Cms/AuthorUpdateAction')
const input: Record<string, unknown> = { name: 'Rear Admiral Hopper' }
await AuthorUpdateAction.handle({
  getParam: (key: string) => ({ id: String(id) } as Record<string, string>)[key],
  get: (key: string, fallback?: unknown) => input[key] !== undefined ? input[key] : fallback,
  only: (keys: string[]) => Object.fromEntries(keys.filter(key => key in input).map(key => [key, input[key]])),
  validate: async () => {},
} as any)

assert.deepEqual(
  { ...db.query(`SELECT name, email FROM authors WHERE id = ?`).get(id) as object },
  { name: 'Rear Admiral Hopper', email: 'grace@example.com' },
)
console.log('author partial update: passed')
