import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

async function main() {
  const dialect = process.env.DB_CONNECTION!
  const config = process.env.STACKS_ROW_LOCK_CONFIG!
  assert(basename(dirname(config)).startsWith('stacks-row-lock-mode-'))
  if (dialect !== 'sqlite') assert(process.env.DB_DATABASE?.startsWith('stacks_row_lock_'))
  const { overridesReady } = await import('@stacksjs/config')
  await overridesReady
  const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src')
  const { lockRow, lockRows } = await import('../../src/row-lock')
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false } } })
  
  try {
    await db.unsafe('CREATE TABLE lock_parents (id INTEGER PRIMARY KEY, name TEXT NOT NULL)').execute()
    await db.unsafe('CREATE TABLE lock_children (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES lock_parents(id))').execute()
    await db.insertInto('lock_parents').values({ id: 1, name: 'Before' }).execute()
    await db.insertInto('lock_children').values({ id: 1, parent_id: 1 }).execute()
    await db.transaction(async tx => {
      assert.equal(Number((await lockRow(tx, 'lock_parents', { id: 1 }, { mode: 'no_key_update' }))?.id), 1)
      assert.equal(await lockRow(tx, 'lock_parents', { id: 2 }), undefined)
      assert.equal((await lockRows(tx, 'lock_parents', [1], { mode: 'no_key_update' })).size, 1)
    })
    await assert.rejects(() => lockRow(db, 'lock_parents', { id: 1 }, { mode: 'invalid' as never }), /Unsupported row lock mode/)
    await assert.rejects(() => lockRow(db, 'lock_parents', {}), /requires a scope/)
    if (dialect === 'postgres') {
      let parentHeld!: () => void
      let childDone!: () => void
      const held = new Promise<void>(resolve => { parentHeld = resolve })
      const child = new Promise<void>(resolve => { childDone = resolve })
      const parentWrite = db.transaction(async tx => {
        await lockRow(tx, 'lock_parents', { id: 1 }, { mode: 'no_key_update' })
        parentHeld()
        await child
        await tx.updateTable('lock_parents').set({ name: 'After' }).where('id', '=', 1).execute()
      })
      await held
      const childWrite = db.transaction(async tx => {
        await lockRow(tx, 'lock_children', { id: 1 })
        // This FK key-share lock must coexist with the parent's non-key update lock.
        await tx.insertInto('lock_children').values({ id: 2, parent_id: 1 }).execute()
      }).finally(childDone)
      await Promise.all([parentWrite, childWrite])
      assert.equal((await db.selectFrom('lock_parents').selectAll().where('id', '=', 1).executeTakeFirst())?.name, 'After')
      assert.equal((await db.selectFrom('lock_children').selectAll().execute()).length, 2)
    }
    process.stdout.write('row lock mode OK\n')
  }
  finally { await resetDatabaseConnection() }
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
