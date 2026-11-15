import type { DesktopUpdatesConfig } from '@stacksjs/types'
import type { DesktopUpdateManifest } from './updater'
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { createReadStream, statSync } from 'node:fs'
import { updateManifestPayload, validateUpdateManifest, verifyUpdateManifestSignature } from './updater'

/**
 * The signing half of desktop updates. A release signs one manifest per
 * platform and architecture with an Ed25519 private key that stays with the
 * person releasing; the app carries the public key and refuses a manifest it
 * does not verify (`updater.ts`).
 */

export const UPDATE_PUBLIC_PREFIX = 'ed25519-public:'
export const UPDATE_PRIVATE_PREFIX = 'ed25519-private:'

export interface UpdateKeypair {
  keyId: string
  /** `ed25519-public:<base64url SPKI DER>`: goes in `desktop.webview.updates.publicKeys`. */
  publicKey: string
  /** `ed25519-private:<base64url PKCS#8 DER>`: `DESKTOP_UPDATE_PRIVATE_KEY`, kept out of the repository. */
  privateKey: string
}

export function generateUpdateKeypair(keyId = 'main'): UpdateKeypair {
  if (!/^[\w.-]+$/.test(keyId)) throw new Error(`A key id is letters, digits, dots, dashes and underscores: ${keyId}`)
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    keyId,
    publicKey: `${UPDATE_PUBLIC_PREFIX}${publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')}`,
    privateKey: `${UPDATE_PRIVATE_PREFIX}${privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url')}`,
  }
}

function privateKeyObject(encoded: string): ReturnType<typeof createPrivateKey> {
  if (!encoded.startsWith(UPDATE_PRIVATE_PREFIX)) throw new Error(`A desktop update private key starts with ${UPDATE_PRIVATE_PREFIX}`)
  let key: ReturnType<typeof createPrivateKey>
  try {
    key = createPrivateKey({ key: Buffer.from(encoded.slice(UPDATE_PRIVATE_PREFIX.length), 'base64url'), format: 'der', type: 'pkcs8' })
  }
  catch {
    throw new Error('The desktop update private key could not be read')
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('The desktop update private key is not an Ed25519 key')
  return key
}

/** The public key that verifies what a private key signs, in the encoding the app trusts. */
export function updatePublicKey(privateKey: string): string {
  return `${UPDATE_PUBLIC_PREFIX}${createPublicKey(privateKeyObject(privateKey)).export({ format: 'der', type: 'spki' }).toString('base64url')}`
}

/** Whether a value is a public key an app can verify with: the prefix, then an Ed25519 key as base64url SPKI DER. */
export function isUpdatePublicKey(encoded: string): boolean {
  if (typeof encoded !== 'string' || !encoded.startsWith(UPDATE_PUBLIC_PREFIX)) return false
  try {
    return createPublicKey({ key: Buffer.from(encoded.slice(UPDATE_PUBLIC_PREFIX.length), 'base64url'), format: 'der', type: 'spki' }).asymmetricKeyType === 'ed25519'
  }
  catch {
    return false
  }
}

/**
 * Why an `updates` section cannot ship, as a list; empty when it can. `key`
 * names it in the messages (`webview.updates`, `macos.updates`). The feed is
 * https, or loopback while developing; every trusted key is a public key.
 * `decodeKeys` also reads each key: the AppKit host parses them natively, and
 * one it cannot read is an app that never updates and never says why.
 */
export function desktopUpdatesProblems(updates: DesktopUpdatesConfig, key: string, options: { decodeKeys?: boolean } = {}): string[] {
  const errors: string[] = []
  try {
    const url = new URL(updates.feedUrl)
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) errors.push(`${key}.feedUrl must be https`)
  }
  catch {
    errors.push(`${key}.feedUrl is not a URL (got ${JSON.stringify(updates.feedUrl)})`)
  }
  const keys = Object.entries(updates.publicKeys ?? {})
  if (!keys.length) errors.push(`${key}.publicKeys needs at least one key (run \`buddy desktop:update:keypair\`)`)
  for (const [id, value] of keys) {
    if (typeof value !== 'string' || !value.startsWith(UPDATE_PUBLIC_PREFIX)) errors.push(`${key}.publicKeys.${id} is not a public key (it starts with ${UPDATE_PUBLIC_PREFIX})`)
    else if (options.decodeKeys && !isUpdatePublicKey(value)) errors.push(`${key}.publicKeys.${id} is not a readable Ed25519 public key: paste the one \`buddy desktop:update:keypair\` printed, whole`)
  }
  if (updates.checkEveryHours !== undefined && !(Number.isFinite(updates.checkEveryHours) && updates.checkEveryHours >= 0))
    errors.push(`${key}.checkEveryHours must be a number of hours, or 0 to turn the automatic check off`)
  return errors
}

export type UnsignedUpdateManifest = Omit<DesktopUpdateManifest, 'signature' | 'signingKeyId'>

/** Sign a manifest. The result is verified against the key's own public half before it is returned. */
export function signUpdateManifest(unsigned: UnsignedUpdateManifest, privateKey: string, keyId = 'main'): DesktopUpdateManifest {
  const key = privateKeyObject(privateKey)
  const manifest = { ...unsigned, sha256: unsigned.sha256.toLowerCase(), signingKeyId: keyId, signature: '' } as DesktopUpdateManifest
  manifest.signature = sign(null, updateManifestPayload(manifest), key).toString('base64url')
  validateUpdateManifest(manifest)
  verifyUpdateManifestSignature(manifest, { [keyId]: updatePublicKey(privateKey) })
  return manifest
}

/** A file's size and SHA-256, read as a stream: an installer is too large to hold twice. */
export async function describeArtifact(file: string): Promise<{ size: number, sha256: string }> {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', resolve).on('error', reject)
  })
  return { size: statSync(file).size, sha256: hash.digest('hex') }
}
