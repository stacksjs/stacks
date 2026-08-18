import type { AttachLookupFailure } from '../src/commands/deploy'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  describeAttachLookupFailure,
  resolveAttachTargetBox,
  resolveHetznerApiToken,
} from '../src/commands/deploy'

const TOKEN_VARS = ['HCLOUD_TOKEN', 'HETZNER_API_TOKEN'] as const

let saved: Record<string, string | undefined>
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  saved = Object.fromEntries(TOKEN_VARS.map(k => [k, process.env[k]]))
  for (const k of TOKEN_VARS) delete process.env[k]
  realFetch = globalThis.fetch
})

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  globalThis.fetch = realFetch
})

/** Record every URL requested, answering each call from a queue. */
function stubFetch(responses: Array<Response | Error>): { urls: string[] } {
  const urls: string[] = []
  let i = 0
  globalThis.fetch = (async (input: any) => {
    urls.push(String(input))
    const next = responses[Math.min(i, responses.length - 1)]
    i++
    if (next instanceof Error) throw next
    return next
  }) as any
  return { urls }
}

function serversResponse(servers: unknown[]): Response {
  return new Response(JSON.stringify({ servers }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const runningBox = {
  id: 501,
  name: 'statushq-production-app',
  status: 'running',
  public_net: { ipv4: { ip: '167.233.116.134' } },
}

describe('resolveHetznerApiToken', () => {
  it('prefers the config token, as deployToHetzner already did', () => {
    process.env.HCLOUD_TOKEN = 'from-env'

    expect(resolveHetznerApiToken({ hetzner: { apiToken: 'from-config' } })).toBe('from-config')
  })

  it('falls back to HCLOUD_TOKEN and then HETZNER_API_TOKEN', () => {
    process.env.HETZNER_API_TOKEN = 'legacy'
    expect(resolveHetznerApiToken({})).toBe('legacy')

    process.env.HCLOUD_TOKEN = 'preferred'
    expect(resolveHetznerApiToken({})).toBe('preferred')
  })

  it('is undefined when nothing supplies one', () => {
    expect(resolveHetznerApiToken({})).toBeUndefined()
    expect(resolveHetznerApiToken(undefined)).toBeUndefined()
  })
})

describe('describeAttachLookupFailure', () => {
  it('does not blame provisioning when there was no token to look with', () => {
    const message = describeAttachLookupFailure('uptime-status', 'production', { kind: 'no-token' })

    expect(message).toContain('no Hetzner API token')
    expect(message).toContain('HCLOUD_TOKEN')
    expect(message).toContain('hetzner.apiToken')
    expect(message).not.toContain('provisioned')
  })

  it('reports an auth failure as an auth failure, not a missing server', () => {
    const failure: AttachLookupFailure = {
      kind: 'request-failed',
      status: 401,
      detail: '{"error":{"message":"unable to authenticate","code":"unauthorized"}}',
    }

    const message = describeAttachLookupFailure('uptime-status', 'production', failure)

    expect(message).toContain('HTTP 401')
    expect(message).toContain('unable to authenticate')
    expect(message).toContain('auth failure')
    expect(message).not.toContain('provisioned')
  })

  it('says the API was unreachable when the request never got an answer', () => {
    const message = describeAttachLookupFailure('uptime-status', 'production', { kind: 'request-failed', status: 0 })

    expect(message).toContain('could not be reached')
    expect(message).not.toContain('provisioned')
  })

  it('asks about provisioning only when nothing actually matched, and shows both queries', () => {
    const message = describeAttachLookupFailure('uptime-status', 'production', { kind: 'no-match' })

    expect(message).toContain('ts-cloud/project=uptime-status')
    expect(message).toContain('ts-cloud/environment=production')
    expect(message).toContain("named 'uptime-status-production-app'")
    expect(message).toContain('Is it provisioned')
  })

  it('falls back to the no-match wording when no failure was recorded', () => {
    expect(describeAttachLookupFailure('uptime-status', 'production', undefined)).toContain('Is it provisioned')
  })
})

describe('resolveAttachTargetBox', () => {
  it('does not even call the API without a token, and says so', async () => {
    const { urls } = stubFetch([serversResponse([runningBox])])

    const result = await resolveAttachTargetBox('uptime-status', 'production', {})

    expect(result.box).toBeNull()
    expect(result.failure).toEqual({ kind: 'no-token' })
    // The bug this replaces: no request was made, yet the operator was told the
    // box might not be provisioned.
    expect(urls).toEqual([])
  })

  it('uses a token from config, which the old lookup ignored entirely', async () => {
    const { urls } = stubFetch([serversResponse([runningBox])])

    const result = await resolveAttachTargetBox('uptime-status', 'production', {
      hetzner: { apiToken: 'from-config' },
    })

    expect(urls).toHaveLength(1)
    expect(result.box?.serverName).toBe('statushq-production-app')
    expect(result.box?.publicIp).toBe('167.233.116.134')
  })

  it('reports the status and body when the API rejects the lookup', async () => {
    process.env.HCLOUD_TOKEN = 'bad-token'
    stubFetch([new Response('{"error":{"message":"unable to authenticate"}}', { status: 401 })])

    const result = await resolveAttachTargetBox('uptime-status', 'production', {})

    expect(result.box).toBeNull()
    expect(result.failure?.kind).toBe('request-failed')
    expect((result.failure as any).status).toBe(401)
    expect((result.failure as any).detail).toContain('unable to authenticate')
  })

  it('reports a thrown request as unreachable rather than as an empty result', async () => {
    process.env.HCLOUD_TOKEN = 'token'
    stubFetch([new Error('getaddrinfo ENOTFOUND api.hetzner.cloud')])

    const result = await resolveAttachTargetBox('uptime-status', 'production', {})

    expect(result.failure?.kind).toBe('request-failed')
    expect((result.failure as any).status).toBe(0)
    expect((result.failure as any).detail).toContain('ENOTFOUND')
  })

  it('keeps the FIRST failure, so a 401 is not masked by the name fallback', async () => {
    process.env.HCLOUD_TOKEN = 'token'
    stubFetch([
      new Response('{"error":{"message":"unable to authenticate"}}', { status: 401 }),
      serversResponse([]),
    ])

    const result = await resolveAttachTargetBox('uptime-status', 'production', {})

    expect((result.failure as any).status).toBe(401)
  })

  it('distinguishes a genuinely empty result from a failed call', async () => {
    process.env.HCLOUD_TOKEN = 'token'
    const { urls } = stubFetch([serversResponse([]), serversResponse([])])

    const result = await resolveAttachTargetBox('uptime-status', 'production', {})

    expect(result.box).toBeNull()
    expect(result.failure).toEqual({ kind: 'no-match' })
    // Both lookup paths were tried: label selector, then conventional name.
    expect(urls).toHaveLength(2)
    expect(decodeURIComponent(urls[0]!)).toContain('ts-cloud/project=uptime-status')
    expect(decodeURIComponent(urls[1]!)).toContain('name=uptime-status-production-app')
  })

  it('falls back to the conventional name when the label selector matches nothing', async () => {
    process.env.HCLOUD_TOKEN = 'token'
    stubFetch([serversResponse([]), serversResponse([runningBox])])

    const result = await resolveAttachTargetBox('statushq', 'production', {})

    expect(result.box?.serverId).toBe(501)
    expect(result.failure).toBeUndefined()
  })

  it('skips a powered-off server in favour of a running one', async () => {
    process.env.HCLOUD_TOKEN = 'token'
    stubFetch([serversResponse([
      { id: 1, name: 'old', status: 'off', public_net: { ipv4: { ip: '10.0.0.1' } } },
      runningBox,
    ])])

    expect((await resolveAttachTargetBox('uptime-status', 'production', {})).box?.serverId).toBe(501)
  })
})
