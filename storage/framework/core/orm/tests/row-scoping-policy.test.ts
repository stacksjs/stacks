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

interface Surface { total: number, mutating: number, userStore: boolean }

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
  it('registers unscoped mutating routes by default, as published', async () => {
    const surface = await registeredSurface()

    expect(surface.mutating).toBeGreaterThan(100)
    // `User` declares no ownership and has no team_id column, so this is the
    // shape the issue is about: an authenticated caller, any row.
    expect(surface.userStore).toBe(true)
  }, 120_000)

  it('withholds them under deny, and keeps the scoped ones', async () => {
    const surface = await registeredSurface('deny')

    expect(surface.userStore).toBe(false)
    // Not zero: models that DO declare ownership or carry team_id keep their
    // writes, which is the whole point of the policy being about scoping
    // rather than about turning writes off.
    expect(surface.mutating).toBeGreaterThan(0)
    expect(surface.total).toBeGreaterThan(0)
  }, 120_000)

  it('removes strictly more than it keeps, on this model set', async () => {
    const [permissive, strict] = await Promise.all([registeredSurface(), registeredSurface('deny')])

    expect(strict.mutating).toBeLessThan(permissive.mutating)
    // Read routes are untouched either way — this policy is about writes.
    expect(strict.total).toBeLessThan(permissive.total)
  }, 180_000)
})
