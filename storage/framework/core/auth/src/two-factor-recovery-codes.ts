import { createHash, randomBytes } from 'node:crypto'
import { db, getDatabaseDialect, mutationCount, parseSqlDateTime } from '@stacksjs/database/runtime'
import { RateLimiter } from './rate-limiter'
import { disableTwoFactor, enableTwoFactor, getTwoFactorState, revokeTwoFactorRecoveryCodes, verifyTwoFactorLoginCode } from './two-factor'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')

/** Serialize factor changes with password recovery and completed login. */
async function withOwner<T>(userId: number, work: () => Promise<T>): Promise<T> {
  return db.transaction(async () => {
    let owner = db.primary.selectFrom('users').where('id', '=', userId).select('id')
    if (getDatabaseDialect() !== 'sqlite') owner = owner.lockForUpdate()
    if (!await owner.executeTakeFirst()) throw new Error('Account no longer exists')
    return work()
  })
}

/** Return plaintext once. Only hashes and the current factor version persist. */
export async function generateTwoFactorRecoveryCodes(userId: number): Promise<string[]> {
  return withOwner(userId, async () => {
    const factor = await getTwoFactorState(userId)
    if (!factor.enabled || !factor.secret) throw new Error('Two-factor authentication is not enabled')
    const codes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'))
    await revokeTwoFactorRecoveryCodes(userId)
    await db.insertInto('two_factor_recovery_codes').values(codes.map(code => ({
      user_id: userId, code_hash: digest(code), secret_digest: digest(factor.secret!),
    }))).execute()
    return codes.map(code => code.match(/.{8}/g)!.join('-'))
  })
}

export async function remainingTwoFactorRecoveryCodes(userId: number): Promise<number> {
  const factor = await getTwoFactorState(userId)
  if (!factor.enabled || !factor.secret) return 0
  return (await db.primary.selectFrom('two_factor_recovery_codes').select('code_hash')
    .where('user_id', '=', userId).where('secret_digest', '=', digest(factor.secret)).execute()).length
}

/** A recovery code is another second factor, with the same account lockout. */
export async function verifyTwoFactorRecoveryCode(userId: number, value: string): Promise<boolean> {
  const rateKey = `2fa:${userId}`
  await RateLimiter.validateAttempt(rateKey)
  const code = value.replace(/[\s-]/g, '').toLowerCase()
  const verified = /^[a-f0-9]{32}$/.test(code) && await withOwner(userId, async () => {
    const factor = await getTwoFactorState(userId)
    if (!factor.enabled || !factor.secret) return false
    const claimed = await db.deleteFrom('two_factor_recovery_codes').where('user_id', '=', userId)
      .where('code_hash', '=', digest(code)).where('secret_digest', '=', digest(factor.secret)).execute()
    return mutationCount(claimed) === 1
  })
  if (verified) await RateLimiter.resetAttempts(rateKey)
  else await RateLimiter.recordFailedAttempt(rateKey)
  return verified
}

export async function verifyTwoFactorCredential(userId: number, code: string): Promise<boolean> {
  return /^\d{6}$/.test(code) ? verifyTwoFactorLoginCode(userId, code) : verifyTwoFactorRecoveryCode(userId, code)
}

/** Management operations require fresh proof of the current factor. */
export async function disableTwoFactorWithCode(userId: number, code: string): Promise<boolean> {
  return withOwner(userId, async () => {
    if (!await verifyTwoFactorCredential(userId, code)) return false
    await disableTwoFactor(userId)
    return true
  })
}

export async function regenerateTwoFactorRecoveryCodes(userId: number, code: string): Promise<string[] | null> {
  return withOwner(userId, async () => {
    if (!await verifyTwoFactorCredential(userId, code)) return null
    return generateTwoFactorRecoveryCodes(userId)
  })
}

export type TwoFactorSetupResult = { enabled: true, recoveryCodes: string[] } | { enabled: false, reason: 'missing' | 'invalid' | 'already_enabled' }

/** A mistyped setup code keeps the same QR usable; promotion and backup codes commit together. */
export async function confirmTwoFactorSetup(userId: number, code: string): Promise<TwoFactorSetupResult> {
  return withOwner<TwoFactorSetupResult>(userId, async () => {
    if ((await getTwoFactorState(userId)).enabled) return { enabled: false, reason: 'already_enabled' }
    const pending = await db.primary.selectFrom('two_factor_pending_secrets').select(['secret', 'expires_at'])
      .where('user_id', '=', userId).executeTakeFirst()
    if (!pending || (parseSqlDateTime(pending.expires_at)?.getTime() ?? 0) <= Date.now()) return { enabled: false, reason: 'missing' }
    if (!await enableTwoFactor(userId, String(pending.secret), code)) return { enabled: false, reason: 'invalid' }
    const recoveryCodes = await generateTwoFactorRecoveryCodes(userId)
    await db.deleteFrom('two_factor_pending_secrets').where('user_id', '=', userId).execute()
    await db.deleteFrom('two_factor_challenges').where('user_id', '=', userId).execute()
    return { enabled: true, recoveryCodes }
  })
}
