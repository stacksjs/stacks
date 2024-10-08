export { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'
import { db } from '@stacksjs/database'

export interface PasskeyAttribute {
  id: number
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  backup_eligible: boolean
  backup_status: boolean
  transports: string
  created_at: Date
  last_used_at: Date
}

export async function getUserPasskeys(userId: number): Promise<any> {
  const query = await db.selectFrom('passkeys').where('user_id', '=', userId).selectAll()
}
