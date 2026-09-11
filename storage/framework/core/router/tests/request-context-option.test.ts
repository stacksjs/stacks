import { afterAll, describe, expect, test } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'
import { getCurrentRequest, request, setAmbientRequestContext } from '../src/request-context'

/*
 * End to end, because the option has to reach three places: the scope this
 * module enters, the one bun-router enters, and the `request()` helper that
 * reads them. A unit test of the switch alone would pass with the dispatch
 * path still entering both.
 */
const router = createStacksRouter({ autoDiscoverRoutes: false, requestContext: false, csrf: false, requestIds: false })
router.get('/ctx/argument', (req: any) => ({ path: new URL(req.url).pathname }))
router.get('/ctx/ambient', () => ({ seen: getCurrentRequest() === undefined ? 'nothing' : 'a request' }))
router.get('/ctx/helper', () => {
  try {
    return { url: request.url }
  }
  catch (error) {
    return { threw: (error as Error).message }
  }
})

let server: Awaited<ReturnType<typeof router.serve>>

afterAll(() => {
  server?.stop()
  // Process-wide, so hand it back before another file's routes are built.
  setAmbientRequestContext(true)
})

async function get(path: string): Promise<any> {
  server ??= await router.serve({ port: 0, hostname: '127.0.0.1' })
  const response = await fetch(`http://127.0.0.1:${server.port}/ctx/${path}`)
  expect(response.status).toBe(200)
  return response.json()
}

describe('a router that opted out of the ambient request scope', () => {
  test('still hands the handler its request', async () => {
    expect(await get('argument')).toEqual({ path: '/ctx/argument' })
  })

  test('enters no scope for it to read', async () => {
    expect(await get('ambient')).toEqual({ seen: 'nothing' })
  })

  test('names the option when a handler reaches for the helper', async () => {
    const body = await get('helper')
    expect(body.threw).toContain('requestContext: false')
    expect(body.threw).toContain('request.url')
  })
})
