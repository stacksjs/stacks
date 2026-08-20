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
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { resolveDefaultsResources } from '../src/dev/defaults-resources'

/*
 * Absolute, and compared as paths rather than strings.
 *
 * The resolver used to return the bare relative string, so these assertions
 * compared against it directly — and passed only when the suite ran from the
 * project root. From `core/actions`, where `bun test` in this package puts the
 * working directory, `existsSync` missed the vendored copy entirely and the
 * package fallback answered instead. What matters is that the resolver points
 * at the same directories the dev server used to hardcode, not that it spells
 * them the same way.
 */
const VENDORED = resolve(import.meta.dir, '../../../defaults/resources')

describe('resolveDefaultsResources - vendored branch (#2240)', () => {
  it('returns the vendored resources root when it exists', () => {
    expect(resolveDefaultsResources()).toBe(VENDORED)
  })

  it('finds it regardless of the working directory', () => {
    // The bug this replaced: the answer changed depending on where the process
    // was started, and the wrong answer was a plausible-looking directory.
    const fromRoot = resolveDefaultsResources()
    const previous = process.cwd()
    try {
      process.chdir(import.meta.dir)
      expect(resolveDefaultsResources()).toBe(fromRoot)
    }
    finally {
      process.chdir(previous)
    }
  })

  it('is behaviour-preserving: the sub-paths are the ones dev/views.ts hardcoded', () => {
    // dev/views.ts previously hardcoded exactly these three. If the resolver
    // ever drifts from them, a default view/component/layout stops resolving in
    // dev with no other signal, so pin them.
    const root = resolveDefaultsResources()
    expect(join(root, 'views')).toBe(join(VENDORED, 'views'))
    expect(join(root, 'components')).toBe(join(VENDORED, 'components'))
    expect(join(root, 'layouts')).toBe(join(VENDORED, 'layouts'))
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
