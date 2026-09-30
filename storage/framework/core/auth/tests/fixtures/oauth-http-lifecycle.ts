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
  authorizeOAuthDelegatedToken,
  authenticatedUser,
  authCookieName,
  createOAuthGrant,
  createS256CodeChallenge,
  issueAuthorizationCode,
  oauthBearerAuthorizationErrorResponse,
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
const OAuthIntrospectionAction = (await import('../../../../defaults/app/Actions/Auth/OAuthIntrospectionAction')).default
const OAuthRevocationAction = (await import('../../../../defaults/app/Actions/Auth/OAuthRevocationAction')).default
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
  router.post('/oauth/revoke', OAuthRevocationAction)
  router.post('/oauth/introspect', OAuthIntrospectionAction)
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
  router.get('/fixture/workspaces/{workspace}/issues', async (request) => {
    const bearer = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
    const workspaceId = request.params.workspace
    const authorization = bearer
      ? await authorizeOAuthDelegatedToken(bearer, {
          scopes: ['issues:read'],
          resource: 'bughq',
          audience: `${new URL(request.url).origin}/fixture/resource`,
          workspaceId,
          isSubjectEligible: subject => subject.type === 'users' && subject.id === 1,
        })
      : { ok: false as const, reason: 'invalid_token' as const }
    if (!authorization.ok)
      return oauthBearerAuthorizationErrorResponse(authorization)
    return { subject: authorization.token.subjectId, workspace: workspaceId }
  })

  const server = await router.serve({ port: 0, hostname: '127.0.0.1' })
  try {
    const issuer = `http://127.0.0.1:${server.port}`
    let activeWorkspace = { id: 'workspace-a', label: 'Workspace A' }
    config.auth.oauthProvider = {
      enabled: true,
      issuer,
      scopes: {
        'issues:read': { description: 'Read issues', resources: ['bughq'] },
        'issues:write': { description: 'Write issues', resources: ['bughq'] },
        'service:read': { description: 'Read service metadata' },
      },
      resources: {
        bughq: { audience: `${issuer}/fixture/resource` },
        other: { audience: `${issuer}/fixture/other` },
      },
      clientCredentials: true,
      introspection: true,
      consent: {
        resolveWorkspace: async () => activeWorkspace,
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
      scopes: ['issues:read', 'issues:write'],
      resources: ['bughq'],
    })
    const machine = await registerOAuthClient(provider, 1, {
      name: 'HTTP resource server',
      type: 'confidential',
      tokenEndpointAuthMethod: 'client_secret_basic',
      redirectUris: [],
      grantTypes: ['client_credentials'],
      scopes: ['issues:read'],
      resources: ['bughq'],
    })
    assert(machine.plainTextSecret)
    const otherResourceClient = await registerOAuthClient(provider, 1, {
      name: 'HTTP other resource server',
      type: 'confidential',
      tokenEndpointAuthMethod: 'client_secret_basic',
      redirectUris: ['https://other.example.test/callback'],
      grantTypes: ['authorization_code'],
      scopes: ['service:read'],
      resources: ['other'],
    })
    assert(otherResourceClient.plainTextSecret)
    const machineAuthorization = `Basic ${btoa(`${machine.client.id}:${machine.plainTextSecret}`)}`
    const machineExchange = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: {
        authorization: machineAuthorization,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'issues:read',
      }),
    })
    assert.equal(machineExchange.status, 200, await machineExchange.clone().text())
    const machinePair = await machineExchange.json() as { access_token: string }
    assert.match(machinePair.access_token, /^[a-f0-9]{80}$/)

    const introspectMachineToken = async (
      authorization: string,
      token = machinePair.access_token,
      tokenTypeHint: 'access_token' | 'refresh_token' = 'access_token',
    ) => await fetch(`${issuer}/oauth/introspect`, {
      method: 'POST',
      headers: {
        authorization,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token, token_type_hint: tokenTypeHint }),
    })
    const activeIntrospection = await introspectMachineToken(machineAuthorization)
    assert.equal(activeIntrospection.status, 200, await activeIntrospection.clone().text())
    assert.equal(activeIntrospection.headers.get('cache-control'), 'no-store')
    assert.equal(activeIntrospection.headers.get('pragma'), 'no-cache')
    const activeClaims = await activeIntrospection.json() as Record<string, unknown>
    assert.equal(activeClaims.active, true)
    assert.equal(activeClaims.client_id, String(machine.client.id))
    assert.equal(activeClaims.sub, `oauth_clients:${machine.client.id}`)
    assert.equal(activeClaims.scope, 'issues:read')
    assert.equal(activeClaims.token_type, 'Bearer')
    assert.deepEqual(activeClaims.aud, [`${issuer}/fixture/resource`])
    assert.equal(activeClaims.iss, issuer)
    assert.equal(typeof activeClaims.iat, 'number')
    assert.equal(typeof activeClaims.exp, 'number')

    const invalidIntrospection = await introspectMachineToken('Basic invalid')
    assert.equal(invalidIntrospection.status, 401)
    assert.equal(invalidIntrospection.headers.get('www-authenticate'), 'Basic realm="oauth-introspect"')
    assert.equal((await invalidIntrospection.json() as { error?: string }).error, 'invalid_client')

    const wrongAudienceIntrospection = await introspectMachineToken(
      `Basic ${btoa(`${otherResourceClient.client.id}:${otherResourceClient.plainTextSecret}`)}`,
    )
    assert.equal(wrongAudienceIntrospection.status, 200)
    assert.deepEqual(await wrongAudienceIntrospection.json(), { active: false })

    const machineRevocation = await fetch(`${issuer}/oauth/revoke`, {
      method: 'POST',
      headers: {
        authorization: machineAuthorization,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: machinePair.access_token, token_type_hint: 'access_token' }),
    })
    assert.equal(machineRevocation.status, 200, await machineRevocation.clone().text())
    const revokedIntrospection = await introspectMachineToken(machineAuthorization)
    assert.equal(revokedIntrospection.status, 200)
    assert.deepEqual(await revokedIntrospection.json(), { active: false })

    const tokenError = async (body: string, contentType = 'application/x-www-form-urlencoded') => {
      const result = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body,
      })
      assert.equal(result.status, 400)
      assert.equal(result.headers.get('cache-control'), 'no-store')
      assert.equal(result.headers.get('pragma'), 'no-cache')
      return (await result.json() as { error?: string }).error
    }
    assert.equal(await tokenError('{}', 'application/json'), 'invalid_request')
    assert.equal(await tokenError(new URLSearchParams({
      grant_type: 'password',
      client_id: String(registration.client.id),
    }).toString()), 'unsupported_grant_type')
    const duplicateGrant = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: String(registration.client.id),
    })
    duplicateGrant.append('grant_type', 'refresh_token')
    assert.equal(await tokenError(duplicateGrant.toString()), 'invalid_request')

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

    const unregisteredResource = new URL('/oauth/authorize', issuer)
    unregisteredResource.search = new URLSearchParams({
      ...authorizationParams,
      resource: 'https://api.attacker.example.test',
    }).toString()
    const unregisteredResourceResponse = await fetch(unregisteredResource, { redirect: 'manual' })
    assert.equal(unregisteredResourceResponse.status, 302)
    const resourceCallback = new URL(unregisteredResourceResponse.headers.get('location')!)
    assert.equal(`${resourceCallback.origin}${resourceCallback.pathname}`, redirectUri)
    assert.equal(resourceCallback.searchParams.get('error'), 'invalid_target')
    assert.equal(resourceCallback.searchParams.get('state'), 'oauth-http-state')
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

    const grantsBeforeDenial = Number((await db.selectFrom('oauth_grants')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirstOrThrow()).count)
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
    assert.equal(Number((await db.selectFrom('oauth_grants').select(db.fn.count('id').as('count')).executeTakeFirstOrThrow()).count), grantsBeforeDenial)

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
    const activeRefreshIntrospection = await introspectMachineToken(machineAuthorization, firstPair.refresh_token, 'refresh_token')
    assert.equal(activeRefreshIntrospection.status, 200, await activeRefreshIntrospection.clone().text())
    const activeRefreshClaims = await activeRefreshIntrospection.json() as Record<string, unknown>
    assert.equal(activeRefreshClaims.active, true)
    assert.equal(activeRefreshClaims.client_id, String(registration.client.id))
    assert.equal(activeRefreshClaims.sub, 'users:1')
    assert.equal(activeRefreshClaims.scope, 'issues:read')
    assert.equal(activeRefreshClaims.token_type, 'refresh_token')
    assert.deepEqual(activeRefreshClaims.aud, [`${issuer}/fixture/resource`])
    assert.equal(activeRefreshClaims.iss, issuer)

    const readResource = async (token: string, status = 200, canWriteIssues = false) => {
      const response = await fetch(`${issuer}/fixture/resource`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      })
      assert.equal(response.status, status)
      if (status === 200) {
        assert.deepEqual(await response.json(), {
          subject: 1,
          canReadIssues: true,
          canWriteIssues,
        })
      }
      else await response.arrayBuffer()
    }
    await readResource(firstPair.access_token)
    const readWorkspaceResource = async (workspace: string, status: number) => {
      const response = await fetch(`${issuer}/fixture/workspaces/${workspace}/issues`, {
        headers: { authorization: `Bearer ${firstPair.access_token}`, accept: 'application/json' },
      })
      assert.equal(response.status, status)
      if (status === 200)
        assert.deepEqual(await response.json(), { subject: 1, workspace })
      else {
        assert.match(response.headers.get('www-authenticate') ?? '', /error="invalid_token"/)
        assert.equal((await response.json() as { error?: string }).error, 'invalid_token')
      }
    }
    await readWorkspaceResource('workspace-a', 200)
    await readWorkspaceResource('workspace-b', 401)

    const workspaceGrantCount = async () => Number((await db.selectFrom('oauth_grants')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirstOrThrow()).count)
    const grantsBeforeWorkspaceChange = await workspaceGrantCount()
    const workspaceChangeUrl = new URL(authorizationUrl)
    workspaceChangeUrl.searchParams.set('state', 'workspace-change-state')
    const workspaceChangePage = await fetch(workspaceChangeUrl, {
      headers: { accept: 'text/html,application/xhtml+xml', cookie: browserCookies },
      redirect: 'manual',
    })
    assert.equal(workspaceChangePage.status, 200, await workspaceChangePage.clone().text())
    const workspaceChangeHtml = await workspaceChangePage.text()
    assert.match(workspaceChangeHtml, /Workspace A/)
    const workspaceChangeRequestId = /name="request_id" value="([A-Za-z0-9_-]{43})"/.exec(workspaceChangeHtml)?.[1]
    assert(workspaceChangeRequestId)
    const workspaceChangeBody = new URLSearchParams({
      _token: csrfToken,
      request_id: workspaceChangeRequestId,
      decision: 'approve',
    })
    const approveWorkspaceChange = async () => await fetch(`${issuer}/oauth/authorize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: browserCookies,
      },
      body: workspaceChangeBody,
      redirect: 'manual',
    })
    activeWorkspace = { id: 'workspace-b', label: 'Workspace B' }
    const changedWorkspaceApproval = await approveWorkspaceChange()
    assert.equal(changedWorkspaceApproval.status, 400)
    assert.equal(await workspaceGrantCount(), grantsBeforeWorkspaceChange)
    const pendingWorkspaceRequest = await db.selectFrom('oauth_authorization_requests')
      .where('request_hash', '=', createHash('sha256').update(workspaceChangeRequestId).digest('hex'))
      .select(['workspace_id', 'workspace_bound', 'consumed_at'])
      .executeTakeFirstOrThrow()
    assert.equal(pendingWorkspaceRequest.workspace_id, 'workspace-a')
    assert.equal(Boolean(pendingWorkspaceRequest.workspace_bound), true)
    assert.equal(pendingWorkspaceRequest.consumed_at, null)
    activeWorkspace = { id: 'workspace-a', label: 'Workspace A' }

    const expandedRefresh = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: String(registration.client.id),
        refresh_token: firstPair.refresh_token,
        scope: 'issues:read issues:write',
      }),
    })
    assert.equal(expandedRefresh.status, 400)
    assert.equal((await expandedRefresh.json() as { error?: string }).error, 'invalid_scope')
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
    const rotatedRefreshIntrospection = await introspectMachineToken(machineAuthorization, firstPair.refresh_token, 'refresh_token')
    assert.equal(rotatedRefreshIntrospection.status, 200)
    assert.deepEqual(await rotatedRefreshIntrospection.json(), { active: false })

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

    const retryGrant = await createOAuthGrant({
      clientId: registration.client.id,
      subjectType: 'users',
      subjectId: 1,
      scopes: ['issues:read'],
      resources: ['bughq'],
      audiences: [`${issuer}/fixture/resource`],
    })
    const retryCode = await issueAuthorizationCode({
      grantId: retryGrant.id,
      redirectUri,
      codeChallenge: challenge,
      lifetimeMs: provider.lifetimes.authorizationCode,
    })
    const retryExchange = async (exchangeRedirect: string, codeVerifier: string) => await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: String(registration.client.id),
        code: retryCode,
        redirect_uri: exchangeRedirect,
        code_verifier: codeVerifier,
      }),
    })
    const wrongVerifier = await retryExchange(redirectUri, 'w'.repeat(43))
    assert.equal(wrongVerifier.status, 400)
    assert.equal((await wrongVerifier.json() as { error?: string }).error, 'invalid_grant')
    const wrongExchangeRedirect = await retryExchange('https://client.example.test/other', verifier)
    assert.equal(wrongExchangeRedirect.status, 400)
    assert.equal((await wrongExchangeRedirect.json() as { error?: string }).error, 'invalid_grant')
    const validRetry = await retryExchange(redirectUri, verifier)
    assert.equal(validRetry.status, 200, await validRetry.clone().text())
    const validRetryPair = await validRetry.json() as { access_token: string }
    await readResource(validRetryPair.access_token)

    const expiredGrant = await createOAuthGrant({
      clientId: registration.client.id,
      subjectType: 'users',
      subjectId: 1,
      scopes: ['issues:read'],
      resources: ['bughq'],
      audiences: [`${issuer}/fixture/resource`],
    })
    const expiredCode = await issueAuthorizationCode({
      grantId: expiredGrant.id,
      redirectUri,
      codeChallenge: challenge,
      lifetimeMs: provider.lifetimes.authorizationCode,
    })
    await db.updateTable('oauth_auth_codes')
      .set({ expires_at: new Date(0).toISOString() })
      .where('grant_id', '=', expiredGrant.id)
      .execute()
    const expiredExchange = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: String(registration.client.id),
        code: expiredCode,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    })
    assert.equal(expiredExchange.status, 400)
    assert.equal((await expiredExchange.json() as { error?: string }).error, 'invalid_grant')
    assert.equal(Number((await db.selectFrom('oauth_access_tokens')
      .where('oauth_grant_id', '=', expiredGrant.id)
      .select(db.fn.count('id').as('count'))
      .executeTakeFirstOrThrow()).count), 0)

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
    const confidentialPair = await correctConfidentialSecret.json() as { access_token: string, refresh_token: string }
    await readResource(confidentialPair.access_token)
    const confidentialRefresh = async (secret: string) => await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${confidential.client.id}:${secret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: confidentialPair.refresh_token,
      }),
    })
    const wrongRefreshSecret = await confidentialRefresh('wrong-secret')
    assert.equal(wrongRefreshSecret.status, 401)
    assert.equal((await wrongRefreshSecret.json() as { error?: string }).error, 'invalid_client')
    await readResource(confidentialPair.access_token)

    const confidentialRotation = await confidentialRefresh(confidential.plainTextSecret)
    assert.equal(confidentialRotation.status, 200, await confidentialRotation.clone().text())
    const rotatedConfidentialPair = await confidentialRotation.json() as { access_token: string }
    await readResource(confidentialPair.access_token, 401)
    await readResource(rotatedConfidentialPair.access_token)
    const confidentialReplay = await confidentialRefresh(confidential.plainTextSecret)
    assert.equal(confidentialReplay.status, 400)
    assert.equal((await confidentialReplay.json() as { error?: string }).error, 'invalid_grant')
    await readResource(rotatedConfidentialPair.access_token, 401)

    const mintPublicPair = async (scopes: readonly string[] = ['issues:read']) => {
      const grant = await createOAuthGrant({
        clientId: registration.client.id,
        subjectType: 'users',
        subjectId: 1,
        scopes,
        resources: ['bughq'],
        audiences: [`${issuer}/fixture/resource`],
      })
      const freshCode = await issueAuthorizationCode({
        grantId: grant.id,
        redirectUri,
        codeChallenge: challenge,
        lifetimeMs: provider.lifetimes.authorizationCode,
      })
      const response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: String(registration.client.id),
          code: freshCode,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
      })
      assert.equal(response.status, 200, await response.clone().text())
      return await response.json() as { access_token: string, refresh_token: string }
    }
    const revoke = async (token: string, tokenTypeHint: 'access_token' | 'refresh_token') => await fetch(`${issuer}/oauth/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: String(registration.client.id),
        token,
        token_type_hint: tokenTypeHint,
      }),
    })

    const accessRevocationPair = await mintPublicPair()
    await readResource(accessRevocationPair.access_token)
    const invalidRevocation = await fetch(`${issuer}/oauth/revoke`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${confidential.client.id}:wrong-secret`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: accessRevocationPair.access_token,
        token_type_hint: 'access_token',
      }),
    })
    assert.equal(invalidRevocation.status, 401)
    assert.equal(invalidRevocation.headers.get('www-authenticate'), 'Basic realm="oauth-revoke"')
    await readResource(accessRevocationPair.access_token)

    const crossClientRevocation = await fetch(`${issuer}/oauth/revoke`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${confidential.client.id}:${confidential.plainTextSecret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: accessRevocationPair.access_token,
        token_type_hint: 'access_token',
      }),
    })
    assert.equal(crossClientRevocation.status, 200)
    await readResource(accessRevocationPair.access_token)

    const accessRevocation = await revoke(accessRevocationPair.access_token, 'access_token')
    assert.equal(accessRevocation.status, 200)
    assert.equal(accessRevocation.headers.get('cache-control'), 'no-store')
    await readResource(accessRevocationPair.access_token, 401)
    const revokedRefresh = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: String(registration.client.id),
        refresh_token: accessRevocationPair.refresh_token,
      }),
    })
    assert.equal(revokedRefresh.status, 400)
    assert.equal((await revokedRefresh.json() as { error?: string }).error, 'invalid_grant')
    assert.equal((await revoke(accessRevocationPair.access_token, 'access_token')).status, 200)

    const refreshRevocationPair = await mintPublicPair()
    await readResource(refreshRevocationPair.access_token)
    assert.equal((await revoke(refreshRevocationPair.refresh_token, 'refresh_token')).status, 200)
    await readResource(refreshRevocationPair.access_token, 401)

    const broadPair = await mintPublicPair(['issues:read', 'issues:write'])
    await readResource(broadPair.access_token, 200, true)
    const narrowedRefresh = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: String(registration.client.id),
        refresh_token: broadPair.refresh_token,
        scope: 'issues:read',
      }),
    })
    assert.equal(narrowedRefresh.status, 200, await narrowedRefresh.clone().text())
    const narrowedPair = await narrowedRefresh.json() as { access_token: string }
    await readResource(broadPair.access_token, 401)
    await readResource(narrowedPair.access_token)

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
