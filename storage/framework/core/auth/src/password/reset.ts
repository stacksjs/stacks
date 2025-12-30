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

    await mail.send({
      to: email,
      subject: 'Password Reset',
      text: `Click <a href="${url}/password/reset/${token}">here</a> to reset your password`,
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

    // Check if token is expired (60 minutes)
    const createdAt = new Date(result.created_at as string)
    const now = new Date()
    const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)

    if (diffInMinutes > 60) {
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
      const createdAt = new Date(resetRecord.created_at as string)
      const now = new Date()
      const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)

      if (diffInMinutes > 60) {
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
