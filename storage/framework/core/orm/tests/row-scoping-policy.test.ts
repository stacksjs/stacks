/**
 * `security.api.rowScoping` actually gates route registration.
 *
 * The helpers it is built from are unit-tested in auto-crud.test.ts. What that
 * cannot show is the thing the setting exists for: that `'deny'` removes the
 * mutating routes of every model with no row-level scoping, and that the
 * default leaves them exactly where they were.
 *
 * Booted as a subprocess because `routes.ts` registers into a module-level
 * router at import time, so the two policies cannot be observed in one process.
 *
 * stacksjs/stacks#2375.
 */

import { describe, expect, it } from 'bun:test'
import { resolve } from 'node:path'

const routesModule = resolve(import.meta.dir, '../src/routes.ts')
const projectRoot = resolve(import.meta.dir, '../../../../..')

interface Surface { total: number, mutating: number, userStore: boolean, boardStore: boolean }

async function registeredSurface(policy?: string): Promise<Surface> {
  const script = `
    const mod = await import(${JSON.stringify(routesModule)})
    const router = mod.default
    const list = typeof router.getRoutes === 'function' ? await router.getRoutes() : (router.routes ?? [])
    const mutating = list.filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(r.method).toUpperCase()))
    console.log('__SURFACE__' + JSON.stringify({
      total: list.length,
      mutating: mutating.length,
      userStore: mutating.some(r => String(r.uri ?? r.path) === '/api/users' && String(r.method).toUpperCase() === 'POST'),
      // \`Board\` was one of the seven models that declared no owner, so 'deny'
      // withheld its writes and a kanban board had no create endpoint. It
      // belongs to a team now (stacksjs/stacks#2412), so this route is expected
      // to be REGISTERED - it is here to catch that ownership being lost again.
      boardStore: mutating.some(r => String(r.uri ?? r.path) === '/api/boards' && String(r.method).toUpperCase() === 'POST'),
    }))
  `

  const proc = Bun.spawn(['bun', '-e', script], {
    cwd: projectRoot,
    env: { ...process.env, ...(policy ? { STACKS_API_ROW_SCOPING: policy } : {}) },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const out = await new Response(proc.stdout).text()
  await proc.exited

  const line = out.split('\n').find(l => l.includes('__SURFACE__'))
  if (!line)
    throw new Error(`route surface not reported:\n${out.slice(-2000)}`)

  return JSON.parse(line.slice(line.indexOf('__SURFACE__') + '__SURFACE__'.length))
}

describe('security.api.rowScoping', () => {
  it('withholds unscoped mutating routes by default', async () => {
    const surface = await registeredSurface()

    // The default flipped to 'deny' in stacksjs/stacks#2375: a model that has
    // said nothing about who owns a row gets no generated writes. Every model
    // the framework ships now says something, so nothing is withheld - `Board`
    // included (stacksjs/stacks#2412).
    expect(surface.boardStore).toBe(true)
    // Scoped models keep theirs. `User` is the case worth pinning: it carries
    // no owner column, and declaring `selfOwnership()` is what restores its
    // writes while confining a caller to their own row.
    expect(surface.userStore).toBe(true)
    expect(surface.mutating).toBeGreaterThan(0)
  }, 120_000)

  it('registers them under the explicit warn opt-out', async () => {
    const surface = await registeredSurface('warn')

    // The escape hatch registers everything regardless of what a model
    // declares, so this stays true no matter how the shipped set is scoped.
    expect(surface.boardStore).toBe(true)
    expect(surface.mutating).toBeGreaterThan(100)
  }, 120_000)

  it('withholds them under deny, and keeps the scoped ones', async () => {
    const surface = await registeredSurface('deny')

    expect(surface.boardStore).toBe(true)
    expect(surface.userStore).toBe(true)
    // Not zero: models that DO declare ownership or carry team_id keep their
    // writes, which is the whole point of the policy being about scoping
    // rather than about turning writes off.
    expect(surface.mutating).toBeGreaterThan(0)
    expect(surface.total).toBeGreaterThan(0)
  }, 120_000)

  it('withholds nothing, because every shipped model declares an owner', async () => {
    const [permissive, strict] = await Promise.all([registeredSurface('warn'), registeredSurface('deny')])

    /*
     * This used to assert `deny` removed strictly more than it kept, which was
     * true while seven models declared no owner at all. #2412 closed that
     * remainder - Board to a team, BoardColumn and Label chaining to it, Pledge
     * and LoyaltyPoint to a customer, Receipt and DigitalDelivery declared as
     * catalog records - so the two surfaces are now identical.
     *
     * Equality is the stronger assertion to hold going forward: it fails the
     * moment a model is added without saying who owns its rows, which is the
     * state #2375 and #2412 spent their time removing. A divergence here names
     * the regression rather than quietly withholding endpoints again.
     */
    expect(strict.mutating).toBe(permissive.mutating)

    // Read routes are untouched either way - this policy is about writes - so
    // with no writes withheld the two surfaces match exactly.
    expect(strict.total).toBe(permissive.total)
  }, 180_000)
})
