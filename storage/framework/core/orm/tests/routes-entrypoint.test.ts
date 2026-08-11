/**
 * How an installed app reaches the ORM route generator.
 *
 * The generator registers the CRUD endpoints a model's `useApi` trait declares.
 * The router loads it from `storage/framework/orm/routes.ts` — a file vendored
 * into every app — and that file re-exported `../core/orm/routes`, a path that
 * exists in this repository and nowhere else. So in every npm-installed app the
 * import threw, the loader fell through to a legacy path that was also absent,
 * and production logged "model useApi endpoints are unavailable" and served
 * none of them. Confirmed in a live app's journal before this was fixed.
 *
 * These are file-shape assertions rather than a boot: importing the generator
 * registers routes and opens a database, and what went wrong was never the
 * generator — it was where the pieces pointed.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const orm = join(import.meta.dir, '..')
const framework = join(orm, '..', '..')

describe('the ORM routes entrypoint', () => {
  it('lives in src/, so the package build can emit it', () => {
    expect(existsSync(join(orm, 'src', 'routes.ts'))).toBe(true)
  })

  it('is built as its own entrypoint', () => {
    // Without this there is nothing behind `@stacksjs/orm/routes`, and every
    // importer below resolves to a 404 the callers swallow.
    expect(readFileSync(join(orm, 'build.ts'), 'utf8')).toContain('./src/routes.ts')
  })

  it('is what the vendored shim re-exports', () => {
    // The file the router loads first, in an app that has no core/ directory.
    const shim = readFileSync(join(framework, 'orm', 'routes.ts'), 'utf8')

    expect(shim).toContain(`from '@stacksjs/orm/routes'`)
    // The export, not the comment that explains why it is no longer that.
    expect(shim).not.toContain(`from '../core/orm/routes'`)
  })

  it('is still reachable at the legacy path for projects that predate the move', () => {
    const legacy = readFileSync(join(orm, 'routes.ts'), 'utf8')

    expect(legacy).toContain('./src/routes')
  })

  it('is imported by package name everywhere that ships in a package', () => {
    /*
     * `@stacksjs/server/dist/start.js` reaching for `../../orm/routes` names a
     * file that does not exist beside a published package — the relative form
     * only ever worked inside this repository.
     */
    for (const file of [
      join(framework, 'core', 'server', 'src', 'start.ts'),
      join(framework, 'core', 'api', 'src', 'generate-openapi.ts'),
    ]) {
      const source = readFileSync(file, 'utf8')

      expect(source).toContain('@stacksjs/orm/routes')
      expect(source).not.toContain(`import('../../orm/routes')`)
    }
  })

  it('is the router last resort, so a stale vendored shim still recovers', () => {
    // An app scaffolded before this fix keeps its broken shim until it upgrades
    // its own files. The router should not leave it without endpoints.
    const router = readFileSync(join(framework, 'core', 'router', 'src', 'stacks-router.ts'), 'utf8')

    expect(router).toContain(`await import('@stacksjs/orm/routes')`)
  })
})
