import { randomBytes } from 'node:crypto'

/** Minimal database contract, also accepted by transaction-scoped connections. */
export interface ReferralDatabase {
  unsafe: (sql: string, bindings?: unknown[]) => { execute: () => Promise<unknown> }
}

export interface ReferralCode {
  code: string
  user_id: number
}

export interface ReferralSummary {
  code: string | null
  referred: number
  qualified: number
}

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toLowerCase()
  return /^[a-f0-9]{24}$/.test(code) ? code : null
}

function userId(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TypeError('A positive integer user ID is required.')
}

async function connection(database?: ReferralDatabase): Promise<ReferralDatabase> {
  return database ?? (await import('@stacksjs/database')).db as unknown as ReferralDatabase
}

async function rows<T>(database: ReferralDatabase, sql: string, bindings: unknown[]): Promise<T[]> {
  const result = await database.unsafe(sql, bindings).execute()
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('The referral query returned an unsupported result.')
}

async function duplicate(error: unknown): Promise<boolean> {
  const { isUniqueViolation } = await import('@stacksjs/orm')
  return isUniqueViolation(error)
}

/** Stable, unguessable share code. The unique user constraint handles concurrent creation. */
export async function createReferralCode(ownerId: number, database?: ReferralDatabase): Promise<string> {
  userId(ownerId)
  const db = await connection(database)
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await rows<ReferralCode>(db, 'SELECT code, user_id FROM referral_codes WHERE user_id = ?', [ownerId])
    if (existing[0]) return existing[0].code
    const code = randomBytes(12).toString('hex')
    try {
      await db.unsafe('INSERT INTO referral_codes (user_id, code) VALUES (?, ?)', [ownerId, code]).execute()
      return code
    }
    catch (error) {
      if (!await duplicate(error)) throw error
    }
  }
  throw new Error('Could not allocate a referral code. Please retry.')
}

/**
 * First attribution wins. Call only from trusted new-account creation, never a
 * public claim endpoint. Pass the registration transaction to commit together.
 * Invalid, unknown, repeated, and self referrals do not disrupt registration.
 */
export async function attributeReferral(newUserId: number, input: unknown, database?: ReferralDatabase): Promise<boolean> {
  userId(newUserId)
  const code = normalizeReferralCode(input)
  if (!code) return false
  const db = await connection(database)
  const owner = (await rows<ReferralCode>(db, 'SELECT code, user_id FROM referral_codes WHERE code = ?', [code]))[0]
  if (!owner || Number(owner.user_id) === newUserId) return false
  try {
    await db.unsafe(
      'INSERT INTO referrals (referrer_id, referred_user_id, code, status) VALUES (?, ?, ?, ?)',
      [Number(owner.user_id), newUserId, code, 'registered'],
    ).execute()
    return true
  }
  catch (error) {
    if (await duplicate(error)) return false
    throw error
  }
}

/** Server-only conversion hook. Replays preserve the first qualification time. */
export async function qualifyReferral(referredUserId: number, database?: ReferralDatabase): Promise<void> {
  userId(referredUserId)
  const db = await connection(database)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await db.unsafe(
    'UPDATE referrals SET status = ?, qualified_at = ?, updated_at = ? WHERE referred_user_id = ? AND status = ?',
    ['qualified', now, now, referredUserId, 'registered'],
  ).execute()
}

/** Aggregate only: a referrer never receives another account's email or profile. */
export async function referralSummary(ownerId: number, database?: ReferralDatabase): Promise<ReferralSummary> {
  userId(ownerId)
  const db = await connection(database)
  const codes = await rows<ReferralCode>(db, 'SELECT code, user_id FROM referral_codes WHERE user_id = ?', [ownerId])
  const counts = await rows<{ total: number, qualified: number }>(db,
    'SELECT COUNT(*) AS total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS qualified FROM referrals WHERE referrer_id = ?',
    ['qualified', ownerId])
  return { code: codes[0]?.code ?? null, referred: Number(counts[0]?.total ?? 0), qualified: Number(counts[0]?.qualified ?? 0) }
}
