// What the public signup relies on: subscribe() validates the address, joins
// a list, refuses a private list when asked to, and signs a person back up
// after either kind of opt-out, saying so in `reactivated`.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { db } from '@stacksjs/database/runtime'
import { buildMigrationPlan, generateSql, loadModels } from 'bun-query-builder'
import { confirm, emailAddress, lists, NewsletterListUnavailableError, subscribe, unsubscribe } from '../../src'

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

// The default list made itself, so it is single opt-in.
const defaultList = await db.selectFrom('email_lists').selectAll().where('slug', '=', 'default').executeTakeFirst() as { double_opt_in: unknown }
assert.ok(!defaultList.double_opt_in || defaultList.double_opt_in === '0', 'the auto-created default list does not ask for confirmation')
// Asking for double opt-in on the default list only matters when it is created; this one exists.
const onExistingDefault = await subscribe('later@example.com', { confirmation: 'list', defaultListDoubleOptIn: true })
assert.equal(onExistingDefault.pending, false)
assert.equal(onExistingDefault.confirms, false)

// Double opt-in, honoured only when the caller asks for the list's rule.
await lists.create({ name: 'Digest', slug: 'digest', isPublic: true, doubleOptIn: true })
const membership = async (token: string) => await db.selectFrom('email_list_subscribers').selectAll().where('uuid', '=', token).executeTakeFirst() as { status: string, subscribed_at: unknown }

const asked = await subscribe('new@example.com', { list: 'digest', confirmation: 'list', publicOnly: true })
assert.equal(asked.pending, true)
assert.equal((await membership(asked.token)).status, 'pending')
const waitingPerson = await db.selectFrom('subscribers').selectAll().where('id', '=', asked.subscriberId).executeTakeFirst() as { status: string }
assert.equal(waitingPerson.status, 'pending')

// Asking again while pending changes nothing and stays pending, so the
// confirmation email can go out again.
const askedAgain = await subscribe('new@example.com', { list: 'digest', confirmation: 'list' })
assert.equal(asked.confirms, true)
assert.equal(askedAgain.confirms, true)
assert.equal(askedAgain.pending, true)
assert.equal(askedAgain.token, asked.token)

// The link in the email.
const confirmed = await confirm(asked.token)
assert.equal(confirmed.ok, true)
assert.equal(confirmed.email, 'new@example.com')
assert.equal((await membership(asked.token)).status, 'subscribed')
assert.ok((await membership(asked.token)).subscribed_at, 'confirming stamps subscribed_at')
const confirmedPerson = await db.selectFrom('subscribers').selectAll().where('id', '=', asked.subscriberId).executeTakeFirst() as { status: string }
assert.equal(confirmedPerson.status, 'subscribed')
assert.equal((await confirm(asked.token)).alreadyConfirmed, true)

// An old confirmation link cannot undo an opt-out, and coming back asks again.
await unsubscribe(asked.token)
assert.equal((await confirm(asked.token)).ok, false)
const returning = await subscribe('new@example.com', { list: 'digest', confirmation: 'list' })
assert.equal(returning.reactivated, true)
assert.equal(returning.pending, true)
assert.equal((await confirm('not-a-token')).ok, false)

// Without asking for the list's rule (an import, an admin), it subscribes at once.
const imported = await subscribe('imported@example.com', { list: 'digest' })
assert.equal(imported.pending, false)
assert.equal(imported.confirms, false)
// Already confirmed and asked again through the form: still a double opt-in list,
// so the form can answer it like a new address.
const confirmedAgain = await subscribe('imported@example.com', { list: 'digest', confirmation: 'list' })
assert.equal(confirmedAgain.created, false)
assert.equal(confirmedAgain.pending, false)
assert.equal(confirmedAgain.confirms, true)
assert.equal((await membership(imported.token)).status, 'subscribed')
// And a pending membership added that way is subscribed.
const promoted = await subscribe('new@example.com', { list: 'digest' })
assert.equal(promoted.pending, false)
assert.equal((await membership(promoted.token)).status, 'subscribed')

console.log('newsletter subscribe OK')
