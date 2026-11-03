import { createHash, randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db, lockRow, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { findAuthUserRowByEmail, normalizeAuthEmail } from '../credential-user'
import { deletePasswordResetCredentials, pendingPasswordResetCredentials } from './reset-store'

/** High-entropy reset credentials support indexed lookup without storing a usable token. */
export function passwordResetTokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function mintPasswordResetToken(): { token: string, digest: string } {
  const token = randomBytes(32).toString('hex')
  return { token, digest: passwordResetTokenDigest(token) }
}

export interface PasswordResetClaim {
  userId: number
  email: string
  /** Whether issuance set its own deadline. Applications decide the link's purpose. */
  hasExplicitExpiry: boolean
}

export interface PasswordResetIssueOptions {
  /** Minimum interval between issuance, checked under the account lock. Zero disables throttling. */
  throttleMs?: number
  /** An explicit deadline for an invitation or first-password link. */
  expiresAt?: Date
  /** Application eligibility against the fresh, locked account. Keep this predicate synchronous. */
  eligible?: (user: Readonly<Record<string, unknown>>) => boolean
}

/** Issue one indexed recovery credential, serializing eligibility, throttling and replacement. */
export async function issuePasswordResetToken(
  address: string,
  options: PasswordResetIssueOptions = {},
): Promise<{ issued: false } | { issued: true, token: string, userId: number, email: string }> {
  const email = normalizeAuthEmail(address)
  const throttleMs = options.throttleMs ?? Number(config.auth.passwordReset?.throttle ?? 60) * 1000
  if (!Number.isFinite(throttleMs) || throttleMs < 0) throw new RangeError('Reset throttle must be nonnegative')
  if (options.expiresAt !== undefined && (!(options.expiresAt instanceof Date) || !(options.expiresAt.getTime() > Date.now())))
    throw new RangeError('Reset expiry must be a future date')
  const observed = await findAuthUserRowByEmail(email)
  if (!observed) return { issued: false }
  return db.transaction(async (tx) => {
    const user = await lockRow(tx, 'users', { id: Number(observed.id) })
    if (!user || normalizeAuthEmail(String(user.email)) !== email || (options.eligible && options.eligible(user) !== true)) return { issued: false as const }
    const now = Date.now()
    const pending = await pendingPasswordResetCredentials(email)
    const createdAt = pending.reduce((latest, credential) => Math.max(latest, parseSqlDateTime(credential.created_at)?.getTime() ?? Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY)
    if (throttleMs > 0 && now < createdAt + throttleMs) return { issued: false as const }
    if (options.expiresAt !== undefined && !(options.expiresAt.getTime() > now))
      throw new RangeError('Reset expiry must be a future date')
    // Keep the account binding in the opaque credential: an address may be
    // reassigned before redemption, but its old recovery must never reset the
    // successor account. The stored value remains a digest only.
    const token = `${Number(observed.id)}.${mintPasswordResetToken().token}`
    await deletePasswordResetCredentials(email)
    const saved = await db.insertInto('password_resets').values({ email, token: passwordResetTokenDigest(token), created_at: sqlDateTime(new Date(now)), expires_at: options.expiresAt ? sqlDateTime(options.expiresAt) : null }).execute()
    if (mutationCount(saved) !== 1) throw new Error('Password reset token could not be issued')
    return { issued: true as const, token, userId: Number(observed.id), email }
  })
}

/**
 * Redeem a SHA-256 reset credential and apply account changes in one transaction.
 * Issuance stores mintPasswordResetToken().digest in password_resets.token.
 * The callback must contain database work only; notify the person after commit.
 * A callback failure restores the token, and competing redeemers cannot both win.
 */
export async function consumePasswordResetToken<T>(
  token: string,
  apply: (claim: PasswordResetClaim) => Promise<T>,
  options: { ttlMs?: number } = {},
): Promise<{ consumed: false } | { consumed: true, value: T }> {
  if (!token || token.length > 1024) return { consumed: false }
  const digest = passwordResetTokenDigest(token)
  const observed = await db.primary.selectFrom('password_resets').select(['email']).where('token', '=', digest).executeTakeFirst()
  if (!observed) return { consumed: false }
  const email = String(observed.email)
  const owner = await findAuthUserRowByEmail(email)
  if (!owner) return { consumed: false }
  const boundAccount = /^([1-9]\d*)\.[a-f0-9]{64}$/.exec(token)?.[1]
  if (boundAccount && boundAccount !== String(owner.id)) return { consumed: false }
  const ttlMs = options.ttlMs ?? Number(config.auth.passwordReset?.expire ?? 60) * 60_000
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('Reset lifetime must be positive')

  return db.transaction(async (tx) => {
    // Match credential issuance/change lock order: stable owner first, token second.
    const user = await lockRow(tx, 'users', { id: Number(owner.id) })
    if (!user || normalizeAuthEmail(String(user.email)) !== normalizeAuthEmail(email)) return { consumed: false as const }
    const reset = await lockRow(tx, 'password_resets', { email })
    if (!reset || reset.token !== digest) return { consumed: false as const }
    const deadline = reset.expires_at == null
      ? (parseSqlDateTime(reset.created_at)?.getTime() ?? 0) + ttlMs
      : parseSqlDateTime(reset.expires_at)?.getTime() ?? 0
    if (!(deadline > Date.now())) {
      await db.deleteFrom('password_resets').where('email', '=', email).where('token', '=', digest).execute()
      return { consumed: false as const }
    }
    // Spend the credential before account work, in the same transaction. A
    // credential sweep may delete other recovery rows; rollback restores this
    // one too if either the account mutation or that sweep fails.
    const deleted = await db.deleteFrom('password_resets').where('email', '=', email).where('token', '=', digest).execute()
    if (mutationCount(deleted) !== 1) throw new Error('Password reset token could not be consumed')
    const value = await apply({ userId: Number(owner.id), email, hasExplicitExpiry: reset.expires_at != null })
    return { consumed: true as const, value }
  })
}
