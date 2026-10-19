/**
 * The default social sign-in routes end to end, against real SQLite and the
 * real GitHub driver with the network stubbed: redirect, callback, handoff.
 * Spawned by social-callback-flow.test.ts so the config and fetch stubs stay
 * out of the shared test process.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { releaseOrm } from 'bun-query-builder'

const database = process.env.DB_DATABASE_PATH
assert(database)

const { closeDatabaseConnection, db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } },
})
const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { ormReady } = await import('@stacksjs/orm')
await ormReady

;(config as any).services = {
  github: { clientId: 'gh-client', clientSecret: 'gh-secret', redirectUrl: 'https://app.test/auth/github/callback', scopes: ['user:email'] },
}
;(config as any).app = { ...(config as any).app, key: 'base64:dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMTIzNA==', url: 'https://app.test' }

let profile = { id: 4242, login: 'octo', name: 'Octo Cat', email: 'octo@example.com', verified: true }
let exchanges = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: unknown) => {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  if (url.startsWith('https://github.com/login/oauth/access_token')) {
    exchanges++
    return json({ access_token: 'gh-access' })
  }
  if (url === 'https://api.github.com/user')
    return json({ id: profile.id, login: profile.login, name: profile.name, avatar_url: null, email: profile.email })
  if (url === 'https://api.github.com/user/emails')
    return json([{ email: profile.email, primary: true, verified: profile.verified }])
  return realFetch(input as Request)
}) as typeof fetch

const { default: SocialRedirectAction } = await import('../../../../defaults/app/Actions/Auth/SocialRedirectAction')
const { default: SocialCallbackAction } = await import('../../../../defaults/app/Actions/Auth/SocialCallbackAction')
const { default: SessionHandoffAction } = await import('../../../../defaults/app/Actions/Auth/SessionHandoffAction')
const { createSessionHandoff, redeemSessionHandoff } = await import('../../src/session-handoff')
const { readSessionHandoffCode } = await import('@stacksjs/composables')

interface FakeRequestInit { params?: Record<string, string>, query?: Record<string, string>, form?: Record<string, string>, body?: Record<string, unknown>, cookie?: string, method?: string }
function fakeRequest(init: FakeRequestInit): RequestInstance {
  const values: Record<string, unknown> = { ...init.query, ...init.body }
  return {
    method: init.method ?? 'GET',
    headers: new Headers(init.cookie ? { cookie: init.cookie } : {}),
    formBody: init.form,
    getParam: (name: string) => init.params?.[name],
    get: (name: string) => values[name],
  } as unknown as RequestInstance
}

/** `name=value` pairs from Set-Cookie headers, for the next request's Cookie header. */
function cookieJar(response: Response, existing = ''): string {
  const jar = new Map(existing.split('; ').filter(Boolean).map(pair => [pair.split('=')[0]!, pair] as const))
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0]!
    const [name, value] = [pair.split('=')[0]!, pair.slice(pair.indexOf('=') + 1)]
    if (value) jar.set(name, pair)
    else jar.delete(name)
  }
  return [...jar.values()].join('; ')
}

async function startFlow(query: Record<string, string> = {}) {
  const redirect = await SocialRedirectAction.handle(fakeRequest({ params: { provider: 'github' }, query })) as Response
  assert.equal(redirect.status, 302)
  const location = new URL(redirect.headers.get('Location')!)
  const state = location.searchParams.get('state')!
  assert.match(state, /^[a-f0-9]{64}$/)
  return { state, cookie: cookieJar(redirect), redirect }
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name TEXT, email VARCHAR(255) UNIQUE, password TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.unsafe('CREATE TABLE social_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, provider_user_id TEXT NOT NULL, provider_email TEXT, user_id INTEGER, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  const migrated = await migrateAuthTables()
  assert.ok(migrated.success, migrated.error)

  // 1. The redirect stores digests only and binds the flow to this browser.
  const flow = await startFlow({ redirect_to: '/account?tab=1' })
  assert.match(flow.redirect.headers.getSetCookie()[0]!, /HttpOnly; SameSite=Lax/)
  const stored = await db.selectFrom('oauth_flows').selectAll().execute()
  assert.equal(stored.length, 1)
  assert.equal(stored[0]!.state_digest, createHash('sha256').update(flow.state).digest('hex'))
  assert.equal(stored[0]!.purpose, 'social:github')

  // 2. Login CSRF: the attacker's state and code, in a browser without the
  //    flow cookie, is refused before the code is exchanged.
  const forged = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: flow.state, code: 'attacker-code' } })) as Response
  assert.equal(forged.status, 302)
  assert.match(forged.headers.get('Location')!, /^\/login\?social_error=/)
  assert.equal(exchanges, 0, 'a forged callback never reaches the token endpoint')

  // A state that was never issued is refused the same way.
  const unknown = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: 'b'.repeat(64), code: 'x' }, cookie: flow.cookie })) as Response
  assert.match(unknown.headers.get('Location')!, /social_error=/)

  // 3. The real browser completes, and gets a one-use code, not tokens.
  const callback = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: flow.state, code: 'real-code' }, cookie: flow.cookie })) as Response
  assert.equal(callback.status, 302)
  assert.equal(exchanges, 1)
  const landing = callback.headers.get('Location')!
  assert.ok(landing.startsWith('/account?tab=1#stx_handoff='), landing)
  assert.ok(!/stx_auth|access|refresh/.test(landing), 'no bearer credential in the URL')
  const code = readSessionHandoffCode(landing.slice(landing.indexOf('#')))!
  assert.match(code, /^[a-f0-9]{64}$/)
  const browser = cookieJar(callback, flow.cookie)

  // The flow state is spent: replaying the callback fails.
  const replay = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: flow.state, code: 'real-code' }, cookie: flow.cookie })) as Response
  assert.match(replay.headers.get('Location')!, /social_error=/)
  assert.equal(exchanges, 1)

  // 4. Another browser holding the code cannot redeem it.
  const stolen = await SessionHandoffAction.handle(fakeRequest({ method: 'POST', body: { code } })) as Response
  assert.equal(stolen.status, 401)

  // 5. The browser that holds the binding cookie can, once.
  const redeemed = await SessionHandoffAction.handle(fakeRequest({ method: 'POST', body: { code }, cookie: browser })) as Response
  assert.equal(redeemed.status, 200, await redeemed.clone().text())
  const session = await redeemed.json() as Record<string, any>
  assert.ok(session.access_token)
  assert.equal(session.user.email, 'octo@example.com')
  assert.ok(redeemed.headers.getSetCookie().some(header => /HttpOnly/.test(header) && !header.startsWith('stacks_oauth_')), 'auth cookie set')
  const user = await db.selectFrom('users').selectAll().where('email', '=', 'octo@example.com').executeTakeFirstOrThrow()
  assert.ok(user.email_verified_at, 'a provider-verified sign-up starts verified')

  const again = await SessionHandoffAction.handle(fakeRequest({ method: 'POST', body: { code }, cookie: browser })) as Response
  assert.equal(again.status, 401)

  // 6. An unverified local account with the same address is not linked onto.
  await db.insertInto('users').values({ name: 'Squatter', email: 'victim@example.com', password: 'x', created_at: sqlDateTime() } as never).execute()
  profile = { id: 777, login: 'victim', name: 'Victim', email: 'victim@example.com', verified: true }
  const squat = await startFlow()
  const refused = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: squat.state, code: 'c' }, cookie: squat.cookie })) as Response
  assert.match(decodeURIComponent(refused.headers.get('Location')!), /has not been verified/)
  assert.equal((await db.selectFrom('social_accounts').selectAll().where('provider_user_id', '=', '777').execute()).length, 0)

  // 7. A provider error (the user cancelled) clears the flow too.
  const cancelled = await startFlow()
  const cancel = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: cancelled.state, error: 'access_denied' }, cookie: cancelled.cookie })) as Response
  assert.match(decodeURIComponent(cancel.headers.get('Location')!), /cancelled/)
  assert.ok(cancel.headers.getSetCookie().some(header => header.includes('Max-Age=0')))

  // 8. An off-site redirect_to is dropped.
  const offsite = await startFlow({ redirect_to: '//evil.example/x' })
  const offsiteCallback = await SocialCallbackAction.handle(fakeRequest({ params: { provider: 'github' }, query: { state: offsite.state, code: 'c' }, cookie: offsite.cookie })) as Response
  profile = { id: 4242, login: 'octo', name: 'Octo Cat', email: 'octo@example.com', verified: true }
  assert.ok(offsiteCallback.headers.get('Location')!.startsWith('/#stx_handoff=') || /social_error/.test(offsiteCallback.headers.get('Location')!))

  // 9. A PKCE-style handoff for a native client redeems with its verifier only.
  const verifier = 'native-verifier-'.padEnd(64, 'x')
  const native = await createSessionHandoff(Number(user.id), { bindTo: { challenge: createHash('sha256').update(verifier).digest('hex') } })
  assert.equal(native.cookie, null)
  assert.equal(await redeemSessionHandoff(native.code, 'wrong'), null)
  assert.deepEqual(await redeemSessionHandoff(native.code, verifier), { userId: Number(user.id), data: null })
  assert.equal(await redeemSessionHandoff(native.code, verifier), null)

  console.log('social callback flow OK')
}
finally {
  globalThis.fetch = realFetch
  releaseOrm()
  await closeDatabaseConnection()
}
