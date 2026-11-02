import { createHash, randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db, lockRow, mutationCount, parseSqlDateTime } from '@stacksjs/database/runtime'

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
  /** Explicit lifetimes distinguish invitation/setup links from ordinary recovery links. */
  setup: boolean
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
  const owner = await db.primary.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst()
  if (!owner) return { consumed: false }
  const ttlMs = options.ttlMs ?? Number(config.auth.passwordReset?.expire ?? 60) * 60_000
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('Reset lifetime must be positive')

  return db.transaction(async (tx) => {
    // Match credential issuance/change lock order: stable owner first, token second.
    const user = await lockRow(tx, 'users', { id: Number(owner.id) })
    if (!user || String(user.email) !== email) return { consumed: false as const }
    const reset = await lockRow(tx, 'password_resets', { email })
    if (!reset || reset.token !== digest) return { consumed: false as const }
    const deadline = reset.expires_at == null
      ? (parseSqlDateTime(reset.created_at)?.getTime() ?? 0) + ttlMs
      : parseSqlDateTime(reset.expires_at)?.getTime() ?? 0
    if (!(deadline > Date.now())) {
      await db.deleteFrom('password_resets').where('email', '=', email).where('token', '=', digest).execute()
      return { consumed: false as const }
    }
    const value = await apply({ userId: Number(owner.id), email, setup: reset.expires_at != null })
    const deleted = await db.deleteFrom('password_resets').where('email', '=', email).where('token', '=', digest).execute()
    if (mutationCount(deleted) !== 1) throw new Error('Password reset token could not be consumed')
    return { consumed: true as const, value }
  })
}
