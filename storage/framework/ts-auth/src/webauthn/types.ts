/**
 * WebAuthn TypeScript type definitions
 */

export interface PublicKeyCredentialCreationOptions {
  challenge: Uint8Array
  rp: {
    name: string
    id: string
  }
  user: {
    id: Uint8Array
    name: string
    displayName: string
  }
  pubKeyCredParams: Array<{
    alg: number
    type: string
  }>
  timeout?: number
  attestation?: 'none' | 'indirect' | 'direct'
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    requireResidentKey?: boolean
    residentKey?: 'discouraged' | 'preferred' | 'required'
    userVerification?: 'required' | 'preferred' | 'discouraged'
  }
  excludeCredentials?: Array<{
    id: ArrayBuffer
    type: string
    transports?: string[]
  }>
}

export interface PublicKeyCredentialRequestOptions {
  challenge: Uint8Array
  rpId?: string
  allowCredentials?: Array<{
    id: ArrayBuffer
    type: string
    transports?: string[]
  }>
  userVerification?: 'required' | 'preferred' | 'discouraged'
  timeout?: number
}

export interface RegistrationCredential {
  id: string
  rawId: ArrayBuffer
  response: AuthenticatorAttestationResponse
  type: string
}

export interface AuthenticationCredential {
  id: string
  rawId: ArrayBuffer
  response: AuthenticatorAssertionResponse
  type: string
}

export interface AuthenticatorAttestationResponse {
  clientDataJSON: ArrayBuffer
  attestationObject: ArrayBuffer
}

export interface AuthenticatorAssertionResponse {
  clientDataJSON: ArrayBuffer
  authenticatorData: ArrayBuffer
  signature: ArrayBuffer
  userHandle: ArrayBuffer | null
}

export interface AttestationObject {
  fmt: string
  attStmt: Record<string, any>
  authData: {
    rpIdHash: Uint8Array
    flags: {
      userPresent: boolean
      userVerified: boolean
      backupEligible: boolean
      backupState: boolean
      attestedCredentialData: boolean
      extensionData: boolean
    }
    signCount: number
    credentialPublicKey: ArrayBuffer
  }
}

export interface VerifiedRegistrationResponse {
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
}

export interface VerifiedAuthenticationResponse {
  verified: boolean
  authenticationInfo?: {
    newCounter: number
  }
}
