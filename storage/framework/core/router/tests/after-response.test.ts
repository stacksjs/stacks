/**
 * Callbacks that run once the answer is known.
 *
 * The other half of what a pre-action middleware pipeline cannot do. The header
 * seam covers "put this on the response"; this covers "record that this
 * happened", which is the case metrics need - a middleware can time the start
 * of a request and has no way to learn its status or duration.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

let server: any = null
let port = 0

const seen: Array<{ status: number, durationMs: number }> = []

beforeAll(async () => {
  const { route } = await import('../src')

  route.get('/_after_ok', (request: any) => {
    request._afterResponse = [(outcome: any) => seen.push(outcome)]

    return new Response('ok', { status: 200 })
  })

  route.get('/_after_bad', (request: any) => {
    request._afterResponse = [(outcome: any) => seen.push(outcome)]

    return new Response('no', { status: 422 })
  })

  route.get('/_after_throws', (request: any) => {
    request._afterResponse = [
      () => { throw new Error('the observer broke') },
      (outcome: any) => seen.push(outcome),
    ]

    return new Response('ok', { status: 200 })
  })

  server = await route.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)
})

afterAll(() => {
  server?.stop?.()
})

describe('an after-response callback', () => {
  it('is told the status', async () => {
    seen.length = 0
    await fetch(`http://127.0.0.1:${port}/_after_ok`)

    expect(seen[0]?.status).toBe(200)
  })

  it('and a status it could not have guessed', async () => {
    // The point: the pipeline runs before the action, so 422 is knowable only
    // afterwards.
    seen.length = 0
    await fetch(`http://127.0.0.1:${port}/_after_bad`)

    expect(seen[0]?.status).toBe(422)
  })

  it('and how long it took', async () => {
    seen.length = 0
    await fetch(`http://127.0.0.1:${port}/_after_ok`)

    expect(typeof seen[0]?.durationMs).toBe('number')
  })
})

describe('a callback that throws', () => {
  it('does not take the response with it', async () => {
    /*
     * An observation is worth less than the request it observes. A metrics
     * callback that throws turning a served request into a 500 would be the
     * instrument causing the outage it exists to report.
     */
    seen.length = 0
    const answer = await fetch(`http://127.0.0.1:${port}/_after_throws`)

    expect(answer.status).toBe(200)
    expect(await answer.text()).toBe('ok')
  })

  it('and the others still run', async () => {
    seen.length = 0
    await fetch(`http://127.0.0.1:${port}/_after_throws`)

    expect(seen).toHaveLength(1)
  })
})
