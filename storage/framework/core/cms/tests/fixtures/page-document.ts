import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_PAGE_DOCUMENT_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-page-document-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_page_document_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const modelsDir = join(import.meta.dir, '../../../../defaults/app/Models')
const models = { ...(await loadModels({ modelsDir })), ...(await loadModels({ modelsDir: join(modelsDir, 'Content') })) }
const plan = buildMigrationPlan(models, { dialect })
// updatePageDocument also writes a revision row.
const TABLES = ['pages', 'page_revisions']
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), [...TABLES].sort(), 'both tables must come from the model definitions')
for (const table of plan.tables)
  for (const column of table.columns)
    delete column.references
const scratch = mkdtempSync(join(tmpdir(), 'stacks-page-document-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
let statements: string[]
try {
  process.chdir(scratch)
  statements = generateSql(plan)
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}

const { createPageDocument, fetchPageDocument, updatePageDocument } = await import('../../src/pages/document')

const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : JSON.stringify(error)}`) }
}

// The editor reads these back and writes them straight out again, so a value
// the database cannot parse is a save that fails or corrupts.
const STORED = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()

  await check('a loaded page keeps its timestamps in the stored format', async () => {
    const scheduledAt = sqlDateTime(new Date(Date.now() + 86_400_000))
    const created = await createPageDocument(1, { title: 'Launch', slug: 'launch', status: 'scheduled', scheduledAt, blocks: [] } as never)
    const doc = await fetchPageDocument(1, created.id)
    assert(doc, 'the page must load')

    for (const [field, value] of [['scheduledAt', doc!.scheduledAt], ['updatedAt', doc!.updatedAt]] as const) {
      if (value === null)
        continue
      assert.match(value, STORED, `${dialect}: ${field} came back as "${value}"`)
    }
  })

  await check('loading a page and saving it back preserves the schedule', async () => {
    const scheduledAt = sqlDateTime(new Date(Date.now() + 172_800_000))
    const created = await createPageDocument(1, { title: 'Roadmap', slug: 'roadmap', status: 'scheduled', scheduledAt, blocks: [] } as never)
    const loaded = await fetchPageDocument(1, created.id)
    assert(loaded)

    // Exactly what an editor does: hand back what it was given.
    await updatePageDocument(1, created.id, {
      title: loaded!.title, slug: loaded!.slug, status: loaded!.status,
      scheduledAt: loaded!.scheduledAt, blocks: loaded!.blocks,
    } as never)

    const again = await fetchPageDocument(1, created.id)
    assert.equal(again!.scheduledAt?.slice(0, 16), loaded!.scheduledAt?.slice(0, 16), 'the schedule survives a round trip')
  })

  assert.deepEqual(failures, [], `${dialect}: page documents must round-trip their timestamps`)
  console.log('page document OK')
}
finally { resetDatabaseConnection() }
