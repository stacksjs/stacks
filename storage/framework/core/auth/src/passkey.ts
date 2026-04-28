/**
 * WebAuthn/Passkey Functions
 *
 * Uses ts-auth for native WebAuthn implementation (no external dependencies)
 */

import type { VerifiedRegistrationResponse } from '@stacksjs/ts-auth'
import type { Insertable } from '@stacksjs/database'

import { db } from '@stacksjs/database'
import { User } from '@stacksjs/orm'

type UserModel = InstanceType<typeof User>

// Re-export WebAuthn functions from ts-auth
export {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  // Browser-side functions (for client use)
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
} from '@stacksjs/ts-auth'

// Re-export WebAuthn types from ts-auth
export type {
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
  RegistrationCredential,
  AuthenticationCredential,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
  RegistrationOptions,
  AuthenticationOptions,
} from '@stacksjs/ts-auth'

type PasskeyInsertable = Insertable<PasskeyAttribute>

export interface PasskeyAttribute {
  id: string
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  credential_type: string
  device_type: string
  backup_eligible: boolean
  backup_status: boolean
  transports?: string
  created_at?: Date
  last_used_at: string
}

export async function getUserPasskeys(userId: number): Promise<PasskeyAttribute[]> {
  const rows = await db.selectFrom('passkeys').selectAll().where('user_id', '=', userId).execute()
  return rows as unknown as PasskeyAttribute[]
}

export async function getUserPasskey(userId: number, passkeyId: string): Promise<PasskeyAttribute | undefined> {
  const row = await db
    .selectFrom('passkeys')
    .selectAll()
    .where('id', '=', passkeyId)
    .where('user_id', '=', userId)
    .executeTakeFirst()
  return row as unknown as PasskeyAttribute | undefined
}

export async function setCurrentRegistrationOptions(
  user: UserModel,
  verified: VerifiedRegistrationResponse,
): Promise<void> {
  // WebAuthn registrations without a credential id or public key are
  // useless for future authentication — inserting `id: ''` would create
  // a "passkey" that nothing can ever match. Reject up front so the
  // caller sees a clear error instead of a soft-fail at next login.
  const credentialId = verified.registrationInfo?.credential.id
  const credentialPublicKey = verified.registrationInfo?.credential.publicKey
  if (!credentialId) {
    throw new Error('[auth/passkey] WebAuthn registration response is missing credential.id')
  }
  if (!credentialPublicKey) {
    throw new Error('[auth/passkey] WebAuthn registration response is missing credential.publicKey')
  }

  const passkeyData: PasskeyInsertable = {
    id: credentialId,
    cred_public_key: JSON.stringify(credentialPublicKey),
    user_id: user.id as number,
    webauthn_user_id: user.email || '',
    counter: verified.registrationInfo?.credential.counter || 0,
    credential_type: verified.registrationInfo?.credentialType || '',
    device_type: verified.registrationInfo?.credentialDeviceType || '',
    backup_eligible: false,
    backup_status: verified.registrationInfo?.credentialBackedUp || false,
    transports: JSON.stringify(['internal']),
    last_used_at: formatDateTime(),
  }

  await db.insertInto('passkeys').values(passkeyData).executeTakeFirstOrThrow()
}

function formatDateTime(): string {
  const date = new Date()
  const pad = (num: number): string => String(num).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())

  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
