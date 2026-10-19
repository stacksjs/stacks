import assert from 'node:assert/strict'
import { configure as configureSms, init as initSms } from '@stacksjs/sms'
import { config } from '@stacksjs/config'
import { db, sqlHelpers } from '@stacksjs/database/runtime'
import { notificationPreferencesTableSql } from '../../../database/src/notification-tables'
import { optOutPhone } from '@stacksjs/sms'
import { notify } from '../../src/index'
import { setNotificationPreference } from '../../src/preferences'

// `ignorePreferences` skips the app's preference rows; a carrier STOP is a
// legal opt-out and only an explicit `ignoreOptOut` sends past it.
await initSms()
configureSms({ provider: 'twilio', drivers: { twilio: { accountSid: 'ACfixture', authToken: 'fixture', from: '+15555550101' } } })
;(config as any).notification.tracking = { enabled: false }
const texts: string[] = []
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  if (!url.startsWith('https://api.twilio.com/')) throw new Error(`Unexpected provider URL: ${url}`)
  texts.push(new URLSearchParams(String(init?.body || '')).get('To') || '')
  return Response.json({ sid: 'SMfixture', status: 'queued' }, { status: 201 })
}) as typeof fetch

await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
await db.insertInto('users').values({ id: 1 }).execute()
await db.unsafe(notificationPreferencesTableSql(sqlHelpers('sqlite'))).execute()
await db.unsafe('CREATE TABLE sms_opt_outs (id INTEGER PRIMARY KEY AUTOINCREMENT, phone VARCHAR(20) NOT NULL UNIQUE, reason VARCHAR(64), opted_out_at TIMESTAMP NOT NULL, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()

const stopped = '+15555550100'
const subscribed = '+15555550199'
await optOutPhone(stopped)
const payload = { subject: 'Notice', body: 'Your class moved to 7pm' }

const plain = await notify({ phone: stopped }, payload, ['sms'])
assert.equal(plain[0]!.success, false)
assert.match(plain[0]!.error!.message, /opted out \(STOP\)/)

const preferencesOnly = await notify({ phone: stopped }, payload, ['sms'], { ignorePreferences: true })
assert.equal(preferencesOnly[0]!.success, false, 'ignorePreferences must not text a number that replied STOP')
assert.match(preferencesOnly[0]!.error!.message, /opted out \(STOP\)/)
assert.equal(texts.length, 0, 'no provider request for a STOPped number')

await setNotificationPreference(1, 'sms', false)
const filtered = await notify({ userId: 1, phone: subscribed }, payload, ['sms'])
assert.equal(filtered.length, 0, 'a disabled preference still filters the channel')
assert.equal(texts.length, 0)

const bypassed = await notify({ userId: 1, phone: subscribed }, payload, ['sms'], { ignorePreferences: true })
assert.equal(bypassed[0]!.success, true, 'ignorePreferences still bypasses preferences')
assert.deepEqual(texts, [subscribed])

const both = await notify({ userId: 1, phone: stopped }, payload, ['sms'], { ignorePreferences: true })
assert.equal(both[0]!.success, false, 'a STOP outranks a preference bypass')
assert.equal(texts.length, 1)

const legallyRequired = await notify({ phone: stopped }, payload, ['sms'], { ignoreOptOut: true })
assert.equal(legallyRequired[0]!.success, true, 'ignoreOptOut sends past STOP')
assert.deepEqual(texts, [subscribed, stopped])

const optOutOnly = await notify({ userId: 1, phone: stopped }, payload, ['sms'], { ignoreOptOut: true })
assert.equal(optOutOnly.length, 0, 'ignoreOptOut does not skip the preference filter')
assert.equal(texts.length, 2)

process.stdout.write('stop opt-out OK\n')
