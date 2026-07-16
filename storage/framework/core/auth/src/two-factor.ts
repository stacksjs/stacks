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
import { db } from '@stacksjs/database'
import { generateTwoFactorSecret, generateTwoFactorUri, verifyTwoFactorCode } from './authenticator'
import { RateLimiter } from './rate-limiter'

const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60

/**
 * Rate-limit key prefix for the SECOND factor. Deliberately distinct from the
 * password-step limiter (which is keyed by bare email and reset on a correct
 * password) so a valid password can never clear an in-progress 2FA lockout —
 * that reset was exactly what let a password-holding attacker brute-force
 * TOTP by looping fresh challenges. stacksjs/stacks#1985.
 */
const TWO_FACTOR_RATE_LIMIT_PREFIX = '2fa:'

// TOTP step in seconds — matches ts-auth's default (verifyTwoFactorCode calls
// verifyTOTP with no override, so the period is 30s).
const TWO_FACTOR_STEP_SECONDS = 30

/** Current TOTP time-step, i.e. ts-auth's `floor(now / step)` counter. */
function currentTotpStep(): number {
  return Math.floor(Date.now() / 1000 / TWO_FACTOR_STEP_SECONDS)
}

/**
 * Best-effort read of `users.two_factor_last_used_step`. Returns null on any
 * error or a missing column (un-migrated DB) so replay protection degrades to
 * "allow" rather than locking anyone out — same legacy-allow stance as
 * getPasswordChangedAt (stacksjs/stacks#1985).
 */
async function getLastUsedTwoFactorStep(userId: number): Promise<number | null> {
  try {
    const row: any = await db.selectFrom('users').where('id', '=', userId).selectAll().executeTakeFirst()
    const value = row?.two_factor_last_used_step
    return value == null ? null : Number(value)
  }
  catch {
    return null
  }
}

/** Best-effort persist of the consumed TOTP step; no-op on an un-migrated DB. */
async function setLastUsedTwoFactorStep(userId: number, step: number): Promise<void> {
  try {
    await db.updateTable('users').set({ two_factor_last_used_step: step } as any).where('id', '=', userId).executeTakeFirst()
  }
  catch {
    // Column missing (un-migrated) — skip; replay protection stays off.
  }
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
  const row = await db
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
 * Generate a new (unpersisted) secret + otpauth:// URI for setup.
 */
export function generateTwoFactorSetup(email: string, serviceName?: string): { secret: string, uri: string } {
  const secret = generateTwoFactorSecret()
  const uri = generateTwoFactorUri(email, serviceName, secret)
  return { secret, uri }
}

const PENDING_SECRET_TTL_SECONDS = 10 * 60

/**
 * Stash a freshly generated secret server-side while the user goes
 * scan/enter it into their authenticator app. Single pending secret
 * per user — generating a new one invalidates any prior unconfirmed
 * attempt, same delete-then-insert shape as storeWebAuthnChallenge.
 */
export async function stashPendingTwoFactorSecret(userId: number, secret: string, ttlSeconds: number = PENDING_SECRET_TTL_SECONDS): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  await db
    .deleteFrom('two_factor_pending_secrets')
    .where('user_id', '=', userId)
    .execute()

  await db
    .insertInto('two_factor_pending_secrets')
    .values({
      user_id: userId,
      secret,
      expires_at: expiresAt,
    } as never)
    .execute()
}

/**
 * Consume (delete-on-read) the pending secret stashed for a user, or
 * null if none exists / it expired.
 */
export async function consumePendingTwoFactorSecret(userId: number): Promise<string | null> {
  const row = await db
    .selectFrom('two_factor_pending_secrets')
    .where('user_id', '=', userId)
    .selectAll()
    .executeTakeFirst()

  if (!row) return null

  await db
    .deleteFrom('two_factor_pending_secrets')
    .where('user_id', '=', userId)
    .execute()

  const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0
  if (Date.now() > expiresAt) return null

  return String(row.secret)
}

/**
 * Verify the setup code against the not-yet-persisted secret and, if
 * valid, persist it + flip `two_factor_enabled` on.
 */
export async function enableTwoFactor(userId: number, secret: string, code: string): Promise<boolean> {
  const valid = await verifyTwoFactorCode(code, secret)
  if (!valid) return false

  await db
    .updateTable('users')
    .set({ two_factor_secret: secret, two_factor_enabled: true })
    .where('id', '=', userId)
    .executeTakeFirst()

  return true
}

export async function disableTwoFactor(userId: number): Promise<void> {
  await db
    .updateTable('users')
    .set({ two_factor_secret: null, two_factor_enabled: false })
    .where('id', '=', userId)
    .executeTakeFirst()
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

  const valid = await verifyTwoFactorCode(code, secret)
  if (!valid) {
    // Only a genuine wrong code counts toward the lockout; a fresh valid code
    // clears the counter so a legitimate user is never progressively locked.
    await RateLimiter.recordFailedAttempt(rateKey)
    return false
  }

  // TOTP replay guard (stacksjs/stacks#1985): a code stays valid for its whole
  // ~30s step (plus ts-auth's ±1 verify window), so the same 6 digits would
  // otherwise be reusable until they expire. Reject any code whose step we've
  // already consumed. Not counted against the rate limiter (it's a replayed
  // *valid* code, not a wrong guess — e.g. a double-submitted form). Residual:
  // a code accepted via the +1 future window isn't covered, acceptable since
  // every verify already needs a fresh single-use challenge.
  const step = currentTotpStep()
  const lastStep = await getLastUsedTwoFactorStep(userId)
  if (lastStep !== null && step <= lastStep)
    return false

  await setLastUsedTwoFactorStep(userId, step)
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
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  await db
    .deleteFrom('two_factor_challenges')
    .where('user_id', '=', userId)
    .execute()

  await db
    .insertInto('two_factor_challenges')
    .values({
      id,
      user_id: userId,
      expires_at: expiresAt,
    } as never)
    .execute()

  return id
}

/**
 * Consume (delete-on-read) a login challenge and return the user id it
 * was issued for, or null if missing/expired.
 */
export async function consumeTwoFactorChallenge(challengeToken: string): Promise<number | null> {
  const row = await db
    .selectFrom('two_factor_challenges')
    .where('id', '=', challengeToken)
    .selectAll()
    .executeTakeFirst()

  if (!row) return null

  await db
    .deleteFrom('two_factor_challenges')
    .where('id', '=', challengeToken)
    .execute()

  const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0
  if (Date.now() > expiresAt) return null

  return Number(row.user_id)
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
