// The API server must not answer page routes.
//
// bun-router discovers `.stx` files without being asked: given no view config
// it falls back to `detectViewsDirectory()`, finds `resources/views` because
// the directory exists, and mounts a GET route for every template under it. So
// the process whose banner reads "API server ready" was serving the whole site,
// with no stylesheet and with every image 404ing, because there is no static
// handling on that port.
//
// It also reads as a bug that isn't there: a page answering 200 at a path the
// developer never routed looks like the route was overridden, when the route
// was mounted somewhere else entirely (stacksjs/stacks#2314 was reported that
// way round).
//
// These tests drive the real bun-router, not a stand-in, because the behaviour
// being switched off is bun-router's - a stand-in would pass whatever the
// upstream default became.

import { Router } from '@stacksjs/bun-router'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { configureViewDirectories, disableViewRouting } from '../src/stacks-router'

let root = ''
let previousCwd = ''

/** An app with one page template and one declared API route. */
function makeApp(): Router {
  mkdirSync(join(root, 'resources/views'), { recursive: true })
  writeFileSync(join(root, 'resources/views/index.stx'), '<h1>home</h1>\n')

  const router = new Router()
  router.get('/api/hello', () => new Response('hello world'))

  return router
}

/** Mount whatever file routing is still switched on, as `serve()` would. */
async function initFileRoutes(router: Router): Promise<void> {
  await (router as Router & { _initFileRoutes: () => Promise<void> })._initFileRoutes()
}

beforeEach(() => {
  // Through `realpathSync`: macOS puts temp directories behind a symlink
  // (`/var` -> `/private/var`), and two spellings of one directory is a
  // confusing way for a test to fail.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'api-views-')))
  previousCwd = process.cwd()
  process.chdir(root)
})

afterEach(() => {
  process.chdir(previousCwd)
  rmSync(root, { recursive: true, force: true })
})

describe('disableViewRouting', () => {
  it('stops the API server answering a path it never routed', async () => {
    const router = makeApp()

    expect(disableViewRouting(router)).toBe(true)
    await initFileRoutes(router)

    const page = await router.handleRequest(new Request('http://localhost/'))
    expect(page.status).toBe(404)
  })

  it('leaves declared routes alone', async () => {
    const router = makeApp()

    disableViewRouting(router)
    await initFileRoutes(router)

    const declared = await router.handleRequest(new Request('http://localhost/api/hello'))
    expect(declared.status).toBe(200)
    expect(await declared.text()).toBe('hello world')
  })

  it('is switching something off, not describing what already happens', async () => {
    // Without the call, the same app answers `/` with the template. If this
    // ever stops being true the test above proves nothing, so it is asserted
    // rather than assumed.
    const router = makeApp()
    await initFileRoutes(router)

    const page = await router.handleRequest(new Request('http://localhost/'))
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toContain('text/html')
  })

  it('leaves an application that asked for file routing alone', async () => {
    // The escape hatch for anyone serving pages from this process on purpose,
    // and the same "said something more specific" rule configureViewDirectories
    // follows. Route files run before this does, so asking from `routes/*.ts`
    // works.
    const router = makeApp()
    router.views({ viewsPath: join(root, 'resources/views') })

    expect(disableViewRouting(router)).toBe(false)
    await initFileRoutes(router)

    const page = await router.handleRequest(new Request('http://localhost/'))
    expect(page.status).toBe(200)
  })

  it('survives the rest of what serve() does on the way past', async () => {
    // `route.serve()` calls `configureViewDirectories()` after this, and that
    // function hands bun-router a view config of its own. It currently backs
    // off because switching file routing off leaves `_fileRoutingConfig`
    // non-empty - which is bun-router's implementation detail, not a promise
    // to us. If an upgrade moved that flag to its own field,
    // `configureViewDirectories` would overwrite the config and every `.stx`
    // would come back, with the test above still passing. So drive both, in
    // the order serve() drives them.
    const router = makeApp()

    disableViewRouting(router)
    configureViewDirectories(router)
    await initFileRoutes(router)

    const page = await router.handleRequest(new Request('http://localhost/'))
    expect(page.status).toBe(404)
  })

  it('does nothing on a router that cannot switch it off', async () => {
    // An older bun-router, where `disableFileRouting` does not exist. Reporting
    // false is the honest answer; throwing would take down a server boot over a
    // hardening step.
    const router = { get: () => {} } as unknown as Router

    expect(disableViewRouting(router)).toBe(false)
  })
})
