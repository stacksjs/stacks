import assert from 'node:assert/strict'
import { authenticator } from '../helpers/webauthn-device'
import { Buffer } from 'node:buffer'
const database = process.env.DB_DATABASE_PATH!
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { beginPasskeyRegistration, finishPasskeyRegistration, beginPasskeyAuthentication, finishPasskeyAuthentication, listPasskeys, removePasskey } = await import('../../src/passkeys')
const { registrationCredentialToJSON, authenticationCredentialToJSON } = await import('@stacksjs/ts-auth')
const party = { origin: 'https://example.com', name: 'Example' }
const user = { id: 1, email: 'one@example.com' }
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password TEXT)').execute()
  await db.insertInto('users').values([{ ...user, password: null }, { id: 2, email: 'two@example.com', password: null }] as never).execute()
  await ensureFrameworkAuthTables()
  const device = await authenticator()
  const registration = await beginPasskeyRegistration(user, party)
  device.useChallenge(Buffer.from(registration.options.challenge, 'base64url'))
  const enrolled = registrationCredentialToJSON(device.registration())
  await assert.rejects(finishPasskeyRegistration(2, registration.ceremony, enrolled, party))
  await finishPasskeyRegistration(1, registration.ceremony, enrolled, party)
  await assert.rejects(finishPasskeyRegistration(1, registration.ceremony, enrolled, party))
  assert.equal((await listPasskeys(2)).length, 0)
  const keys = await listPasskeys(1)
  assert.equal(keys.length, 1)
  assert.equal(keys[0]!.last_used_at, null)
  assert.equal('cred_public_key' in keys[0]!, false)
  const first = await beginPasskeyAuthentication(party)
  const second = await beginPasskeyAuthentication(party)
  assert.deepEqual(first.options.allowCredentials, [])
  assert.notEqual(first.ceremony, second.ceremony)
  device.useChallenge(Buffer.from(first.options.challenge, 'base64url'))
  const credential = authenticationCredentialToJSON(device.assertion())
  await assert.rejects(finishPasskeyAuthentication(second.ceremony, credential, party))
  const results = await Promise.allSettled([finishPasskeyAuthentication(first.ceremony, credential, party), finishPasskeyAuthentication(first.ceremony, credential, party)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal((results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<number>).value, 1)
  assert((await listPasskeys(1))[0]!.last_used_at)
  const replay = await beginPasskeyAuthentication(party)
  device.useChallenge(Buffer.from(replay.options.challenge, 'base64url'))
  await assert.rejects(finishPasskeyAuthentication(replay.ceremony, authenticationCredentialToJSON(device.assertion(1)), party))
  const expired = await beginPasskeyAuthentication(party)
  await db.updateTable('passkey_ceremonies').set({ expires_at: sqlDateTime(new Date(0)) } as never).execute()
  device.useChallenge(Buffer.from(expired.options.challenge, 'base64url'))
  await assert.rejects(finishPasskeyAuthentication(expired.ceremony, authenticationCredentialToJSON(device.assertion(2)), party))
  assert.equal(await removePasskey(2, keys[0]!.id), false)
  await assert.rejects(removePasskey(1, keys[0]!.id))
  assert.equal(await removePasskey(1, keys[0]!.id, () => true), true)
  const revoked = await beginPasskeyAuthentication(party)
  device.useChallenge(Buffer.from(revoked.options.challenge, 'base64url'))
  await assert.rejects(finishPasskeyAuthentication(revoked.ceremony, authenticationCredentialToJSON(device.assertion(2)), party))
  // Racing removals still leave one usable factor on a passwordless account.
  for (const extra of [await authenticator(), await authenticator()]) {
    const options = await beginPasskeyRegistration(user, party)
    extra.useChallenge(Buffer.from(options.options.challenge, 'base64url'))
    await finishPasskeyRegistration(1, options.ceremony, registrationCredentialToJSON(extra.registration()), party)
  }
  const pair = await listPasskeys(1)
  assert.equal(pair.length, 2)
  await Promise.allSettled(pair.map(key => removePasskey(1, key.id)))
  assert.equal((await listPasskeys(1)).length, 1)
  console.log('passkey ceremonies OK')
}
finally {
  await closeDatabaseConnection()
  await releaseOrm()
}
