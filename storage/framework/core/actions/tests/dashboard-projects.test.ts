import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { listProjects, recordProjectService, registerProject } from '@stacksjs/path'
import { createIdleExit, displayPath, projectSwitcherRoutes } from '../src/dev/dashboard-projects'
import { shouldDelegateDashboardRequest } from '../src/dev/dashboard-request-routing'

let sandbox: string
let previousHome: string | undefined

function makeProject(name: string): string {
  const root = join(sandbox, name)
  mkdirSync(join(root, 'config'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
  writeFileSync(join(root, 'config/app.ts'), 'export default {}')
  return realpathSync(root)
}

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-switcher-')))
  previousHome = process.env.STACKS_HOME
  process.env.STACKS_HOME = join(sandbox, '.stacks')
})

afterEach(() => {
  if (previousHome === undefined)
    delete process.env.STACKS_HOME
  else
    process.env.STACKS_HOME = previousHome
  rmSync(sandbox, { recursive: true, force: true })
})

function routes(root: string, overrides: Partial<Parameters<typeof projectSwitcherRoutes>[0]> = {}) {
  const opened: string[] = []
  const handlers = projectSwitcherRoutes({
    root,
    url: 'http://localhost:3900',
    idleExitMs: 0,
    validateWrite: async () => {},
    openDashboard: async (project) => {
      opened.push(project)
      return { url: 'http://localhost:3901' }
    },
    ...overrides,
  })

  const post = (path: string, body: unknown) => handlers[path]!(new Request(`http://localhost:3900${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
  const get = (path: string) => handlers[path]!(new Request(`http://localhost:3900${path}`))

  return { handlers, opened, post, get }
}

describe('the project list a dashboard serves', () => {
  it('puts its own project first and marks which others have a dashboard up', async () => {
    const shop = makeProject('shop')
    const blog = makeProject('blog')
    const docs = makeProject('docs')
    registerProject(blog, new Date('2026-01-02T00:00:00Z'))
    registerProject(docs, new Date('2026-01-01T00:00:00Z'))
    recordProjectService(blog, { name: 'dashboard', pid: process.pid, port: 3905, url: 'http://localhost:3905', startedAt: '2026-01-02T00:00:00.000Z' })

    const listing = await (await routes(shop).get('/__buddy/projects')).json()

    expect(listing.ok).toBe(true)
    expect(listing.current).toMatchObject({ name: 'shop', current: true, running: true, url: 'http://localhost:3900' })
    expect(listing.projects.map((project: { name: string }) => project.name)).toEqual(['shop', 'blog', 'docs'])
    expect(listing.projects[1]).toMatchObject({ id: 'blog', current: false, running: true, url: 'http://localhost:3905' })
    expect(listing.projects[2]).toMatchObject({ id: 'docs', running: false, url: null })
    // Served straight from source, the dashboard put its own project on the list.
    expect(listProjects().map(project => project.name)).toContain('shop')
  })

  it('does not offer a project whose directory is gone', async () => {
    const shop = makeProject('shop')
    const gone = makeProject('gone')
    registerProject(gone)
    rmSync(gone, { recursive: true, force: true })

    const listing = await (await routes(shop).get('/__buddy/projects')).json()
    expect(listing.projects.map((project: { name: string }) => project.name)).toEqual(['shop'])
  })

  it('asks an open page to report in only when the server stops itself when idle', async () => {
    const shop = makeProject('shop')

    expect((await (await routes(shop).get('/__buddy/projects')).json()).keepAliveMs).toBeNull()
    expect((await (await routes(shop, { idleExitMs: 900_000 }).get('/__buddy/projects')).json()).keepAliveMs).toBe(60_000)
    // Never so rarely that the server could give up between two reports.
    expect((await (await routes(shop, { idleExitMs: 30_000 }).get('/__buddy/projects')).json()).keepAliveMs).toBe(10_000)
    expect((await routes(shop).get('/__buddy/alive')).status).toBe(204)
  })

  it('writes a home directory the way a person does', () => {
    expect(displayPath('/Users/chris/Code/shop', '/Users/chris')).toBe('~/Code/shop')
    expect(displayPath('/Users/chris', '/Users/chris')).toBe('~')
    expect(displayPath('/Users/christine/shop', '/Users/chris')).toBe('/Users/christine/shop')
  })
})

describe('opening another project', () => {
  it('brings its dashboard up and answers with where it is', async () => {
    const shop = makeProject('shop')
    const blog = makeProject('blog')
    registerProject(blog, new Date('2026-01-01T00:00:00Z'))
    const { post, opened } = routes(shop)

    const response = await post('/__buddy/projects/open', { id: 'blog' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, url: 'http://localhost:3901' })
    expect(opened).toEqual([blog])
    // Opened just now: it is the most recently used project.
    expect(listProjects()[0]!.name).toBe('blog')
  })

  it('refuses a write that did not come from the dashboard\'s own page', async () => {
    const shop = makeProject('shop')
    registerProject(makeProject('blog'))
    const { post, opened } = routes(shop, {
      validateWrite: async () => {
        throw Object.assign(new Error('CSRF token mismatch'), { status: 403 })
      },
    })

    expect((await post('/__buddy/projects/open', { id: 'blog' })).status).toBe(403)
    expect((await post('/__buddy/projects/add', { path: shop })).status).toBe(403)
    expect(opened).toEqual([])
  })

  it('answers an unknown project and a failed start with the reason', async () => {
    const shop = makeProject('shop')
    registerProject(makeProject('blog'))

    expect((await routes(shop).post('/__buddy/projects/open', { id: 'nowhere' })).status).toBe(404)

    const failing = routes(shop, {
      openDashboard: async () => {
        throw Object.assign(new Error('blog has no `./buddy` to start a dashboard with.'), { status: 409 })
      },
    })
    const response = await failing.post('/__buddy/projects/open', { id: 'blog' })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ ok: false, error: 'blog has no `./buddy` to start a dashboard with.' })
  })

  it('only takes a POST', async () => {
    const shop = makeProject('shop')
    expect((await routes(shop).get('/__buddy/projects/open')).status).toBe(405)
  })
})

describe('adding a project', () => {
  it('lists the project a path is in, wherever in it the path points', async () => {
    const shop = makeProject('shop')
    const blog = makeProject('blog')
    mkdirSync(join(blog, 'app/Models'), { recursive: true })

    const response = await routes(shop).post('/__buddy/projects/add', { path: join(blog, 'app/Models') })

    expect(response.status).toBe(200)
    expect((await response.json()).project).toMatchObject({ id: 'blog', name: 'blog' })
    expect(listProjects().map(project => project.path)).toContain(blog)
  })

  it('says so when there is no project there', async () => {
    const shop = makeProject('shop')
    const empty = join(sandbox, 'empty')
    mkdirSync(empty)

    const response = await routes(shop).post('/__buddy/projects/add', { path: empty })
    expect(response.status).toBe(422)
    expect((await response.json()).error).toContain('There is no Stacks project at')
    expect((await routes(shop).post('/__buddy/projects/add', { path: '  ' })).status).toBe(422)
  })
})

describe('where the dev dashboard sends a request', () => {
  it('keeps the switcher\'s routes, writes included, away from the application\'s router', () => {
    expect(shouldDelegateDashboardRequest('/__buddy/projects', 'GET')).toBe(false)
    expect(shouldDelegateDashboardRequest('/__buddy/projects/open', 'POST')).toBe(false)
    // An application's own `/api/projects` is still the application's.
    expect(shouldDelegateDashboardRequest('/api/projects', 'GET')).toBe(true)
  })
})

describe('stopping when nobody is using it', () => {
  function clock() {
    let time = 0
    return { now: () => time, advance: (ms: number) => { time += ms } }
  }

  it('fires once the limit passes without a touch, and not before', async () => {
    const { now, advance } = clock()
    let fired = 0
    // 1s limit, checked every 250ms.
    const idle = createIdleExit(1_000, () => fired++, now)

    advance(500)
    await Bun.sleep(300)
    expect(fired).toBe(0)

    advance(600)
    await Bun.sleep(300)
    expect(fired).toBe(1)
    idle.stop()
  })

  it('starts counting again from every touch', async () => {
    const { now, advance } = clock()
    let fired = 0
    const idle = createIdleExit(1_000, () => fired++, now)

    advance(900)
    idle.touch()
    advance(900)
    await Bun.sleep(300)
    expect(fired).toBe(0)
    idle.stop()
  })

  it('does not count the time a laptop spent asleep', async () => {
    const { now, advance } = clock()
    let fired = 0
    const idle = createIdleExit(1_000, () => fired++, now)

    // Eight hours pass between two checks: the machine was not running.
    advance(8 * 60 * 60 * 1000)
    await Bun.sleep(300)
    expect(fired).toBe(0)

    // Awake and still unused for the full limit, one check at a time: now it goes.
    for (let check = 0; check < 5 && fired === 0; check++) {
      advance(250)
      await Bun.sleep(260)
    }
    expect(fired).toBe(1)
    idle.stop()
  })

  it('does nothing at all without a limit', async () => {
    let fired = 0
    const idle = createIdleExit(0, () => fired++)
    await Bun.sleep(50)
    idle.touch()
    idle.stop()
    expect(fired).toBe(0)
  })
})
