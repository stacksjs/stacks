/**
 * Every request gets an id.
 *
 * The router already echoed `X-Request-ID`, stitched it into JSON error bodies,
 * and used it as the implicit trace for background work - all of it guarded on
 * `_requestId` being set, and nothing ever set it. A complete read path with no
 * writer: the header never appeared, error bodies carried no id, and every
 * queued job logged under an id of its own.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

let server: any = null
let port = 0

beforeAll(async () => {
  const { route } = await import('../src')

  route.get('/_rid', (request: any) => Response.json({ seen: request._requestId }))
  route.get('/_rid_boom', () => Response.json({ error: 'nope' }, { status: 500 }))

  server = await route.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)
})

afterAll(() => {
  server?.stop?.()
})

describe('a request', () => {
  it('gets an id, echoed to the client', async () => {
    const answer = await fetch(`http://127.0.0.1:${port}/_rid`)
    const body: any = await answer.json()

    expect(answer.headers.get('X-Request-ID')).toBeTruthy()
    // The same one the handler saw, or the header is useless for correlating.
    expect(answer.headers.get('X-Request-ID')).toBe(body.seen)
  })

  it('and a different one each time', async () => {
    const first = await fetch(`http://127.0.0.1:${port}/_rid`)
    const second = await fetch(`http://127.0.0.1:${port}/_rid`)

    expect(first.headers.get('X-Request-ID')).not.toBe(second.headers.get('X-Request-ID'))
  })
})

describe('an inbound id', () => {
  it('is honoured, so a trace survives a proxy', async () => {
    // Correlating one request across a proxy and two services is the entire
    // point of having an id at all.
    const answer = await fetch(`http://127.0.0.1:${port}/_rid`, {
      headers: { 'X-Request-ID': 'edge-7f3a9c21' },
    })

    expect(answer.headers.get('X-Request-ID')).toBe('edge-7f3a9c21')
  })

  it('is ignored when it is not one we would repeat', async () => {
    /*
     * This string is written into log lines verbatim. An unbounded one from a
     * stranger is log injection with extra steps, so anything outside the
     * alphabet ids actually use is replaced rather than trusted.
     */
    const answer = await fetch(`http://127.0.0.1:${port}/_rid`, {
      headers: { 'X-Request-ID': 'a b evil=1' },
    })

    expect(answer.headers.get('X-Request-ID')).not.toContain('evil')
  })

  it('and so is one long enough to be a payload', async () => {
    const answer = await fetch(`http://127.0.0.1:${port}/_rid`, {
      headers: { 'X-Request-ID': 'x'.repeat(5000) },
    })

    expect((answer.headers.get('X-Request-ID') ?? '').length).toBeLessThan(200)
  })

  it('and one too short to be meaningful', async () => {
    // Eight characters is the floor: shorter ids collide, and a collision is
    // worse than no id because it joins two unrelated requests.
    const answer = await fetch(`http://127.0.0.1:${port}/_rid`, {
      headers: { 'X-Request-ID': 'abc' },
    })

    expect(answer.headers.get('X-Request-ID')).not.toBe('abc')
  })
})

describe('an error body', () => {
  it('carries the id, so a bug report is one grep', async () => {
    const answer = await fetch(`http://127.0.0.1:${port}/_rid_boom`)
    const body: any = await answer.json()

    expect(body.request_id).toBe(answer.headers.get('X-Request-ID'))
  })
})
