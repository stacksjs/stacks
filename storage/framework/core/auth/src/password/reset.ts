import type { PasswordResetsRequestType, PasswordResetsTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { randomBytes } from 'node:crypto'

export interface PasswordResetActions {
  getToken: () => Promise<string>
  verifyToken: (token: string) => Promise<boolean>
}

export function passwordResets(email: string): PasswordResetActions {
  /**
   * Generate a secure random token for password reset
   */
  function generateResetToken(): string {
    return randomBytes(32).toString('hex')
  }


  async function getToken(): Promise<string> {
    const token = generateResetToken()
    
    const passwordResetData = {
      email: email,
      token,
    }
  
    const result = await db
      .insertInto('password_resets')
      .values(passwordResetData)
      .returningAll()
      .executeTakeFirst()
  
    return token
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
      getToken,
      verifyToken,
  }
}