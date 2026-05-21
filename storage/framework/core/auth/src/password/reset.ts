import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { mail, template } from '@stacksjs/email'
import { makeHash, verifyHash } from '@stacksjs/security'

export interface PasswordResetResult {
  success: boolean
  message?: string
}

export interface PasswordResetActions {
  sendEmail: () => Promise<void>
  verifyToken: (token: string) => Promise<boolean>
  resetPassword: (token: string, newPassword: string) => Promise<PasswordResetResult>
}

// Get token expiration from config (default: 60 minutes)
function getTokenExpireMinutes(): number {
  return config.auth.passwordReset?.expire ?? 60
}

/**
 * True when the given password_resets row is still valid. Prefers
 * the explicit `expires_at` column (set at insert time by
 * `createResetToken`) and falls back to clock-arithmetic against
 * `created_at` so rows inserted before the column existed continue
 * to verify correctly (stacksjs/stacks#1861 A-5 + M-2).
 */
function isWithinExpiry(row: Record<string, unknown>): boolean {
  const explicit = row.expires_at
  if (typeof explicit === 'string' || explicit instanceof Date) {
    return new Date(explicit).getTime() > Date.now()
  }
  const created = row.created_at
  if (typeof created === 'string' || created instanceof Date) {
    const expireMinutes = getTokenExpireMinutes()
    return new Date(created).getTime() + expireMinutes * 60_000 > Date.now()
  }
  // No timestamp at all — refuse to verify rather than leak forever.
  return false
}

/**
 * Send a notification email when password has been changed
 * This is a security feature to alert users of password changes
 */
async function sendPasswordChangedNotification(userEmail: string): Promise<void> {
  const appName = config.app.name || 'Stacks'
  const supportEmail = config.app.supportEmail || config.email?.from?.address || ''
  const changedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  try {
    const { html, text } = await template('password-changed', {
      subject: `Your ${appName} password has been changed`,
      variables: {
        changedAt,
        supportEmail,
      },
    })

    await mail.send({
      to: userEmail,
      subject: `Your ${appName} password has been changed`,
      text,
      html,
    })
  }
  catch (error) {
    // Log error but don't throw - the password was already changed successfully
    console.error('[PasswordReset] Failed to send password changed notification:', error)
  }
}

export function passwordResets(email: string): PasswordResetActions {
  function generateResetToken(): string {
    return randomBytes(32).toString('hex')
  }

  async function createResetToken(): Promise<string> {
    const token = generateResetToken()
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })
    const expireMinutes = getTokenExpireMinutes()
    const expiresAt = new Date(Date.now() + expireMinutes * 60_000).toISOString()

    // Delete any existing reset row for this email before inserting
    // the new one so a second reset request invalidates any prior
    // outstanding token. The schema's unique index on `email` enforces
    // single-outstanding-token-per-email at the DB layer; this delete
    // makes the rotation work even when the unique constraint hasn't
    // been applied yet (older installs). See stacksjs/stacks#1861 A-5.
    await db
      .deleteFrom('password_resets')
      .where('email', '=', email)
      .execute()

    await db
      .insertInto('password_resets')
      .values({
        email,
        token: hashedToken,
        expires_at: expiresAt,
      } as never)
      .executeTakeFirst()

    return token // Return unhashed token for email
  }

  async function sendEmail(): Promise<void> {
    const token = await createResetToken()

    const url = config.app.url ? `https://${config.app.url}` : `http://localhost:${process.env.PORT || '3000'}`
    const resetUrl = `${url}/password/reset/${token}?email=${encodeURIComponent(email)}`
    const expireMinutes = getTokenExpireMinutes()
    const appName = config.app.name || 'Stacks'

    const { html, text } = await template('password-reset', {
      subject: `Reset Your ${appName} Password`,
      variables: {
        resetUrl,
        expireMinutes,
      },
    })

    await mail.send({
      to: email,
      subject: `Reset Your ${appName} Password`,
      text,
      html,
    })
  }

  async function verifyToken(token: string): Promise<boolean> {
    const result = await db
      .selectFrom('password_resets')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      return false

    // Prefer the explicit `expires_at` column when present (it's set
    // at insert time). Fall back to clock-arithmetic against
    // `created_at` for rows inserted before the column existed
    // (stacksjs/stacks#1861 A-5 + M-2).
    if (!isWithinExpiry(result)) {
      await db
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .execute()
      return false
    }

    // Verify the hashed token
    const hashedToken = result.token as string
    return await verifyHash(token, hashedToken)
  }

  async function resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    const result = await db.transaction(async (rawTrx) => {
      // The transaction callback receives bun-query-builder's raw `QueryBuilder<DB>`,
      // which marks chained fluent methods like `selectAll` as optional. We mirror
      // the typing of the top-level `db` proxy so chained calls type-check the same way.
      const trx = rawTrx as unknown as typeof db
      // First verify the token exists
      const resetRecord = await trx
        .selectFrom('password_resets')
        .where('email', '=', email)
        .selectAll()
        .executeTakeFirst()

      // If no reset record, return generic error (don't leak if user exists)
      if (!resetRecord) {
        return { success: false as const, message: 'Invalid or expired reset token' }
      }

      // Check token expiration first (before verifying hash to save compute).
      // Same expires_at-or-created_at logic as `verifyToken` above.
      if (!isWithinExpiry(resetRecord)) {
        await trx
          .deleteFrom('password_resets')
          .where('email', '=', email)
          .execute()

        return { success: false as const, message: 'This password reset link has expired. Please request a new one.' }
      }

      // Verify the hashed token
      const hashedToken = resetRecord.token as string
      const isValid = await verifyHash(token, hashedToken)

      if (!isValid) {
        return { success: false as const, message: 'Invalid or expired reset token' }
      }

      // Update the user's password
      const user = await trx
        .selectFrom('users')
        .where('email', '=', email)
        .selectAll()
        .executeTakeFirst()

      // If no user, return generic error (don't leak user existence)
      if (!user) {
        return { success: false as const, message: 'Invalid or expired reset token' }
      }

      const hashedPassword = await makeHash(newPassword, { algorithm: 'bcrypt' })

      // Update password
      await trx
        .updateTable('users')
        .set({ password: hashedPassword })
        .where('email', '=', email)
        .executeTakeFirst()

      // Delete the used reset token
      await trx
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .execute()

      return { success: true as const }
    })

    // Send password changed notification (async, non-blocking)
    // This runs after the transaction is committed to ensure the password was actually changed
    if (result.success) {
      sendPasswordChangedNotification(email).catch((err) => {
        console.error('[PasswordReset] Failed to send notification:', err)
      })
    }

    return result
  }

  return {
    sendEmail,
    verifyToken,
    resetPassword,
  }
}
