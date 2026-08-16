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

const releaseDbConfigLock = await acquireDbConfigLock()

async function forceConfig(): Promise<void> {
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })
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
  releaseDbConfigLock()
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
