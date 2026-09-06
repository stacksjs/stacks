/**
 * The error-page templates ship beside the code that reads them.
 *
 * `error-page-renderer.ts` resolves its views relative to its own module:
 *
 *     const VIEWS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'views/errors')
 *
 * Running from source that lands on `src/views/errors` and works, which is why
 * nothing noticed. Installed, it lands on `dist/views/errors`, and
 * `transpilePackage` emits only the `.ts` files it compiles - so the published
 * tarball held 29 files and not one template, and the dev error page could not
 * render in any app that installs the framework.
 *
 * The same shape has bitten this repo before: a build that ships `src/**\/*.ts`
 * silently drops the templates and images sitting beside the code.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const pkg = new URL('../', import.meta.url).pathname

describe('error-page views', () => {
  it('exist in src, where the renderer finds them when run from source', () => {
    for (const file of ['views/errors/show.stx', 'views/errors/layout.stx', 'views/500.html'])
      expect(existsSync(join(pkg, 'src', file))).toBe(true)
  })

  it('are copied into dist, where the renderer finds them once installed', () => {
    // `dist` is gitignored, so a fresh checkout has none until the package is
    // built. Only assert the copy when there is a build to assert about -
    // otherwise this fails for everyone who has not run `bun run build` yet.
    if (!existsSync(join(pkg, 'dist')))
      return

    for (const file of ['views/errors/show.stx', 'views/errors/layout.stx'])
      expect(existsSync(join(pkg, 'dist', file))).toBe(true)
  })

  it('keeps the renderer resolving them relative to its own module', async () => {
    /*
     * The copy into `dist/views` is only correct while the renderer looks
     * beside itself. If this becomes a `resourcesPath()` or a bare relative
     * path, the build step is aiming at the wrong directory and the templates
     * go missing again - silently, because rendering an error page is not
     * something the test suite does.
     */
    const source = await Bun.file(join(pkg, 'src/error-page-renderer.ts')).text()

    expect(source).toContain('fileURLToPath(import.meta.url)')
    expect(source).toContain(`'views/errors'`)
  })
})
