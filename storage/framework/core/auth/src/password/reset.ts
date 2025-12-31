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

    await db
      .insertInto('password_resets')
      .values({
        email,
        token: hashedToken,
      })
      .executeTakeFirst()

    return token // Return unhashed token for email
  }

  async function sendEmail(): Promise<void> {
    console.log('[PasswordReset.sendEmail] Starting for email:', email)

    console.log('[PasswordReset.sendEmail] Creating reset token...')
    const token = await createResetToken()
    console.log('[PasswordReset.sendEmail] Token created (length):', token.length)

    const url = config.app.url || 'https://localhost:5173'
    const resetUrl = `${url}/password/reset/${token}?email=${encodeURIComponent(email)}`
    const expireMinutes = getTokenExpireMinutes()
    const appName = config.app.name || 'Stacks'

    console.log('[PasswordReset.sendEmail] Reset URL:', resetUrl)
    console.log('[PasswordReset.sendEmail] Expire minutes:', expireMinutes)

    console.log('[PasswordReset.sendEmail] Rendering template...')
    const { html, text } = await template('password-reset', {
      subject: `Reset Your ${appName} Password`,
      variables: {
        resetUrl,
        expireMinutes,
      },
    })
    console.log('[PasswordReset.sendEmail] Template rendered')

    console.log('[PasswordReset.sendEmail] Calling mail.send()...')
    try {
      await mail.send({
        to: email,
        subject: `Reset Your ${appName} Password`,
        text,
        html,
      })
      console.log('[PasswordReset.sendEmail] mail.send() completed successfully!')
    }
    catch (error) {
      console.error('[PasswordReset.sendEmail] mail.send() failed:', error)
      throw error
    }
  }

  async function verifyToken(token: string): Promise<boolean> {
    const result = await db
      .selectFrom('password_resets')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      return false

    // Check if token is expired (configurable, default 60 minutes)
    const expireMinutes = getTokenExpireMinutes()
    const createdAt = new Date(result.created_at as string)
    const now = new Date()
    const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)

    if (diffInMinutes > expireMinutes) {
      // Delete expired token
      await db
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .execute()

      return false
    }

    // Verify the hashed token
    const hashedToken = result.token
    return await verifyHash(token, hashedToken, 'bcrypt')
  }

  async function resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    const trx = await db.startTransaction().execute()

    try {
      // First verify the token exists
      const resetRecord = await trx
        .selectFrom('password_resets')
        .where('email', '=', email)
        .selectAll()
        .executeTakeFirst()

      // If no reset record, return generic error (don't leak if user exists)
      if (!resetRecord) {
        await trx.rollback().execute()
        return { success: false, message: 'Invalid or expired reset token' }
      }

      // Check token expiration first (before verifying hash to save compute)
      const expireMinutes = getTokenExpireMinutes()
      const createdAt = new Date(resetRecord.created_at as string)
      const now = new Date()
      const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)

      if (diffInMinutes > expireMinutes) {
        // Delete expired token
        await trx
          .deleteFrom('password_resets')
          .where('email', '=', email)
          .execute()
        await trx.commit().execute()

        return { success: false, message: 'This password reset link has expired. Please request a new one.' }
      }

      // Verify the hashed token
      const hashedToken = resetRecord.token
      const isValid = await verifyHash(token, hashedToken, 'bcrypt')

      if (!isValid) {
        await trx.rollback().execute()
        return { success: false, message: 'Invalid or expired reset token' }
      }

      // Update the user's password
      const user = await db
        .selectFrom('users')
        .where('email', '=', email)
        .selectAll()
        .executeTakeFirst()

      // If no user, return generic error (don't leak user existence)
      if (!user) {
        await trx.rollback().execute()
        return { success: false, message: 'Invalid or expired reset token' }
      }

      const hashedPassword = await makeHash(newPassword, { algorithm: 'bcrypt' })

      // Update password
      await db
        .updateTable('users')
        .set({ password: hashedPassword })
        .where('email', '=', email)
        .executeTakeFirst()

      // Delete the used reset token
      await db
        .deleteFrom('password_resets')
        .where('email', '=', email)
        .execute()

      await trx.commit().execute()

      // Send password changed notification (async, non-blocking)
      // This runs after the transaction is committed to ensure the password was actually changed
      sendPasswordChangedNotification(email)

      return { success: true }
    }
    catch (error) {
      await trx.rollback().execute()
      throw error
    }
  }

  return {
    sendEmail,
    verifyToken,
    resetPassword,
  }
}
