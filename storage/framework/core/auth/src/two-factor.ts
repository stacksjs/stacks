/**
 * TOTP Two-Factor Authentication
 *
 * Wraps the TOTP primitives in ./authenticator.ts with DB persistence
 * for `users.two_factor_secret` / `users.two_factor_enabled` and a
 * server-issued, single-use login challenge (`two_factor_challenges`)
 * that bridges LoginAction (password verified, 2FA pending) and
 * VerifyTwoFactorLoginAction (code verified, tokens minted).
 *
 * Setup flow (stacksjs/status#1 Phase 9):
 *   1. GenerateTwoFactorSecretAction generates a fresh secret + otpauth
 *      URI, stashes the secret server-side (two_factor_pending_secrets,
 *      not yet the real `users.two_factor_secret`), and returns both to
 *      the client for QR/manual-entry display.
 *   2. EnableTwoFactorAction takes only a `code` from the client — the
 *      secret it verifies against is the server-stashed pending one,
 *      never a client-supplied value, so a client that echoes back a
 *      stale or tampered secret can't silently enable 2FA against
 *      something other than what generate-step actually issued. Same
 *      "don't trust the client for security material" rule
 *      passkey.ts's WebAuthn challenges follow (stacksjs/stacks#1866).
 *      Only once the code verifies does the pending secret get
 *      promoted to `users.two_factor_secret` and `two_factor_enabled`
 *      flip to true.
 *
 * Login flow:
 *   1. LoginAction verifies the password (Auth.attempt), and if
 *      `two_factor_enabled` is set, creates a challenge row instead of
 *      minting tokens.
 *   2. VerifyTwoFactorLoginAction consumes the challenge, verifies the
 *      submitted code against the stored secret, and mints tokens via
 *      Auth.loginUsingId().
 */

import { randomBytes } from 'node:crypto'
import { db, getDatabaseDialect, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { verifyTOTPWithCounter } from '@stacksjs/ts-auth'
import { generateTwoFactorSecret, generateTwoFactorUri, twoFactorQrCode, verifyTwoFactorCode } from './authenticator'
import { RateLimiter } from './rate-limiter'

const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60

function challengeExpiry(ttlSeconds: number): string {
  const deadline = new Date(Date.now() + ttlSeconds * 1000)
  // The shipped MySQL DATETIME stores whole seconds. Never extend a grant
  // by letting the server round upward, and compare stored setup deadlines
  // against a value that schema can actually represent.
  if (getDatabaseDialect() === 'mysql') deadline.setUTCMilliseconds(0)
  return sqlDateTime(deadline)
}

/**
 * Rate-limit key prefix for the SECOND factor. Deliberately distinct from the
 * password-step limiter (which is keyed by bare email and reset on a correct
 * password) so a valid password can never clear an in-progress 2FA lockout —
 * that reset was exactly what let a password-holding attacker brute-force
 * TOTP by looping fresh challenges. stacksjs/stacks#1985.
 */
const TWO_FACTOR_RATE_LIMIT_PREFIX = '2fa:'

/** Read the primary replay marker. Database failures must not authorize. */
async function getLastUsedTwoFactorStep(userId: number): Promise<number | null> {
  const row = await db.primary.selectFrom('users').where('id', '=', userId).select(['two_factor_last_used_step']).executeTakeFirst()
  const value = row?.two_factor_last_used_step
  return value == null ? null : Number(value)
}

/** Claim only the enabled secret and replay marker that this request read. */
async function claimTwoFactorStep(userId: number, secret: string, step: number, lastStep: number | null): Promise<boolean> {
  let claim = db.updateTable('users')
    .set({ two_factor_last_used_step: step })
    .where('id', '=', userId)
    .where('two_factor_secret', '=', secret)
    .where('two_factor_enabled', '=', true)
  claim = lastStep === null
    ? claim.whereNull('two_factor_last_used_step')
    : claim.where('two_factor_last_used_step', '=', lastStep)
  return mutationCount(await claim.execute()) === 1
}

export interface TwoFactorUser {
  id: number
  email?: string
  two_factor_secret?: string | null
  two_factor_enabled?: boolean | number | null
}

/**
 * Reads `two_factor_secret`/`two_factor_enabled` directly — these are
 * guarantee-ALTER columns (see ensureUsersAuthColumns), not part of
 * the User model's typed `attributes`, so callers query them the same
 * way email-verification.ts reads email_verified_at: raw db access,
 * not the ORM model.
 */
export async function getTwoFactorState(userId: number): Promise<{ secret: string | null, enabled: boolean }> {
  // A lagged replica can still say disabled after the user enabled 2FA.
  const row = await db.primary
    .selectFrom('users')
    .where('id', '=', userId)
    .select(['two_factor_secret', 'two_factor_enabled'])
    .executeTakeFirst()

  return {
    secret: (row?.two_factor_secret as string | null) ?? null,
    enabled: Boolean(row?.two_factor_enabled),
  }
}

export function isTwoFactorEnabled(user: TwoFactorUser): boolean {
  return Boolean(user.two_factor_enabled)
}

/**
 * Generate a new (unpersisted) secret + otpauth:// URI for setup, along with
 * the URI rendered as a scannable QR code.
 *
 * The QR code comes back here rather than being left to the caller because
 * every setup screen needs one, and a caller that has to find its own encoder
 * either ships one to the browser or falls back to asking the user to type a
 * 32-character secret by hand. Clients that render their own still have `uri`.
 */
export function generateTwoFactorSetup(email: string, serviceName?: string): { secret: string, uri: string, qr: string } {
  const secret = generateTwoFactorSecret()
  const uri = generateTwoFactorUri(email, serviceName, secret)
  return { secret, uri, qr: twoFactorQrCode(uri) }
}

const PENDING_SECRET_TTL_SECONDS = 10 * 60

/**
 * Stash a freshly generated secret server-side while the user goes
 * scan/enter it into their authenticator app. Single pending secret
 * per user. Replacing it is one atomic upsert so a failed write preserves
 * the prior setup and simultaneous setup requests cannot collide.
 */
export async function stashPendingTwoFactorSecret(userId: number, secret: string, ttlSeconds: number = PENDING_SECRET_TTL_SECONDS): Promise<void> {
  const expiresAt = challengeExpiry(ttlSeconds)

  await db.transaction(async () => {
    await db.upsert('two_factor_pending_secrets', [{
      user_id: userId, secret, expires_at: expiresAt,
    }], ['user_id'], ['secret', 'expires_at'])
    // Triggers can suppress a write without throwing. Check under the same
    // transaction lock so another setup cannot replace our row before reading.
    const stored = await db.primary.selectFrom('two_factor_pending_secrets')
      .where('user_id', '=', userId).select(['secret', 'expires_at']).executeTakeFirst()
    if (stored?.secret !== secret || parseSqlDateTime(stored.expires_at)?.getTime() !== parseSqlDateTime(expiresAt)?.getTime())
      throw new Error('[auth] Pending two-factor setup could not be stored.')
  })
}

/**
 * Consume (delete-on-read) the pending secret stashed for a user, or
 * null if none exists / it expired.
 */
export async function consumePendingTwoFactorSecret(userId: number): Promise<string | null> {
  const row = await db.primary
    .selectFrom('two_factor_pending_secrets')
    .where('user_id', '=', userId)
    .selectAll()
    .executeTakeFirst()

  if (!row) return null

  // Claim the version we read. A replacement secret must not be deleted by
  // an older consumer, and only the request that actually deletes may win.
  const claimed = await db
    .deleteFrom('two_factor_pending_secrets')
    .where('user_id', '=', userId)
    .where('secret', '=', row.secret)
    .where('expires_at', '=', row.expires_at)
    .execute()

  if (mutationCount(claimed) !== 1) return null
  const expiresAt = parseSqlDateTime(row.expires_at)?.getTime() ?? 0
  if (Date.now() >= expiresAt) return null

  return String(row.secret)
}

/**
 * Verify the setup code against the not-yet-persisted secret and, if
 * valid, persist it + flip `two_factor_enabled` on.
 */
export async function enableTwoFactor(userId: number, secret: string, code: string): Promise<boolean> {
  const valid = await verifyTwoFactorCode(code, secret)
  if (!valid) return false

  return persistTwoFactorState(userId, secret, true)
}

export async function disableTwoFactor(userId: number): Promise<void> {
  await persistTwoFactorState(userId, null, false)
}

async function persistTwoFactorState(userId: number, secret: string | null, enabled: boolean): Promise<boolean> {
  return db.transaction(async () => {
    await db.updateTable('users')
      .set({ two_factor_secret: secret, two_factor_enabled: enabled })
      .where('id', '=', userId).execute()

    // A successful query is not proof that a trigger accepted the requested
    // state. Check while the write lock is held and roll back altered writes.
    // Same-state updates remain valid even on drivers reporting zero changes.
    const stored = await db.primary.selectFrom('users').where('id', '=', userId)
      .select(['two_factor_secret', 'two_factor_enabled']).executeTakeFirst()
    if (!stored) return false
    if (stored.two_factor_secret !== secret || Boolean(stored.two_factor_enabled) !== enabled)
      throw new Error('[auth] Two-factor state could not be stored.')
    return true
  })
}

/**
 * Verify a live login/dashboard-reauth code against the user's
 * already-persisted secret.
 */
export async function verifyTwoFactorLoginCode(userId: number, code: string): Promise<boolean> {
  // Account-scoped throttle on the SECOND factor. Without it, an attacker who
  // already holds the victim's password could brute-force the 6-digit TOTP by
  // looping LoginAction (fresh challenge each time) — the per-IP route limit
  // is bypassable via IP rotation, and the password-step limiter is reset by
  // the correct password. Throws HttpError(429) when locked out, exactly like
  // the password step (Auth.attempt). stacksjs/stacks#1985.
  const rateKey = `${TWO_FACTOR_RATE_LIMIT_PREFIX}${userId}`
  await RateLimiter.validateAttempt(rateKey)

  const { secret, enabled } = await getTwoFactorState(userId)
  if (!enabled || !secret)
    return false

  const { valid, counter: step } = await verifyTOTPWithCounter(code, { secret })
  if (!valid || step === null) {
    // Only a genuine wrong code counts toward the lockout; a fresh valid code
    // clears the counter so a legitimate user is never progressively locked.
    await RateLimiter.recordFailedAttempt(rateKey)
    return false
  }

  // TOTP replay guard (stacksjs/stacks#1985): a code stays valid for its whole
  // ~30s step (plus ts-auth's ±1 verify window), so the same 6 digits would
  // otherwise be reusable until they expire. Reject any code whose step we've
  // already consumed. Not counted against the rate limiter (it's a replayed
  // valid code, not a wrong guess, e.g. a double-submitted form). Persist the
  // MATCHED counter, not the server clock: a code accepted from either side
  // of the clock-skew window must stay consumed as the server clock advances.
  const lastStep = await getLastUsedTwoFactorStep(userId)
  if (lastStep !== null && step <= lastStep)
    return false

  if (!await claimTwoFactorStep(userId, secret, step, lastStep))
    return false
  await RateLimiter.resetAttempts(rateKey)
  return true
}

/**
 * Create a single-use, short-lived login challenge for a user whose
 * password just verified but who still needs to supply a TOTP code.
 * Mirrors storeWebAuthnChallenge's delete-then-insert shape, keyed by
 * an opaque random id instead of (user_id, purpose) since a user can
 * only have one login attempt in flight that matters here.
 */
export async function createTwoFactorChallenge(userId: number, ttlSeconds: number = DEFAULT_CHALLENGE_TTL_SECONDS): Promise<string> {
  const id = randomBytes(32).toString('hex')
  const expiresAt = challengeExpiry(ttlSeconds)

  await db.transaction(async () => {
    await db.deleteFrom('two_factor_challenges').where('user_id', '=', userId).execute()

    await db.insertInto('two_factor_challenges').values({
      id,
      user_id: userId,
      expires_at: expiresAt,
    } as never).execute()

    // Never invalidate the prior login attempt unless its replacement was
    // actually stored. Silent or altered inserts must roll back the deletion.
    const stored = await db.primary.selectFrom('two_factor_challenges')
      .where('user_id', '=', userId).select('id').execute()
    if (stored.length !== 1 || stored[0]?.id !== id)
      throw new Error('[auth] Two-factor login challenge could not be stored.')
  })

  return id
}

/**
 * Consume (delete-on-read) a login challenge and return the user id it
 * was issued for, or null if missing/expired.
 */
export async function consumeTwoFactorChallenge(challengeToken: string): Promise<number | null> {
  const row = await db.primary
    .selectFrom('two_factor_challenges')
    .where('id', '=', challengeToken)
    .selectAll()
    .executeTakeFirst()

  if (!row) return null

  const claimed = await db
    .deleteFrom('two_factor_challenges')
    .where('id', '=', challengeToken)
    .execute()

  if (mutationCount(claimed) !== 1) return null
  const expiresAt = parseSqlDateTime(row.expires_at)?.getTime() ?? 0
  if (Date.now() >= expiresAt) return null

  return Number(row.user_id)
}

/**
 * Consume a challenge and complete login while holding recovery's owner lock.
 * A reset either revokes this challenge first or revokes the issued tokens
 * afterward. It cannot commit between the second factor and token issuance.
 */
export async function withTwoFactorChallenge<T>(challengeToken: string, complete: (userId: number) => Promise<T>): Promise<T | null> {
  const pending = await db.primary.selectFrom('two_factor_challenges')
    .where('id', '=', challengeToken).select('user_id').executeTakeFirst()
  if (!pending) return null
  const userId = Number(pending.user_id)

  const outcome = await db.transaction(async () => {
    let owner = db.primary.selectFrom('users').where('id', '=', userId).select('id')
    if (getDatabaseDialect() !== 'sqlite') owner = owner.lockForUpdate()
    if (!await owner.executeTakeFirst()) return { value: null }
    // Re-read and claim AFTER the lock: recovery may have removed the row
    // while we waited. DELETE's affected count also rejects stale snapshots.
    if (await consumeTwoFactorChallenge(challengeToken) !== userId) return { value: null }
    try {
      // Roll back incomplete issuance without reviving the single-use grant.
      // The outer transaction commits consumption even when verification or
      // issuance throws, matching the existing delete-before-verify contract.
      return { value: await db.transaction(() => complete(userId)) }
    }
    catch (error) { return { error } }
  })
  if ('error' in outcome) throw outcome.error
  return outcome.value
}

/** Revoke password-stage grants in the same transaction as credential recovery. */
export async function revokeTwoFactorChallenges(userId: number): Promise<void> {
  try {
    // The savepoint also isolates an absent optional table on PostgreSQL.
    await db.transaction(async () => {
      await db.deleteFrom('two_factor_challenges').where('user_id', '=', userId).execute()
      const remaining = await db.primary.selectFrom('two_factor_challenges')
        .where('user_id', '=', userId).select('id').executeTakeFirst()
      if (remaining)
        throw new Error('[auth] Two-factor login challenges could not be revoked.')
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // An installation without this table cannot redeem a challenge. Do not
    // hide a failed DELETE caused by a missing trigger dependency instead.
    if (/^(?:no such table: (?:main\.)?two_factor_challenges|relation "two_factor_challenges" does not exist|Table '(?:[^'.]+\.)?two_factor_challenges' doesn't exist)$/i.test(message))
      return
    throw error
  }
}

export const TwoFactor = {
  isEnabled: isTwoFactorEnabled,
  getState: getTwoFactorState,
  generateSetup: generateTwoFactorSetup,
  stashPendingSecret: stashPendingTwoFactorSecret,
  consumePendingSecret: consumePendingTwoFactorSecret,
  enable: enableTwoFactor,
  disable: disableTwoFactor,
  verifyLoginCode: verifyTwoFactorLoginCode,
  createChallenge: createTwoFactorChallenge,
  consumeChallenge: consumeTwoFactorChallenge,
}
