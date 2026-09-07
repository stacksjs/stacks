import type { Router } from '@stacksjs/bun-router'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { createStacksRouter } from '../src/stacks-router'

let root = ''
let previousCwd = ''

async function discoverRoutes(router: Router): Promise<void> {
  await (router as Router & { _initApiRoutes: () => Promise<void> })._initApiRoutes()
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'api-routes-')))
  previousCwd = process.cwd()
  process.chdir(root)
  mkdirSync(join(root, 'routes'))
  writeFileSync(join(root, 'routes', 'probe.ts'), `
export default function register(router: any) {
  router.get('/discovered', () => new Response('discovered'))
}
`)
})

afterEach(() => {
  process.chdir(previousCwd)
  rmSync(root, { recursive: true, force: true })
})

describe('createStacksRouter route discovery', () => {
  it('discovers route files by default', async () => {
    const router = createStacksRouter({ csrf: false, requestIds: false })

    await discoverRoutes(router.bunRouter)

    expect(router.routes.map(route => route.path)).toContain('/probe/discovered')
  })

  it('can serve only routes registered programmatically', async () => {
    const router = createStacksRouter({
      autoDiscoverRoutes: false,
      csrf: false,
      requestIds: false,
    })
    router.get('/declared', () => 'declared')

    await discoverRoutes(router.bunRouter)

    expect(router.routes.map(route => route.path)).toEqual(['/declared'])
  })
})
