/**
 * WebAuthn Browser Implementation
 * Native implementation to replace @simplewebauthn/browser
 */

import { base64Decode, base64Encode } from '../utils/base64'
import type {
  AuthenticationCredential,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
  RegistrationCredential,
} from './types'

/**
 * Start registration (credential creation) process
 */
export async function startRegistration(
  options: PublicKeyCredentialCreationOptions,
): Promise<RegistrationCredential> {
  // Check if WebAuthn is supported
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser')
  }

  // Convert options to browser-compatible format
  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: options.challenge,
    user: {
      ...options.user,
      id: options.user.id,
    },
  }

  // Create credential
  const credential = await navigator.credentials.create({
    publicKey: publicKeyOptions as any,
  }) as any

  if (!credential) {
    throw new Error('Failed to create credential')
  }

  // Convert to serializable format
  return {
    id: credential.id,
    rawId: credential.rawId,
    response: {
      clientDataJSON: credential.response.clientDataJSON,
      attestationObject: credential.response.attestationObject,
    },
    type: credential.type,
  }
}

/**
 * Start authentication (credential verification) process
 */
export async function startAuthentication(
  options: PublicKeyCredentialRequestOptions,
): Promise<AuthenticationCredential> {
  // Check if WebAuthn is supported
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser')
  }

  // Get credential
  const credential = await navigator.credentials.get({
    publicKey: options as any,
  }) as any

  if (!credential) {
    throw new Error('Failed to get credential')
  }

  // Convert to serializable format
  return {
    id: credential.id,
    rawId: credential.rawId,
    response: {
      clientDataJSON: credential.response.clientDataJSON,
      authenticatorData: credential.response.authenticatorData,
      signature: credential.response.signature,
      userHandle: credential.response.userHandle,
    },
    type: credential.type,
  }
}

/**
 * Check if platform authenticator is available
 */
export async function platformAuthenticatorIsAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  }
  catch {
    return false
  }
}

/**
 * Check if browser supports WebAuthn
 */
export function browserSupportsWebAuthn(): boolean {
  return !!window.PublicKeyCredential
}

/**
 * Check if browser supports conditional UI
 */
export async function browserSupportsWebAuthnAutofill(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false
  }

  try {
    return await (PublicKeyCredential as any).isConditionalMediationAvailable?.()
  }
  catch {
    return false
  }
}
