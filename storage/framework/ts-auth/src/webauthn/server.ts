/**
 * WebAuthn Server Implementation
 * Native implementation to replace @simplewebauthn/server
 */

import { base64Decode, base64Encode } from '../utils/base64'
import type {
  AttestationObject,
  AuthenticationCredential,
  AuthenticatorAssertionResponse,
  AuthenticatorAttestationResponse,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
  RegistrationCredential,
} from './types'

export interface RegistrationOptions {
  rpName: string
  rpID: string
  userID: string
  userName: string
  userDisplayName?: string
  challenge?: Uint8Array
  attestationType?: 'none' | 'indirect' | 'direct'
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    requireResidentKey?: boolean
    residentKey?: 'discouraged' | 'preferred' | 'required'
    userVerification?: 'required' | 'preferred' | 'discouraged'
  }
  excludeCredentials?: Array<{
    id: ArrayBuffer
    type: 'public-key'
    transports?: ('usb' | 'nfc' | 'ble' | 'internal')[]
  }>
  timeout?: number
}

export interface AuthenticationOptions {
  rpID: string
  challenge?: Uint8Array
  allowCredentials?: Array<{
    id: ArrayBuffer
    type: 'public-key'
    transports?: ('usb' | 'nfc' | 'ble' | 'internal')[]
  }>
  userVerification?: 'required' | 'preferred' | 'discouraged'
  timeout?: number
}

/**
 * Generate registration options for creating a new credential
 */
export function generateRegistrationOptions(
  options: RegistrationOptions,
): PublicKeyCredentialCreationOptions {
  const challenge = options.challenge || crypto.getRandomValues(new Uint8Array(32))

  return {
    challenge,
    rp: {
      name: options.rpName,
      id: options.rpID,
    },
    user: {
      id: new TextEncoder().encode(options.userID),
      name: options.userName,
      displayName: options.userDisplayName || options.userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    timeout: options.timeout || 60000,
    attestation: options.attestationType || 'none',
    authenticatorSelection: options.authenticatorSelection || {
      authenticatorAttachment: 'platform',
      requireResidentKey: false,
      userVerification: 'preferred',
    },
    excludeCredentials: options.excludeCredentials || [],
  }
}

/**
 * Generate authentication options for verifying an existing credential
 */
export function generateAuthenticationOptions(
  options: AuthenticationOptions,
): PublicKeyCredentialRequestOptions {
  const challenge = options.challenge || crypto.getRandomValues(new Uint8Array(32))

  return {
    challenge,
    rpId: options.rpID,
    allowCredentials: options.allowCredentials || [],
    userVerification: options.userVerification || 'preferred',
    timeout: options.timeout || 60000,
  }
}

/**
 * Verify registration response from the client
 */
export async function verifyRegistrationResponse(
  credential: RegistrationCredential,
  expectedChallenge: Uint8Array,
  expectedOrigin: string,
  expectedRPID: string,
): Promise<{
  verified: boolean
  registrationInfo?: {
    credential: {
      id: string
      publicKey: ArrayBuffer
      counter: number
    }
    credentialType: string
    credentialDeviceType: string
    credentialBackedUp: boolean
  }
}> {
  try {
    const response = credential.response as AuthenticatorAttestationResponse

    // Decode client data JSON
    const clientDataJSON = JSON.parse(new TextDecoder().decode(response.clientDataJSON))

    // Verify challenge
    const receivedChallenge = base64Decode(clientDataJSON.challenge)
    if (receivedChallenge !== base64Encode(expectedChallenge)) {
      return { verified: false }
    }

    // Verify origin
    if (clientDataJSON.origin !== expectedOrigin) {
      return { verified: false }
    }

    // Verify type
    if (clientDataJSON.type !== 'webauthn.create') {
      return { verified: false }
    }

    // Parse attestation object
    const attestationObject = parseAttestationObject(response.attestationObject)

    // Verify RP ID hash
    const rpIdHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRPID))
    if (!arraysEqual(new Uint8Array(rpIdHash), attestationObject.authData.rpIdHash)) {
      return { verified: false }
    }

    return {
      verified: true,
      registrationInfo: {
        credential: {
          id: credential.id,
          publicKey: attestationObject.authData.credentialPublicKey,
          counter: attestationObject.authData.signCount,
        },
        credentialType: 'public-key',
        credentialDeviceType: attestationObject.authData.flags.backupEligible ? 'multiDevice' : 'singleDevice',
        credentialBackedUp: attestationObject.authData.flags.backupState,
      },
    }
  }
  catch (error) {
    return { verified: false }
  }
}

/**
 * Verify authentication response from the client
 */
export async function verifyAuthenticationResponse(
  credential: AuthenticationCredential,
  expectedChallenge: Uint8Array,
  expectedOrigin: string,
  expectedRPID: string,
  credentialPublicKey: ArrayBuffer,
  currentCounter: number,
): Promise<{
  verified: boolean
  authenticationInfo?: {
    newCounter: number
  }
}> {
  try {
    const response = credential.response as AuthenticatorAssertionResponse

    // Decode client data JSON
    const clientDataJSON = JSON.parse(new TextDecoder().decode(response.clientDataJSON))

    // Verify challenge
    const receivedChallenge = base64Decode(clientDataJSON.challenge)
    if (receivedChallenge !== base64Encode(expectedChallenge)) {
      return { verified: false }
    }

    // Verify origin
    if (clientDataJSON.origin !== expectedOrigin) {
      return { verified: false }
    }

    // Verify type
    if (clientDataJSON.type !== 'webauthn.get') {
      return { verified: false }
    }

    // Parse authenticator data
    const authData = parseAuthenticatorData(response.authenticatorData)

    // Verify RP ID hash
    const rpIdHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRPID))
    if (!arraysEqual(new Uint8Array(rpIdHash), authData.rpIdHash)) {
      return { verified: false }
    }

    // Verify counter
    if (authData.signCount > 0 && authData.signCount <= currentCounter) {
      return { verified: false }
    }

    // Verify signature
    const clientDataHash = await crypto.subtle.digest('SHA-256', response.clientDataJSON)
    const signatureBase = new Uint8Array([
      ...new Uint8Array(response.authenticatorData),
      ...new Uint8Array(clientDataHash),
    ])

    const verified = await verifySignature(
      credentialPublicKey,
      signatureBase,
      response.signature,
    )

    if (!verified) {
      return { verified: false }
    }

    return {
      verified: true,
      authenticationInfo: {
        newCounter: authData.signCount,
      },
    }
  }
  catch (error) {
    return { verified: false }
  }
}

// Helper functions

function parseAttestationObject(attestationObject: ArrayBuffer): AttestationObject {
  // This is a simplified parser - in production, use proper CBOR parsing
  const view = new DataView(attestationObject)
  const authData = parseAuthenticatorData(attestationObject)

  return {
    fmt: 'none',
    attStmt: {},
    authData,
  }
}

function parseAuthenticatorData(authData: ArrayBuffer) {
  const view = new DataView(authData)
  let offset = 0

  // RP ID Hash (32 bytes)
  const rpIdHash = new Uint8Array(authData.slice(offset, offset + 32))
  offset += 32

  // Flags (1 byte)
  const flagsByte = view.getUint8(offset)
  offset += 1

  const flags = {
    userPresent: (flagsByte & 0x01) !== 0,
    userVerified: (flagsByte & 0x04) !== 0,
    backupEligible: (flagsByte & 0x08) !== 0,
    backupState: (flagsByte & 0x10) !== 0,
    attestedCredentialData: (flagsByte & 0x40) !== 0,
    extensionData: (flagsByte & 0x80) !== 0,
  }

  // Sign count (4 bytes)
  const signCount = view.getUint32(offset, false)
  offset += 4

  let credentialPublicKey: ArrayBuffer = new ArrayBuffer(0)

  if (flags.attestedCredentialData) {
    // AAGUID (16 bytes)
    offset += 16

    // Credential ID length (2 bytes)
    const credIdLength = view.getUint16(offset, false)
    offset += 2

    // Credential ID
    offset += credIdLength

    // Credential public key (rest of the data)
    credentialPublicKey = authData.slice(offset)
  }

  return {
    rpIdHash,
    flags,
    signCount,
    credentialPublicKey,
  }
}

async function verifySignature(
  publicKey: ArrayBuffer,
  data: Uint8Array,
  signature: ArrayBuffer,
): Promise<boolean> {
  try {
    // Import the public key
    const key = await crypto.subtle.importKey(
      'spki',
      publicKey,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify'],
    )

    // Verify the signature
    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      key,
      signature,
      data,
    )
  }
  catch {
    return false
  }
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}
