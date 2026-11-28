import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { registerProject } from '@stacksjs/path'
import { dashboardGitHubIssuesRoutes } from '../src/dev/dashboard-github-issues'

const endpoint = 'http://localhost:3900/__buddy/github-issues'
type IssuesHandler = ReturnType<typeof dashboardGitHubIssuesRoutes>['/__buddy/github-issues']
let sandbox: string
let previousHome: string | undefined

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'stacks-github-issues-'))
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

function project(name: string, ...remotes: Array<[string, string]>): string {
  const root = join(sandbox, name)
  mkdirSync(join(root, 'config'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
  writeFileSync(join(root, 'config/app.ts'), 'export default {}')
  expect(Bun.spawnSync(['git', 'init', '-q', root]).exitCode).toBe(0)
  for (const [remote, url] of remotes)
    expect(Bun.spawnSync(['git', '-C', root, 'remote', 'add', remote, url]).exitCode).toBe(0)
  return root
}

async function waitForSnapshot(handler: IssuesHandler, ready: (snapshot: Awaited<ReturnType<Response['json']>>) => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await handler(new Request(`${endpoint}?poll=1`))
    expect(response.status).toBe(200)
    const snapshot = await response.json()
    if (ready(snapshot))
      return snapshot
    await Bun.sleep(5)
  }
  throw new Error('Timed out waiting for GitHub issues')
}

test('combines all GitHub issue pages from the current and registered local projects', async () => {
  const root = project('shop', ['origin', 'git@github.com:stacksjs/shop.git'])
  registerProject(project('shop-copy', ['origin', 'https://github.com/StacksJS/Shop']))
  registerProject(project('blog', ['origin', 'https://gitlab.com/example/blog'], ['upstream', 'https://github.com/stacksjs/blog']))
  registerProject(project('docs'))
  registerProject(project('private', ['origin', 'https://github.com/stacksjs/private']))
  const missing = project('missing', ['origin', 'https://github.com/stacksjs/missing'])
  registerProject(missing)
  rmSync(missing, { recursive: true })

  const issue = (number: number, state: string, day: string) => ({
    id: number, number, state, title: `Issue ${number}`, updated_at: `2026-10-${day}T00:00:00Z`, labels: [{ name: 'bug' }],
  })
  const paths: string[] = []
  const secondPage = Promise.withResolvers<void>()
  const fetcher: typeof fetch = async (input, options) => {
    const url = new URL(String(input))
    expect(url.origin).toBe('https://api.github.com')
    expect(url.searchParams.get('state')).toBe('all')
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-token')
    const path = `${url.pathname}:${url.searchParams.get('page')}`
    paths.push(path)
    switch (path) {
      case '/repos/stacksjs/shop/issues:1':
        return Response.json([issue(1, 'open', '04'), { ...issue(2, 'open', '06'), pull_request: {} }], {
          headers: { link: '<https://api.github.com/repositories/123/issues?page=2>; rel="next"' },
        })
      case '/repos/stacksjs/shop/issues:2':
        await secondPage.promise
        return Response.json([issue(3, 'closed', '02')])
      case '/repos/stacksjs/blog/issues:1':
        return Response.json([issue(4, 'open', '05')])
      default:
        return Response.json({}, { status: 404 })
    }
  }
  const handler = dashboardGitHubIssuesRoutes({ root, port: 3900, url: () => 'https://dashboard.shop.localhost', fetch: fetcher, resolveToken: () => 'fixture-token' })['/__buddy/github-issues']
  const response = await handler(new Request(endpoint))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({ loading: true })
  const partial = await waitForSnapshot(handler, snapshot => snapshot.issues.length === 2)
  expect(partial.loading).toBe(true)
  secondPage.resolve()
  const body = await waitForSnapshot(handler, snapshot => !snapshot.loading)
  expect(body.issues.map(({ number, state, repository }: { number: number, state: string, repository: string }) => [number, state, repository]))
    .toEqual([[4, 'open', 'stacksjs/blog'], [1, 'open', 'stacksjs/shop'], [3, 'closed', 'stacksjs/shop']])
  expect(body.issues[0]).toMatchObject({ url: 'https://github.com/stacksjs/blog/issues/4', labels: ['bug'] })
  expect(body.projects).toEqual(expect.arrayContaining([
    { id: 'shop', name: 'shop', repository: 'stacksjs/shop' },
    { id: 'shop-copy', name: 'shop-copy', repository: 'stacksjs/shop' },
    { id: 'docs', name: 'docs', repository: null },
  ]))
  expect(body.failures).toEqual([{ repository: 'stacksjs/private', message: expect.any(String) }])
  expect(paths.sort()).toEqual(['/repos/stacksjs/blog/issues:1', '/repos/stacksjs/private/issues:1', '/repos/stacksjs/shop/issues:1', '/repos/stacksjs/shop/issues:2'])

  await handler(new Request(endpoint))
  expect(paths).toHaveLength(4)
  await handler(new Request(`${endpoint}?refresh=1`))
  await waitForSnapshot(handler, snapshot => !snapshot.loading)
  expect(paths).toHaveLength(8)
})

test('keeps issue data on the local dashboard origin and reads public repositories without a token', async () => {
  const root = project('shop', ['origin', 'https://github.com/stacksjs/shop'])
  let requests = 0
  const fetcher: typeof fetch = async (_input, options) => {
    requests++
    expect(new Headers(options?.headers).get('authorization')).toBeNull()
    return Response.json([])
  }
  const handler = dashboardGitHubIssuesRoutes({ root, port: 3900, url: () => 'https://dashboard.shop.localhost', fetch: fetcher, resolveToken: () => null })['/__buddy/github-issues']

  expect((await handler(new Request(endpoint, { headers: { origin: 'https://example.com' } }))).status).toBe(403)
  expect((await handler(new Request(endpoint, { headers: { 'sec-fetch-site': 'same-site' } }))).status).toBe(403)
  expect((await handler(new Request('http://example.com:3900/__buddy/github-issues'))).status).toBe(403)
  expect((await handler(new Request(endpoint, { method: 'POST' }))).status).toBe(405)
  expect(requests).toBe(0)

  const response = await handler(new Request('http://dashboard.shop.localhost/__buddy/github-issues', {
    headers: { origin: 'https://dashboard.shop.localhost', 'sec-fetch-site': 'same-origin' },
  }))
  expect(response.status).toBe(200)
  expect(await waitForSnapshot(handler, snapshot => !snapshot.loading)).toMatchObject({ issues: [], failures: [] })
  expect(requests).toBe(1)
})
