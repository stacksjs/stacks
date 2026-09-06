import { config as queryBuilderConfig, setConfig } from '@stacksjs/query-builder'
import { db, initializeDbConfig } from '../../src/utils'

const databasePath = process.argv[2]
if (!databasePath)
  throw new Error('Expected an isolated SQLite path')

initializeDbConfig({
  app: { env: 'production' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database: databasePath } },
    queryLogging: { enabled: false },
  },
})

if (queryBuilderConfig.hooks !== undefined)
  throw new Error('The fast SELECT fixture requires the production no-hooks profile')

await db.unsafe('CREATE TABLE fast_items (id INTEGER PRIMARY KEY, name TEXT, active INTEGER)').execute()
await db.unsafe('INSERT INTO fast_items (id, name, active) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)', [
  1, 'alpha', 1,
  2, 'beta', 1,
  3, 'gamma', 0,
]).execute()

const fast = await db
  .selectFrom('fast_items')
  .select(['id', 'name'])
  .where('active', '=', 1)
  .where('id', '>=', 2)
  .limit(1)
  .execute()

if (JSON.stringify(fast) !== JSON.stringify([{ id: 2, name: 'beta' }]))
  throw new Error(`Unexpected lightweight SELECT result: ${JSON.stringify(fast)}`)

const first = await db
  .selectFrom('fast_items')
  .select(['id', 'name'])
  .where('id', '=', 2)
  .executeTakeFirst()

if (JSON.stringify(first) !== JSON.stringify({ id: 2, name: 'beta' }))
  throw new Error(`Unexpected lightweight first-row result: ${JSON.stringify(first)}`)

const missing = await db
  .selectFrom('fast_items')
  .where('id', '=', 999)
  .executeTakeFirst()

if (missing !== undefined)
  throw new Error(`Missing lightweight first-row query returned: ${JSON.stringify(missing)}`)

const required = await db
  .selectFrom('fast_items')
  .where('id', '=', 1)
  .executeTakeFirstOrThrow()

if (required.name !== 'alpha')
  throw new Error(`Unexpected required lightweight row: ${JSON.stringify(required)}`)

let missingError: unknown
try {
  await db.selectFrom('fast_items').where('id', '=', 999).executeTakeFirstOrThrow()
}
catch (error) {
  missingError = error
}
if (!(missingError instanceof Error) || missingError.message !== 'Record not found')
  throw new Error(`Unexpected missing-row error: ${String(missingError)}`)

const firstAliases = await Promise.all([
  db.selectFrom('fast_items').select('name').where('id', '=', 2).first(),
  db.selectFrom('fast_items').select('name').where('id', '=', 1).firstOrFail(),
  db.selectFrom('fast_items').select('name').where('id', '=', 999).first(),
])
if (JSON.stringify(firstAliases) !== JSON.stringify([{ name: 'beta' }, { name: 'alpha' }, null]))
  throw new Error(`Unexpected lightweight first aliases: ${JSON.stringify(firstAliases)}`)

let missingFirstError: unknown
try {
  await db.selectFrom('fast_items').where('id', '=', 999).firstOrFail()
}
catch (error) {
  missingFirstError = error
}
if (!(missingFirstError instanceof Error) || missingFirstError.message !== 'Record not found')
  throw new Error(`Unexpected missing first-row error: ${String(missingFirstError)}`)

const existence = await Promise.all([
  db.selectFrom('fast_items').where('id', '=', 1).exists(),
  db.selectFrom('fast_items').where('id', '=', 999).exists(),
  db.selectFrom('fast_items').where('id', '=', 1).doesntExist(),
  db.selectFrom('fast_items').where('id', '=', 999).doesntExist(),
])
if (JSON.stringify(existence) !== JSON.stringify([true, false, false, true]))
  throw new Error(`Unexpected lightweight existence results: ${JSON.stringify(existence)}`)

const aliased = await db
  .selectFrom('fast_items')
  .select('name AS label')
  .where('id', '=', 1)
  .execute()

if (JSON.stringify(aliased) !== JSON.stringify([{ label: 'alpha' }]))
  throw new Error(`Unexpected aliased SELECT result: ${JSON.stringify(aliased)}`)

const fallback = await db
  .selectFrom('fast_items')
  .select(['id', 'name'])
  .where({ active: 1 })
  .orderBy('id', 'desc')
  .limit(1)
  .execute()

if (JSON.stringify(fallback) !== JSON.stringify([{ id: 2, name: 'beta' }]))
  throw new Error(`Unexpected fallback SELECT result: ${JSON.stringify(fallback)}`)

let rejectedUnsafeColumn = false
try {
  db.selectFrom('fast_items').where('id OR 1=1', '=', 1)
}
catch {
  rejectedUnsafeColumn = true
}
if (!rejectedUnsafeColumn)
  throw new Error('Unsafe WHERE identifiers must still reach upstream validation')

async function supportedMatrix() {
  return {
    selectAll: await db.selectFrom('fast_items').limit(2).execute(),
    explicitSelectAll: await db.selectFrom('fast_items').selectAll().limit(2).execute(),
    selectAllAfterSelection: await db.selectFrom('fast_items').select('name').selectAll().limit(1).execute(),
    replacedSelection: await db
      .selectFrom('fast_items')
      .select('id')
      .select('name')
      .where('id', '<>', 3)
      .limit(3)
      .limit(1)
      .execute(),
    fallbackAfterReplacements: await db
      .selectFrom('fast_items')
      .limit(3)
      .select('id')
      .where('active', '=', 1)
      .select('name')
      .limit(1)
      .orderBy('id', 'desc')
      .offset(0)
      .execute(),
    ordered: await db
      .selectFrom('fast_items')
      .select(['id', 'name'])
      .orderBy('active')
      .orderByDesc('id')
      .limit(2)
      .execute(),
    get: await db.selectFrom('fast_items').select('name').where('active', '=', 1).limit(1).get(),
    first: await db.selectFrom('fast_items').select('name').where('active', '=', 1).first(),
    missingFirst: await db.selectFrom('fast_items').where('id', '=', 999).first(),
    value: await db.selectFrom('fast_items').select('name').where('id', '=', 2).value('name'),
    missingValue: await db.selectFrom('fast_items').select('name').where('id', '=', 999).value('name'),
    unselectedValue: await db.selectFrom('fast_items').select('id').where('id', '=', 1).value('name'),
    pluck: await db.selectFrom('fast_items').select('name').where('active', '=', 1).pluck('name'),
    keyedPluck: await db.selectFrom('fast_items').select(['id', 'name']).pluck('name', 'id'),
    aggregates: {
      count: await db.selectFrom('fast_items').where('active', '=', 1).count(),
      countColumn: await db.selectFrom('fast_items').where('active', '=', 1).count('id'),
      sum: await db.selectFrom('fast_items').where('active', '=', 1).sum('id'),
      avg: await db.selectFrom('fast_items').where('active', '=', 1).avg('id'),
      min: await db.selectFrom('fast_items').where('active', '=', 1).min('id'),
      max: await db.selectFrom('fast_items').where('active', '=', 1).max('id'),
      emptySum: await db.selectFrom('fast_items').where('id', '=', 999).sum('id'),
      emptyAvg: await db.selectFrom('fast_items').where('id', '=', 999).avg('id'),
      emptyMin: await db.selectFrom('fast_items').where('id', '=', 999).min('id'),
      emptyMax: await db.selectFrom('fast_items').where('id', '=', 999).max('id'),
    },
  }
}

const lightweightMatrix = await supportedMatrix()

let hookKind: string | undefined
setConfig({
  hooks: {
    onQueryEnd: event => hookKind = event.kind,
  },
})
const upstreamMatrix = await supportedMatrix()
if (JSON.stringify(lightweightMatrix) !== JSON.stringify(upstreamMatrix))
  throw new Error(`Lightweight and upstream SELECT results diverged: ${JSON.stringify({ lightweightMatrix, upstreamMatrix })}`)
if (hookKind !== 'select')
  throw new Error(`Configured hooks must retain the upstream SELECT path, received ${hookKind}`)

console.log('fast-sqlite-select-ok')
