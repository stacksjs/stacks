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
import { db } from '@stacksjs/database'
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
      '[auth] config.app.key is not set — email-verification HMAC requires a real APP_KEY. '
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
  // Generate token
  const { token, hash } = generateVerificationToken(user.id)
  const expiryMinutes = getExpiryMinutes()
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

  // Delete any existing verification tokens for this user
  await db
    .deleteFrom('email_verifications')
    .where('user_id', '=', user.id)
    .execute()

  // Store the hash
  await db
    .insertInto('email_verifications')
    .values({
      user_id: user.id,
      token: hash,
      expires_at: expiresAt.toISOString(),
    })
    .executeTakeFirst()

  // Build verification URL (configurable — see getVerificationUrl)
  const verificationUrl = getVerificationUrl(user.id, token)
  const appName = config.app.name || 'Stacks'

  try {
    const { html, text } = await template('email-verification', {
      subject: `Verify Your ${appName} Email Address`,
      variables: {
        verificationUrl,
        expiryMinutes,
        userName: user.name || user.email,
      },
    })

    await mail.send({
      to: user.email,
      subject: `Verify Your ${appName} Email Address`,
      text,
      html,
    })
  }
  catch (templateError) {
    const errorMessage = templateError instanceof Error ? templateError.message : String(templateError)
    log.warn(`[email] Email verification template failed, using plain text fallback: ${errorMessage}`)
    // Fallback: send a simple text email if template is not found
    await mail.send({
      to: user.email,
      subject: `Verify Your ${appName} Email Address`,
      text: `Please verify your email address by visiting: ${verificationUrl}\n\nThis link expires in ${expiryMinutes} minutes.`,
    })
  }
}

/**
 * Verify a user's email with the provided token
 */
export async function verifyEmail(userId: number, token: string): Promise<EmailVerificationResult> {
  // Find the verification record
  const record = await db
    .selectFrom('email_verifications')
    .where('user_id', '=', userId)
    .selectAll()
    .executeTakeFirst()

  if (!record) {
    return { success: false, message: 'No verification request found. Please request a new verification email.' }
  }

  // Check expiration
  const expiresAt = new Date(record.expires_at as string)
  if (new Date() > expiresAt) {
    await db
      .deleteFrom('email_verifications')
      .where('user_id', '=', userId)
      .execute()
    return { success: false, message: 'Verification link has expired. Please request a new one.' }
  }

  // Verify the token
  if (!verifyToken(userId, token, record.token as string)) {
    return { success: false, message: 'Invalid verification link.' }
  }

  // Mark the user's email as verified
  await db
    .updateTable('users')
    .set({ email_verified_at: new Date().toISOString() })
    .where('id', '=', userId)
    .executeTakeFirst()

  // Clean up the verification record
  await db
    .deleteFrom('email_verifications')
    .where('user_id', '=', userId)
    .execute()

  return { success: true, message: 'Email verified successfully.' }
}

/**
 * Resend verification email with rate limiting
 */
export async function resendVerificationEmail(user: { id: number, email: string, name?: string, email_verified_at?: string | Date | null }): Promise<EmailVerificationResult> {
  if (isEmailVerified(user)) {
    return { success: false, message: 'Email is already verified.' }
  }

  // Check for rate limiting: only allow resend every 60 seconds
  const existing = await db
    .selectFrom('email_verifications')
    .where('user_id', '=', user.id)
    .selectAll()
    .executeTakeFirst()

  if (existing) {
    const createdAt = new Date(existing.created_at as string)
    const secondsSince = (Date.now() - createdAt.getTime()) / 1000
    if (secondsSince < 60) {
      return { success: false, message: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting another verification email.` }
    }
  }

  await sendVerificationEmail(user)
  return { success: true, message: 'Verification email sent.' }
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
