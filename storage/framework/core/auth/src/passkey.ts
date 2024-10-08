export { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'
import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  CredentialDeviceType,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/types'
export type * from '@simplewebauthn/types'
import { db } from '@stacksjs/database'
import type { UserModel, UsersTable } from '../../../orm/src/models/User'

export interface PasskeyAttribute {
  id: string
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  backup_eligible: boolean
  backup_status: boolean
  transports?: AuthenticatorTransportFuture[]
  created_at: Date
  last_used_at: Date
}

export async function getUserPasskeys(userId: number): Promise<PasskeyAttribute[]> {
  return await db.selectFrom('passkeys').selectAll().where('user_id', '=', userId).execute()
}

export async function setCurrentRegistrationOptions(
  user: UserModel,
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<void> {
  console.log(user)
  console.log(options)
}
