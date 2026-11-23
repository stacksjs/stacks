// What the public signup relies on: subscribe() validates the address, joins
// a list, refuses a private list when asked to, and signs a person back up
// after either kind of opt-out, saying so in `reactivated`.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { db } from '@stacksjs/database/runtime'
import { buildMigrationPlan, generateSql, loadModels } from 'bun-query-builder'
import { emailAddress, lists, NewsletterListUnavailableError, subscribe, unsubscribe } from '../../src'

const TABLES = ['email_list_subscribers', 'email_lists', 'subscribers']
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../../defaults/app/Models') }), { dialect: 'sqlite' })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}
for (const statement of generateSql(plan))
  await db.unsafe(statement).execute()

// The address check the endpoint and subscribe() share.
assert.equal(emailAddress('  Ada@Example.COM '), 'ada@example.com')
for (const bad of ['', 'bogus', 'a@b', '<b>@example.com', 'a b@example.com', 'a@example.c', 42, null])
  assert.equal(emailAddress(bad), null, `refuses ${String(bad)}`)
await assert.rejects(subscribe('<b>@x'), /valid email/)

// A first signup joins the default list, created on first use.
const first = await subscribe('Reader@Example.com', { source: 'blog' })
assert.equal(first.created, true)
assert.equal(first.reactivated, false)
assert.equal(first.email, 'reader@example.com')
assert.ok(first.subscriberId > 0)

// Again: nothing changes.
const again = await subscribe('reader@example.com')
assert.equal(again.created, false)
assert.equal(again.reactivated, false)
assert.equal(again.token, first.token)

// After the list's own unsubscribe link: back on, same token.
await unsubscribe(first.token)
const back = await subscribe('reader@example.com')
assert.equal(back.reactivated, true)
assert.equal(back.token, first.token)
const pivot = await db.selectFrom('email_list_subscribers').selectAll().where('uuid', '=', first.token).executeTakeFirst() as { status: string }
assert.equal(pivot.status, 'subscribed')

// After the legacy global link, which marks the subscribers row itself.
await db.updateTable('subscribers').set({ status: 'unsubscribed' }).where('id', '=', first.subscriberId).execute()
const globalBack = await subscribe('reader@example.com')
assert.equal(globalBack.reactivated, true)
const person = await db.selectFrom('subscribers').selectAll().where('id', '=', first.subscriberId).executeTakeFirst() as { status: string, unsubscribed_at: unknown }
assert.equal(person.status, 'subscribed')
assert.equal(person.unsubscribed_at, null)

// A public caller can join a public list, never a private one.
await lists.create({ name: 'Launch', slug: 'launch', isPublic: true })
await lists.create({ name: 'Staff', slug: 'staff', isPublic: false })
const launch = await subscribe('reader@example.com', { list: 'launch', publicOnly: true })
assert.equal(launch.created, true)
await assert.rejects(subscribe('reader@example.com', { list: 'staff', publicOnly: true }), NewsletterListUnavailableError)
await assert.rejects(subscribe('reader@example.com', { list: 'nope', publicOnly: true }), NewsletterListUnavailableError)
// Code that is not public-facing may still add to a private list.
assert.equal((await subscribe('reader@example.com', { list: 'staff' })).created, true)

console.log('newsletter subscribe OK')
