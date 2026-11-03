import type { OAuthDelegatedAccessRequirement } from '../src/oauth-delegated-access'
import { describe, expect, test } from 'bun:test'
import { oauthUserInfoResponse, pairwiseOAuthSubject } from '../src/oauth-userinfo'

const SECRET = 'p'.repeat(48)
const subject = { type: 'users', id: 42, clientId: 7, grantId: 'grant-1', workspaceId: null }
const requirement = { scopes: ['identity'], resource: 'hq-identity', audience: 'https://hq.example/api/platform', workspaceId: null }

function fakeAuthorize(scopes: string[], outcome: 'ok' | 'invalid' | 'scope' = 'ok') {
  const seen: OAuthDelegatedAccessRequirement[] = []
  const authorize = async (bearer: string, req: OAuthDelegatedAccessRequirement) => {
    seen.push(req)
    if (bearer !== 'good' || outcome === 'invalid') return { ok: false as const, reason: 'invalid_token' as const }
    if (!await req.isSubjectEligible(subject)) return { ok: false as const, reason: 'invalid_token' as const }
    if (outcome === 'scope') return { ok: false as const, reason: 'insufficient_scope' as const, requiredScopes: [...req.scopes] }
    return { ok: true as const, token: { scopes, clientId: 7, subjectId: 42, subjectType: 'users' } as any }
  }
  return { authorize, seen }
}

const request = (bearer?: string) => new Request('https://hq.example/api/platform/identity/me', { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} })

describe('pairwiseOAuthSubject', () => {
  test('is stable per client and differs across clients', () => {
    const a = pairwiseOAuthSubject(SECRET, 7, subject)
    expect(pairwiseOAuthSubject(SECRET, '7', subject)).toBe(a)
    expect(pairwiseOAuthSubject(SECRET, 8, subject)).not.toBe(a)
    expect(pairwiseOAuthSubject(SECRET, 7, { type: 'users', id: 43 })).not.toBe(a)
    expect(a).not.toContain('42')
  })

  test('refuses a short secret', () => {
    expect(() => pairwiseOAuthSubject('short', 7, subject)).toThrow(TypeError)
  })
})

describe('oauthUserInfoResponse', () => {
  test('answers the pairwise sub and the released claims, without caching', async () => {
    const { authorize } = fakeAuthorize(['identity', 'profile'])
    const response = await oauthUserInfoResponse(request('good'), {
      ...requirement, pairwiseSecret: SECRET, authorize, isSubjectEligible: () => true,
      claims: async ({ scopes, clientId, subject }) => ({ name: 'Ada', scopes, clientId, user: subject.id, sub: 'forged' }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json() as Record<string, unknown>
    expect(body.sub).toBe(pairwiseOAuthSubject(SECRET, 7, subject))
    expect(body).toMatchObject({ name: 'Ada', scopes: ['identity', 'profile'], clientId: 7, user: 42 })
  })

  test('401 without a bearer, for an invalid token and for an ineligible subject', async () => {
    const claims = async () => ({ name: 'x' })
    const { authorize } = fakeAuthorize(['identity'])
    for (const [bearer, eligible] of [[undefined, true], ['bad', true], ['good', false]] as const) {
      const response = await oauthUserInfoResponse(request(bearer), { ...requirement, pairwiseSecret: SECRET, authorize, isSubjectEligible: () => eligible, claims })
      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toContain('invalid_token')
    }
  })

  test('403 when the token lacks a required scope', async () => {
    const { authorize } = fakeAuthorize(['profile'], 'scope')
    const response = await oauthUserInfoResponse(request('good'), { ...requirement, pairwiseSecret: SECRET, authorize, isSubjectEligible: () => true, claims: async () => ({}) })
    expect(response.status).toBe(403)
  })

  test('401 when the claims resolver no longer finds the subject', async () => {
    const { authorize } = fakeAuthorize(['identity'])
    const response = await oauthUserInfoResponse(request('good'), { ...requirement, pairwiseSecret: SECRET, authorize, isSubjectEligible: () => true, claims: async () => null })
    expect(response.status).toBe(401)
  })
})
