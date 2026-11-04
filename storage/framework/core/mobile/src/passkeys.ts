import { callNative } from './bridge'

/** JSON WebAuthn options as supplied by the relying party's server. */
export interface NativePasskeyOptions {
  challenge: string
  rpId?: string
  rp?: { id?: string, name?: string }
  user?: { id: string, name: string, displayName?: string }
  [option: string]: unknown
}

export interface NativePasskeyCredential {
  id: string
  rawId: string
  type: 'public-key'
  response: Record<string, string>
  clientExtensionResults?: Record<string, unknown>
  authenticatorAttachment?: string
}

export interface PasskeysApi {
  isAvailable: () => Promise<boolean>
  create: (options: NativePasskeyOptions) => Promise<NativePasskeyCredential>
  get: (options: NativePasskeyOptions) => Promise<NativePasskeyCredential>
}

function unavailable(): never {
  throw Object.assign(new Error('Native passkeys are not available on this host'), { code: 'CAPABILITY_DISABLED' })
}

/** The native system sheet returns JSON credentials for server verification. */
export const passkeys: PasskeysApi = {
  isAvailable: () => callNative<boolean>('passkeys.isAvailable', [], () => false),
  create: options => callNative<NativePasskeyCredential>('passkeys.create', [options], unavailable),
  get: options => callNative<NativePasskeyCredential>('passkeys.get', [options], unavailable),
}
