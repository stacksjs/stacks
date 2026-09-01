/**
 * Every default route file is registered by the bootstrap.
 *
 * A route file that exists and is never mounted is indistinguishable from a
 * working feature until something calls it: the actions are there, the tests
 * pass, the endpoints 404. That is exactly how the courier delivery bundle
 * shipped — `defaults/routes/delivery.ts` was written, reviewed and merged,
 * and needed a follow-up (`7d096b26f5`, "register the delivery bundle so its
 * routes actually mount") before a single one of its endpoints answered.
 *
 * This compares the directory against the bootstrap rather than asserting a
 * hard-coded list, so adding a route file without mounting it fails here
 * instead of in an app.
 *
 * stacksjs/stacks#2384.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const defaultsDir = join(import.meta.dir, '../../../defaults')
const bootstrap = readFileSync(join(defaultsDir, 'bootstrap.ts'), 'utf8')

const routeFiles = readdirSync(join(defaultsDir, 'routes'))
  .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .sort()

describe('default route bundles', () => {
  it('finds the route files', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
    expect(routeFiles).toContain('core.ts')
  })

  it('registers every one of them', () => {
    const unmounted = routeFiles.filter(name => !bootstrap.includes(`defaults/routes/${name}`))

    expect(unmounted).toEqual([])
  })

  it('registers each exactly once, so a bundle cannot mount twice', () => {
    // Two registrations of one file is not harmless: the second pass re-runs
    // every `route.*` call, and a duplicate route is resolved by whichever
    // registration the router kept.
    const duplicated = routeFiles.filter((name) => {
      const occurrences = bootstrap.split(`defaults/routes/${name}`).length - 1
      return occurrences > 1
    })

    expect(duplicated).toEqual([])
  })
})
