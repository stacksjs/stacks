import assert from 'node:assert/strict'
import { join } from 'node:path'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlHelpers } from '@stacksjs/database/runtime'
import { notificationPreferencesTableSql, notificationsTableSql } from '../../../database/src/notification-tables'
import { bulkSetPreferences, filterChannelsByPreferences, getNotificationPreferences, setNotificationPreference } from '../../src/preferences'
import { DatabaseNotificationDriver } from '../../src/drivers/database'
import { createBroadcastHub, getServer, stopServer } from '@stacksjs/realtime'

const directory = process.env.STACKS_PREFERENCE_TEST_DIRECTORY!
const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
if (dialect === 'postgres') assert(/^stacks_preferences_[a-f0-9]{32}$/.test(process.env.DB_DATABASE || ''))
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { sqlite: { database: join(directory, 'test.sqlite') }, postgres: { name: process.env.DB_DATABASE!, host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD! } }, queryLogging: { enabled: false } } })
await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
await db.insertInto('users').values({ id: 1 }).execute()
await db.unsafe(notificationPreferencesTableSql(sqlHelpers(dialect))).execute()
await db.unsafe(notificationsTableSql(sqlHelpers(dialect))).execute()
await setNotificationPreference(1, 'email', true)
await setNotificationPreference(1, 'email', false, 'marketing')
assert.equal((await getNotificationPreferences(1)).get('email'), true, 'category-specific opt-outs must not masquerade as global ones')
assert.deepEqual(await filterChannelsByPreferences(1, ['email'], 'transactional'), ['email'])
assert.deepEqual(await filterChannelsByPreferences(1, ['email'], 'marketing'), [])
await setNotificationPreference(1, 'email', false)
await setNotificationPreference(1, 'email', true, 'marketing')
assert.deepEqual(await filterChannelsByPreferences(1, ['email'], 'marketing'), [], 'a global opt-out must remain a master switch')
await Promise.all([setNotificationPreference(1, 'sms', false), setNotificationPreference(1, 'sms', true)])
assert.equal((await db.selectFrom('notification_preferences').selectAll().where('channel', '=', 'sms').execute()).length, 1, 'nullable global categories must not permit duplicate rows')
await assert.rejects(() => bulkSetPreferences(1, [{ channel: 'email', enabled: true }, { channel: 'sms', enabled: null as any }]))
assert.equal((await getNotificationPreferences(1)).get('email'), false, 'a failed bulk write must not partially save earlier preferences')
const notification = await DatabaseNotificationDriver.send({ userId: 1, type: 'workout_comment', data: { body: 'Well done' } })
assert(notification.id > 0, 'the database driver returns a generated notification id on every dialect')
assert.equal((await DatabaseNotificationDriver.getUserNotifications(1))[0]?.id, notification.id)
await DatabaseNotificationDriver.markAsRead(notification.id, 2)
assert.equal((await DatabaseNotificationDriver.getUnreadNotifications(1)).length, 1, 'a foreign owner must not mark the inbox read')
await DatabaseNotificationDriver.deleteNotification(notification.id, 2)
assert.equal((await DatabaseNotificationDriver.getUserNotifications(1)).length, 1, 'a foreign owner must not delete the inbox row')
await db.updateTable('notifications').set({ read_at: '2026-01-01 00:00:00' }).where('id', '=', notification.id).execute()
await DatabaseNotificationDriver.markAsRead(notification.id)
const read = (await DatabaseNotificationDriver.getUserNotifications(1))[0]?.read_at
assert.equal(read instanceof Date ? read.toISOString() : String(read), dialect === 'postgres' ? '2026-01-01T00:00:00.000Z' : '2026-01-01 00:00:00')
await DatabaseNotificationDriver.deleteNotification(notification.id, 1)
assert.equal((await DatabaseNotificationDriver.getUserNotifications(1)).length, 0)
createBroadcastHub()
const events: Array<{ event: string, data: unknown }> = []
const remove = getServer()!.addBroadcastHook(frame => { events.push(frame) })
const retries = await Promise.all([
  DatabaseNotificationDriver.send({ userId: 1, type: 'chat_message', idempotencyKey: 'message:7', data: { body: 'Hello' } }),
  DatabaseNotificationDriver.send({ userId: 1, type: 'chat_message', idempotencyKey: 'message:7', data: { body: 'Hello' } }),
])
assert.equal(retries[0].id, retries[1].id, 'concurrent chat notification retries return the same native inbox row')
assert.equal((await DatabaseNotificationDriver.getUserNotifications(1)).length, 1)
assert.equal(events.length, 1, 'one private invalidation for a concurrently retried notification')
assert.equal(events[0].event, 'notifications.created')
assert(!JSON.stringify(events[0]).includes('Hello'), 'notification contents never appear in the broadcast')
await assert.rejects(db.transaction(async () => {
  await DatabaseNotificationDriver.send({ userId: 1, type: 'chat_message', idempotencyKey: 'rollback', data: { body: 'Rolled back' } })
  throw new Error('rollback')
}))
assert.equal(events.length, 1, 'rolled-back notifications never broadcast')
remove()
await stopServer()
await resetDatabaseConnection()
process.stdout.write('preference runtime OK\n')
