import type { DaemonStatus } from '@stacksjs/actions/daemon/server'
import type { RegisteredProject } from '@stacksjs/path'
import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTrayApi, traySnapshot } from '../src/tray/api'
import { renderTray, reviewScript } from '../src/tray/run'

const origin = 'http://127.0.0.1:54109'
const token = 'test-tray-session'
const timestamp = '2026-01-01T00:00:00Z'
const shop: RegisteredProject = { id: 'shop', name: 'Shop', path: '/code/shop', addedAt: timestamp, lastUsedAt: timestamp }
const studio: RegisteredProject = { ...shop, id: 'studio', name: 'Studio', path: '/code/studio' }
const status: DaemonStatus = {
  pid: 42,
  protocol: 3,
  startedAt: timestamp,
  dashboards: [],
  generation: {
    watched: 2,
    queued: 0,
    running: shop.path,
    approvals: [{ path: shop.path, files: 3 }],
    failures: [{ path: studio.path, error: 'Model could not load' }],
  },
}

function fixture() {
  const actions: string[] = []
  const api = createTrayApi(token, {
    status: async () => status,
    projects: () => [shop, studio],
    start: async () => { actions.push('start') },
    dashboard: async project => { actions.push(`dashboard:${project.id}`) },
    review: async project => { actions.push(`review:${project.id}`) },
    quit: () => { actions.push('quit') },
  })
  function request(path: string, body?: object, headers: HeadersInit = {}) {
    return api(new Request(`${origin}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers },
      body: body && JSON.stringify(body),
    }), origin)
  }
  return { request, actions }
}

test('maps generation and pending approvals from the existing daemon', () => {
  expect(traySnapshot(status, [shop, studio])).toEqual({
    online: true,
    watched: 2,
    running: true,
    failed: 1,
    projects: [
      { id: shop.id, name: shop.name, path: shop.path, pending: 3, issue: '' },
      { id: studio.id, name: studio.name, path: studio.path, pending: 0, issue: 'Model could not load' },
    ],
  })
  expect(traySnapshot(null, [])).toEqual({ online: false, watched: 0, running: false, failed: 0, projects: [] })
})

test('requires the private capability and rejects foreign origins before actions', async () => {
  const { request, actions } = fixture()
  expect((await request('/api/status', undefined, { authorization: '' })).status).toBe(403)
  expect((await request('/api/action', { action: 'quit' }, { origin: 'https://example.com' })).status).toBe(403)
  expect((await request('/api/action', { action: 'quit' }, { 'content-type': 'text/plain' })).status).toBe(415)
  expect(await (await request('/api/status')).json()).toEqual(traySnapshot(status, [shop, studio]))
  expect(actions).toEqual([])
})

test('opens only registered projects and requires a current approval before review', async () => {
  const { request, actions } = fixture()
  expect((await request('/api/action', { action: 'dashboard', project: '/code/shop' })).status).toBe(404)
  expect((await request('/api/action', { action: 'review', project: 'studio' })).status).toBe(409)
  expect((await request('/api/action', { action: 'commit', project: 'shop' })).status).toBe(400)
  expect((await request('/api/action', { action: 'review', project: 'shop' }, { origin })).ok).toBe(true)
  expect((await request('/api/action', { action: 'dashboard', project: 'studio' }, { origin })).ok).toBe(true)
  expect(actions).toEqual(['review:shop', 'dashboard:studio'])
})

test('review launch quotes the working directory and executable arguments', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'stacks-tray-'))
  try {
    const project = join(temp, "Shop's project")
    mkdirSync(project)
    const output = join(project, 'review output')
    const launcher = join(temp, 'launch review.command')
    const fakeCli = join(temp, "Buddy's CLI")
    await Bun.write(fakeCli, '#!/bin/sh\nprintf "%s\n" "$PWD" "$1" "$3" > "$2"\n')
    await Bun.write(launcher, reviewScript(project, ['/bin/sh', fakeCli, 'literal $(exit 1)', output]))

    expect(Bun.spawnSync(['/bin/sh', launcher]).exitCode).toBe(0)
    expect(await Bun.file(output).text()).toBe(`${project}\nliteral $(exit 1)\ngenerate:review\n`)
    expect(await Bun.file(launcher).exists()).toBe(false)
  }
  finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('renders an stx document with its generated utilities and client actions', async () => {
  const html = await renderTray()
  expect(html).toContain('<title>Buddy</title>')
  expect(html).toContain('Pending approvals')
  expect(html).toContain('/api/status')
  expect(html).toContain('.rounded-xl')
})
