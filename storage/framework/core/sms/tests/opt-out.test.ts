import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-smsoptout-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { classifyInboundSms, handleInboundSms, isPhoneOptedOut, normalizePhone, optOutPhone } = await import('../src/opt-out')
const { handleTwilioInbound, inboundSmsKind } = await import('../src/inbound')
const { createHmac } = await import('node:crypto')


async function forceConfig(): Promise<void> {
  /*
   * Held for the MUTATION only. Acquiring at module scope and releasing from
   * the `process.on('exit')` handler meant holding it for the whole of
   * `bun test`, since every file shares one process - so each later file
   * wanting the lock waited out the full 60s watchdog
   * (stacksjs/stacks#2413).
   */
  const releaseDbConfigLock = await acquireDbConfigLock()

  try {
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'testing' },
      database: {
        default: 'sqlite',
        connections: { sqlite: { database: DB_PATH, prefix: '' } },
      },
    })
  }
  finally {
    releaseDbConfigLock()
  }
}

beforeAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
  await forceConfig()
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS sms_opt_outs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone VARCHAR(20) NOT NULL UNIQUE,
      reason VARCHAR(64) DEFAULT 'stop-keyword',
      opted_out_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()
})

beforeEach(async () => {
  await forceConfig()
  await db.unsafe('DELETE FROM sms_opt_outs').execute()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // best effort
    }
  }
})

describe('normalizePhone', () => {
  test('US shapes collapse to E.164', () => {
    expect(normalizePhone('(310) 555-0199')).toBe('+13105550199')
    expect(normalizePhone('1-310-555-0199')).toBe('+13105550199')
    expect(normalizePhone('+13105550199')).toBe('+13105550199')
    expect(normalizePhone('+49 170 1234567')).toBe('+491701234567')
  })
})

describe('classifyInboundSms', () => {
  test('keyword set per CTIA, first word only, case-insensitive', () => {
    expect(classifyInboundSms('STOP')).toBe('stop')
    expect(classifyInboundSms('  stop please ')).toBe('stop')
    expect(classifyInboundSms('Unsubscribe')).toBe('stop')
    expect(classifyInboundSms('START')).toBe('start')
    expect(classifyInboundSms('help')).toBe('help')
    expect(classifyInboundSms('can you stop by later?')).toBe('message')
  })
})

describe('handleInboundSms', () => {
  test('STOP records the opt-out and replies; START clears it', async () => {
    const stop = await handleInboundSms({ from: '(310) 555-0199', body: 'STOP' }, { appName: 'CampusHQ' })
    expect(stop.kind).toBe('stop')
    expect(stop.reply).toContain('unsubscribed')
    expect(await isPhoneOptedOut('+13105550199')).toBe(true)

    const start = await handleInboundSms({ from: '+13105550199', body: 'start' }, { appName: 'CampusHQ' })
    expect(start.kind).toBe('start')
    expect(await isPhoneOptedOut('310-555-0199')).toBe(false)
  })

  test('HELP answers without touching state; ordinary texts pass through', async () => {
    await optOutPhone('+13105550100')
    const help = await handleInboundSms({ from: '+13105550100', body: 'HELP' })
    expect(help.kind).toBe('help')
    expect(await isPhoneOptedOut('+13105550100')).toBe(true)

    const message = await handleInboundSms({ from: '+13105550101', body: 'Will Ana be at practice?' })
    expect(message.kind).toBe('message')
    expect(message.reply).toBeUndefined()
  })

  test('opt-out survives duplicate STOPs (webhooks retry)', async () => {
    await handleInboundSms({ from: '+13105550199', body: 'STOP' })
    await handleInboundSms({ from: '+13105550199', body: 'STOP' })
    expect(await isPhoneOptedOut('+13105550199')).toBe(true)
  })
})

describe('handleTwilioInbound', () => {
  const token = 'twilio-auth-token'
  const url = 'https://app.test/api/sms/inbound'

  function twilioRequest(fields: Record<string, string>, options: { signWith?: string, signUrl?: string, requestUrl?: string } = {}): Request {
    const signed = Object.keys(fields).sort().reduce((value, key) => `${value}${key}${fields[key]}`, options.signUrl ?? url)
    const signature = createHmac('sha1', options.signWith ?? token).update(signed).digest('base64')
    return new Request(options.requestUrl ?? url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': signature },
      body: new URLSearchParams(fields).toString(),
    })
  }

  test('STOP records the opt-out, tells the app, and answers empty TwiML', async () => {
    const changes: unknown[] = []
    const response = await handleTwilioInbound(twilioRequest({ From: '+13105550199', To: '+15550000000', Body: 'Stop', MessageSid: 'SM1' }), { authToken: token, publicUrl: url, onConsentChange: change => changes.push(change) })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/xml')
    expect(await response.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
    expect(await isPhoneOptedOut('+13105550199')).toBe(true)
    expect(changes).toEqual([{ phone: '+13105550199', kind: 'stop' }])
  })

  test('START clears it, and replies only when asked to', async () => {
    await optOutPhone('+13105550199')
    const changes: unknown[] = []
    const response = await handleTwilioInbound(twilioRequest({ From: '+13105550199', Body: 'START' }), { authToken: token, publicUrl: url, reply: true, appName: 'HQ', onConsentChange: change => changes.push(change) })
    expect(await response.text()).toContain('<Message>You are resubscribed to HQ texts. Reply STOP to unsubscribe.</Message>')
    expect(await isPhoneOptedOut('+13105550199')).toBe(false)
    expect(changes).toEqual([{ phone: '+13105550199', kind: 'start' }])
  })

  test('refuses a bad signature and an unconfigured token, changing nothing', async () => {
    expect((await handleTwilioInbound(twilioRequest({ From: '+13105550199', Body: 'STOP' }, { signWith: 'other' }), { authToken: token, publicUrl: url })).status).toBe(403)
    expect((await handleTwilioInbound(twilioRequest({ From: '+13105550199', Body: 'STOP' }), { authToken: '', publicUrl: url })).status).toBe(503)
    expect(await isPhoneOptedOut('+13105550199')).toBe(false)
  })

  test('checks the signature against APP_URL, not the proxied request URL', async () => {
    const appUrl = process.env.APP_URL
    process.env.APP_URL = 'https://app.test/'
    try {
      const request = twilioRequest({ From: '+13105550199', Body: 'STOP' }, { requestUrl: 'http://127.0.0.1:3008/api/sms/inbound' })
      expect((await handleTwilioInbound(request, { authToken: token })).status).toBe(200)
    }
    finally {
      if (appUrl === undefined) delete process.env.APP_URL
      else process.env.APP_URL = appUrl
    }
  })

  test('passes ordinary messages to the app without touching consent', async () => {
    const messages: unknown[] = []
    const changes: unknown[] = []
    await handleTwilioInbound(twilioRequest({ From: '+13105550101', To: '+15550000000', Body: 'Can I stop by at 6?', MessageSid: 'SM2' }), { authToken: token, publicUrl: url, onMessage: m => messages.push(m), onConsentChange: c => changes.push(c) })
    expect(messages).toEqual([{ from: '+13105550101', to: '+15550000000', body: 'Can I stop by at 6?', messageId: 'SM2', kind: 'message' }])
    expect(changes).toEqual([])
    expect(await isPhoneOptedOut('+13105550101')).toBe(false)
  })

  test('honours Twilio Advanced Opt-Out\'s OptOutType for custom keywords', () => {
    expect(inboundSmsKind({ Body: 'ARRET', OptOutType: 'STOP' })).toBe('stop')
    expect(inboundSmsKind({ Body: 'stop' })).toBe('stop')
    expect(inboundSmsKind({ Body: 'hello' })).toBe('message')
  })
})
