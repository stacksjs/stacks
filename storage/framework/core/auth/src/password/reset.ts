import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { mail } from '@stacksjs/email'
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
 * Base email template wrapper
 */
function emailTemplate(content: string, appName: string): string {
  const primaryColor = config.app.primaryColor || '#3b82f6'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${appName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated message from ${appName}. Please do not reply to this email.
              </p>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 11px; text-align: center;">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Generate HTML for password reset email
 */
function generatePasswordResetHtml(resetUrl: string, expireMinutes: number): string {
  const appName = config.app.name || 'Stacks'
  const primaryColor = config.app.primaryColor || '#3b82f6'

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
    <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
      You recently requested to reset your password for your ${appName} account. Click the button below to reset it.
    </p>
    <table role="presentation" style="width: 100%; margin: 30px 0;">
      <tr>
        <td style="text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">Reset Password</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
      This password reset link will expire in <strong>${expireMinutes} minutes</strong>.
    </p>
    <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">
      If you did not request a password reset, please ignore this email or contact support if you have concerns.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
      If the button above doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin: 10px 0 0; word-break: break-all;">
      <a href="${resetUrl}" style="color: ${primaryColor}; font-size: 12px;">${resetUrl}</a>
    </p>
  `

  return emailTemplate(content, appName)
}

/**
 * Generate HTML for password changed notification
 */
function generatePasswordChangedHtml(changedAt: string, supportEmail: string): string {
  const appName = config.app.name || 'Stacks'

  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 20px; font-weight: 600;">Password Changed Successfully</h2>
    <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
      Your ${appName} account password was successfully changed on:
    </p>
    <p style="margin: 0 0 20px; padding: 15px; background-color: #f3f4f6; border-radius: 6px; color: #111827; font-size: 16px; font-weight: 500; text-align: center;">
      ${changedAt}
    </p>
    <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
      If you made this change, you can safely ignore this email.
    </p>
    <div style="padding: 20px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">
        ⚠️ Didn't make this change?
      </p>
      <p style="margin: 10px 0 0; color: #7f1d1d; font-size: 14px;">
        If you did not change your password, your account may have been compromised. Please ${supportEmail ? `contact us immediately at <a href="mailto:${supportEmail}" style="color: #991b1b;">${supportEmail}</a>` : 'contact support immediately'}.
      </p>
    </div>
    <h3 style="margin: 30px 0 15px; color: #111827; font-size: 16px; font-weight: 600;">Security Recommendations</h3>
    <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 14px;">
      <li style="margin-bottom: 8px;">Use a strong, unique password</li>
      <li style="margin-bottom: 8px;">Enable two-factor authentication if available</li>
      <li style="margin-bottom: 8px;">Review your recent account activity</li>
    </ul>
  `

  return emailTemplate(content, appName)
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

  // Plain text version for email clients that don't support HTML
  const textContent = `Hello,

Your password was successfully changed on ${changedAt}.

If you made this change, you can safely ignore this email.

If you did not change your password, please contact us immediately${supportEmail ? ` at ${supportEmail}` : ''} as your account may have been compromised.

For your security, we recommend:
- Using a strong, unique password
- Enabling two-factor authentication if available
- Reviewing your recent account activity

Regards,
The ${appName} Team

This is an automated security notification. Please do not reply to this email.`

  try {
    await mail.send({
      to: userEmail,
      subject: `Your ${appName} password has been changed`,
      text: textContent,
      html: generatePasswordChangedHtml(changedAt, supportEmail),
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
    const token = await createResetToken()
    const url = config.app.url || 'https://localhost:5173'
    const resetUrl = `${url}/password/reset/${token}?email=${encodeURIComponent(email)}`
    const expireMinutes = getTokenExpireMinutes()
    const appName = config.app.name || 'Stacks'

    // Plain text version for email clients that don't support HTML
    const textContent = `Reset Your Password

You recently requested to reset your password for your ${appName} account.

Click the link below to reset your password:
${resetUrl}

This link will expire in ${expireMinutes} minutes.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Regards,
The ${appName} Team`

    await mail.send({
      to: email,
      subject: `Reset Your ${appName} Password`,
      text: textContent,
      html: generatePasswordResetHtml(resetUrl, expireMinutes),
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
