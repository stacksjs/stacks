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

await db.unsafe('CREATE TABLE fast_items (id INTEGER PRIMARY KEY, name TEXT, active INTEGER, note TEXT, created_at TEXT)').execute()
await db.unsafe('INSERT INTO fast_items (id, name, active, created_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)', [
  1, 'alpha', 1, '2026-01-01T00:00:00.000Z',
  2, 'beta', 1, '2026-01-02T00:00:00.000Z',
  3, 'gamma', 0, '2026-01-03T00:00:00.000Z',
]).execute()
await db.unsafe('PRAGMA case_sensitive_like = ON').execute()

await db.transaction(async (transaction: any) => {
  await transaction.insertInto('fast_items').values({ id: 4, name: 'delta', active: 1 }).execute()
  const visible = await db.selectFrom('fast_items').select('name').where('id', '=', 4).first()
  if (visible?.name !== 'delta')
    throw new Error(`Fast SELECT did not share the active SQLite transaction: ${JSON.stringify(visible)}`)
})
await db.unsafe('DELETE FROM fast_items WHERE id = 4').execute()

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

const mutableSelection = ['id']
await db.selectFrom('fast_items').select(mutableSelection).where('id', '=', 1).execute()
mutableSelection[0] = 'name'
const mutatedSelection = await db.selectFrom('fast_items').select(mutableSelection).where('id', '=', 1).execute()
if (JSON.stringify(mutatedSelection) !== JSON.stringify([{ name: 'alpha' }]))
  throw new Error(`Cached selection did not preserve caller mutation safety: ${JSON.stringify(mutatedSelection)}`)

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
      .groupBy('name')
      .execute(),
    ordered: await db
      .selectFrom('fast_items')
      .select(['id', 'name'])
      .orderBy('active')
      .orderByDesc('id')
      .limit(2)
      .execute(),
    orderAliases: await Promise.all([
      db.selectFrom('fast_items').select('id').latest().first(),
      db.selectFrom('fast_items').select('id').oldest('id').first(),
    ]),
    offset: await db
      .selectFrom('fast_items')
      .select(['id', 'name'])
      .orderBy('id')
      .offset(1)
      .limit(1)
      .execute(),
    nullPredicates: await db
      .selectFrom('fast_items')
      .select(['id', 'name'])
      .whereNull('note')
      .whereNotNull('name')
      .orderBy('id', 'desc')
      .limit(2)
      .execute(),
    likePredicates: await db
      .selectFrom('fast_items')
      .select(['id', 'name'])
      .whereLike('name', '%a%')
      .whereNotLike('name', 'g%')
      .orderBy('id')
      .execute(),
    likeCaseModes: await Promise.all([
      db.selectFrom('fast_items').select('id').whereLike('name', 'A%').execute(),
      db.selectFrom('fast_items').select('id').whereLike('name', 'A%', true).execute(),
      db.selectFrom('fast_items').select('id').whereILike('name', 'A%').execute(),
      db.selectFrom('fast_items').select('id').whereNotILike('name', 'A%').orderBy('id').execute(),
    ]),
    listPredicates: await db
      .selectFrom('fast_items')
      .select(['id', 'name'])
      .whereIn('id', [1, 2, 3])
      .whereNotIn('name', ['gamma'])
      .orderBy('id')
      .execute(),
    betweenArray: await db.selectFrom('fast_items').select('id').whereBetween('id', [1, 2]).orderBy('id').execute(),
    betweenBounds: await db.selectFrom('fast_items').select('id').whereBetween('id', 1, 2).orderBy('id').execute(),
    objectPredicates: await Promise.all([
      db.selectFrom('fast_items').select('name').where({ id: 2 }).execute(),
      db.selectFrom('fast_items').select('name').where({ active: 1, note: null }).execute(),
    ]),
    datePredicates: await Promise.all([
      db.selectFrom('fast_items').select('id').whereDate('created_at', '>=', '2026-01-02T00:00:00.000Z').execute(),
      db.selectFrom('fast_items').select('id').whereDate('created_at', '=', new Date('2026-01-01T00:00:00.000Z')).execute(),
    ]),
    distinct: await db.selectFrom('fast_items').select('active').distinct().orderBy('active').execute(),
    emptyIn: await db.selectFrom('fast_items').whereIn('id', []).execute(),
    emptyNotIn: await db.selectFrom('fast_items').whereNotIn('id', []).limit(1).execute(),
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

async function offsetOnlyRejections() {
  const rejects: boolean[] = []
  for (const terminal of ['execute', 'first'] as const) {
    try {
      await db.selectFrom('fast_items').offset(1)[terminal]()
      rejects.push(false)
    }
    catch {
      rejects.push(true)
    }
  }
  return rejects
}

async function repeatedDistinctRejects() {
  try {
    await db.selectFrom('fast_items').select('active').distinct().distinct().execute()
    return false
  }
  catch {
    return true
  }
}

const lightweightMatrix = await supportedMatrix()
const lightweightOffsetOnlyRejections = await offsetOnlyRejections()
const lightweightRepeatedDistinctRejection = await repeatedDistinctRejects()

let hookKind: string | undefined
setConfig({
  hooks: {
    onQueryEnd: event => hookKind = event.kind,
  },
})
const upstreamMatrix = await supportedMatrix()
const upstreamOffsetOnlyRejections = await offsetOnlyRejections()
const upstreamRepeatedDistinctRejection = await repeatedDistinctRejects()
if (JSON.stringify(lightweightMatrix) !== JSON.stringify(upstreamMatrix))
  throw new Error(`Lightweight and upstream SELECT results diverged: ${JSON.stringify({ lightweightMatrix, upstreamMatrix })}`)
if (JSON.stringify(lightweightOffsetOnlyRejections) !== JSON.stringify([true, true])
  || JSON.stringify(lightweightOffsetOnlyRejections) !== JSON.stringify(upstreamOffsetOnlyRejections))
  throw new Error(`Lightweight and upstream offset-only behavior diverged: ${JSON.stringify({ lightweightOffsetOnlyRejections, upstreamOffsetOnlyRejections })}`)
if (!lightweightRepeatedDistinctRejection || lightweightRepeatedDistinctRejection !== upstreamRepeatedDistinctRejection)
  throw new Error(`Lightweight and upstream repeated-distinct behavior diverged: ${JSON.stringify({ lightweightRepeatedDistinctRejection, upstreamRepeatedDistinctRejection })}`)
if (hookKind !== 'select')
  throw new Error(`Configured hooks must retain the upstream SELECT path, received ${hookKind}`)

console.log('fast-sqlite-select-ok')
