import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { mail } from '@stacksjs/email'
import { makeHash } from '@stacksjs/security'

export interface PasswordResetActions {
  sendEmail: () => Promise<void>
  verifyToken: (token: string) => Promise<boolean>
  resetPassword: (token: string, newPassword: string) => Promise<boolean>
}

export function passwordResets(email: string): PasswordResetActions {
  function generateResetToken(): string {
    return randomBytes(32).toString('hex')
  }

  async function createResetToken(): Promise<string> {
    const token = generateResetToken()

    await db
      .insertInto('password_resets')
      .values({
        email,
        token,
      })
      .executeTakeFirst()

    return token
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
      .where('token', '=', token)
      .selectAll()
      .executeTakeFirst()

    return result !== undefined
  }

  async function resetPassword(token: string, newPassword: string): Promise<boolean> {
    const trx = await db.startTransaction().execute()

    try {
      const resetRecord = await trx
      .selectFrom('password_resets')
      .where('token', '=', token)
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    if (!resetRecord)
      return false

    // Update the user's password
    const user = await db
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    if (!user)
      return false

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
      .where('token', '=', token)
      .where('email', '=', email)
      .execute()

      await trx.commit().execute()
    } catch (error) {
      await trx.rollback().execute()

      throw error
    }

    return true
  }

  return {
    sendEmail,
    verifyToken,
    resetPassword,
  }
}
