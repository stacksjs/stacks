import type { PasswordResetsRequestType, PasswordResetsTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { mail } from '@stacksjs/email'
import { config } from '@stacksjs/config'
import { randomBytes } from 'node:crypto'

export interface PasswordResetActions {
  sendEmail: () => Promise<void>
  verifyToken: (token: string) => Promise<boolean>
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

  return {
    sendEmail,
    verifyToken,
  }
}