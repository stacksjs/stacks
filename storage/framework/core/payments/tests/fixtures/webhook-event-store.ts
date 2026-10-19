import assert from 'node:assert/strict'
import { db } from '@stacksjs/database/runtime'
import { databaseWebhookEventStore, WEBHOOK_HANDLERS_PROVIDER } from '../../src/billable/webhook-events'

// Before the table exists the store still dedupes, in memory.
const unmigrated = databaseWebhookEventStore()
assert.equal(await unmigrated.has('evt_early'), false)
await unmigrated.add('evt_early')
assert.equal(await unmigrated.has('evt_early'), true, 'an unmigrated app still skips an in-process replay')

await db.unsafe(`CREATE TABLE payment_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider VARCHAR(64) NOT NULL,
  event_id VARCHAR(512) NOT NULL,
  processed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE (provider, event_id)
)`).execute()

const store = databaseWebhookEventStore()
assert.equal(await store.has('evt_1'), false)
await store.add('evt_1')
await store.add('evt_1')
const rows = await db.selectFrom('payment_webhook_events').selectAll().execute()
assert.equal(rows.length, 1, 'recording twice leaves one row')
assert.equal(rows[0]!.provider, WEBHOOK_HANDLERS_PROVIDER)
assert.equal(await databaseWebhookEventStore().has('evt_1'), true, 'a restarted process still knows the event')

// Commerce records the same Stripe events under the driver name. Its row must
// not make the handler registry skip an event, nor the other way round.
await db.insertInto('payment_webhook_events').values({ provider: 'stripe', event_id: 'evt_commerce', processed_at: '2026-10-18 00:00:00' } as never).execute()
assert.equal(await store.has('evt_commerce'), false)

process.stdout.write('webhook event store OK\n')
