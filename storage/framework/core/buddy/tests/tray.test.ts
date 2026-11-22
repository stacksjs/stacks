import type { DaemonStatus } from '@stacksjs/actions/daemon/server'
import type { RegisteredProject } from '@stacksjs/path'
import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTrayApi, traySnapshot } from '../src/tray/api'
import { renderTray, reviewScript } from '../src/tray/run'
import { activeMemoryBytes, createCpuSampler } from '../src/tray/system'

const origin = 'http://127.0.0.1:54109'
const craftOrigin = 'http://localhost'
const token = 'test-tray-session'
const timestamp = '2026-01-01T00:00:00Z'
const shop: RegisteredProject = { id: 'shop', name: 'Shop', path: '/code/shop', addedAt: timestamp, lastUsedAt: timestamp }
const studio: RegisteredProject = { ...shop, id: 'studio', name: 'Studio', path: '/code/studio' }
const system = { cpu: 12, memory: { used: 4096, total: 8192, raw: false } }
const status: DaemonStatus = {
  pid: 42,
  protocol: 3,
  startedAt: timestamp,
  dashboards: [{ name: shop.name, path: shop.path, url: 'https://shop.test', port: 3910, pid: 43, state: 'ready', startedAt: timestamp }],
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
    system: async () => system,
    pantry: {
      status: async () => ({ state: 'pair' }),
      catalog: query => [{ name: query, domain: 'bun.com' }],
      jobs: async () => [],
      pair: async () => { actions.push('pantry:pair') },
      disconnect: async () => { actions.push('pantry:disconnect') },
      change: async (operation, domain, id) => {
        actions.push(`pantry:${operation}:${domain}`)
        return { id, domain, status: 'queued', operation, error: undefined }
      },
    },
  }, craftOrigin)
  function request(path: string, body?: object, headers: HeadersInit = {}) {
    return api(new Request(`${origin}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers },
      body: body && JSON.stringify(body),
    }), origin)
  }
  return { api, request, actions }
}

test('maps generation and pending approvals from the existing daemon', () => {
  expect(traySnapshot(status, [shop, studio])).toEqual({
    online: true,
    watched: 2,
    running: true,
    failed: 1,
    projects: [
      { id: shop.id, name: shop.name, path: shop.path, pending: 3, issue: '', dashboard: 'ready' },
      { id: studio.id, name: studio.name, path: studio.path, pending: 0, issue: 'Model could not load', dashboard: 'stopped' },
    ],
  })
  expect(traySnapshot(null, [])).toEqual({ online: false, watched: 0, running: false, failed: 0, projects: [] })
})

test('requires the private capability and rejects foreign origins before actions', async () => {
  const { request, actions } = fixture()
  expect((await request('/api/status', undefined, { authorization: '' })).status).toBe(403)
  expect((await request('/api/action', { action: 'quit' }, { origin: 'https://example.com' })).status).toBe(403)
  expect((await request('/api/action', { action: 'quit' }, { 'content-type': 'text/plain' })).status).toBe(415)
  expect(await (await request('/api/status')).json()).toEqual({ ...traySnapshot(status, [shop, studio]), system })
  expect(actions).toEqual([])
})

test('answers preflight for the inline Craft view and still requires its capability', async () => {
  const { api, request, actions } = fixture()
  const address = `${origin}/api/action`
  const makePreflight = (origin: string) => new Request(address, { method: 'OPTIONS', headers: { origin } })
  expect((await api(makePreflight('https://example.com'), origin)).status).toBe(403)
  const preflight = await api(makePreflight(craftOrigin), origin)
  expect(preflight.status).toBe(204)
  expect(preflight.headers.get('access-control-allow-origin')).toBe(craftOrigin)
  expect((await request('/api/action', { action: 'quit' }, { origin: craftOrigin, authorization: '' })).status).toBe(403)
  expect(actions).toEqual([])
})

test('uses bounded Pantry requests and returns queued jobs', async () => {
  const { request, actions } = fixture()
  const requestId = '135814d3-83a6-4554-8dcf-d7e9df1a931d'
  expect(await (await request('/api/pantry')).json()).toEqual({ state: 'pair' })
  expect(await (await request('/api/pantry/catalog?q=bun')).json()).toEqual([{ name: 'bun', domain: 'bun.com' }])
  expect((await request('/api/action', { action: 'pantry:install', domain: 'bun.com', requestId }, { authorization: '' })).status).toBe(403)
  expect((await request('/api/action', { action: 'pantry:pair', code: '1234' })).status).toBe(400)
  expect((await request('/api/action', { action: 'pantry:install', domain: '-flag', requestId })).status).toBe(400)
  expect((await request('/api/action', { action: 'pantry:install', domain: 'bun.com', requestId: 'missing' })).status).toBe(400)
  expect((await request('/api/action', { action: 'pantry:pair', code: '12345678' })).ok).toBe(true)
  const job = await request('/api/action', { action: 'pantry:uninstall', domain: 'bun.com', requestId })
  expect(job.status).toBe(202)
  expect(await job.json()).toMatchObject({ status: 'queued', id: requestId })
  expect(actions).toEqual(['pantry:pair', 'pantry:uninstall:bun.com'])
})

test('calculates CPU utilization from tick deltas and memory from native page counts', () => {
  const ticks = { user: 1000, nice: 0, sys: 0, idle: 1000, irq: 0 }
  const sample = createCpuSampler(() => [{ model: 'test', speed: 0, times: ticks }])
  expect(sample()).toBeNull()
  ticks.user += 10
  ticks.idle += 30
  expect(sample()).toBe(25)
  expect(sample()).toBe(25)
  expect(activeMemoryBytes('page size of 16384 bytes\nPages active: 3.\nPages wired down: 2.\nPages occupied by compressor: 1.')).toBe(98_304)
  expect(activeMemoryBytes('partial output')).toBeUndefined()
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
  expect(html).toContain('System usage')
  expect(html).toContain('Connect Pantry')
  expect(html).toContain('.rounded-xl')
})
