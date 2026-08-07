/**
 * The dev server resolves its default resources instead of hardcoding a
 * gitignored path (stacksjs/stacks#2240).
 *
 * `dev/views.ts` pointed `defaultViewsPath` / `componentsDir` / `defaultLayouts`
 * at the string `storage/framework/defaults/resources/...`. That directory is
 * generated and gitignored (`git ls-files storage/framework` is empty), so a
 * framework-as-dependencies app has nothing there on a fresh clone — the same
 * content ships as the published `@stacksjs/defaults` package. The production
 * server already resolved it (vendored copy wins, else the package); the dev
 * server did not, so this extracts that resolver and points the dev server at
 * it too.
 *
 * HONEST LIMIT. Only the vendored branch executes here: the monorepo checkout
 * HAS `storage/framework/defaults/resources`, so `existsSync` is true and the
 * package fallback is never taken. The fallback runs only in a node_modules app,
 * which this test environment is not — the same reason the twin in
 * production-server.ts is untested. What is guarded below is that the resolver
 * is behaviour-preserving in the environment every contributor develops in: the
 * resolved sub-paths still equal the strings the dev server used to hardcode.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { resolveDefaultsResources } from '../src/dev/defaults-resources'

describe('resolveDefaultsResources — vendored branch (#2240)', () => {
  it('returns the vendored resources root when it exists', () => {
    expect(resolveDefaultsResources()).toBe('storage/framework/defaults/resources')
  })

  it('is behaviour-preserving: the sub-paths equal the old hardcoded strings', () => {
    // dev/views.ts previously hardcoded exactly these three. If the resolver
    // ever drifts from them, a default view/component/layout stops resolving in
    // dev with no other signal, so pin them.
    const root = resolveDefaultsResources()
    expect(join(root, 'views')).toBe('storage/framework/defaults/resources/views')
    expect(join(root, 'components')).toBe('storage/framework/defaults/resources/components')
    expect(join(root, 'layouts')).toBe('storage/framework/defaults/resources/layouts')
  })

  it('resolves to a real directory that actually holds the defaults', () => {
    // Non-vacuity: a resolver that returned a plausible-but-empty path would
    // pass the string checks above and still serve nothing.
    const root = resolveDefaultsResources()
    expect(existsSync(join(root, 'views'))).toBe(true)
    expect(existsSync(join(root, 'components'))).toBe(true)
    expect(existsSync(join(root, 'layouts'))).toBe(true)
  })

  it('the fallback target is a resolvable package, so the other branch has somewhere to go', () => {
    // The fallback itself does not run here, but its precondition — that
    // `@stacksjs/defaults` resolves at all — must hold, or an app that DOES take
    // that branch would land in the catch and get the vendored path that is not
    // there. This asserts the branch is reachable, not that it executes.
    expect(() => Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())).not.toThrow()
  })
})
