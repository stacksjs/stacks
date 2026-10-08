/**
 * `dashboard.roles` gating the generated API, not only the sidebar row
 * (stacksjs/stacks#2883).
 *
 * The real generator, booted in a throwaway project, because this is the shape
 * of bug unit tests cannot see: `resolveApiMiddleware` was correct about
 * everything it was asked, and the generator never asked it about
 * `model.dashboard`. #1843 taught the sidebar to hide a row whose roles a
 * viewer lacks; nothing taught the routes behind it the same thing, so a model
 * declaring `roles: ['admin']` registered `['auth']` and served every row of
 * itself - plus DELETE and bulk-delete - to anyone signed in.
 *
 * What the generator registers is what an app serves, so that is what these
 * assert.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const fixture = join(import.meta.dir, 'fixtures', 'print-model-api-routes.ts')

/** Every route the trait generates, so a gate cannot be verified on reads alone. */
const ROUTES = ['index', 'show', 'store', 'update', 'destroy']

describe('dashboard.roles on a generated model API', () => {
  let project: string

  beforeAll(() => {
    project = mkdtempSync(join(tmpdir(), 'stacks-dashboard-roles-'))
    mkdirSync(join(project, 'app', 'Models'), { recursive: true })
    mkdirSync(join(project, 'config'), { recursive: true })
    writeFileSync(join(project, 'package.json'), '{"name":"dashboard-roles-fixture"}\n')
  })
  afterAll(() => rmSync(project, { recursive: true, force: true }))

  /**
   * Writes one model and boots the generator against it.
   *
   * `ownership: false` on every model here is what lets the mutating routes
   * register at all: `rowScoping` defaults to `'deny'`, which withholds
   * store/update/destroy from a model that scopes no rows (#2375). Without it
   * this would assert a role gate on two read routes and silently miss the
   * five that accept writes.
   */
  function boot(model: Record<string, unknown>): { middleware: Map<string, string[]>, output: string } {
    writeFileSync(
      join(project, 'app', 'Models', 'AuditTrail.ts'),
      `export default ${JSON.stringify({ name: 'AuditTrail', table: 'audit_trails', ownership: false, ...model })}\n`,
    )

    const result = Bun.spawnSync([process.execPath, fixture], { cwd: project, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe' })
    const output = `${result.stdout}${result.stderr}`
    const line = result.stdout.toString().split('\n').find(candidate => candidate.startsWith('{"paths"'))
    if (!line)
      throw new Error(`the generator printed no routes (exit ${result.exitCode})\n${output}`)

    const rows = JSON.parse(line).routes as Array<{ route: string, middleware: string[] }>
    return { middleware: new Map(rows.map(row => [row.route, row.middleware])), output }
  }

  const trait = (middleware?: unknown) => ({
    traits: { useApi: { uri: 'audit-trails', routes: ROUTES, ...(middleware === undefined ? {} : { middleware }) } },
    attributes: {},
  })

  /** The seven endpoints the trait registers for this model. */
  const ENDPOINTS = [
    'GET /api/audit-trails',
    'GET /api/audit-trails/{id}',
    'POST /api/audit-trails',
    'PUT /api/audit-trails/{id}',
    'PATCH /api/audit-trails/{id}',
    'DELETE /api/audit-trails/{id}',
    'POST /api/audit-trails/bulk-delete',
  ] as const

  it('gates every generated endpoint, writes included', () => {
    const { middleware } = boot({ dashboard: { roles: ['admin'] }, ...trait() })

    for (const endpoint of ENDPOINTS) {
      expect(middleware.get(endpoint), `${endpoint} should exist`).toBeDefined()
      expect(middleware.get(endpoint), endpoint).toEqual(['auth', 'role:admin'])
    }
  }, 60_000)

  it('carries a multi-role list as one any-of entry', () => {
    const { middleware } = boot({ dashboard: { roles: ['admin', 'dev'] }, ...trait() })

    expect(middleware.get('GET /api/audit-trails')).toEqual(['auth', 'role:admin,dev'])
  }, 60_000)

  it('leaves a model with no dashboard roles exactly as it was', () => {
    // The framework's own models declare none, so an upgrade moves nothing.
    const { middleware } = boot(trait())

    for (const endpoint of ENDPOINTS)
      expect(middleware.get(endpoint), endpoint).toEqual(['auth'])
  }, 60_000)

  it('honours `enforce: false` for a row hidden only to reduce clutter', () => {
    const { middleware } = boot({ dashboard: { roles: ['admin'], enforce: false }, ...trait() })

    for (const endpoint of ENDPOINTS)
      expect(middleware.get(endpoint), endpoint).toEqual(['auth'])
  }, 60_000)

  it('appends the role after a declared list rather than replacing it', () => {
    const { middleware } = boot({ dashboard: { roles: ['admin'] }, ...trait(['auth', 'team']) })

    expect(middleware.get('GET /api/audit-trails')).toEqual(['auth', 'team', 'role:admin'])
  }, 60_000)

  it('lets an explicit role entry win over the derived one', () => {
    const { middleware } = boot({ dashboard: { roles: ['admin'] }, ...trait(['auth', 'role:dev']) })

    expect(middleware.get('GET /api/audit-trails')).toEqual(['auth', 'role:dev'])
  }, 60_000)

  it('keeps a deliberately public side public, and says so once at boot', () => {
    // Two opposite statements, neither safe to assume is the mistake: the
    // explicit middleware wins and the pairing is named.
    const { middleware, output } = boot({
      dashboard: { roles: ['admin'] },
      ...trait({ read: [], write: ['auth'] }),
    })

    expect(middleware.get('GET /api/audit-trails')).toEqual([])
    expect(middleware.get('DELETE /api/audit-trails/{id}')).toEqual(['auth', 'role:admin'])
    expect(output).toContain('AuditTrail (read)')
    expect(output).toContain('dashboard.enforce')
  }, 60_000)
})
