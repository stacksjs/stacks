/** Passwordless, discoverable passkeys. All binary fields use base64url JSON. */
import { createHash, randomBytes } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { db, getDatabaseDialect, mutationCount, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse,
  registrationOptionsToJSON, authenticationOptionsToJSON, registrationCredentialFromJSON, authenticationCredentialFromJSON } from '@stacksjs/ts-auth'
import type { RegistrationOptionsJSON, AuthenticationOptionsJSON, RegistrationCredentialJSON, AuthenticationCredentialJSON } from '@stacksjs/ts-auth'
import { getUserPasskeys, passkeyDescriptors, updatePasskeyCounter } from './passkey'

export interface PasskeyRelyingParty { origin: string, name: string }
export class PasskeyError extends Error {}
const TTL = 5 * 60 * 1000
const digest = (token: string): string => createHash('sha256').update(token).digest('hex')
function relyingParty(party: PasskeyRelyingParty): { origin: string, rpID: string } {
  const url = new URL(party.origin)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    throw new Error('Passkeys require HTTPS or localhost')
  return { origin: url.origin, rpID: url.hostname }
}
interface Ceremony { id: string, challenge: string, user_id: number | null, purpose: string, expires_at: string }
async function issue(purpose: 'registration' | 'authentication', challenge: Uint8Array, userId: number | null, origin: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.deleteFrom('passkey_ceremonies').where('expires_at', '<', sqlDateTime()).execute()
  await db.insertInto('passkey_ceremonies').values({ id: digest(token), user_id: userId, purpose,
    challenge: Buffer.from(challenge).toString('base64url'), origin, expires_at: sqlDateTime(new Date(Date.now() + TTL)) } as never).execute()
  return token
}
async function consume(token: unknown, purpose: string, origin: string, userId?: number): Promise<Ceremony> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new PasskeyError('Passkey request expired. Please try again.')
  const row = await db.primary.selectFrom('passkey_ceremonies').selectAll().where('id', '=', digest(token))
    .where('purpose', '=', purpose).where('origin', '=', origin).executeTakeFirst() as Ceremony | undefined
  if (!row || (userId !== undefined && Number(row.user_id) !== userId)) throw new PasskeyError('Passkey request expired. Please try again.')
  // Conditional DELETE: concurrent finishes have exactly one winner, including across workers.
  const claimed = await db.deleteFrom('passkey_ceremonies').where('id', '=', row.id).execute()
  if (mutationCount(claimed) !== 1 || (parseSqlDateTime(row.expires_at)?.getTime() ?? 0) <= Date.now())
    throw new PasskeyError('Passkey request expired. Please try again.')
  return row
}

export async function beginPasskeyRegistration(user: { id: number, email?: string, name?: string }, party: PasskeyRelyingParty): Promise<{ ceremony: string, options: RegistrationOptionsJSON }> {
  const { origin, rpID } = relyingParty(party)
  const existing = await getUserPasskeys(user.id)
  // Stable opaque handle: independent of mutable email and within WebAuthn's 64-byte limit.
  const handle = createHash('sha256').update(`stacks:passkey:${rpID}:${user.id}`).digest('base64url')
  const options = generateRegistrationOptions({ rpID, rpName: party.name, userID: handle, userName: user.email || String(user.id), userDisplayName: user.name,
    attestationType: 'none', excludeCredentials: passkeyDescriptors(existing),
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' } })
  return { ceremony: await issue('registration', options.challenge, user.id, origin), options: registrationOptionsToJSON(options) }
}
export async function finishPasskeyRegistration(userId: number, token: unknown, credential: RegistrationCredentialJSON, party: PasskeyRelyingParty): Promise<void> {
  const { origin, rpID } = relyingParty(party)
  const ceremony = await consume(token, 'registration', origin, userId)
  let verified
  try {
    verified = await verifyRegistrationResponse(registrationCredentialFromJSON(credential), Buffer.from(ceremony.challenge, 'base64url'), origin, rpID, { requireUserVerification: true })
  }
  catch { throw new PasskeyError('Passkey could not be verified.') }
  const info = verified.registrationInfo
  if (!verified.verified || !info || info.credential.id.length > 255) throw new PasskeyError('Passkey could not be verified.')
  const transports = Array.isArray(credential.response.transports) ? credential.response.transports.filter(value => ['internal', 'hybrid', 'usb', 'nfc', 'ble'].includes(value)) : []
  await db.insertInto('passkeys').values({ id: info.credential.id, user_id: userId,
    cred_public_key: Buffer.from(info.credential.publicKey).toString('base64url'),
    webauthn_user_id: createHash('sha256').update(`stacks:passkey:${rpID}:${userId}`).digest('base64url'),
    counter: info.credential.counter, credential_type: info.credentialType, device_type: info.credentialDeviceType,
    backup_eligible: info.credentialDeviceType === 'multiDevice', backup_status: info.credentialBackedUp,
    transports: JSON.stringify(transports || []), created_at: sqlDateTime(), last_used_at: null } as never).execute()
}
export async function beginPasskeyAuthentication(party: PasskeyRelyingParty): Promise<{ ceremony: string, options: AuthenticationOptionsJSON }> {
  const { origin, rpID } = relyingParty(party)
  // No account lookup or allowCredentials: supports autofill and never enumerates accounts.
  const options = generateAuthenticationOptions({ rpID, userVerification: 'required' })
  return { ceremony: await issue('authentication', options.challenge, null, origin), options: authenticationOptionsToJSON(options) }
}
export async function finishPasskeyAuthentication(token: unknown, credential: AuthenticationCredentialJSON, party: PasskeyRelyingParty): Promise<number> {
  const { origin, rpID } = relyingParty(party)
  const ceremony = await consume(token, 'authentication', origin)
  try {
    const decoded = authenticationCredentialFromJSON(credential)
    const passkey = await db.primary.selectFrom('passkeys').selectAll().where('id', '=', decoded.id).executeTakeFirst()
    if (!passkey) throw new PasskeyError('Passkey could not be verified.')
    if (decoded.response.userHandle && Buffer.from(decoded.response.userHandle).toString() !== passkey.webauthn_user_id)
      throw new PasskeyError('Passkey could not be verified.')
    // Legacy rows stored JSON byte objects; new registrations store base64url.
    const stored = String(passkey.cred_public_key)
    const key = stored.startsWith('{') || stored.startsWith('[')
      ? Uint8Array.from(Object.values(JSON.parse(stored)) as number[]).buffer
      : new Uint8Array(Buffer.from(stored, 'base64url')).buffer
    const verified = await verifyAuthenticationResponse(decoded, Buffer.from(ceremony.challenge, 'base64url'), origin, rpID, key, Number(passkey.counter), { requireUserVerification: true })
    const counter = verified.authenticationInfo?.newCounter
    if (!verified.verified || counter === undefined || !await updatePasskeyCounter(Number(passkey.user_id), decoded.id, counter, { counter: Number(passkey.counter), cred_public_key: String(passkey.cred_public_key) }))
      throw new PasskeyError('Passkey could not be verified.')
    return Number(passkey.user_id)
  }
  catch { throw new PasskeyError('Passkey could not be verified.') }
}

/** Only display-safe metadata leaves the server. */
export async function listPasskeys(userId: number): Promise<{ id: string, device: string, created_at: unknown, last_used_at: unknown }[]> {
  return (await getUserPasskeys(userId)).map(key => ({ id: key.id, device: key.device_type, created_at: key.created_at, last_used_at: key.last_used_at }))
}
/** Serialize removals per account so two simultaneous deletes cannot remove the last way in. */
export async function removePasskey(userId: number, credentialId: string, hasAlternativeSignIn?: (user: Record<string, unknown>) => boolean | Promise<boolean>): Promise<boolean> {
  return db.transaction(async () => {
    let query = db.primary.selectFrom('users').selectAll().where('id', '=', userId)
    if (getDatabaseDialect() !== 'sqlite') query = query.lockForUpdate()
    const user = await query.executeTakeFirst()
    if (!user) return false
    const keys = await getUserPasskeys(userId)
    if (!keys.some(key => key.id === credentialId)) return false
    const alternative = hasAlternativeSignIn ? await hasAlternativeSignIn(user) : typeof user.password === 'string' && user.password.length > 0
    if (keys.length === 1 && !alternative) throw new PasskeyError('Add a password or another passkey before removing your last passkey.')
    return mutationCount(await db.deleteFrom('passkeys').where('user_id', '=', userId).where('id', '=', credentialId).execute()) === 1
  })
}
