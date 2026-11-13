import assert from 'node:assert/strict'
import { configure as configureSms, init as initSms } from '@stacksjs/sms'
import { config } from '@stacksjs/config'
import { db, sqlHelpers } from '@stacksjs/database/runtime'
import { notificationPreferencesTableSql } from '../../../database/src/notification-tables'
import { notify } from '../../src/index'
import { filterChannelsByPreferences, setNotificationPreference } from '../../src/preferences'

// A send that names a category is one a person can unsubscribe from, so when
// the preferences cannot be read it is not sent. An uncategorized send still
// goes out.
await initSms()
configureSms({ provider: 'twilio', drivers: { twilio: { accountSid: 'ACfixture', authToken: 'fixture', from: '+15555550101' } } })
;(config as any).notification.tracking = { enabled: false }
const texts: string[] = []
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  if (!url.startsWith('https://api.twilio.com/')) throw new Error(`Unexpected provider URL: ${url}`)
  texts.push(new URLSearchParams(String(init?.body || '')).get('Body') || '')
  return Response.json({ sid: 'SMfixture', status: 'queued' }, { status: 201 })
}) as typeof fetch

await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
await db.insertInto('users').values({ id: 1 }).execute()
await db.unsafe(notificationPreferencesTableSql(sqlHelpers('sqlite'))).execute()
await db.unsafe('CREATE TABLE sms_opt_outs (id INTEGER PRIMARY KEY AUTOINCREMENT, phone VARCHAR(20) NOT NULL UNIQUE, reason VARCHAR(64), opted_out_at TIMESTAMP NOT NULL, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()

const recipient = { userId: 1, phone: '+15555550199' }
await setNotificationPreference(1, 'sms', false, 'marketing')
assert.equal((await notify(recipient, { body: 'Sale' }, ['sms'], { category: 'marketing' })).length, 0, 'the opt-out holds while the table is readable')

// The opt-out row is still there; the lookup can no longer reach it.
await db.unsafe('ALTER TABLE notification_preferences RENAME TO notification_preferences_offline').execute()
await assert.rejects(async () => filterChannelsByPreferences(1, ['sms'], 'marketing'), 'a failed lookup is not an empty preference list')

const marketing = await notify(recipient, { body: 'Sale' }, ['sms'], { category: 'marketing' })
assert.equal(marketing.length, 1)
assert.equal(marketing[0]!.success, false, 'a marketing send must not go out when the opt-outs cannot be read')
assert.match(marketing[0]!.error!.message, /preferences could not be read/)
assert.deepEqual(texts, [], 'no provider request for a send whose opt-outs are unknown')

const other = await notify(recipient, { body: 'Newsletter' }, ['sms'], { category: 'news' })
assert.equal(other[0]!.success, false, 'every category fails closed, not only marketing')
assert.deepEqual(texts, [])

const uncategorized = await notify(recipient, { body: 'Your class moved to 7pm' }, ['sms'])
assert.equal(uncategorized[0]!.success, true, 'an uncategorized send still fails open')
assert.deepEqual(texts, ['Your class moved to 7pm'])

const bypassed = await notify(recipient, { body: 'Security alert' }, ['sms'], { category: 'security', ignorePreferences: true })
assert.equal(bypassed[0]!.success, true, 'ignorePreferences never reads the preferences')
assert.equal(texts.length, 2)

process.stdout.write('preference lookup failure OK\n')
