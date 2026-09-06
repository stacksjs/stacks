import { existsSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (see transpilePackage) instead of bundling: this
// barrel re-exports named bindings that Bun's bundler mangles.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal([]),
  plugins: [
    // Ship declarations: without them every consumer of this package sees
    // `any`, which is how a typed framework silently stops being typed.
    dts({
      root: './src',
      outdir: './dist',
      exclude: ['tests/**'],
    }),
  ],
})

/*
 * Copy the error-page templates beside the code that reads them.
 *
 * `error-page-renderer.ts` resolves them relative to its own module:
 *
 *     const VIEWS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'views/errors')
 *
 * In this repo that lands on `src/views/errors` and works. Installed, it lands
 * on `dist/views/errors` - and `transpilePackage` only emits the `.ts` it
 * compiles, so the published tarball carried 29 files and not one template.
 * The dev error page could not render in any app that installs the framework,
 * which is the one place it matters most.
 */
const viewsSource = join(import.meta.dir, 'src/views')
if (existsSync(viewsSource))
  await cp(viewsSource, join(import.meta.dir, 'dist/views'), { recursive: true })

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
