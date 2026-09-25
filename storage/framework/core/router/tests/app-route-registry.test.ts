import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appRouteRegistry, DEFAULT_ROUTE_REGISTRY } from '../src/route-loader'

/**
 * `app/Routes.ts` says which route files to load and under which prefix. It
 * is not where routes are written — `routes/` is — so an app whose routes all
 * live in `routes/api.ts` is described completely by the default and should
 * not have to carry a file saying so.
 *
 * It used to be mandatory by accident: the dashboard imported the path with
 * no existence check, so a project without one failed to boot on "Cannot find
 * module", which reads as the app being broken rather than the file being
 * optional.
 *
 * `projectPath()` resolves against the project root, which these tests move
 * by setting the working directory — the same knob `@stacksjs/path` reads.
 */

const projects: string[] = []
const originalCwd = process.cwd()

/** A throwaway project root, optionally carrying an app/Routes.ts. */
function project(routesFile?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-registry-'))
  projects.push(root)
  mkdirSync(join(root, 'app'), { recursive: true })
  if (routesFile !== undefined)
    writeFileSync(join(root, 'app', 'Routes.ts'), routesFile)
  process.chdir(root)
  return root
}

afterEach(() => {
  process.chdir(originalCwd)
  for (const root of projects.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('appRouteRegistry', () => {
  it('describes an app with no manifest as routes/api.ts at /api', async () => {
    project()
    expect(await appRouteRegistry()).toEqual({ api: 'api' })
    expect(DEFAULT_ROUTE_REGISTRY).toEqual({ api: 'api' })
  })

  it('uses the app\'s own manifest when it has one', async () => {
    project(`export default { api: 'api', v1: { path: 'v1', prefix: 'v1' } }\n`)
    expect(await appRouteRegistry()).toEqual({ api: 'api', v1: { path: 'v1', prefix: 'v1' } })
  })

  it('falls back rather than iterating a file that exports no registry', async () => {
    project(`export const notTheDefault = true\n`)
    expect(await appRouteRegistry()).toEqual(DEFAULT_ROUTE_REGISTRY)
  })

  it('falls back on an empty manifest, which registers nothing at all', async () => {
    project(`export default {}\n`)
    expect(await appRouteRegistry()).toEqual(DEFAULT_ROUTE_REGISTRY)
  })

  it('hands back a registry the caller can load without a guard', async () => {
    project()
    const registry = await appRouteRegistry()
    expect(Object.keys(registry).length).toBeGreaterThan(0)
    for (const [key, definition] of Object.entries(registry)) {
      expect(typeof key).toBe('string')
      expect(['string', 'object']).toContain(typeof definition)
    }
  })
})
