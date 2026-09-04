/**
 * A rewritten preload names a package the app actually depends on.
 *
 * `unpublish:core` turns the vendored layout into a package-based app, and part
 * of that is rewriting bunfig preloads: `storage/framework/core/env/plugin.ts`
 * becomes `@stacksjs/env/plugin.js`. That half worked. The other half did not:
 * the app declares `stacks`, and `@stacksjs/env` arrives underneath it as a
 * transitive package that bun does not place in the app's `node_modules`. So
 * every scaffolded app died before running a line, on
 *
 *     error: preload not found "@stacksjs/env/plugin.js"
 *
 * which reads like a missing file and is not one - the package publishes
 * `dist/plugin.js` and its `./*` export maps onto it. It is a package the app
 * never asked for (stacksjs/stacks#2433 neighbours, seen in scaffold-smoke).
 *
 * The caller declares everything this reports, which is why it reports it.
 */
import { describe, expect, it } from 'bun:test'
import { rewriteBunfigPreloads } from '../src/commands/publish'

describe('rewriteBunfigPreloads', () => {
  it('rewrites a vendored preload and names the package behind it', () => {
    const { next, packages, rewritten } = rewriteBunfigPreloads(
      'preload = [\n  "./storage/framework/core/env/plugin.ts",\n]\n',
    )

    expect(next).toContain('"@stacksjs/env/plugin.js"')
    expect([...packages]).toEqual(['@stacksjs/env'])
    expect(rewritten).toBe(1)
  })

  it('handles the leading-slash-free form the file also uses', () => {
    const { next, packages } = rewriteBunfigPreloads('preload = ["storage/framework/core/env/plugin.ts"]')

    expect(next).toContain('"@stacksjs/env/plugin.js"')
    expect([...packages]).toEqual(['@stacksjs/env'])
  })

  it('reports each distinct package once across several preloads', () => {
    const { packages, rewritten } = rewriteBunfigPreloads([
      'preload = ["./storage/framework/core/env/plugin.ts"]',
      '[test]',
      'preload = ["./storage/framework/core/env/plugin.ts", "./storage/framework/core/config/loader.ts"]',
    ].join('\n'))

    expect([...packages].sort()).toEqual(['@stacksjs/config', '@stacksjs/env'])
    expect(rewritten).toBe(3)
  })

  it('leaves a preload that is already a package specifier alone', () => {
    const bunfig = 'preload = ["@stacksjs/env/plugin.js", "./tests/setup.ts"]'
    const { next, packages, rewritten } = rewriteBunfigPreloads(bunfig)

    // Re-running `unpublish:core` must not double-rewrite or re-declare.
    expect(next).toBe(bunfig)
    expect([...packages]).toEqual([])
    expect(rewritten).toBe(0)
  })

  it('leaves an app-relative preload alone', () => {
    const bunfig = 'preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]'

    // That path survives into the scaffolded app, so it is not a package.
    expect(rewriteBunfigPreloads(bunfig).next).toBe(bunfig)
  })
})
