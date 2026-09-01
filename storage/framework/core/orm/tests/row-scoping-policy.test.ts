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

interface Surface { total: number, mutating: number, userStore: boolean, unscopedStore: boolean }

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
      // A model that still declares nothing: no ownership config, no owner
      // column, no \`ownership: false\`. \`Board\` is one of the seven left in
      // that state - nothing in the schema says who owns a board - which is
      // exactly the shape 'deny' withholds.
      unscopedStore: mutating.some(r => String(r.uri ?? r.path) === '/api/boards' && String(r.method).toUpperCase() === 'POST'),
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
    // said nothing about who owns a row gets no generated writes.
    expect(surface.unscopedStore).toBe(false)
    // Scoped models keep theirs. `User` is the case worth pinning: it carries
    // no owner column, and declaring `selfOwnership()` is what restores its
    // writes while confining a caller to their own row.
    expect(surface.userStore).toBe(true)
    expect(surface.mutating).toBeGreaterThan(0)
  }, 120_000)

  it('registers them under the explicit warn opt-out', async () => {
    const surface = await registeredSurface('warn')

    // Under the explicit opt-out even the models that declare nothing are
    // registered again, which is what makes it an escape hatch.
    expect(surface.unscopedStore).toBe(true)
    expect(surface.mutating).toBeGreaterThan(100)
  }, 120_000)

  it('withholds them under deny, and keeps the scoped ones', async () => {
    const surface = await registeredSurface('deny')

    expect(surface.unscopedStore).toBe(false)
    expect(surface.userStore).toBe(true)
    // Not zero: models that DO declare ownership or carry team_id keep their
    // writes, which is the whole point of the policy being about scoping
    // rather than about turning writes off.
    expect(surface.mutating).toBeGreaterThan(0)
    expect(surface.total).toBeGreaterThan(0)
  }, 120_000)

  it('removes strictly more than it keeps, on this model set', async () => {
    const [permissive, strict] = await Promise.all([registeredSurface('warn'), registeredSurface('deny')])

    expect(strict.mutating).toBeLessThan(permissive.mutating)
    // Read routes are untouched either way — this policy is about writes.
    expect(strict.total).toBeLessThan(permissive.total)
  }, 180_000)
})
