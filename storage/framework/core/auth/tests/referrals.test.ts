import type { ReferralDatabase } from '../src/referrals'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { attributeReferral, createReferralCode, normalizeReferralCode, qualifyReferral, referralSummary } from '../src/referrals'

let sqlite: Database
let db: ReferralDatabase

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON; CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users VALUES (1), (2), (3), (4);')
  for (const file of ['1785502251866-create-referrals-table.sql', '1785502251867-create-referral_codes-table.sql'])
    sqlite.exec(readFileSync(join(import.meta.dir, '../../../../../database/migrations', file), 'utf8'))
  db = {
    unsafe(sql, bindings = []) {
      return { async execute() {
        const statement = sqlite.prepare(sql)
        return sql.startsWith('SELECT') ? statement.all(...bindings as never[]) : statement.run(...bindings as never[])
      } }
    },
  }
})
afterEach(() => sqlite.close())

describe('native referrals', () => {
  test('allocates one code per user under concurrent requests', async () => {
    const codes = await Promise.all(Array.from({ length: 8 }, () => createReferralCode(1, db)))
    expect(new Set(codes).size).toBe(1)
    expect(normalizeReferralCode(codes[0])).toBe(codes[0])
    expect(await createReferralCode(2, db)).not.toBe(codes[0])
  })

  test('attributes once and never overwrites the original referrer', async () => {
    const first = await createReferralCode(1, db)
    const second = await createReferralCode(2, db)
    expect(await attributeReferral(3, first, db)).toBe(true)
    expect(await attributeReferral(3, first, db)).toBe(false)
    expect(await attributeReferral(3, second, db)).toBe(false)
    expect(await referralSummary(1, db)).toEqual({ code: first, referred: 1, qualified: 0 })
    expect((await referralSummary(2, db)).referred).toBe(0)
  })

  test('rejects self, malformed, and unknown codes without database writes', async () => {
    const code = await createReferralCode(1, db)
    for (const input of [code, '', "' OR 1=1 --", null, 'a'.repeat(24)])
      expect(await attributeReferral(1, input, db)).toBe(false)
    expect((await referralSummary(1, db)).referred).toBe(0)
  })

  test('qualifies only an attributed user and preserves first conversion time', async () => {
    const code = await createReferralCode(1, db)
    await attributeReferral(2, code, db)
    await qualifyReferral(2, db)
    sqlite.exec("UPDATE referrals SET qualified_at = '2026-01-01 00:00:00'")
    await qualifyReferral(2, db)
    await qualifyReferral(3, db)
    expect((sqlite.query('SELECT qualified_at FROM referrals').get() as { qualified_at: string }).qualified_at).toBe('2026-01-01 00:00:00')
    expect(await referralSummary(1, db)).toEqual({ code, referred: 1, qualified: 1 })
    expect(await referralSummary(4, db)).toEqual({ code: null, referred: 0, qualified: 0 })
  })

  test('propagates infrastructure failures and validates IDs', async () => {
    const broken: ReferralDatabase = { unsafe: () => ({ execute: async () => { throw new Error('database unavailable') } }) }
    await expect(createReferralCode(1, broken)).rejects.toThrow('database unavailable')
    await expect(attributeReferral(1, 'a'.repeat(24), broken)).rejects.toThrow('database unavailable')
    await expect(createReferralCode(0, db)).rejects.toThrow('positive integer')
    await expect(referralSummary(Number.NaN, db)).rejects.toThrow('positive integer')
  })
})
