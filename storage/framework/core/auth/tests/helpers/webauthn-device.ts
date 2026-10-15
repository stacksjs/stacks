import { generateKeyPairSync, sign } from 'node:crypto'
import { Buffer } from 'node:buffer'
function cbor(value: any): Buffer {
  const header = (major: number, n: number) => n < 24 ? Buffer.from([major * 32 + n]) : n < 256 ? Buffer.from([major * 32 + 24, n]) : Buffer.from([major * 32 + 25, n >> 8, n & 255])
  if (typeof value === 'number') return header(value < 0 ? 1 : 0, value < 0 ? -1 - value : value)
  if (typeof value === 'string') return Buffer.concat([header(3, Buffer.byteLength(value)), Buffer.from(value)])
  if (value instanceof Uint8Array) return Buffer.concat([header(2, value.length), value])
  if (value instanceof Map) return Buffer.concat([header(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])])
  throw new Error('fixture CBOR')
}
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer

/** Real attestation:none and DER ES256 / RS256 assertions, with JSON in both directions. */
export async function authenticator(algorithm: 'ec' | 'rsa' = 'ec') {
  const pair = algorithm === 'ec' ? generateKeyPairSync('ec', { namedCurve: 'P-256' }) : generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = pair.publicKey.export({ format: 'jwk' })
  const key = algorithm === 'ec'
    ? new Map<any, any>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')]])
    : new Map<any, any>([[1, 3], [3, -257], [-1, Buffer.from(jwk.n!, 'base64url')], [-2, Buffer.from(jwk.e!, 'base64url')]])
  const id = crypto.getRandomValues(new Uint8Array(32))
  const publicKey = cbor(key)
  let challenge = crypto.getRandomValues(new Uint8Array(32))
  const rpHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('example.com')))
  function client(type: string, origin = 'https://example.com', nonce = challenge): ArrayBuffer {
    return arrayBuffer(Buffer.from(JSON.stringify({ type, origin, challenge: Buffer.from(nonce).toString('base64url') })))
  }
  function data(flags: number, counter: number): Buffer {
    const count = Buffer.alloc(4); count.writeUInt32BE(counter)
    return Buffer.concat([rpHash, Buffer.from([flags]), count])
  }
  function registration(flags = 0x45) {
    const size = Buffer.alloc(2); size.writeUInt16BE(id.length)
    return { id: Buffer.from(id).toString('base64url'), rawId: arrayBuffer(id), type: 'public-key', response: {
      clientDataJSON: client('webauthn.create'), attestationObject: arrayBuffer(cbor(new Map([
        ['fmt', 'none'], ['attStmt', new Map()], ['authData', Buffer.concat([data(flags, 0), Buffer.alloc(16), size, id, publicKey])],
      ] as any))) } }
  }
  function assertion(counter = 1, flags = 0x05, origin = 'https://example.com') {
    const clientDataJSON = client('webauthn.get', origin)
    const authData = data(flags, counter)
    const hash = new Uint8Array(new Bun.CryptoHasher('sha256').update(clientDataJSON).digest())
    return { id: Buffer.from(id).toString('base64url'), rawId: arrayBuffer(id), type: 'public-key', response: {
      clientDataJSON, authenticatorData: arrayBuffer(authData), signature: arrayBuffer(sign('sha256', Buffer.concat([authData, hash]), pair.privateKey)), userHandle: null } }
  }
  return { id, publicKey: arrayBuffer(publicKey), registration, assertion, useChallenge(value: Uint8Array) { challenge = value } }
}
