/**
 * Email Verification System
 *
 * Provides email verification functionality similar to Laravel's
 * MustVerifyEmail trait and verification flow.
 *
 * @example
 * import { sendVerificationEmail, verifyEmail, isEmailVerified } from '@stacksjs/auth'
 *
 * await sendVerificationEmail(user)
 * await verifyEmail(userId, token)
 */

import { Buffer } from 'node:buffer'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db, enqueueAfterCommit, getDatabaseDialect, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'

export interface EmailVerificationResult {
  success: boolean
  message?: string
}

/**
 * Resolve the HMAC signing key from `config.app.key`. The previous
 * implementation silently fell back to the literal `'stacks-default-key'`
 * if `APP_KEY` was unset — anyone reading the source could forge
 * verification tokens against any install that hadn't generated its
 * own key yet. This throws instead so the boot fails loud and the
 * deployer knows to run `./buddy key:generate` (stacksjs/stacks#1861 A-1).
 */
function getVerificationKey(): string {
  const appKey = config.app.key
  if (typeof appKey !== 'string' || appKey.length === 0) {
    throw new Error(
      '[auth] config.app.key is not set - email-verification HMAC requires a real APP_KEY. '
      + 'Run `./buddy key:generate` to provision one, or set the APP_KEY env var before booting the app.',
    )
  }
  return appKey
}

/**
 * Generate an HMAC-based verification token.
 * Uses the user ID and a random nonce so that each token is unique.
 */
function generateVerificationToken(userId: number): { token: string, hash: string } {
  const nonce = randomBytes(32).toString('hex')
  const payload = `${userId}:${nonce}`
  const hash = createHmac('sha256', getVerificationKey()).update(payload).digest('hex')
  return { token: nonce, hash }
}

/**
 * Verify a token matches the stored hash
 */
function verifyToken(userId: number, token: string, storedHash: string): boolean {
  const payload = `${userId}:${token}`
  const hash = createHmac('sha256', getVerificationKey()).update(payload).digest('hex')
  const a = Buffer.from(hash)
  const b = Buffer.from(storedHash)
  if (a.length !== b.length)
    return false
  return timingSafeEqual(a, b)
}

/**
 * Get verification expiry minutes from config (default: 60)
 */
function getExpiryMinutes(): number {
  const authConfig = (config.auth ?? {}) as Record<string, unknown>
  const emailVerification = authConfig.emailVerification
  if (emailVerification != null && typeof emailVerification === 'object') {
    const ev = emailVerification as Record<string, unknown>
    if (typeof ev.expire === 'number') {
      return ev.expire
    }
  }
  return 60
}

/**
 * Build the verification URL. Configurable via
 * `config.auth.emailVerification.url` — a template with `{id}` / `{token}`
 * placeholders — so apps whose verify page lives on a custom route can
 * reuse this whole flow instead of hand-rolling the send. Falls back to
 * the framework convention. Absolute templates are used as-is; path
 * templates are prefixed with the app URL. (Mirrors the password-reset
 * URL treatment — stacksjs/stacks#1944.)
 */
function getVerificationUrl(userId: number, token: string): string {
  const base = config.app.url ? `https://${config.app.url}` : `http://localhost:${process.env.PORT || '3000'}`
  const tpl = config.auth.emailVerification?.url ?? '/verify-email/{id}/{token}'
  const filled = tpl.replace('{id}', String(userId)).replace('{token}', token)
  return /^https?:\/\//.test(filled) ? filled : `${base}${filled.startsWith('/') ? '' : '/'}${filled}`
}

/**
 * Check if a user's email is verified
 */
export function isEmailVerified(user: { email_verified_at?: string | Date | null }): boolean {
  return user.email_verified_at != null
}

/**
 * Send a verification email to the user
 */
export async function sendVerificationEmail(user: { id: number, email: string, name?: string }): Promise<void> {
  await deliverAfterCommit(await prepareVerificationEmail(user))
}

async function prepareVerificationEmail(user: { id: number, email: string, name?: string }): Promise<() => Promise<void>> {
  // Generate token
  const { token, hash } = generateVerificationToken(user.id)
  const expiryMinutes = getExpiryMinutes()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + expiryMinutes * 60 * 1000)

  // A failed replacement must not destroy the user's previous working link.
  await db.transaction(async () => {
    await db
      .deleteFrom('email_verifications')
      .where('user_id', '=', user.id)
      .execute()

    await db
      .insertInto('email_verifications')
      .values({
        user_id: user.id,
        token: hash,
        expires_at: sqlDateTime(expiresAt),
        // Use issuance time, not an outer transaction's CURRENT_TIMESTAMP.
        created_at: sqlDateTime(createdAt),
      })
      .executeTakeFirst()

    // A trigger can suppress an INSERT without throwing. Do not send a link
    // whose hash never persisted, or keep an older link alongside its successor.
    const stored = await db.primary.selectFrom('email_verifications')
      .where('user_id', '=', user.id).selectAll().execute()
    if (stored.length !== 1 || stored[0]?.token !== hash)
      throw new Error('[auth] Email verification could not replace the token.')
  })

  return () => deliverVerificationEmail(user, token, expiryMinutes)
}

async function deliverAfterCommit(deliver: () => Promise<void>): Promise<void> {
  // Standalone sends still await and expose provider errors. When the caller
  // owns an outer transaction, its rollback must discard the email as well.
  if (!enqueueAfterCommit(deliver)) await deliver()
}

async function deliverVerificationEmail(user: { id: number, email: string, name?: string }, token: string, expiryMinutes: number): Promise<void> {
  // Build verification URL (configurable — see getVerificationUrl)
  const verificationUrl = getVerificationUrl(user.id, token)
  const appName = config.app.name || 'Stacks'

  let html: string | undefined
  let text: string | undefined
  try {
    const rendered = await template('email-verification', {
      subject: `Verify Your ${appName} Email Address`,
      variables: {
        verificationUrl,
        expiryMinutes,
        userName: user.name || user.email,
      },
    })
    html = rendered.html
    text = rendered.text

    // template() swallows missing-template and STX-render failures into
    // empty strings instead of throwing (template.ts returns
    // { html: '', text: '' }), which would mail a blank email with no
    // verification link. Treat an empty render as failure so the
    // plain-text fallback below actually fires (stacksjs/stacks#1944).
    if (!html && !text)
      throw new Error('email-verification template missing or rendered empty')
  }
  catch (templateError) {
    const errorMessage = templateError instanceof Error ? templateError.message : String(templateError)
    log.warn(`[email] Email verification template failed, using plain text fallback: ${errorMessage}`)
    html = undefined
    text = `Please verify your email address by visiting: ${verificationUrl}\n\nThis link expires in ${expiryMinutes} minutes.`
  }

  await mail.sendOrFail({
    to: user.email,
    subject: `Verify Your ${appName} Email Address`,
    text,
    html,
  })
}

/**
 * Verify a user's email with the provided token
 */
export async function verifyEmail(userId: number, token: string): Promise<EmailVerificationResult> {
  // Consuming the token and marking its owner must commit together. Otherwise
  // a failed delete leaves a reusable token attached to an already verified user.
  return db.transaction(async () => {
    const record = await db.primary
      .selectFrom('email_verifications')
      .where('user_id', '=', userId)
      .selectAll()
      .executeTakeFirst()

    if (!record)
      return { success: false, message: 'No verification request found. Please request a new verification email.' }

    const observed = db
      .deleteFrom('email_verifications')
      .where('user_id', '=', userId)
      .where('id', '=', record.id)
      .where('token', '=', record.token)
    const claim = record.expires_at == null
      ? observed.whereNull('expires_at')
      : observed.where('expires_at', '=', record.expires_at)

    const expiresAt = parseSqlDateTime(record.expires_at) ?? new Date(Number.NaN)
    if (Number.isNaN(expiresAt.getTime()) || Date.now() >= expiresAt.getTime()) {
      await claim.execute()
      return { success: false, message: 'Verification link has expired. Please request a new one.' }
    }

    if (!verifyToken(userId, token, record.token as string))
      return { success: false, message: 'Invalid verification link.' }

    // Lock the owner so deletion cannot turn the later UPDATE into a no-op.
    // MySQL's zero changed-row count also covers an already verified user,
    // so a mutation count alone cannot establish that the owner exists.
    let owner = db.primary.selectFrom('users').where('id', '=', userId).selectAll()
    if (getDatabaseDialect() !== 'sqlite') owner = owner.lockForUpdate()
    const user = await owner.executeTakeFirst()
    if (!user)
      return { success: false, message: 'Invalid verification link.' }

    if (mutationCount(await claim.execute()) !== 1)
      return { success: false, message: 'Invalid verification link.' }
    // Either locking statement may have waited behind another transaction.
    if (Date.now() >= expiresAt.getTime())
      return { success: false, message: 'Verification link has expired. Please request a new one.' }

    const updated = await db.updateTable('users')
      .set({ email_verified_at: sqlDateTime() })
      .where('id', '=', userId)
      .execute()
    if (mutationCount(updated) !== 1 && user.email_verified_at == null)
      throw new Error('[auth] Email verification could not update the user.')

    return { success: true, message: 'Email verified successfully.' }
  })
}

/**
 * Resend verification email with rate limiting
 */
export async function resendVerificationEmail(user: { id: number, email: string, name?: string, email_verified_at?: string | Date | null }): Promise<EmailVerificationResult> {
  if (isEmailVerified(user)) {
    return { success: false, message: 'Email is already verified.' }
  }

  const outcome = await db.transaction(async (): Promise<{ result: EmailVerificationResult, deliver?: () => Promise<void> }> => {
    // Lock a stable owner row, not the optional verification row. This also
    // serializes first sends, when there is no cooldown record to lock yet.
    let ownerQuery = db.primary.selectFrom('users').where('id', '=', user.id).selectAll()
    if (getDatabaseDialect() !== 'sqlite') ownerQuery = ownerQuery.lockForUpdate()
    const owner = await ownerQuery.executeTakeFirst()
    if (!owner)
      return { result: { success: false, message: 'User not found.' } }
    if (isEmailVerified(owner))
      return { result: { success: false, message: 'Email is already verified.' } }

    // A locking read sees the latest committed cooldown even when a caller's
    // outer MySQL transaction established an older repeatable-read snapshot.
    let existingQuery = db.primary.selectFrom('email_verifications')
      .where('user_id', '=', user.id).selectAll()
    if (getDatabaseDialect() !== 'sqlite') existingQuery = existingQuery.lockForUpdate()
    const existing = await existingQuery.executeTakeFirst()
    if (existing) {
      const createdAt = parseSqlDateTime(existing.created_at)
      const secondsSince = createdAt ? (Date.now() - createdAt.getTime()) / 1000 : Number.NaN
      // Malformed state must not bypass the cooldown. #1985.
      if (Number.isNaN(secondsSince)) {
        return { result: { success: false, message: 'Please wait a moment before requesting another verification email.' } }
      }
      if (secondsSince < 60) {
        return { result: { success: false, message: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting another verification email.` } }
      }
    }

    const deliver = await prepareVerificationEmail(user)
    return { result: { success: true, message: 'Verification email sent.' }, deliver }
  // SQLite uses optimistic read-to-write promotion instead of row locks.
  // Restart a conflicted claim from fresh state, never just its final write.
  // Delivery happens below, outside every retry attempt.
  }, getDatabaseDialect() === 'sqlite' ? { retries: 3 } : undefined)
  if (outcome.deliver) await deliverAfterCommit(outcome.deliver)
  return outcome.result
}

/**
 * Email verification facade
 */
export const EmailVerification = {
  isVerified: isEmailVerified,
  send: sendVerificationEmail,
  verify: verifyEmail,
  resend: resendVerificationEmail,
}
