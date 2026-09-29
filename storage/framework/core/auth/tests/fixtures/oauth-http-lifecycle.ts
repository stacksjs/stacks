import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const database = process.env.STACKS_OAUTH_HTTP_FIXTURE_DB
assert(database, 'Only run with an isolated OAuth HTTP fixture database')
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, database)

const { config, overridesReady } = await import('@stacksjs/config')
const {
  db,
  ensureDatabaseConfigLoaded,
  initializeDbConfig,
  resetDatabaseConnection,
} = await import('@stacksjs/database')
await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database } },
    queryLogging: { enabled: false },
  },
})

const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady

const {
  authenticatedUser,
  authCookieName,
  createOAuthGrant,
  createS256CodeChallenge,
  issueAuthorizationCode,
  registerOAuthClient,
  resolveOAuthProviderConfig,
} = await import('../../src')
const { makeHash } = await import('@stacksjs/security')
const { createStacksRouter } = await import('@stacksjs/router')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const LoginAction = (await import('../../../../defaults/app/Actions/Auth/LoginAction')).default
const OAuthAuthorizationAction = (await import('../../../../defaults/app/Actions/Auth/OAuthAuthorizationAction')).default
const OAuthConnectionsAction = (await import('../../../../defaults/app/Actions/Auth/OAuthConnectionsAction')).default
const OAuthConsentAction = (await import('../../../../defaults/app/Actions/Auth/OAuthConsentAction')).default
const OAuthDisconnectAction = (await import('../../../../defaults/app/Actions/Auth/OAuthDisconnectAction')).default
const OAuthTokenAction = (await import('../../../../defaults/app/Actions/Auth/OAuthTokenAction')).default

const email = 'oauth-http@example.test'
const password = 'oauth-http-password'
const redirectUri = 'https://client.example.test/callback'
const verifier = 'v'.repeat(43)
const challenge = await createS256CodeChallenge(verifier)

function responseCookie(response: Response, name: string): string {
  const value = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${name}=`))
  assert(value, `response did not set ${name}`)
  return value.split(';', 1)[0]!
}

function cookieValue(cookie: string): string {
  return cookie.slice(cookie.indexOf('=') + 1)
}

try {
  await db.unsafe(`CREATE TABLE users (
    id INTEGER PRIMARY KEY, name TEXT, email TEXT NOT NULL, password TEXT NOT NULL,
    password_changed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP
  )`).execute()
  await db.unsafe(`CREATE TABLE sessions (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, ip_address TEXT, user_agent TEXT,
    payload TEXT NOT NULL, last_activity INTEGER NOT NULL, expires_at TIMESTAMP
  )`).execute()
  await db.insertInto('users').values({
    id: 1,
    name: 'OAuth HTTP User',
    email,
    password: await makeHash(password, { algorithm: 'bcrypt' }),
  }).execute()
  await ensureFrameworkAuthTables()

  const router = createStacksRouter({ autoDiscoverRoutes: false })
  router.get('/fixture/start', () => new Response('<p>OAuth fixture</p>', {
    headers: { 'Content-Type': 'text/html' },
  }))
  router.post('/login', LoginAction)
  router.get('/oauth/authorize', OAuthAuthorizationAction)
  router.post('/oauth/authorize', OAuthConsentAction).middleware('auth')
  router.post('/oauth/token', OAuthTokenAction)
  router.get('/auth/oauth/connections', OAuthConnectionsAction).middleware('auth')
  router.post('/auth/oauth/connections/{id}/disconnect', OAuthDisconnectAction).middleware('auth')
  router.get('/fixture/resource', async (request) => {
    const user = await authenticatedUser(request)
    return {
      subject: Number(user?.id),
      canReadIssues: await request.tokenCan?.('issues:read') ?? false,
      canWriteIssues: await request.tokenCan?.('issues:write') ?? false,
    }
  }).middleware('auth')

  const server = await router.serve({ port: 0, hostname: '127.0.0.1' })
  try {
    const issuer = `http://127.0.0.1:${server.port}`
    config.auth.oauthProvider = {
      enabled: true,
      issuer,
      scopes: {
        'issues:read': { description: 'Read issues', resources: ['bughq'] },
      },
      resources: {
        bughq: { audience: `${issuer}/fixture/resource` },
      },
    }
    const provider = resolveOAuthProviderConfig(config.auth.oauthProvider)
    assert(provider)
    const registration = await registerOAuthClient(provider, 1, {
      name: 'HTTP lifecycle client',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: [redirectUri],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['issues:read'],
      resources: ['bughq'],
    })

    const authorizationParams = {
      response_type: 'code',
      client_id: String(registration.client.id),
      redirect_uri: redirectUri,
      scope: 'issues:read',
      resource: `${issuer}/fixture/resource`,
      state: 'oauth-http-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }
    const invalidRedirect = new URL('/oauth/authorize', issuer)
    invalidRedirect.search = new URLSearchParams({
      ...authorizationParams,
      redirect_uri: 'https://attacker.example.test/callback',
    }).toString()
    const invalidRedirectResponse = await fetch(invalidRedirect, { redirect: 'manual' })
    assert.equal(invalidRedirectResponse.status, 400)
    assert.equal(invalidRedirectResponse.headers.get('location'), null)
    assert.equal((await invalidRedirectResponse.json() as { error?: string }).error, 'invalid_request')

    const duplicateClient = new URL('/oauth/authorize', issuer)
    duplicateClient.search = new URLSearchParams(authorizationParams).toString()
    duplicateClient.searchParams.append('client_id', String(registration.client.id))
    const duplicateClientResponse = await fetch(duplicateClient, { redirect: 'manual' })
    assert.equal(duplicateClientResponse.status, 400)
    assert.equal(duplicateClientResponse.headers.get('location'), null)
    assert.equal((await duplicateClientResponse.json() as { error?: string }).error, 'invalid_request')

    const pkceDowngrade = new URL('/oauth/authorize', issuer)
    pkceDowngrade.search = new URLSearchParams({
      ...authorizationParams,
      code_challenge_method: 'plain',
    }).toString()
    const pkceDowngradeResponse = await fetch(pkceDowngrade, { redirect: 'manual' })
    assert.equal(pkceDowngradeResponse.status, 302)
    const pkceDowngradeCallback = new URL(pkceDowngradeResponse.headers.get('location')!)
    assert.equal(`${pkceDowngradeCallback.origin}${pkceDowngradeCallback.pathname}`, redirectUri)
    assert.equal(pkceDowngradeCallback.searchParams.get('error'), 'invalid_request')
    assert.equal(pkceDowngradeCallback.searchParams.get('state'), 'oauth-http-state')
    assert.equal(Number((await db.selectFrom('oauth_authorization_requests')
      .select(db.fn.count('request_hash').as('count'))
      .executeTakeFirstOrThrow()).count), 0)

    const start = await fetch(`${issuer}/fixture/start`)
    assert.equal(start.status, 200)
    const csrfCookie = responseCookie(start, 'X-CSRF-Token')
    const csrfToken = cookieValue(csrfCookie)
    await start.arrayBuffer()

    const authorizationUrl = new URL('/oauth/authorize', issuer)
    authorizationUrl.search = new URLSearchParams(authorizationParams).toString()
    const anonymousAuthorization = await fetch(authorizationUrl, {
      headers: { cookie: csrfCookie },
      redirect: 'manual',
    })
    assert.equal(anonymousAuthorization.status, 302)
    assert.match(anonymousAuthorization.headers.get('location') ?? '', /^\/login\?redirect=/)
    const oauthCookie = responseCookie(anonymousAuthorization, 'stacks-oauth-session')
    await anonymousAuthorization.arrayBuffer()

    const login = await fetch(`${issuer}/login`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        cookie: `${csrfCookie}; ${oauthCookie}`,
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ email, password }),
    })
    assert.equal(login.status, 200, await login.clone().text())
    const authCookie = responseCookie(login, authCookieName())
    await login.arrayBuffer()
    const browserCookies = `${csrfCookie}; ${oauthCookie}; ${authCookie}`

    const denialUrl = new URL(authorizationUrl)
    denialUrl.searchParams.set('state', 'oauth-http-denial-state')
    const denialPage = await fetch(denialUrl, {
      headers: { accept: 'text/html,application/xhtml+xml', cookie: browserCookies },
      redirect: 'manual',
    })
    assert.equal(denialPage.status, 200, await denialPage.clone().text())
    const denialHtml = await denialPage.text()
    const denialRequestId = /name="request_id" value="([A-Za-z0-9_-]{43})"/.exec(denialHtml)?.[1]
    assert(denialRequestId, 'denial page did not contain the opaque request id')
    const denialBody = new URLSearchParams({ _token: csrfToken, request_id: denialRequestId, decision: 'deny' })
    const deny = async () => await fetch(`${issuer}/oauth/authorize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: browserCookies,
      },
      body: denialBody,
      redirect: 'manual',
    })
    const denial = await deny()
    assert.equal(denial.status, 302, await denial.clone().text())
    const denialCallback = new URL(denial.headers.get('location')!)
    assert.equal(`${denialCallback.origin}${denialCallback.pathname}`, redirectUri)
    assert.equal(denialCallback.searchParams.get('error'), 'access_denied')
    assert.equal(denialCallback.searchParams.get('state'), 'oauth-http-denial-state')
    assert.equal((await deny()).status, 400, 'a denial request must be single-use')
    assert.equal(Number((await db.selectFrom('oauth_grants').select(db.fn.count('id').as('count')).executeTakeFirstOrThrow()).count), 0)

    const resumeLocation = new URL(anonymousAuthorization.headers.get('location')!, issuer)
      .searchParams.get('redirect')
    assert(resumeLocation)
    const consentPage = await fetch(new URL(resumeLocation, issuer), {
      headers: { accept: 'text/html,application/xhtml+xml', cookie: browserCookies },
      redirect: 'manual',
    })
    assert.equal(
      consentPage.status,
      200,
      `unexpected consent response: ${consentPage.status} ${consentPage.headers.get('location') ?? ''} ${await consentPage.clone().text()}`,
    )
    const consentHtml = await consentPage.text()
    assert.match(consentHtml, /HTTP lifecycle client/)
    const consentCsrfToken = /name="_token" value="([a-f0-9]{64})"/.exec(consentHtml)?.[1]
    assert.equal(consentCsrfToken, csrfToken, 'consent form did not render the browser CSRF token')
    const requestId = /name="request_id" value="([A-Za-z0-9_-]{43})"/.exec(consentHtml)?.[1]
    assert(requestId, 'consent page did not contain the opaque request id')

    const approval = await fetch(`${issuer}/oauth/authorize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: browserCookies,
      },
      body: new URLSearchParams({ _token: consentCsrfToken, request_id: requestId, decision: 'approve' }),
      redirect: 'manual',
    })
    assert.equal(approval.status, 302, await approval.clone().text())
    const callback = new URL(approval.headers.get('location')!)
    assert.equal(`${callback.origin}${callback.pathname}`, redirectUri)
    assert.equal(callback.searchParams.get('state'), 'oauth-http-state')
    const code = callback.searchParams.get('code')
    assert(code)

    const exchange = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: String(registration.client.id),
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    })
    assert.equal(exchange.status, 200, await exchange.clone().text())
    assert.equal(exchange.headers.get('cache-control'), 'no-store')
    const firstPair = await exchange.json() as { access_token: string, refresh_token: string }

    const readResource = async (token: string, status = 200) => {
      const response = await fetch(`${issuer}/fixture/resource`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      })
      assert.equal(response.status, status)
      if (status === 200) {
        assert.deepEqual(await response.json(), {
          subject: 1,
          canReadIssues: true,
          canWriteIssues: false,
        })
      }
      else await response.arrayBuffer()
    }
    await readResource(firstPair.access_token)

    const refresh = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: String(registration.client.id),
        refresh_token: firstPair.refresh_token,
      }),
    })
    assert.equal(refresh.status, 200, await refresh.clone().text())
    const secondPair = await refresh.json() as { access_token: string, refresh_token: string }
    assert.notEqual(secondPair.access_token, firstPair.access_token)
    assert.notEqual(secondPair.refresh_token, firstPair.refresh_token)
    await readResource(firstPair.access_token, 401)
    await readResource(secondPair.access_token)

    const connections = await fetch(`${issuer}/auth/oauth/connections`, {
      headers: { cookie: browserCookies, accept: 'application/json' },
    })
    assert.equal(connections.status, 200, await connections.clone().text())
    const connectionBody = await connections.json() as {
      count: number
      connections: Array<{ grant_id: string }>
    }
    assert.equal(connectionBody.count, 1)
    const grantId = connectionBody.connections[0]?.grant_id
    assert.match(grantId ?? '', /^[a-f0-9]{32}$/)

    const disconnect = await fetch(`${issuer}/auth/oauth/connections/${grantId}/disconnect`, {
      method: 'POST',
      headers: {
        cookie: browserCookies,
        'x-csrf-token': csrfToken,
      },
    })
    assert.equal(disconnect.status, 200, await disconnect.clone().text())
    await disconnect.arrayBuffer()
    await readResource(secondPair.access_token, 401)

    const storedGrant = await db.selectFrom('oauth_grants')
      .where('id', '=', grantId!)
      .select('revoked_at')
      .executeTakeFirstOrThrow()
    assert(storedGrant.revoked_at)
    const tokenHash = createHash('sha256').update(secondPair.access_token, 'ascii').digest('hex')
    const storedAccess = await db.selectFrom('oauth_access_tokens')
      .where('token', '=', tokenHash)
      .select('revoked')
      .executeTakeFirstOrThrow()
    assert.equal(Number(storedAccess.revoked), 1)

    const replayGrant = await createOAuthGrant({
      clientId: registration.client.id,
      subjectType: 'users',
      subjectId: 1,
      scopes: ['issues:read'],
      resources: ['bughq'],
      audiences: [`${issuer}/fixture/resource`],
    })
    const replayCode = await issueAuthorizationCode({
      grantId: replayGrant.id,
      redirectUri,
      codeChallenge: challenge,
      lifetimeMs: provider.lifetimes.authorizationCode,
    })
    const replayBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: String(registration.client.id),
      code: replayCode,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    })
    const exchangeReplayCode = async () => await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: replayBody,
    })
    const replayExchange = await exchangeReplayCode()
    assert.equal(replayExchange.status, 200, await replayExchange.clone().text())
    const replayPair = await replayExchange.json() as { access_token: string }
    await readResource(replayPair.access_token)
    const replay = await exchangeReplayCode()
    assert.equal(replay.status, 400)
    assert.equal((await replay.json() as { error?: string }).error, 'invalid_grant')
    await readResource(replayPair.access_token, 401)
    assert.equal(await db.selectFrom('oauth_grants')
      .where('id', '=', replayGrant.id)
      .whereNull('revoked_at')
      .select('id')
      .executeTakeFirst(), undefined)

    const confidential = await registerOAuthClient(provider, 1, {
      name: 'HTTP confidential client',
      type: 'confidential',
      tokenEndpointAuthMethod: 'client_secret_basic',
      redirectUris: ['https://server.example.test/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['issues:read'],
      resources: ['bughq'],
    })
    assert(confidential.plainTextSecret)
    const confidentialGrant = await createOAuthGrant({
      clientId: confidential.client.id,
      subjectType: 'users',
      subjectId: 1,
      scopes: ['issues:read'],
      resources: ['bughq'],
      audiences: [`${issuer}/fixture/resource`],
    })
    const confidentialRedirect = confidential.client.redirectUris[0]!
    const confidentialCode = await issueAuthorizationCode({
      grantId: confidentialGrant.id,
      redirectUri: confidentialRedirect,
      codeChallenge: challenge,
      lifetimeMs: provider.lifetimes.authorizationCode,
    })
    const confidentialBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: confidentialCode,
      redirect_uri: confidentialRedirect,
      code_verifier: verifier,
    })
    const confidentialExchange = async (secret: string) => await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${confidential.client.id}:${secret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: confidentialBody,
    })
    const wrongConfidentialSecret = await confidentialExchange('wrong-secret')
    assert.equal(wrongConfidentialSecret.status, 401)
    assert.equal(wrongConfidentialSecret.headers.get('www-authenticate'), 'Basic realm="oauth-token"')
    assert.equal((await wrongConfidentialSecret.json() as { error?: string }).error, 'invalid_client')
    assert.equal((await db.selectFrom('oauth_auth_codes')
      .where('grant_id', '=', confidentialGrant.id)
      .select('consumed_at')
      .executeTakeFirstOrThrow()).consumed_at, null)

    const correctConfidentialSecret = await confidentialExchange(confidential.plainTextSecret)
    assert.equal(correctConfidentialSecret.status, 200, await correctConfidentialSecret.clone().text())
    const confidentialPair = await correctConfidentialSecret.json() as { access_token: string }
    await readResource(confidentialPair.access_token)

    console.log('PASS OAuth HTTP lifecycle')
  }
  finally {
    server.stop()
  }
}
finally {
  await releaseOrm()
  await resetDatabaseConnection()
}
