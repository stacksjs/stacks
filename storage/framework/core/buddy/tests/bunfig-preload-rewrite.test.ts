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
import { packagesPreloadFilesFallBackTo, rewriteBunfigPreloads } from '../src/commands/publish'

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

describe('packagesPreloadFilesFallBackTo', () => {
  it('finds the package a vendored-path import falls back to', () => {
    // The idiom for an import the file cannot do without: vendored path first,
    // published package when that path is gone - which it always is in a
    // package-based app.
    const source = [
      "const pathPkg = '@stacksjs/' + 'path'",
      "const path = await import('../../../core/path/src/index.ts').catch(() => import(pathPkg))",
    ].join('\n')

    expect([...packagesPreloadFilesFallBackTo(source)]).toEqual(['@stacksjs/path'])
  })

  it('ignores plain specifiers, which are the optional globalThis list', () => {
    /*
     * That list is walked inside a try/catch and degrades to "no auto-imports"
     * rather than a crash. Counting it collects 24 packages instead of 3 and
     * puts the whole framework in the app's direct dependencies.
     */
    const source = "const stacksPackages = ['@stacksjs/orm', '@stacksjs/validation', '@stacksjs/cache']"

    expect([...packagesPreloadFilesFallBackTo(source)]).toEqual([])
  })

  it('tolerates spacing around the concatenation', () => {
    expect([...packagesPreloadFilesFallBackTo("const p = '@stacksjs/'+'env'")]).toEqual(['@stacksjs/env'])
  })

  it('reads the real preloader as the two it dies without, plus actions', async () => {
    // Regression anchor: `@stacksjs/env` alone left the scaffolded app dying on
    // `Cannot find module '@stacksjs/path'` at the next step.
    const preloader = await Bun.file(
      new URL('../../../defaults/resources/plugins/preloader.ts', import.meta.url).pathname,
    ).text()

    expect([...packagesPreloadFilesFallBackTo(preloader)].sort())
      .toEqual(['@stacksjs/actions', '@stacksjs/env', '@stacksjs/path'])
  })
})
