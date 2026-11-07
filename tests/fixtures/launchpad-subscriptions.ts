import assert from 'node:assert/strict'
import { join } from 'node:path'
import { db } from '@stacksjs/database/runtime'
import { buildMigrationPlan, generateSql, loadModels } from 'bun-query-builder'
import { lists, subscribe, unsubscribe } from '@stacksjs/newsletter'
import { subscribeToLaunchpad } from '../../app/Services/launchpad-subscriptions'
const dialect = 'sqlite'
const TABLES = ['email_list_subscribers', 'email_lists', 'subscribers']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
for (const statement of generateSql(plan))
  await db.unsafe(statement).execute()

await lists.create({ name: 'Stacks updates', slug: 'stacks-updates' })
await subscribe('person@example.com', { list: 'stacks-updates' })
const first = await subscribeToLaunchpad(' Person@EXAMPLE.com ')
const repeat = await subscribeToLaunchpad('person@example.com')
assert.equal(first.created, true)
assert.equal(repeat.created, false)
assert.equal(first.token, repeat.token)
assert.equal((await db.selectFrom('subscribers').selectAll().execute()).length, 1)
assert.equal((await unsubscribe(first.token)).ok, true)
const memberships = await db.selectFrom('email_list_subscribers').selectAll().execute()
assert.equal(memberships.length, 2)
assert.equal(memberships.filter(row => Number(row.email_list_id) === first.listId && row.status === 'unsubscribed').length, 1)
assert.equal(memberships.filter(row => Number(row.email_list_id) !== first.listId && row.status === 'subscribed').length, 1)
console.log('Native Launchpad subscription and scoped unsubscribe verified')
