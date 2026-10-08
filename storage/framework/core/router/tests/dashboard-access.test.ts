/**
 * Role gating for the framework's own dashboard route groups
 * (stacksjs/stacks#2883).
 *
 * The 24 groups in `defaults/routes/dashboard.ts` shipped `middleware: 'auth'`
 * and nothing more, and an app had no way to tighten that: the file is
 * framework-owned, there is no global middleware stack, and nothing attached
 * middleware to a path. So `/api/commerce`, `/cms` and `/models` were reachable
 * by any signed-in user whatever the sidebar showed them.
 *
 * The group list now exists in three places - this runtime array, the
 * `DashboardRouteGroup` union apps type their config against, and the route
 * file itself. That is a mirror, and mirrors drift, so the first test here
 * compares all three. A group added to the routes file and not to the list is a
 * group an app silently cannot gate.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { DASHBOARD_ROUTE_GROUPS, dashboardGroupMiddleware, describeUnknownDashboardGroups, resolveDashboardAccess } from '../src/dashboard-access'

const framework = join(import.meta.dir, '..', '..', '..')

describe('the dashboard route group list', () => {
  it('matches the prefixes defaults/routes/dashboard.ts registers', () => {
    const source = readFileSync(join(framework, 'defaults', 'routes', 'dashboard.ts'), 'utf8')
    const registered = [...source.matchAll(/route\.group\(\{[^}]*?prefix:\s*'([^']+)'/g)]
      .map(match => match[1])
      .sort()

    // Every group carries a prefix, so none is unreachable from config. The
    // AI group had none until this issue: its routes are `/ai/ask` and
    // `/ai/summary`, so it became `prefix: '/ai'` with the same two URLs.
    expect(registered.length).toBe(24)
    expect([...new Set(registered)]).toEqual([...DASHBOARD_ROUTE_GROUPS].sort())
  })

  it('matches the DashboardRouteGroup union apps type their config against', () => {
    const types = readFileSync(join(framework, 'core', 'types', 'src', 'dashboard.ts'), 'utf8')
    const block = types.slice(types.indexOf('export type DashboardRouteGroup ='))
    const declared = [...block.slice(0, block.indexOf('export interface')).matchAll(/'([^']+)'/g)]
      .map(match => match[1])
      .sort()

    expect(declared).toEqual([...DASHBOARD_ROUTE_GROUPS].sort())
  })

  it('leaves every group on auth alone, so an upgrade changes no app', () => {
    const source = readFileSync(join(framework, 'defaults', 'routes', 'dashboard.ts'), 'utf8')

    // The framework declares no `access` of its own; the default config file
    // carries the key commented or absent. If a default ever lands here, every
    // app inherits a role requirement it never asked for.
    const config = readFileSync(join(framework, '..', '..', 'config', 'dashboard.ts'), 'utf8')
    expect(config).not.toMatch(/^\s*access:\s*\{\s*'/m)

    // And every group still routes through the shared helper rather than a
    // hardcoded list, so none is left behind when one is gated.
    expect(source).toContain('dashboardGroupMiddleware(')
  })
})

describe('resolveDashboardAccess', () => {
  it('reads a prefix to its roles', () => {
    const { roles, unknown } = resolveDashboardAccess({ '/api/commerce': ['admin', 'superadmin'] })

    expect(roles.get('/api/commerce')).toEqual(['admin', 'superadmin'])
    expect(unknown).toEqual([])
  })

  it('accepts a bare string as a one-role list', () => {
    expect(resolveDashboardAccess({ '/cms': 'admin' }).roles.get('/cms')).toEqual(['admin'])
  })

  it('trims names and drops blank or non-string ones', () => {
    const { roles } = resolveDashboardAccess({ '/cms': [' admin ', '', 42, null, 'editor'] })

    expect(roles.get('/cms')).toEqual(['admin', 'editor'])
  })

  it('treats an empty role list as unset, not as nobody', () => {
    // An app must not be able to lock itself out of its own dashboard with [].
    expect(resolveDashboardAccess({ '/cms': [] }).roles.has('/cms')).toBe(false)
    expect(resolveDashboardAccess({ '/cms': ['', '  '] }).roles.has('/cms')).toBe(false)
  })

  it('collects a key naming no known group rather than ignoring it', () => {
    // A typo'd prefix would otherwise read as a gate that is quietly absent,
    // which is the failure this surface exists to stop.
    const { roles, unknown } = resolveDashboardAccess({ '/api/commmerce': ['admin'], '/cms': ['admin'] })

    expect(unknown).toEqual(['/api/commmerce'])
    expect(roles.get('/cms')).toEqual(['admin'])
  })

  it('survives a malformed config rather than taking the dashboard down', () => {
    // This runs at route-registration time on a value an app wrote.
    for (const configured of [undefined, null, 42, 'admin', [], ['/cms'], true])
      expect(resolveDashboardAccess(configured)).toEqual({ roles: new Map(), unknown: [] })
  })
})

describe('dashboardGroupMiddleware', () => {
  it('leaves an ungated group on its base', () => {
    const access = resolveDashboardAccess({ '/cms': ['admin'] })

    expect(dashboardGroupMiddleware('/api/commerce', access)).toEqual(['auth'])
  })

  it('appends one any-of entry after the base, so auth runs first', () => {
    const access = resolveDashboardAccess({ '/cms': ['admin', 'editor'] })

    expect(dashboardGroupMiddleware('/cms', access)).toEqual(['auth', 'role:admin,editor'])
  })

  it('keeps a group whose base is more than auth', () => {
    const access = resolveDashboardAccess({ '/cms': ['admin'] })

    expect(dashboardGroupMiddleware('/cms', access, ['auth', 'team'])).toEqual(['auth', 'team', 'role:admin'])
  })

  it('returns a fresh array, so one group cannot mutate another', () => {
    const access = resolveDashboardAccess({})
    const base = ['auth']

    expect(dashboardGroupMiddleware('/cms', access, base)).not.toBe(base)
  })
})

describe('describeUnknownDashboardGroups', () => {
  it('is null when every key named a real group', () => {
    expect(describeUnknownDashboardGroups([])).toBeNull()
  })

  it('names what gated nothing, and what the valid prefixes are', () => {
    const message = describeUnknownDashboardGroups(['/typo', '/api/commmerce'])

    expect(message).toContain('/typo')
    expect(message).toContain('/api/commmerce')
    expect(message).toContain('/api/commerce')
  })
})

/**
 * What the groups actually register, read out of a fresh process.
 *
 * The decisions above are pure and unit-tested; this is the half that is not.
 * Registration happens at module-import time off a config file, so the only
 * honest check is to boot it and look - and it has to be a subprocess, because
 * importing this route table into the test process registers 319 routes into
 * the shared router singleton and once hung 77 tests in this suite.
 */
describe('the registered dashboard groups', () => {
  const projectRoot = join(import.meta.dir, '../../../../..')
  const fixture = join(import.meta.dir, 'fixtures/print-dashboard-guards.ts')

  async function registered(): Promise<Array<{ route: string, middleware: string[] }>> {
    const proc = Bun.spawn(['bun', fixture], { cwd: projectRoot, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0)

    const lines = stdout.trim().split('\n')
    return JSON.parse(lines[lines.length - 1])
  }

  it('keeps auth on every route in a group, with no access configured', async () => {
    // The floor. `access` adds a role on top of `auth`; it must never be able
    // to replace it, and the framework ships no `access` of its own.
    const rows = await registered()
    const inGroups = rows.filter(row => DASHBOARD_ROUTE_GROUPS.some(prefix => row.route.includes(` ${prefix}/`) || row.route.endsWith(` ${prefix}`)))

    expect(inGroups.length).toBeGreaterThan(200)
    expect(inGroups.filter(row => !row.middleware.includes('auth')).map(row => row.route)).toEqual([])
  }, 60_000)

  it('gates the AI endpoints, which reach the configured LLM provider', async () => {
    // Asserted behaviourally here rather than as source text in
    // tests/unit/ai-action-contract.test.ts, which pinned the group's option
    // spelling and broke when the group took a prefix.
    const rows = await registered()
    const ai = rows.filter(row => row.route.startsWith('POST /ai/'))

    expect(ai.map(row => row.route).sort()).toEqual(['POST /ai/ask', 'POST /ai/summary'])
    for (const row of ai)
      expect(row.middleware, row.route).toContain('auth')
  }, 60_000)

  it('carries no role gate until an app asks for one', async () => {
    const rows = await registered()

    expect(rows.filter(row => row.middleware.some(name => name.startsWith('role:'))).map(row => row.route)).toEqual([])
  }, 60_000)
})
