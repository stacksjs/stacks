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

import { randomBytes, createHmac } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { mail, template } from '@stacksjs/email'

export interface EmailVerificationResult {
  success: boolean
  message?: string
}

/**
 * Generate an HMAC-based verification token.
 * Uses the user ID and a random nonce so that each token is unique.
 */
function generateVerificationToken(userId: number): { token: string, hash: string } {
  const nonce = randomBytes(32).toString('hex')
  const appKey = config.app.key || config.security?.appKey || 'stacks-default-key'
  const payload = `${userId}:${nonce}`
  const hash = createHmac('sha256', appKey).update(payload).digest('hex')
  return { token: nonce, hash }
}

/**
 * Verify a token matches the stored hash
 */
function verifyToken(userId: number, token: string, storedHash: string): boolean {
  const appKey = config.app.key || config.security?.appKey || 'stacks-default-key'
  const payload = `${userId}:${token}`
  const hash = createHmac('sha256', appKey).update(payload).digest('hex')
  return hash === storedHash
}

/**
 * Get verification expiry minutes from config (default: 60)
 */
function getExpiryMinutes(): number {
  return config.auth?.emailVerification?.expire ?? 60
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

  // Build verification URL
  const appUrl = config.app.url || 'https://localhost:5173'
  const verificationUrl = `${appUrl}/verify-email/${user.id}/${token}`
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
  catch {
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
