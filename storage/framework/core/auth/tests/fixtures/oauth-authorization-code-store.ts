import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_OAUTH_CODE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-oauth-codes-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_oauth_codes_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}

const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const {
  db,
  ensureDatabaseConfigLoaded,
  initializeDbConfig,
  migrateAuthTables,
  resetDatabaseConnection,
  sqlDateTime,
} = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: dialect,
    connections: dialect === 'sqlite'
      ? { sqlite: { database: process.env.DB_DATABASE_PATH } }
      : {
          [dialect]: {
            name: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
          },
        },
    queryLogging: { enabled: false },
  },
})
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite')
  configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const {
  approveOAuthAuthorizationRequestSession,
  authorizeOAuthDelegatedToken,
  beginOAuthAuthorizationRequest,
  createOAuthGrant,
  createOAuthAuthorizationRequestSession,
  createS256CodeChallenge,
  denyOAuthAuthorizationRequestSession,
  disableOAuthClient,
  disconnectOAuthGrant,
  exchangeAuthorizationCode,
  exchangeOAuthAuthorizationCode,
  findToken,
  handleOAuthRevocationRequest,
  handleOAuthAuthorizationConsentRequest,
  handleOAuthTokenRequest,
  hasReusableOAuthConsent,
  issueAuthorizationCode,
  listOAuthClients,
  listOAuthConnections,
  loadOAuthAuthorizationConsentView,
  loadOAuthAuthorizationRequestSession,
  loadOAuthAuthorizationClient,
  oauthAuthorizationBrowserSessionCookieName,
  refreshOAuthDelegatedToken,
  pruneOAuthAuthorizationArtifacts,
  registerOAuthClient,
  rotateOAuthClientSecret,
  resolveOAuthProviderConfig,
  refreshToken,
  revokeOAuthGrant,
  oauthBearerAuthorizationErrorResponse,
  updateOAuthClient,
  validateRefreshToken,
  validateOAuthAuthorizationRequest,
  withAuthorizationCode,
  withAuthenticatedOAuthTokenClient,
  withOAuthAuthorizationRequestSession,
} = await import('../../src')

const verifier = 'v'.repeat(43)
const codeChallenge = await createS256CodeChallenge(verifier)

try {
  assert.equal((await migrateAuthTables()).success, true)
  assert.equal((await migrateAuthTables()).success, true)
  await db.unsafe('CREATE TABLE issued_markers (marker VARCHAR(255) PRIMARY KEY)').execute()
  const client = await db.selectFrom('oauth_clients')
    .where('personal_access_client', '=', true)
    .where('revoked', '=', false)
    .select('id')
    .executeTakeFirstOrThrow()

  const providerConfig = {
    enabled: true,
    issuer: 'https://id.example.com',
    lifetimes: { authorizationRequest: 90_000 },
    scopes: {
      'issues:read': { description: 'Read issues', resources: ['bughq'] },
      'profile:read': { description: 'Read profile' },
    },
    resources: { bughq: { audience: 'https://api.bughq.example' } },
  }
  config.auth.oauthProvider = providerConfig
  const provider = resolveOAuthProviderConfig(providerConfig)!

  const OAuthClientDisableAction = (await import('../../../../defaults/app/Actions/Auth/OAuthClientDisableAction')).default
  const OAuthClientsAction = (await import('../../../../defaults/app/Actions/Auth/OAuthClientsAction')).default
  const OAuthClientSecretRotateAction = (await import('../../../../defaults/app/Actions/Auth/OAuthClientSecretRotateAction')).default
  const OAuthClientStoreAction = (await import('../../../../defaults/app/Actions/Auth/OAuthClientStoreAction')).default
  const OAuthClientUpdateAction = (await import('../../../../defaults/app/Actions/Auth/OAuthClientUpdateAction')).default
  const actionOwner = { id: '84', email: 'owner@example.com' }
  const actionRequest = (body: Record<string, unknown> = {}, id = '') => ({
    user: async () => actionOwner,
    all: () => body,
    getParam: () => id,
  })
  const storedByAction = await OAuthClientStoreAction.handle(actionRequest({
    name: 'Action-managed client',
    type: 'confidential',
    redirect_uris: ['https://actions.example.com/callback'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  }) as never)
  assert.equal(storedByAction.status, 201)
  assert.equal(storedByAction.headers.get('cache-control'), 'no-store')
  assert.equal(storedByAction.headers.get('pragma'), 'no-cache')
  const storedByActionBody = await storedByAction.json() as {
    client: { id: number, name: string }
    client_secret: string
  }
  assert.equal(storedByActionBody.client.name, 'Action-managed client')
  assert.match(storedByActionBody.client_secret, /^[a-f0-9]{80}$/)

  const listedByAction = await OAuthClientsAction.handle(actionRequest() as never)
  assert.equal(listedByAction.status, 200)
  assert.equal(listedByAction.headers.get('cache-control'), 'no-store')
  const listedByActionBody = await listedByAction.json() as {
    clients: Array<Record<string, unknown>>
    count: number
  }
  assert.equal(listedByActionBody.count, 1)
  assert.equal(listedByActionBody.clients[0]?.id, storedByActionBody.client.id)
  assert.equal('secret' in listedByActionBody.clients[0]!, false)
  assert.equal('client_secret' in listedByActionBody.clients[0]!, false)

  const rotatedByAction = await OAuthClientSecretRotateAction.handle(actionRequest({}, String(storedByActionBody.client.id)) as never)
  assert.equal(rotatedByAction.status, 200)
  assert.equal(rotatedByAction.headers.get('cache-control'), 'no-store')
  assert.equal(rotatedByAction.headers.get('pragma'), 'no-cache')
  const rotatedByActionBody = await rotatedByAction.json() as { client_secret: string }
  assert.match(rotatedByActionBody.client_secret, /^[a-f0-9]{80}$/)
  assert.notEqual(rotatedByActionBody.client_secret, storedByActionBody.client_secret)

  const updatedByAction = await OAuthClientUpdateAction.handle(actionRequest({
    name: 'Updated action-managed client',
    redirect_uris: ['https://actions.example.com/updated-callback'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  }, String(storedByActionBody.client.id)) as never)
  assert.equal(updatedByAction.status, 200)
  assert.equal(updatedByAction.headers.get('cache-control'), 'no-store')
  const updatedByActionBody = await updatedByAction.json() as { client: { name: string, redirect_uris: string[] } }
  assert.equal(updatedByActionBody.client.name, 'Updated action-managed client')
  assert.deepEqual(updatedByActionBody.client.redirect_uris, ['https://actions.example.com/updated-callback'])

  const disabledByAction = await OAuthClientDisableAction.handle(actionRequest({}, String(storedByActionBody.client.id)) as never)
  assert.equal(disabledByAction.status, 200)
  assert.equal(disabledByAction.headers.get('cache-control'), 'no-store')
  const disabledListByAction = await OAuthClientsAction.handle(actionRequest() as never)
  const disabledListBody = await disabledListByAction.json() as { clients: Array<{ id: number, revoked: boolean }> }
  assert.equal(disabledListBody.clients.find(client => client.id === storedByActionBody.client.id)?.revoked, true)
  const publicRegistration = await registerOAuthClient(provider, 42, {
    name: 'Browser integration',
    type: 'public',
    tokenEndpointAuthMethod: 'none',
    redirectUris: ['https://client.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read', 'profile:read'],
    resources: ['bughq'],
  })
  assert.equal(publicRegistration.plainTextSecret, undefined)
  assert.equal(publicRegistration.client.ownerId, 42)
  assert.equal(publicRegistration.client.type, 'public')
  const storedPublic = await db.selectFrom('oauth_clients').where('id', '=', publicRegistration.client.id).selectAll().executeTakeFirstOrThrow() as Record<string, unknown>
  assert.equal(storedPublic.secret, null)
  assert.deepEqual(JSON.parse(String(storedPublic.redirect_uris)), ['https://client.example.com/callback'])
  assert.deepEqual(JSON.parse(String(storedPublic.grant_types)), ['authorization_code', 'refresh_token'])
  assert.deepEqual(JSON.parse(String(storedPublic.allowed_scopes)), ['issues:read', 'profile:read'])
  assert.deepEqual(JSON.parse(String(storedPublic.allowed_resources)), ['bughq'])
  const loadedPublic = await loadOAuthAuthorizationClient(String(publicRegistration.client.id))
  assert.deepEqual(loadedPublic, {
    id: publicRegistration.client.id,
    type: 'public',
    revoked: false,
    redirectUris: ['https://client.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read', 'profile:read'],
    resources: ['bughq'],
  })
  assert.deepEqual(
    await withAuthenticatedOAuthTokenClient(String(publicRegistration.client.id), undefined, async client => client),
    loadedPublic,
  )
  assert.equal(await withAuthenticatedOAuthTokenClient(
    String(publicRegistration.client.id),
    'unexpected-secret',
    async client => client,
  ), null)
  const validatedRequest = validateOAuthAuthorizationRequest(provider, loadedPublic!, {
    responseType: 'code',
    clientId: String(publicRegistration.client.id),
    redirectUri: 'https://client.example.com/callback',
    scope: 'issues:read',
    resource: 'https://api.bughq.example',
    state: 'registered-client-state',
    codeChallenge,
    codeChallengeMethod: 'S256',
  })
  assert.equal(validatedRequest.clientType, 'public')
  const browserSession = 'b'.repeat(43)
  const begunRequest = await beginOAuthAuthorizationRequest({
    provider,
    browserSessionId: browserSession,
    query: new URLSearchParams([
      ['response_type', 'code'],
      ['client_id', String(publicRegistration.client.id)],
      ['redirect_uri', 'https://client.example.com/callback'],
      ['scope', 'issues:read'],
      ['resource', 'https://api.bughq.example'],
      ['state', 'registered-client-state'],
      ['code_challenge', codeChallenge],
      ['code_challenge_method', 'S256'],
    ]),
  })
  assert.match(begunRequest.requestId, /^[A-Za-z0-9_-]{43}$/)
  assert.deepEqual(await loadOAuthAuthorizationRequestSession(begunRequest.requestId, browserSession), validatedRequest)
  const consentView = await loadOAuthAuthorizationConsentView({
    provider,
    requestId: begunRequest.requestId,
    browserSessionId: browserSession,
  })
  assert.deepEqual(consentView, {
    requestId: begunRequest.requestId,
    client: {
      id: String(publicRegistration.client.id),
      name: 'Browser integration',
      type: 'public',
    },
    permissions: [{ name: 'issues:read', description: 'Read issues' }],
    resources: [{ name: 'bughq', audience: 'https://api.bughq.example' }],
  })
  assert.equal('redirectUri' in consentView!, false)
  assert.equal('codeChallenge' in consentView!, false)
  assert.equal(await loadOAuthAuthorizationConsentView({
    provider,
    requestId: begunRequest.requestId,
    browserSessionId: 'different-browser-session-token',
  }), null)
  assert.equal(await loadOAuthAuthorizationConsentView({
    provider: resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      scopes: {},
      resources: {},
    })!,
    requestId: begunRequest.requestId,
    browserSessionId: browserSession,
  }), null)
  const begunRequestRow = await db.selectFrom('oauth_authorization_requests')
    .where('request_hash', '=', createHash('sha256').update(begunRequest.requestId).digest('hex'))
    .selectAll()
    .executeTakeFirstOrThrow() as Record<string, unknown>
  assert.equal(
    new Date(String(begunRequestRow.expires_at)).getTime() - new Date(String(begunRequestRow.created_at)).getTime(),
    provider.lifetimes.authorizationRequest,
  )
  const requestCountBeforeUnknownClient = Number((await db.selectFrom('oauth_authorization_requests')
    .select(db.raw('COUNT(*) AS count'))
    .executeTakeFirstOrThrow() as { count: number | string }).count)
  await assert.rejects(beginOAuthAuthorizationRequest({
    provider,
    browserSessionId: browserSession,
    query: new URLSearchParams([
      ['response_type', 'code'],
      ['client_id', '999999'],
      ['redirect_uri', 'https://attacker.example/callback'],
      ['code_challenge', codeChallenge],
      ['code_challenge_method', 'S256'],
    ]),
  }), error => error instanceof Error
    && error.name === 'OAuthAuthorizationRequestError'
    && (error as { redirectUri?: unknown }).redirectUri === null)
  assert.equal(Number((await db.selectFrom('oauth_authorization_requests')
    .select(db.raw('COUNT(*) AS count'))
    .executeTakeFirstOrThrow() as { count: number | string }).count), requestCountBeforeUnknownClient)
  const requestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const requestHash = createHash('sha256').update(requestId).digest('hex')
  const storedRequest = await db.selectFrom('oauth_authorization_requests').where('request_hash', '=', requestHash).selectAll().executeTakeFirstOrThrow() as Record<string, unknown>
  assert.equal(storedRequest.browser_session_hash, createHash('sha256').update(browserSession).digest('hex'))
  assert.notEqual(storedRequest.request_hash, requestId)
  assert.equal('browser_session' in storedRequest, false)
  assert.deepEqual(await loadOAuthAuthorizationRequestSession(requestId, browserSession), validatedRequest)
  assert.equal(await loadOAuthAuthorizationRequestSession(requestId, 'different-browser-session-token'), null)
  assert.equal(await loadOAuthAuthorizationRequestSession('malformed', browserSession), null)
  const expiredRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  await db.updateTable('oauth_authorization_requests')
    .set({ expires_at: sqlDateTime(new Date(Date.now() - 1000)) } as never)
    .where('request_hash', '=', createHash('sha256').update(expiredRequestId).digest('hex'))
    .execute()
  assert.equal(await loadOAuthAuthorizationRequestSession(expiredRequestId, browserSession), null)

  const approvalRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const approvalResults = await Promise.all(Array.from({ length: 8 }, () =>
    withOAuthAuthorizationRequestSession(approvalRequestId, browserSession, async request => request.clientId)))
  assert.equal(approvalResults.filter(result => result.ok).length, 1)
  assert.equal(approvalResults.filter(result => !result.ok).length, 7)
  assert(approvalResults.some(result => result.ok && result.value === validatedRequest.clientId))
  assert.equal(await loadOAuthAuthorizationRequestSession(approvalRequestId, browserSession), null)

  const wrongSessionRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  assert.deepEqual(
    await withOAuthAuthorizationRequestSession(wrongSessionRequestId, 'different-browser-session-token', async request => request),
    { ok: false, reason: 'invalid_request' },
  )
  assert.equal((await withOAuthAuthorizationRequestSession(wrongSessionRequestId, browserSession, async request => request)).ok, true)

  const denialRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const grantsBeforeDenial = await db.selectFrom('oauth_grants').where('client_id', '=', publicRegistration.client.id).select('id').get()
  const codesBeforeDenial = await db.selectFrom('oauth_auth_codes').where('client_id', '=', publicRegistration.client.id).select('code_hash').get()
  assert.deepEqual(
    await denyOAuthAuthorizationRequestSession(denialRequestId, 'different-browser-session-token'),
    { ok: false, reason: 'invalid_request' },
  )
  assert(await loadOAuthAuthorizationRequestSession(denialRequestId, browserSession), 'the wrong browser must not consume the request')
  assert.deepEqual(await denyOAuthAuthorizationRequestSession(denialRequestId, browserSession), {
    ok: true,
    value: {
      error: 'access_denied',
      redirectUri: validatedRequest.redirectUri,
      state: validatedRequest.state,
    },
  })
  assert.deepEqual(await denyOAuthAuthorizationRequestSession(denialRequestId, browserSession), { ok: false, reason: 'invalid_request' })
  assert.equal((await db.selectFrom('oauth_grants').where('client_id', '=', publicRegistration.client.id).select('id').get()).length, grantsBeforeDenial.length)
  assert.equal((await db.selectFrom('oauth_auth_codes').where('client_id', '=', publicRegistration.client.id).select('code_hash').get()).length, codesBeforeDenial.length)

  const rollbackRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  await assert.rejects(withOAuthAuthorizationRequestSession(rollbackRequestId, browserSession, async () => {
    await db.insertInto('issued_markers').values({ marker: 'authorization-request-must-roll-back' }).execute()
    throw new Error('synthetic consent failure')
  }), /synthetic consent failure/)
  assert.equal(await db.selectFrom('issued_markers').where('marker', '=', 'authorization-request-must-roll-back').select('marker').executeTakeFirst(), undefined)
  assert.equal((await withOAuthAuthorizationRequestSession(rollbackRequestId, browserSession, async request => request)).ok, true)

  const rememberedGrant = await createOAuthGrant({
    clientId: publicRegistration.client.id,
    subjectType: 'users',
    subjectId: 42,
    scopes: validatedRequest.scopes,
    resources: validatedRequest.resources,
    audiences: validatedRequest.audiences,
    workspaceId: 'workspace-1',
  })
  const rememberedConsent = {
    request: validatedRequest,
    subjectType: 'users',
    subjectId: 42,
    workspaceId: 'workspace-1',
    rememberForMs: 60_000,
  }
  assert.equal(await hasReusableOAuthConsent({ ...rememberedConsent, rememberForMs: 0 }), false)
  assert.equal(await hasReusableOAuthConsent(rememberedConsent), true)
  assert.equal(await hasReusableOAuthConsent({ ...rememberedConsent, workspaceId: 'workspace-2' }), false)
  assert.equal(await hasReusableOAuthConsent({ ...rememberedConsent, subjectId: 43 }), false)
  assert.equal(await hasReusableOAuthConsent({
    ...rememberedConsent,
    request: { ...validatedRequest, scopes: ['issues:read', 'profile:read'] },
  }), false, 'remembered consent must not authorize expanded scopes')
  await db.updateTable('oauth_grants')
    .set({ audiences: JSON.stringify(['https://different.example']) })
    .where('id', '=', rememberedGrant.id)
    .execute()
  assert.equal(await hasReusableOAuthConsent(rememberedConsent), false, 'resource and audience bindings must stay paired')
  await db.updateTable('oauth_grants')
    .set({ audiences: JSON.stringify(validatedRequest.audiences) })
    .where('id', '=', rememberedGrant.id)
    .execute()
  await db.updateTable('oauth_grants')
    .set({ created_at: sqlDateTime(new Date(Date.now() - 120_000)) })
    .where('id', '=', rememberedGrant.id)
    .execute()
  assert.equal(await hasReusableOAuthConsent(rememberedConsent), false)
  await db.updateTable('oauth_grants')
    .set({ created_at: sqlDateTime(new Date()), revoked_at: sqlDateTime(new Date()) })
    .where('id', '=', rememberedGrant.id)
    .execute()
  assert.equal(await hasReusableOAuthConsent(rememberedConsent), false)

  const handledApprovalRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const handledApproval = await handleOAuthAuthorizationConsentRequest({
    provider,
    request: new Request('https://id.example.com/oauth/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `${oauthAuthorizationBrowserSessionCookieName(provider)}=${browserSession}`,
      },
      body: new URLSearchParams({ request_id: handledApprovalRequestId, decision: 'approve' }),
    }),
    subjectType: 'users',
    subjectId: 42,
    workspaceId: 'workspace-1',
  })
  assert.equal(handledApproval.status, 302)
  const handledApprovalLocation = new URL(handledApproval.headers.get('location')!)
  assert.equal(`${handledApprovalLocation.origin}${handledApprovalLocation.pathname}`, validatedRequest.redirectUri)
  assert.equal(handledApprovalLocation.searchParams.get('state'), validatedRequest.state)
  assert.match(handledApprovalLocation.searchParams.get('code')!, /^[A-Za-z0-9_-]{43}$/)

  const handledDenialRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const handledDenial = await handleOAuthAuthorizationConsentRequest({
    provider,
    request: new Request('https://id.example.com/oauth/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Cookie': `${oauthAuthorizationBrowserSessionCookieName(provider)}=${browserSession}`,
      },
      body: new URLSearchParams({ request_id: handledDenialRequestId, decision: 'deny' }),
    }),
    subjectType: 'users',
    subjectId: 42,
  })
  assert.equal(handledDenial.status, 302)
  const handledDenialLocation = new URL(handledDenial.headers.get('location')!)
  assert.equal(handledDenialLocation.searchParams.get('error'), 'access_denied')
  assert.equal(handledDenialLocation.searchParams.get('state'), validatedRequest.state)
  assert.equal(handledDenialLocation.searchParams.has('code'), false)

  const unboundRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const unboundResponse = await handleOAuthAuthorizationConsentRequest({
    provider,
    request: new Request('https://id.example.com/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ request_id: unboundRequestId, decision: 'approve' }),
    }),
    subjectType: 'users',
    subjectId: 42,
  })
  assert.equal(unboundResponse.status, 400)
  assert(await loadOAuthAuthorizationRequestSession(unboundRequestId, browserSession), 'missing browser binding must not consume the request')

  const wrongMediaRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const wrongMediaResponse = await handleOAuthAuthorizationConsentRequest({
    provider,
    request: new Request('https://id.example.com/oauth/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${oauthAuthorizationBrowserSessionCookieName(provider)}=${browserSession}`,
      },
      body: JSON.stringify({ request_id: wrongMediaRequestId, decision: 'deny' }),
    }),
    subjectType: 'users',
    subjectId: 42,
  })
  assert.equal(wrongMediaResponse.status, 415)
  assert.deepEqual(await wrongMediaResponse.json(), { error: 'invalid_request' })
  assert(await loadOAuthAuthorizationRequestSession(wrongMediaRequestId, browserSession), 'invalid form media must not consume the request')

  const changedProviderRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const changedProvider = resolveOAuthProviderConfig({
    enabled: true,
    issuer: 'https://id.example.com',
    scopes: {},
    resources: {},
  })!
  await assert.rejects(approveOAuthAuthorizationRequestSession({
    provider: changedProvider,
    requestId: changedProviderRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  }), /scope is no longer registered/)
  assert(await loadOAuthAuthorizationRequestSession(changedProviderRequestId, browserSession), 'provider drift must not consume the request')
  const changedProviderResponse = await handleOAuthAuthorizationConsentRequest({
    provider: changedProvider,
    request: new Request('https://id.example.com/oauth/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `${oauthAuthorizationBrowserSessionCookieName(changedProvider)}=${browserSession}`,
      },
      body: new URLSearchParams({ request_id: changedProviderRequestId, decision: 'approve' }),
    }),
    subjectType: 'users',
    subjectId: 42,
  })
  assert.equal(changedProviderResponse.status, 302)
  const changedProviderLocation = new URL(changedProviderResponse.headers.get('location')!)
  assert.equal(changedProviderLocation.searchParams.get('error'), 'invalid_scope')
  assert.equal(changedProviderLocation.searchParams.get('state'), validatedRequest.state)
  assert(await loadOAuthAuthorizationRequestSession(changedProviderRequestId, browserSession), 'failed provider policy must roll back request consumption')

  const consentRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const consent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: consentRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    workspaceId: 'workspace-1',
    authorizationCodeLifetimeMs: 60_000,
  })
  assert.equal(consent.ok, true)
  if (consent.ok) {
    assert.equal(consent.value.redirectUri, validatedRequest.redirectUri)
    assert.equal(consent.value.state, validatedRequest.state)
    assert.match(consent.value.code, /^[A-Za-z0-9_-]{43}$/)
    const consentGrant = await db.selectFrom('oauth_grants').where('id', '=', consent.value.grantId).selectAll().executeTakeFirstOrThrow() as Record<string, unknown>
    assert.equal(String(consentGrant.client_id), validatedRequest.clientId)
    assert.equal(consentGrant.subject_type, 'users')
    assert.equal(String(consentGrant.subject_id), '42')
    assert.deepEqual(JSON.parse(String(consentGrant.scopes)), validatedRequest.scopes)
    assert.deepEqual(JSON.parse(String(consentGrant.resources)), validatedRequest.resources)
    assert.deepEqual(JSON.parse(String(consentGrant.audiences)), validatedRequest.audiences)
    assert.equal(consentGrant.workspace_id, 'workspace-1')
    const consentCode = await db.selectFrom('oauth_auth_codes')
      .where('code_hash', '=', createHash('sha256').update(consent.value.code).digest('hex'))
      .selectAll()
      .executeTakeFirstOrThrow() as Record<string, unknown>
    assert.equal(consentCode.grant_id, consent.value.grantId)
    assert.equal(consentCode.code_challenge, validatedRequest.codeChallenge)
    const redeemedConsent = await withAuthorizationCode(consent.value.code, {
      clientId: publicRegistration.client.id,
      redirectUri: validatedRequest.redirectUri,
      codeVerifier: verifier,
    }, async grant => grant)
    assert.equal(redeemedConsent.ok, true)
    if (redeemedConsent.ok)
      assert.equal(redeemedConsent.value.grantId, consent.value.grantId)
  }
  assert.deepEqual(await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: consentRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    workspaceId: 'workspace-1',
    authorizationCodeLifetimeMs: 60_000,
  }), { ok: false, reason: 'invalid_request' })

  const concurrentConsentRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const grantsBeforeConsent = await db.selectFrom('oauth_grants').where('client_id', '=', publicRegistration.client.id).select('id').get()
  const codesBeforeConsent = await db.selectFrom('oauth_auth_codes').where('client_id', '=', publicRegistration.client.id).select('code_hash').get()
  const concurrentConsents = await Promise.all(Array.from({ length: 8 }, () => approveOAuthAuthorizationRequestSession({
    provider,
    requestId: concurrentConsentRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    workspaceId: 'workspace-1',
    authorizationCodeLifetimeMs: 60_000,
  })))
  assert.equal(concurrentConsents.filter(result => result.ok).length, 1)
  assert.equal((await db.selectFrom('oauth_grants').where('client_id', '=', publicRegistration.client.id).select('id').get()).length, grantsBeforeConsent.length + 1)
  assert.equal((await db.selectFrom('oauth_auth_codes').where('client_id', '=', publicRegistration.client.id).select('code_hash').get()).length, codesBeforeConsent.length + 1)

  const failedConsentRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  await assert.rejects(approveOAuthAuthorizationRequestSession({
    provider,
    requestId: failedConsentRequestId,
    browserSessionId: browserSession,
    subjectType: 'invalid subject type',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  }), /subject type is invalid/)
  assert.equal((await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: failedConsentRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })).ok, true)

  const publicExchangeRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const publicConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: publicExchangeRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert.equal(publicConsent.ok, true)
  if (publicConsent.ok) {
    assert.deepEqual(await exchangeOAuthAuthorizationCode({
      code: publicConsent.value.code,
      clientId: publicRegistration.client.id,
      clientSecret: 'unexpected-secret',
      redirectUri: validatedRequest.redirectUri,
      codeVerifier: verifier,
      accessTokenLifetimeMs: 60_000,
      refreshTokenLifetimeMs: 120_000,
    }), { ok: false, reason: 'invalid_client' })
    const publicExchange = await exchangeOAuthAuthorizationCode({
      code: publicConsent.value.code,
      clientId: publicRegistration.client.id,
      redirectUri: validatedRequest.redirectUri,
      codeVerifier: verifier,
      accessTokenLifetimeMs: 60_000,
      refreshTokenLifetimeMs: 120_000,
    })
    assert.equal(publicExchange.ok, true)
    if (publicExchange.ok) {
      assert.match(publicExchange.value.refreshToken ?? '', /^[a-f0-9]{80}$/)
      const originalAccessToken = publicExchange.value.accessToken
      const originalRefreshToken = publicExchange.value.refreshToken!
      const originalRefreshRow = await db.selectFrom('oauth_refresh_tokens')
        .where('token', '=', createHash('sha256').update(originalRefreshToken).digest('hex'))
        .selectAll()
        .executeTakeFirstOrThrow() as Record<string, unknown>
      assert.deepEqual(await refreshOAuthDelegatedToken({
        refreshToken: originalRefreshToken,
        clientId: publicRegistration.client.id,
        clientSecret: 'unexpected-secret',
        accessTokenLifetimeMs: 60_000,
        refreshTokenLifetimeMs: 120_000,
      }), { ok: false, reason: 'invalid_client' })
      const rotated = await refreshOAuthDelegatedToken({
        refreshToken: originalRefreshToken,
        clientId: publicRegistration.client.id,
        accessTokenLifetimeMs: 60_000,
        refreshTokenLifetimeMs: 120_000,
      })
      assert.equal(rotated.ok, true)
      if (rotated.ok) {
        assert.notEqual(rotated.value.accessToken, originalAccessToken)
        assert.notEqual(rotated.value.refreshToken, originalRefreshToken)
        assert.equal(await findToken(originalAccessToken), null)
        assert(await findToken(rotated.value.accessToken))
        const replacementRefresh = await db.selectFrom('oauth_refresh_tokens')
          .where('token', '=', createHash('sha256').update(rotated.value.refreshToken!).digest('hex'))
          .selectAll()
          .executeTakeFirstOrThrow() as Record<string, unknown>
        assert.equal(replacementRefresh.family_id, originalRefreshRow.family_id)
        assert.equal(String(replacementRefresh.parent_id), String(originalRefreshRow.id))

        assert.deepEqual(await refreshOAuthDelegatedToken({
          refreshToken: originalRefreshToken,
          clientId: publicRegistration.client.id,
          accessTokenLifetimeMs: 60_000,
          refreshTokenLifetimeMs: 120_000,
        }), { ok: false, reason: 'invalid_grant' })
        assert.equal(await findToken(rotated.value.accessToken), null, 'replaying a parent must revoke its descendants')
        const familyRows = await db.selectFrom('oauth_refresh_tokens')
          .where('family_id', '=', String(originalRefreshRow.family_id))
          .select(['id', 'revoked'])
          .get()
        assert.equal(familyRows.length, 2)
        assert(familyRows.every(row => Boolean(row.revoked)))
      }
    }

    const concurrentRefreshRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
    const concurrentRefreshConsent = await approveOAuthAuthorizationRequestSession({
      provider,
      requestId: concurrentRefreshRequestId,
      browserSessionId: browserSession,
      subjectType: 'users',
      subjectId: 42,
      authorizationCodeLifetimeMs: 60_000,
    })
    assert.equal(concurrentRefreshConsent.ok, true)
    if (concurrentRefreshConsent.ok) {
      const concurrentFamily = await exchangeOAuthAuthorizationCode({
        code: concurrentRefreshConsent.value.code,
        clientId: publicRegistration.client.id,
        redirectUri: validatedRequest.redirectUri,
        codeVerifier: verifier,
        accessTokenLifetimeMs: 60_000,
        refreshTokenLifetimeMs: 120_000,
      })
      assert.equal(concurrentFamily.ok, true)
      if (concurrentFamily.ok) {
        const attempts = await Promise.all(Array.from({ length: 8 }, () => refreshOAuthDelegatedToken({
          refreshToken: concurrentFamily.value.refreshToken!,
          clientId: publicRegistration.client.id,
          accessTokenLifetimeMs: 60_000,
          refreshTokenLifetimeMs: 120_000,
        })))
        assert.equal(attempts.filter(result => result.ok).length, 1)
        const winner = attempts.find(result => result.ok)
        assert(winner?.ok)
        assert.equal(await findToken(winner.value.accessToken), null, 'concurrent reuse must contain the winning descendant')
      }
    }
  }

  assert.equal(await loadOAuthAuthorizationClient(String(client.id)), null, 'legacy personal clients must not enter the provider flow')

  const confidentialRegistration = await registerOAuthClient(provider, 42, {
    name: 'Server integration',
    type: 'confidential',
    tokenEndpointAuthMethod: 'client_secret_basic',
    redirectUris: ['https://server.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  })
  assert(confidentialRegistration.plainTextSecret)
  const storedConfidential = await db.selectFrom('oauth_clients').where('id', '=', confidentialRegistration.client.id).selectAll().executeTakeFirstOrThrow() as Record<string, unknown>
  assert.notEqual(storedConfidential.secret, confidentialRegistration.plainTextSecret)
  assert(String(storedConfidential.secret).startsWith('$2'))
  const { verifyHash } = await import('@stacksjs/security')
  assert.equal(await verifyHash(confidentialRegistration.plainTextSecret, String(storedConfidential.secret)), true)
  const loadedConfidential = await loadOAuthAuthorizationClient(String(confidentialRegistration.client.id))
  assert.deepEqual(
    await withAuthenticatedOAuthTokenClient(
      String(confidentialRegistration.client.id),
      confidentialRegistration.plainTextSecret,
      async client => client,
    ),
    loadedConfidential,
  )
  assert.equal(await withAuthenticatedOAuthTokenClient(
    String(confidentialRegistration.client.id),
    undefined,
    async client => client,
  ), null)
  assert.equal(await withAuthenticatedOAuthTokenClient(
    String(confidentialRegistration.client.id),
    'wrong-secret',
    async client => client,
  ), null)
  assert.equal(await rotateOAuthClientSecret(7, confidentialRegistration.client.id), null, 'another owner must not rotate the secret')
  assert.equal(await rotateOAuthClientSecret(42, publicRegistration.client.id), null, 'public clients must not gain a secret')
  const rotatedSecret = await rotateOAuthClientSecret(42, confidentialRegistration.client.id)
  assert(rotatedSecret)
  assert.notEqual(rotatedSecret, confidentialRegistration.plainTextSecret)
  const rotatedConfidential = await db.selectFrom('oauth_clients')
    .where('id', '=', confidentialRegistration.client.id)
    .select('secret')
    .executeTakeFirstOrThrow()
  assert.equal(await verifyHash(confidentialRegistration.plainTextSecret, String(rotatedConfidential.secret)), false)
  assert.equal(await verifyHash(rotatedSecret, String(rotatedConfidential.secret)), true)
  assert.equal(await withAuthenticatedOAuthTokenClient(
    String(confidentialRegistration.client.id),
    confidentialRegistration.plainTextSecret,
    async client => client,
  ), null, 'the old client secret must stop authenticating')
  assert.deepEqual(await withAuthenticatedOAuthTokenClient(
    String(confidentialRegistration.client.id),
    rotatedSecret,
    async client => client,
  ), loadedConfidential)
  await assert.rejects(withAuthenticatedOAuthTokenClient(
    String(confidentialRegistration.client.id),
    rotatedSecret,
    async () => {
      await db.insertInto('issued_markers').values({ marker: 'client-auth-must-roll-back' }).execute()
      throw new Error('synthetic token endpoint failure')
    },
  ), /synthetic token endpoint failure/)
  assert.equal(await db.selectFrom('issued_markers').where('marker', '=', 'client-auth-must-roll-back').select('marker').executeTakeFirst(), undefined)
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: 'malformed',
    clientId: confidentialRegistration.client.id,
    clientSecret: 'wrong-secret',
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_client' })
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: 'malformed',
    clientId: confidentialRegistration.client.id,
    clientSecret: rotatedSecret,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' })

  const confidentialRequest = validateOAuthAuthorizationRequest(provider, loadedConfidential!, {
    responseType: 'code',
    clientId: String(confidentialRegistration.client.id),
    redirectUri: 'https://server.example.com/callback',
    scope: 'issues:read',
    resource: 'https://api.bughq.example',
    codeChallenge,
    codeChallengeMethod: 'S256',
  })
  const confidentialRequestId = await createOAuthAuthorizationRequestSession(confidentialRequest, browserSession, 60_000)
  const confidentialConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: confidentialRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert.equal(confidentialConsent.ok, true)
  let confidentialAccessToken = ''
  let confidentialRefreshToken = ''
  if (confidentialConsent.ok) {
    const confidentialInput = {
      code: confidentialConsent.value.code,
      clientId: confidentialRegistration.client.id,
      redirectUri: confidentialRequest.redirectUri,
      codeVerifier: verifier,
      accessTokenLifetimeMs: 60_000,
      refreshTokenLifetimeMs: 120_000,
    }
    assert.deepEqual(await exchangeOAuthAuthorizationCode(confidentialInput), { ok: false, reason: 'invalid_client' })
    assert.deepEqual(await exchangeOAuthAuthorizationCode({ ...confidentialInput, clientSecret: 'wrong-secret' }), { ok: false, reason: 'invalid_client' })
    const confidentialExchange = await exchangeOAuthAuthorizationCode({
      ...confidentialInput,
      clientSecret: rotatedSecret,
    })
    assert.equal(confidentialExchange.ok, true)
    if (confidentialExchange.ok) {
      confidentialAccessToken = confidentialExchange.value.accessToken
      confidentialRefreshToken = confidentialExchange.value.refreshToken!
      assert(confidentialRefreshToken)
    }
    assert.deepEqual(await exchangeOAuthAuthorizationCode({
      ...confidentialInput,
      clientSecret: rotatedSecret,
    }), { ok: false, reason: 'invalid_grant' })
  }
  const pendingConfidentialRequestId = await createOAuthAuthorizationRequestSession(confidentialRequest, browserSession, 60_000)
  const pendingConfidentialConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: pendingConfidentialRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(pendingConfidentialConsent.ok)
  const replacementSecret = await rotateOAuthClientSecret(42, confidentialRegistration.client.id)
  assert(replacementSecret)
  assert.equal(await findToken(confidentialAccessToken), null, 'secret rotation must revoke existing access tokens')
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: confidentialRefreshToken,
    clientId: confidentialRegistration.client.id,
    clientSecret: replacementSecret,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' }, 'secret rotation must revoke existing refresh families')
  assert.deepEqual(await exchangeOAuthAuthorizationCode({
    code: pendingConfidentialConsent.value.code,
    clientId: confidentialRegistration.client.id,
    clientSecret: replacementSecret,
    redirectUri: confidentialRequest.redirectUri,
    codeVerifier: verifier,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' }, 'secret rotation must consume pending authorization codes')
  await db.updateTable('oauth_clients').set({ revoked: true }).where('id', '=', confidentialRegistration.client.id).execute()
  assert.equal((await loadOAuthAuthorizationClient(String(confidentialRegistration.client.id)))?.revoked, true)
  assert.equal(await withAuthenticatedOAuthTokenClient(
    String(confidentialRegistration.client.id),
    replacementSecret,
    async client => client,
  ), null)
  assert.equal(await rotateOAuthClientSecret(42, confidentialRegistration.client.id), null, 'revoked clients must not rotate secrets')

  const disableRegistration = await registerOAuthClient(provider, 42, {
    name: 'Disposable integration',
    type: 'public',
    tokenEndpointAuthMethod: 'none',
    redirectUris: ['https://disable.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  })
  const disableRequest = validateOAuthAuthorizationRequest(provider, (await loadOAuthAuthorizationClient(String(disableRegistration.client.id)))!, {
    responseType: 'code',
    clientId: String(disableRegistration.client.id),
    redirectUri: 'https://disable.example.com/callback',
    scope: 'issues:read',
    resource: 'https://api.bughq.example',
    codeChallenge,
    codeChallengeMethod: 'S256',
  })
  const disableRequestId = await createOAuthAuthorizationRequestSession(disableRequest, browserSession, 60_000)
  const disableConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: disableRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(disableConsent.ok)
  const disableTokens = await exchangeOAuthAuthorizationCode({
    code: disableConsent.value.code,
    clientId: disableRegistration.client.id,
    redirectUri: disableRequest.redirectUri,
    codeVerifier: verifier,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(disableTokens.ok)
  const pendingDisableRequestId = await createOAuthAuthorizationRequestSession(disableRequest, browserSession, 60_000)
  const pendingCodeRequestId = await createOAuthAuthorizationRequestSession(disableRequest, browserSession, 60_000)
  const pendingDisableCode = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: pendingCodeRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(pendingDisableCode.ok)
  assert(await findToken(disableTokens.value.accessToken))
  assert.equal(await disableOAuthClient(7, disableRegistration.client.id), false, 'another owner must not disable the client')
  assert(await findToken(disableTokens.value.accessToken))
  assert.equal(await disableOAuthClient(42, disableRegistration.client.id), true)
  assert.equal(await disableOAuthClient(42, disableRegistration.client.id), false, 'disable must be idempotent')
  assert.equal(await findToken(disableTokens.value.accessToken), null)
  assert.equal(await loadOAuthAuthorizationRequestSession(pendingDisableRequestId, browserSession), null)
  assert.deepEqual(await withAuthorizationCode(pendingDisableCode.value.code, {
    clientId: disableRegistration.client.id,
    redirectUri: disableRequest.redirectUri,
    codeVerifier: verifier,
  }, async grant => grant), { ok: false, reason: 'invalid_grant' })
  const disabledGrant = await db.selectFrom('oauth_grants').where('id', '=', disableTokens.value.grantId).select(['revoked_at']).executeTakeFirstOrThrow()
  assert(disabledGrant.revoked_at)
  const disabledAccess = await db.selectFrom('oauth_access_tokens').where('oauth_grant_id', '=', disableTokens.value.grantId).select(['revoked']).get()
  assert(disabledAccess.every(token => Boolean(token.revoked)))
  const disabledRefresh = await db.selectFrom('oauth_refresh_tokens')
    .innerJoin('oauth_access_tokens', 'oauth_access_tokens.id', '=', 'oauth_refresh_tokens.access_token_id')
    .where('oauth_access_tokens.oauth_grant_id', '=', disableTokens.value.grantId)
    .select('oauth_refresh_tokens.revoked')
    .get()
  assert(disabledRefresh.every(token => Boolean(token.revoked)))
  const ownedClients = await listOAuthClients(42)
  assert.deepEqual(new Set(ownedClients.map(client => client.id)), new Set([
    publicRegistration.client.id,
    confidentialRegistration.client.id,
    disableRegistration.client.id,
  ]))
  assert.equal(ownedClients.find(client => client.id === publicRegistration.client.id)?.revoked, false)
  assert.equal(ownedClients.find(client => client.id === confidentialRegistration.client.id)?.revoked, true)
  assert.equal(ownedClients.find(client => client.id === disableRegistration.client.id)?.revoked, true)
  assert(ownedClients.every(client => !('secret' in client)))
  assert.deepEqual(await listOAuthClients(7), [])
  const scopedRequest = validateOAuthAuthorizationRequest(provider, loadedPublic!, {
    responseType: 'code',
    clientId: String(publicRegistration.client.id),
    redirectUri: 'https://client.example.com/callback',
    scope: 'issues:read profile:read',
    resource: 'https://api.bughq.example',
    codeChallenge,
    codeChallengeMethod: 'S256',
  })
  const scopedRequestId = await createOAuthAuthorizationRequestSession(scopedRequest, browserSession, 60_000)
  const scopedConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: scopedRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(scopedConsent.ok)
  const scopedTokens = await exchangeOAuthAuthorizationCode({
    code: scopedConsent.value.code,
    clientId: publicRegistration.client.id,
    redirectUri: scopedRequest.redirectUri,
    codeVerifier: verifier,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(scopedTokens.ok)
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: scopedTokens.value.refreshToken!,
    clientId: publicRegistration.client.id,
    scopes: ['issues:write'],
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_scope' })
  assert(await findToken(scopedTokens.value.accessToken), 'invalid scope must not consume the refresh family')
  const narrowedTokens = await refreshOAuthDelegatedToken({
    refreshToken: scopedTokens.value.refreshToken!,
    clientId: publicRegistration.client.id,
    scopes: ['issues:read'],
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(narrowedTokens.ok)
  assert.deepEqual(narrowedTokens.value.scopes, ['issues:read'])
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: narrowedTokens.value.refreshToken!,
    clientId: publicRegistration.client.id,
    scopes: ['issues:read', 'profile:read'],
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_scope' })
  assert(await findToken(narrowedTokens.value.accessToken), 'scope re-expansion must not consume the narrowed family')
  const continuedNarrowing = await refreshOAuthDelegatedToken({
    refreshToken: narrowedTokens.value.refreshToken!,
    clientId: publicRegistration.client.id,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(continuedNarrowing.ok)
  assert.deepEqual(continuedNarrowing.value.scopes, ['issues:read'])
  const connections = await listOAuthConnections('users', 42)
  const narrowedConnection = connections.find(connection => connection.grantId === continuedNarrowing.value.grantId)
  assert(narrowedConnection)
  assert.equal(narrowedConnection.clientId, publicRegistration.client.id)
  assert.equal(narrowedConnection.clientName, 'Browser integration')
  assert.deepEqual(narrowedConnection.scopes, ['issues:read', 'profile:read'])
  assert.deepEqual(await listOAuthConnections('users', 7), [])
  const disconnectedCode = await issueAuthorizationCode({
    grantId: continuedNarrowing.value.grantId,
    redirectUri: scopedRequest.redirectUri,
    codeChallenge,
    lifetimeMs: 60_000,
  })
  const disconnectedCodeHash = createHash('sha256').update(disconnectedCode, 'ascii').digest('hex')
  assert.equal(await disconnectOAuthGrant('users', 7, continuedNarrowing.value.grantId), false, 'another subject must not disconnect the grant')
  assert(await findToken(continuedNarrowing.value.accessToken))
  assert.equal(await disconnectOAuthGrant('users', 42, continuedNarrowing.value.grantId), true)
  assert.equal(await disconnectOAuthGrant('users', 42, continuedNarrowing.value.grantId), false, 'disconnect must be idempotent')
  assert.equal((await listOAuthConnections('users', 42)).some(connection => connection.grantId === continuedNarrowing.value.grantId), false)
  assert((await db.selectFrom('oauth_auth_codes')
    .where('code_hash', '=', disconnectedCodeHash)
    .select('consumed_at')
    .executeTakeFirstOrThrow()).consumed_at)
  assert.equal(await findToken(continuedNarrowing.value.accessToken), null)
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: continuedNarrowing.value.refreshToken!,
    clientId: publicRegistration.client.id,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' })
  const ineligibleRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const ineligibleConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: ineligibleRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(ineligibleConsent.ok)
  const siblingIneligibleCode = await issueAuthorizationCode({
    grantId: ineligibleConsent.value.grantId,
    redirectUri: validatedRequest.redirectUri,
    codeChallenge,
    lifetimeMs: 60_000,
  })
  const ineligibleBody = (code: string) => new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: String(publicRegistration.client.id),
    code,
    redirect_uri: validatedRequest.redirectUri,
    code_verifier: verifier,
  }).toString()
  const ineligibleExchange = await handleOAuthTokenRequest(provider, {
    body: ineligibleBody(ineligibleConsent.value.code),
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async () => false })
  assert.equal(ineligibleExchange.status, 400)
  assert.deepEqual(await ineligibleExchange.json(), { error: 'invalid_grant' })
  for (const code of [ineligibleConsent.value.code, siblingIneligibleCode]) {
    const afterIneligibility = await handleOAuthTokenRequest(provider, {
      body: ineligibleBody(code),
      contentType: 'application/x-www-form-urlencoded',
    }, { isSubjectEligible: async () => true })
    assert.equal(afterIneligibility.status, 400)
    assert.deepEqual(await afterIneligibility.json(), { error: 'invalid_grant' })
  }
  const endpointRequestId = await createOAuthAuthorizationRequestSession(validatedRequest, browserSession, 60_000)
  const endpointConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: endpointRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(endpointConsent.ok)
  const endpointExchange = await handleOAuthTokenRequest(provider, {
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: String(publicRegistration.client.id),
      code: endpointConsent.value.code,
      redirect_uri: validatedRequest.redirectUri,
      code_verifier: verifier,
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async subject => subject.type === 'users' && subject.id === 42 })
  assert.equal(endpointExchange.status, 200)
  assert.equal(endpointExchange.headers.get('cache-control'), 'no-store')
  const endpointTokens = await endpointExchange.json() as Record<string, unknown>
  assert.equal(endpointTokens.token_type, 'Bearer')
  assert.equal(endpointTokens.expires_in, 3600)
  assert.equal(endpointTokens.scope, 'issues:read')
  assert.equal(typeof endpointTokens.access_token, 'string')
  assert.equal(typeof endpointTokens.refresh_token, 'string')
  assert.equal('grantId' in endpointTokens, false)
  const endpointRefresh = await handleOAuthTokenRequest(provider, {
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: String(publicRegistration.client.id),
      refresh_token: String(endpointTokens.refresh_token),
      scope: 'issues:read',
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async subject => subject.type === 'users' && subject.id === 42 })
  assert.equal(endpointRefresh.status, 200)
  const refreshedEndpointTokens = await endpointRefresh.json() as Record<string, unknown>
  assert.equal(refreshedEndpointTokens.scope, 'issues:read')
  assert.equal(await findToken(String(endpointTokens.access_token)), null)
  assert(await findToken(String(refreshedEndpointTokens.access_token)))
  const endpointBearer = String(refreshedEndpointTokens.access_token)
  const delegatedAccess = await authorizeOAuthDelegatedToken(endpointBearer, {
    scopes: ['issues:read'],
    resource: 'bughq',
    audience: 'https://api.bughq.example',
    workspaceId: null,
    isSubjectEligible: async subject => subject.type === 'users' && subject.id === 42,
  })
  assert(delegatedAccess.ok)
  assert.equal(delegatedAccess.token.subjectType, 'users')
  assert.equal(delegatedAccess.token.subjectId, 42)
  const insufficientScope = await authorizeOAuthDelegatedToken(endpointBearer, {
    scopes: ['issues:write'],
    resource: 'bughq',
    audience: 'https://api.bughq.example',
    workspaceId: null,
    isSubjectEligible: async () => true,
  })
  assert.deepEqual(insufficientScope, { ok: false, reason: 'insufficient_scope', requiredScopes: ['issues:write'] })
  const scopeResponse = oauthBearerAuthorizationErrorResponse(insufficientScope)
  assert.equal(scopeResponse.status, 403)
  assert.equal(scopeResponse.headers.get('www-authenticate'), 'Bearer error="insufficient_scope", scope="issues:write"')
  assert.deepEqual(await authorizeOAuthDelegatedToken(endpointBearer, {
    scopes: ['issues:read'],
    resource: 'loghq',
    audience: 'https://api.loghq.example',
    workspaceId: null,
    isSubjectEligible: async () => true,
  }), { ok: false, reason: 'invalid_token' })
  assert.deepEqual(await authorizeOAuthDelegatedToken(endpointBearer, {
    scopes: ['issues:read'],
    resource: 'bughq',
    audience: 'https://api.bughq.example',
    workspaceId: 'another-workspace',
    isSubjectEligible: async () => true,
  }), { ok: false, reason: 'invalid_token' })
  assert.deepEqual(await authorizeOAuthDelegatedToken(endpointBearer, {
    scopes: ['issues:read'],
    resource: 'bughq',
    audience: 'https://api.bughq.example',
    workspaceId: null,
    isSubjectEligible: async () => false,
  }), { ok: false, reason: 'invalid_token' })
  const siblingFamilyCode = await issueAuthorizationCode({
    grantId: endpointConsent.value.grantId,
    redirectUri: validatedRequest.redirectUri,
    codeChallenge,
    lifetimeMs: 60_000,
  })
  const siblingFamilyExchange = await handleOAuthTokenRequest(provider, {
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: String(publicRegistration.client.id),
      code: siblingFamilyCode,
      redirect_uri: validatedRequest.redirectUri,
      code_verifier: verifier,
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async () => true })
  assert.equal(siblingFamilyExchange.status, 200)
  const siblingFamilyTokens = await siblingFamilyExchange.json() as Record<string, unknown>
  const ineligibleRefreshBody = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: String(publicRegistration.client.id),
    refresh_token: String(refreshedEndpointTokens.refresh_token),
    scope: 'issues:read',
  }).toString()
  const ineligibleRefresh = await handleOAuthTokenRequest(provider, {
    body: ineligibleRefreshBody,
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async () => false })
  assert.equal(ineligibleRefresh.status, 400)
  assert.deepEqual(await ineligibleRefresh.json(), { error: 'invalid_grant' })
  assert.equal(await findToken(String(siblingFamilyTokens.access_token)), null)
  const siblingFamilyRefresh = await handleOAuthTokenRequest(provider, {
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: String(publicRegistration.client.id),
      refresh_token: String(siblingFamilyTokens.refresh_token),
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async () => true })
  assert.equal(siblingFamilyRefresh.status, 400)
  assert.deepEqual(await siblingFamilyRefresh.json(), { error: 'invalid_grant' })
  const revokedFamilyRefresh = await handleOAuthTokenRequest(provider, {
    body: ineligibleRefreshBody,
    contentType: 'application/x-www-form-urlencoded',
  }, { isSubjectEligible: async () => true })
  assert.equal(revokedFamilyRefresh.status, 400)
  assert.deepEqual(await revokedFamilyRefresh.json(), { error: 'invalid_grant' })
  const revocationRegistration = await registerOAuthClient(provider, 42, {
    name: 'Revocation integration',
    type: 'public',
    tokenEndpointAuthMethod: 'none',
    redirectUris: ['https://revoke.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  })
  const revocationRequest = validateOAuthAuthorizationRequest(
    provider,
    (await loadOAuthAuthorizationClient(String(revocationRegistration.client.id)))!,
    {
      responseType: 'code',
      clientId: String(revocationRegistration.client.id),
      redirectUri: 'https://revoke.example.com/callback',
      scope: 'issues:read',
      resource: 'https://api.bughq.example',
      codeChallenge,
      codeChallengeMethod: 'S256',
    },
  )
  const revocationRequestId = await createOAuthAuthorizationRequestSession(revocationRequest, browserSession, 60_000)
  const revocationConsent = await approveOAuthAuthorizationRequestSession({
    provider,
    requestId: revocationRequestId,
    browserSessionId: browserSession,
    subjectType: 'users',
    subjectId: 42,
    authorizationCodeLifetimeMs: 60_000,
  })
  assert(revocationConsent.ok)
  const revocationTokens = await exchangeOAuthAuthorizationCode({
    code: revocationConsent.value.code,
    clientId: revocationRegistration.client.id,
    redirectUri: revocationRequest.redirectUri,
    codeVerifier: verifier,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(revocationTokens.ok)
  const secondRevocationCode = await issueAuthorizationCode({
    grantId: revocationTokens.value.grantId,
    redirectUri: revocationRequest.redirectUri,
    codeChallenge,
    lifetimeMs: 60_000,
  })
  const secondRevocationTokens = await exchangeOAuthAuthorizationCode({
    code: secondRevocationCode,
    clientId: revocationRegistration.client.id,
    redirectUri: revocationRequest.redirectUri,
    codeVerifier: verifier,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(secondRevocationTokens.ok)
  const invalidBasicRevocation = await handleOAuthRevocationRequest({
    body: new URLSearchParams({ token: revocationTokens.value.accessToken }).toString(),
    contentType: 'application/x-www-form-urlencoded',
    authorization: 'Basic !!!',
  })
  assert.equal(invalidBasicRevocation.status, 401)
  assert.equal(invalidBasicRevocation.headers.get('www-authenticate'), 'Basic realm="oauth-revoke"')
  const crossClientRevocation = await handleOAuthRevocationRequest({
    body: new URLSearchParams({
      client_id: String(publicRegistration.client.id),
      token: revocationTokens.value.accessToken,
      token_type_hint: 'access_token',
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  })
  assert.equal(crossClientRevocation.status, 200)
  assert.equal(await crossClientRevocation.text(), '')
  assert(await findToken(revocationTokens.value.accessToken), 'another client must not revoke the token')
  const unsupportedHint = await handleOAuthRevocationRequest({
    body: new URLSearchParams({
      client_id: String(revocationRegistration.client.id),
      token: revocationTokens.value.accessToken,
      token_type_hint: 'id_token',
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  })
  assert.equal(unsupportedHint.status, 400)
  assert.deepEqual(await unsupportedHint.json(), { error: 'unsupported_token_type' })
  assert(await findToken(revocationTokens.value.accessToken), 'an unsupported hint must not revoke the token')
  const accessRevocation = await handleOAuthRevocationRequest({
    body: new URLSearchParams({
      client_id: String(revocationRegistration.client.id),
      token: revocationTokens.value.accessToken,
      token_type_hint: 'refresh_token',
    }).toString(),
    contentType: 'application/x-www-form-urlencoded; charset=utf-8',
  })
  assert.equal(accessRevocation.status, 200)
  assert.equal(accessRevocation.headers.get('cache-control'), 'no-store')
  assert.equal(await findToken(revocationTokens.value.accessToken), null)
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: revocationTokens.value.refreshToken!,
    clientId: revocationRegistration.client.id,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' })
  const refreshRevocation = await handleOAuthRevocationRequest({
    body: new URLSearchParams({
      client_id: String(revocationRegistration.client.id),
      token: secondRevocationTokens.value.refreshToken!,
      token_type_hint: 'refresh_token',
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  })
  assert.equal(refreshRevocation.status, 200)
  assert.equal(await findToken(secondRevocationTokens.value.accessToken), null)
  assert.deepEqual(await refreshOAuthDelegatedToken({
    refreshToken: secondRevocationTokens.value.refreshToken!,
    clientId: revocationRegistration.client.id,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' })
  const repeatedRevocation = await handleOAuthRevocationRequest({
    body: new URLSearchParams({
      client_id: String(revocationRegistration.client.id),
      token: secondRevocationTokens.value.refreshToken!,
    }).toString(),
    contentType: 'application/x-www-form-urlencoded',
  })
  assert.equal(repeatedRevocation.status, 200)
  const publicUpdate = {
    name: 'Browser integration renamed',
    redirectUris: ['https://client.example.com/callback'],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read', 'profile:read'],
    resources: ['bughq'],
  }
  assert.equal(await updateOAuthClient(provider, 7, publicRegistration.client.id, publicUpdate), null, 'another owner must not edit the client')
  await assert.rejects(updateOAuthClient(provider, 42, publicRegistration.client.id, {
    ...publicUpdate,
    scopes: ['issues:write'],
  }), /scope/)
  const renamedPublic = await updateOAuthClient(provider, 42, publicRegistration.client.id, publicUpdate)
  assert.equal(renamedPublic?.name, publicUpdate.name)
  assert(await loadOAuthAuthorizationRequestSession(requestId, browserSession), 'a name-only edit must preserve pending authorization')
  const pendingCodesBeforeEdit = await db.selectFrom('oauth_auth_codes')
    .where('client_id', '=', publicRegistration.client.id)
    .whereNull('consumed_at')
    .select('code_hash')
    .get()
  assert(pendingCodesBeforeEdit.length > 0)
  const editedPublic = await updateOAuthClient(provider, 42, publicRegistration.client.id, {
    ...publicUpdate,
    redirectUris: ['https://client.example.com/new-callback'],
  })
  assert.deepEqual(editedPublic?.redirectUris, ['https://client.example.com/new-callback'])
  assert.deepEqual(await authorizeOAuthDelegatedToken(endpointBearer, {
    scopes: ['issues:read'],
    resource: 'bughq',
    audience: 'https://api.bughq.example',
    workspaceId: null,
    isSubjectEligible: async () => true,
  }), { ok: false, reason: 'invalid_token' })
  assert.equal(await loadOAuthAuthorizationRequestSession(requestId, browserSession), null, 'a policy edit must consume stale authorization requests')
  const publicGrantsAfterEdit = await db.selectFrom('oauth_grants')
    .where('client_id', '=', publicRegistration.client.id)
    .select('revoked_at')
    .get()
  assert(publicGrantsAfterEdit.length > 0)
  assert(publicGrantsAfterEdit.every(grant => grant.revoked_at != null))
  const publicCodesAfterEdit = await db.selectFrom('oauth_auth_codes')
    .where('client_id', '=', publicRegistration.client.id)
    .select('consumed_at')
    .get()
  assert(publicCodesAfterEdit.every(code => code.consumed_at != null))
  const publicAccessAfterEdit = await db.selectFrom('oauth_access_tokens')
    .where('oauth_client_id', '=', publicRegistration.client.id)
    .select('revoked')
    .get()
  assert(publicAccessAfterEdit.every(token => Boolean(token.revoked)))
  await db.updateTable('oauth_clients').set({ redirect_uris: 'not-json' } as never).where('id', '=', publicRegistration.client.id).execute()
  assert.equal(await loadOAuthAuthorizationClient(String(publicRegistration.client.id)), null, 'malformed provider policy must fail closed')
  assert.equal(await loadOAuthAuthorizationRequestSession(requestId, browserSession), null, 'saved requests must recheck current client policy')
  assert.deepEqual(
    await withOAuthAuthorizationRequestSession(requestId, browserSession, async request => request),
    { ok: false, reason: 'invalid_request' },
    'approval must recheck current client policy before consuming the request',
  )
  await assert.rejects(registerOAuthClient(provider, 0, {
    name: 'Ownerless integration',
    type: 'public',
    tokenEndpointAuthMethod: 'none',
    redirectUris: ['https://client.example.com/callback'],
    grantTypes: ['authorization_code'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  }), /owner identifier/)

  const grant = await createOAuthGrant({
    clientId: Number(client.id),
    subjectType: 'users',
    subjectId: 42,
    scopes: ['issues:read'],
    resources: ['bughq'],
    audiences: ['https://api.bughq.example'],
    workspaceId: 'workspace-1',
  })
  const base = {
    grantId: grant.id,
    clientId: grant.clientId,
    subjectType: grant.subjectType,
    subjectId: grant.subjectId,
    redirectUri: 'https://client.example.com/callback',
    scopes: grant.scopes,
    resources: grant.resources,
    audiences: grant.audiences,
    workspaceId: grant.workspaceId,
    codeChallenge,
    lifetimeMs: 60_000,
  }
  const expected = {
    clientId: base.clientId,
    redirectUri: base.redirectUri,
    codeVerifier: verifier,
  }

  const plain = await issueAuthorizationCode(base)
  const stored = await db.selectFrom('oauth_auth_codes')
    .where('code_hash', '=', createHash('sha256').update(plain).digest('hex'))
    .selectAll()
    .executeTakeFirstOrThrow() as Record<string, unknown>
  assert.equal(stored.code_hash, createHash('sha256').update(plain).digest('hex'))
  assert.equal(stored.grant_id, grant.id)
  assert.equal('code' in stored, false)

  const first = await withAuthorizationCode(plain, expected, async grant => grant)
  assert.equal(first.ok, true)
  if (first.ok) {
    assert.equal(first.value.grantId, grant.id)
    assert.equal(first.value.clientId, Number(client.id))
    assert.equal(first.value.subjectType, 'users')
    assert.equal(first.value.subjectId, 42)
    assert.deepEqual(first.value.scopes, ['issues:read'])
    assert.deepEqual(first.value.resources, ['bughq'])
    assert.deepEqual(first.value.audiences, ['https://api.bughq.example'])
    assert.equal(first.value.workspaceId, 'workspace-1')
  }
  assert.deepEqual(await withAuthorizationCode(plain, expected, async grant => grant), { ok: false, reason: 'invalid_grant' })

  for (const invalid of [
    { ...expected, clientId: 8 },
    { ...expected, redirectUri: `${expected.redirectUri}/` },
    { ...expected, codeVerifier: 'x'.repeat(43) },
  ]) {
    const code = await issueAuthorizationCode(base)
    assert.deepEqual(await withAuthorizationCode(code, invalid, async grant => grant), { ok: false, reason: 'invalid_grant' })
    assert.equal((await withAuthorizationCode(code, expected, async grant => grant)).ok, true)
  }

  const concurrentCode = await issueAuthorizationCode(base)
  const concurrent = await Promise.all(Array.from({ length: 8 }, () =>
    withAuthorizationCode(concurrentCode, expected, async grant => grant.subjectId)))
  assert.equal(concurrent.filter(result => result.ok).length, 1)
  assert.equal(concurrent.filter(result => !result.ok).length, 7)

  const rollbackCode = await issueAuthorizationCode(base)
  await assert.rejects(withAuthorizationCode(rollbackCode, expected, async () => {
    await db.insertInto('issued_markers').values({ marker: 'must-roll-back' }).execute()
    throw new Error('synthetic token mint failure')
  }), /synthetic token mint failure/)
  assert.equal((await db.selectFrom('issued_markers').selectAll().get()).length, 0)
  assert.equal((await withAuthorizationCode(rollbackCode, expected, async grant => grant.clientId)).ok, true)

  const expiredCode = await issueAuthorizationCode(base)
  await db.updateTable('oauth_auth_codes')
    .set({ expires_at: sqlDateTime(new Date(Date.now() - 1000)) } as never)
    .where('code_hash', '=', createHash('sha256').update(expiredCode).digest('hex'))
    .execute()
  assert.deepEqual(await withAuthorizationCode(expiredCode, expected, async grant => grant), { ok: false, reason: 'invalid_grant' })

  const revokedGrant = await createOAuthGrant({
    clientId: Number(client.id),
    subjectType: 'users',
    subjectId: 42,
    scopes: ['profile:read'],
    resources: [],
    audiences: [],
  })
  const revokedBase = {
    ...base,
    grantId: revokedGrant.id,
    clientId: revokedGrant.clientId,
    scopes: revokedGrant.scopes,
    resources: revokedGrant.resources,
    audiences: revokedGrant.audiences,
    workspaceId: revokedGrant.workspaceId,
  }
  const outstanding = await issueAuthorizationCode(revokedBase)
  assert.equal(await revokeOAuthGrant(revokedGrant.id), true)
  assert.deepEqual(await withAuthorizationCode(outstanding, {
    ...expected,
    clientId: revokedGrant.clientId,
  }, async active => active), { ok: false, reason: 'invalid_grant' })
  await assert.rejects(issueAuthorizationCode(revokedBase), /grant is not active/)
  await assert.rejects(createOAuthGrant({
    clientId: 999_999,
    subjectType: 'users',
    subjectId: 42,
    scopes: ['profile:read'],
    resources: [],
    audiences: [],
  }), /client is not active/)

  const exchangeCode = await issueAuthorizationCode(base)
  const exchanged = await exchangeAuthorizationCode({
    code: exchangeCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert.equal(exchanged.ok, true)
  if (exchanged.ok) {
    const tokenRow = await db.selectFrom('oauth_access_tokens')
      .where('oauth_grant_id', '=', grant.id)
      .selectAll()
      .executeTakeFirstOrThrow() as Record<string, unknown>
    assert.equal(tokenRow.token, createHash('sha256').update(exchanged.value.accessToken).digest('hex'))
    assert.notEqual(tokenRow.token, exchanged.value.accessToken)
    assert.equal(String(tokenRow.oauth_client_id), String(grant.clientId))
    assert.equal(String(tokenRow.tokenable_id), String(grant.subjectId))
    assert.equal(tokenRow.tokenable_type, grant.subjectType)
    assert.deepEqual(JSON.parse(String(tokenRow.scopes)), grant.scopes)
    assert.deepEqual(JSON.parse(String(tokenRow.resources)), grant.resources)
    assert.deepEqual(JSON.parse(String(tokenRow.audiences)), grant.audiences)
    assert.equal(tokenRow.workspace_id, grant.workspaceId)

    const refreshRow = await db.selectFrom('oauth_refresh_tokens')
      .where('access_token_id', '=', tokenRow.id as number)
      .selectAll()
      .executeTakeFirstOrThrow() as Record<string, unknown>
    assert.equal(refreshRow.token, createHash('sha256').update(exchanged.value.refreshToken).digest('hex'))
    assert.notEqual(refreshRow.token, exchanged.value.refreshToken)
    assert.match(String(refreshRow.family_id), /^[a-f0-9]{32}$/)
    assert.equal(refreshRow.parent_id, null)
    assert.equal(await validateRefreshToken(exchanged.value.refreshToken), false)
    await assert.rejects(refreshToken(exchanged.value.refreshToken), /Invalid or expired refresh token/)
    assert(await db.selectFrom('oauth_refresh_tokens').where('id', '=', refreshRow.id as number).where('revoked', '=', false).executeTakeFirst())
  }
  assert.deepEqual(await exchangeAuthorizationCode({
    code: exchangeCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' })

  const concurrentExchangeCode = await issueAuthorizationCode(base)
  const tokensBefore = await db.selectFrom('oauth_access_tokens').where('oauth_grant_id', '=', grant.id).select('id').get()
  const concurrentExchanges = await Promise.all(Array.from({ length: 8 }, () => exchangeAuthorizationCode({
    code: concurrentExchangeCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })))
  assert.equal(concurrentExchanges.filter(result => result.ok).length, 1)
  assert.equal(concurrentExchanges.filter(result => !result.ok).length, 7)
  const tokensAfter = await db.selectFrom('oauth_access_tokens').where('oauth_grant_id', '=', grant.id).select('id').get()
  assert.equal(tokensAfter.length, tokensBefore.length + 1, 'one consumed code must mint exactly one access token')
  const newTokenIds = tokensAfter.filter(token => !tokensBefore.some(previous => String(previous.id) === String(token.id))).map(token => token.id)
  const newRefreshTokens = await db.selectFrom('oauth_refresh_tokens').where('access_token_id', 'in', newTokenIds).select('id').get()
  assert.equal(newRefreshTokens.length, 1, 'one consumed code must mint exactly one refresh token')
  if (exchanged.ok) {
    const resolved = await findToken(exchanged.value.accessToken)
    assert(resolved)
    assert.equal(resolved.grantId, grant.id)
    assert.deepEqual(resolved.resources, grant.resources)
    assert.deepEqual(resolved.audiences, grant.audiences)
    assert.equal(resolved.workspaceId, grant.workspaceId)
    assert.equal(await revokeOAuthGrant(grant.id), true)
    assert.equal(await findToken(exchanged.value.accessToken), null, 'revoking consent must invalidate its access tokens')
  }

  const activePruneRegistration = await registerOAuthClient(provider, 55, {
    name: 'Prune preservation client',
    type: 'public',
    tokenEndpointAuthMethod: 'none',
    redirectUris: ['https://prune.example.com/callback'],
    grantTypes: ['authorization_code'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  })
  const activePruneClient = await loadOAuthAuthorizationClient(String(activePruneRegistration.client.id))
  assert(activePruneClient)
  const activePruneRequest = validateOAuthAuthorizationRequest(provider, activePruneClient, {
    responseType: 'code',
    clientId: String(activePruneRegistration.client.id),
    redirectUri: 'https://prune.example.com/callback',
    scope: 'issues:read',
    resource: 'https://api.bughq.example',
    state: 'prune-active-state',
    codeChallenge,
    codeChallengeMethod: 'S256',
  })
  const activePruneRequestId = await createOAuthAuthorizationRequestSession(activePruneRequest, browserSession, 60_000)
  const activePruneGrant = await createOAuthGrant({
    clientId: activePruneRegistration.client.id,
    subjectType: 'users',
    subjectId: 42,
    scopes: ['issues:read'],
    resources: ['bughq'],
    audiences: ['https://api.bughq.example'],
  })
  const activePruneCode = await issueAuthorizationCode({
    grantId: activePruneGrant.id,
    clientId: activePruneGrant.clientId,
    subjectType: activePruneGrant.subjectType,
    subjectId: activePruneGrant.subjectId,
    redirectUri: 'https://prune.example.com/callback',
    scopes: activePruneGrant.scopes,
    resources: activePruneGrant.resources,
    audiences: activePruneGrant.audiences,
    workspaceId: activePruneGrant.workspaceId,
    codeChallenge,
    lifetimeMs: 60_000,
  })
  const pruned = await pruneOAuthAuthorizationArtifacts({ now: new Date(), consumedRetentionMs: 60_000 })
  assert(pruned.authorizationRequests > 0)
  assert(pruned.authorizationCodes > 0)
  assert.equal(await db.selectFrom('oauth_authorization_requests')
    .where('request_hash', '=', createHash('sha256').update(expiredRequestId).digest('hex'))
    .select('request_hash')
    .executeTakeFirst(), undefined)
  assert.equal(await db.selectFrom('oauth_auth_codes')
    .where('code_hash', '=', createHash('sha256').update(expiredCode).digest('hex'))
    .select('code_hash')
    .executeTakeFirst(), undefined)
  assert(await db.selectFrom('oauth_authorization_requests')
    .where('request_hash', '=', createHash('sha256').update(activePruneRequestId).digest('hex'))
    .select('request_hash')
    .executeTakeFirst())
  assert(await db.selectFrom('oauth_auth_codes')
    .where('code_hash', '=', createHash('sha256').update(activePruneCode).digest('hex'))
    .select('code_hash')
    .executeTakeFirst())
  assert.deepEqual(
    await pruneOAuthAuthorizationArtifacts({ now: new Date(), consumedRetentionMs: 60_000 }),
    { authorizationRequests: 0, authorizationCodes: 0 },
  )

  console.log('oauth authorization code store OK')
}
finally {
  await releaseOrm()
  await resetDatabaseConnection()
}
