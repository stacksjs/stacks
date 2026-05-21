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

/**
 * Persist the post-verification authenticator counter and refresh the
 * passkey's last-used timestamp. WebAuthn's anti-cloning guarantee
 * depends on the relying party rejecting any authentication whose
 * `newCounter` is **not strictly greater** than the stored value —
 * authenticators monotonically increment their counter on every use,
 * so a counter that doesn't advance (or goes backwards) signals a
 * cloned or replayed credential.
 *
 * Returns `true` when the counter was updated successfully; `false`
 * when the new counter is not greater than the stored one (the
 * authentication MUST be rejected by the caller in that case).
 * stacksjs/stacks#1861 A-4.
 */
export async function updatePasskeyCounter(
  userId: number,
  passkeyId: string,
  newCounter: number,
): Promise<boolean> {
  // Authenticators that don't implement a counter (some platform
  // authenticators) always send 0 — accept those at face value as
  // long as the stored value is also 0. The strictly-greater check
  // applies only when the device claims a non-zero counter.
  const passkey = await getUserPasskey(userId, passkeyId)
  if (!passkey) return false

  const stored = Number(passkey.counter ?? 0)
  if (newCounter !== 0 && newCounter <= stored) {
    return false
  }

  await db
    .updateTable('passkeys')
    .set({ counter: newCounter, last_used_at: formatDateTime() } as never)
    .where('id', '=', passkeyId)
    .where('user_id', '=', userId)
    .execute()

  return true
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

// =============================================================================
// WebAuthn challenge persistence (stacksjs/stacks#1866)
// =============================================================================
//
// WebAuthn relying parties MUST verify the assertion's challenge
// against a server-issued nonce. Previously Stacks returned the
// challenge in `generateOptions` and trusted the client to echo it
// back on verify — so any attacker who captured the assertion AND the
// challenge could replay the response. Persisting the challenge
// server-side and consuming it on verify closes that gap.
//
// The default TTL is 5 minutes — long enough for slow biometric
// flows, short enough to bound the replay window. Override per-call
// via the `ttlSeconds` parameter.

export type WebAuthnChallengePurpose = 'registration' | 'authentication'

const DEFAULT_CHALLENGE_TTL_SECONDS = 5 * 60

/**
 * Persist a server-issued WebAuthn challenge for the given user +
 * purpose. Deletes any prior challenge for the same (user, purpose)
 * pair so a fresh `generateOptions` invalidates the previous one.
 *
 * The unique index on `(user_id, purpose)` enforces single-outstanding
 * at the DB layer; this delete makes the upsert safe even on installs
 * that ran an earlier auth:setup before the unique index existed.
 */
export async function storeWebAuthnChallenge(
  userId: number,
  challenge: string,
  purpose: WebAuthnChallengePurpose,
  ttlSeconds: number = DEFAULT_CHALLENGE_TTL_SECONDS,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  await db
    .deleteFrom('webauthn_challenges')
    .where('user_id', '=', userId)
    .where('purpose', '=', purpose)
    .execute()

  await db
    .insertInto('webauthn_challenges')
    .values({
      user_id: userId,
      challenge,
      purpose,
      expires_at: expiresAt,
    } as never)
    .execute()
}

/**
 * Read + delete (single-use) a WebAuthn challenge for the given user
 * + purpose. Returns `null` when no outstanding challenge exists or
 * when the stored challenge has expired.
 *
 * Single-use semantics matter: a successful verify must invalidate
 * the challenge so a captured assertion can't be replayed even within
 * the TTL window. Callers MUST treat a `null` return as a verification
 * failure.
 */
export async function consumeWebAuthnChallenge(
  userId: number,
  purpose: WebAuthnChallengePurpose,
): Promise<string | null> {
  const row = await db
    .selectFrom('webauthn_challenges')
    .where('user_id', '=', userId)
    .where('purpose', '=', purpose)
    .selectAll()
    .executeTakeFirst()

  if (!row) return null

  // Delete BEFORE checking expiry so an expired row doesn't linger
  // and consume the unique slot for the next legitimate generate.
  await db
    .deleteFrom('webauthn_challenges')
    .where('user_id', '=', userId)
    .where('purpose', '=', purpose)
    .execute()

  const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0
  if (Date.now() > expiresAt) return null

  return String(row.challenge)
}
