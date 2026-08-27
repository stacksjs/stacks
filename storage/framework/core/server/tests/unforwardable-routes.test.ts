/**
 * stacksjs/stacks#2326 - a root-mounted `GET` is registered in the API
 * process and answered in the views process, and with default rules the views
 * server forwards only `/api/**` and the mutating verbs. So `route.post('/ingest')`
 * works, `route.get('/ingest/verify')` renders as a page, finds no page, and
 * returns the view 404. The handler never runs and nothing says so.
 *
 * The views server cannot consult the route table (different process, possibly
 * a different host), so it cannot fix this at request time. The API process
 * has both the table and the config, so it can say so at boot.
 */

import { describe, expect, it } from 'bun:test'
import { describeUnforwardableRoutes, resolveApiProxyRules, unforwardableRoutes } from '../src/proxy'

const defaults = resolveApiProxyRules()

describe('unforwardableRoutes', () => {
  it('flags a root-mounted GET that no rule forwards', () => {
    const routes = [{ method: 'GET', path: '/ingest/verify' }]

    expect(unforwardableRoutes(routes, defaults)).toEqual(routes)
  })

  it('says nothing about the POST beside it, which the verb rule forwards', () => {
    // The asymmetry in the report: same file, same prefix, one verb reachable.
    expect(unforwardableRoutes([{ method: 'POST', path: '/ingest' }], defaults)).toEqual([])
  })

  it('says nothing about a prefixed route', () => {
    expect(unforwardableRoutes([{ method: 'GET', path: '/api/hello' }], defaults)).toEqual([])
  })

  it('goes quiet once the path is configured, which is the fix it recommends', () => {
    const rules = resolveApiProxyRules({ paths: ['/ingest/verify'] })

    expect(unforwardableRoutes([{ method: 'GET', path: '/ingest/verify' }], rules)).toEqual([])
  })

  it('goes quiet once the prefix is configured', () => {
    const rules = resolveApiProxyRules({ prefixes: ['/ingest'] })

    expect(unforwardableRoutes([{ method: 'GET', path: '/ingest/verify' }], rules)).toEqual([])
  })
})

describe('describeUnforwardableRoutes', () => {
  it('names each route, its file, and the config key that fixes it', () => {
    const message = describeUnforwardableRoutes([
      { method: 'GET', path: '/ingest/verify', file: 'routes/ingest.ts' },
    ])

    expect(message).toContain('GET /ingest/verify')
    expect(message).toContain('routes/ingest.ts')
    expect(message).toContain('proxy.paths')
    expect(message).toContain('config/server.ts')
  })

  it('agrees with itself about how many routes it found', () => {
    const one = describeUnforwardableRoutes([{ method: 'GET', path: '/a' }])
    const two = describeUnforwardableRoutes([{ method: 'GET', path: '/a' }, { method: 'GET', path: '/b' }])

    expect(one).toContain('1 root-mounted route the')
    expect(two).toContain('2 root-mounted routes the')
  })
})
