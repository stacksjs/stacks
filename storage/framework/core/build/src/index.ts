import { mkdir, stat } from 'node:fs/promises'
import { bold, dim, green, italic, log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'

export async function outro(options: {
  dir: string
  startTime: number
  result: any
  pkgName?: string
}): Promise<void> {
  const endTime = Date.now()
  const timeTaken = endTime - options.startTime
  const pkgName = options.pkgName ?? `@stacksjs/${p.basename(options.dir)}`

  // Handle both esbuild and Bun.build result formats
  if (options.result.errors && options.result.errors.length > 0) {
    // esbuild format
    // eslint-disable-next-line no-console
    console.error('Build errors:', options.result.errors)
    throw new Error(`Build failed with errors: ${JSON.stringify(options.result.errors)}`)
  }
  else if (options.result.success !== undefined && !options.result.success) {
    // Bun.build format
    const firstLog = options.result.logs?.[0] || 'Unknown build error'
    // eslint-disable-next-line no-console
    console.log(firstLog)
    throw new Error(`Build failed: ${firstLog}`)
  }

  // loop over all the files in the dist directory and log them and their size
  const files = await glob([p.resolve(options.dir, 'dist', '**/*')], { absolute: true })
  for (const file of files) {
    const stats = await stat(file)

    let sizeStr
    if (stats.size < 1024 * 1024) {
      const sizeInKb = stats.size / 1024
      sizeStr = `${sizeInKb.toFixed(2)}kb`
    }
    else {
      const sizeInMb = stats.size / 1024 / 1024
      sizeStr = `${sizeInMb.toFixed(2)}mb`
    }

    const relativeFilePath = p.relative(options.dir, file).replace('dist/', '')
    // eslint-disable-next-line no-console
    console.log(`${bold(dim(`[${sizeStr}]`))} ${dim('dist/')}${relativeFilePath}`)
  }

  // eslint-disable-next-line no-console
  console.log(`${bold(dim(`[${timeTaken}ms]`))} Built ${italic(bold(green(pkgName)))}`)
}

export async function intro(options: { dir: string, pkgName?: string, styled?: boolean }): Promise<{
  startTime: number
}> {
  const pkgName = options.pkgName ?? `@stacksjs/${p.basename(options.dir)}`

  if (options.styled === false) // eslint-disable-next-line no-console
    console.log(`Building ${pkgName}...`)
  else log.info(`Building ${italic(pkgName)}...`)

  return { startTime: Date.now() }
}


/**
 * Standard `external` list for framework package bundlers.
 *
 * Every package's `build.ts` should spread this into its `Bun.build({ external })`
 * so optional peers and other framework packages stay out of each individual
 * bundle. Without it, transitive imports through the queue or tunnel modules
 * surface as "Could not resolve: bun-queue" style build failures the moment a
 * project hasn't `bun add`-ed those peers.
 *
 * Pass extra package-specific entries as `extras` and they'll be merged in.
 *
 * Notably absent: `sharp`, `vue-component-meta`, `@aws-sdk/*`. We don't ship
 * any of those — image work goes through the in-house `ts-images` (formerly
 * `imgx`), template metadata is parsed by our own STX-aware extractor, and
 * AWS interactions go through `ts-cloud` / our wrappers. If a build error
 * complains about one of those, the right fix is to remove the import, not
 * to add it back here.
 */
/**
 * Build a library package by transpiling each `src/**` file 1:1 to `dist/`,
 * preserving the module graph, then emitting `.d.ts` alongside.
 *
 * WHY NOT `Bun.build` (bundling): several barrel packages here re-export named
 * bindings from a source — `export { fromPromise } from 'ts-error-handling'`,
 * `export { ERROR_PAGE_CSS } from './error-page'`. Bun's bundler mangles these:
 *   - with `splitting: true` it wires cross-chunk symbols wrong, emitting an
 *     `export { x as ok }` where `x` is never imported/declared in the file
 *     (`SyntaxError: Exported binding 'X' needs to refer to a top-level
 *     declared variable`);
 *   - marking the source external instead drops the `from` clause entirely,
 *     producing an invalid bare `export { ok }`.
 * Affected: arrays, collections, datetime, error-handling, github, strings, ui.
 *
 * `Bun.Transpiler` sidesteps all of it: it strips types and leaves every
 * import/export statement verbatim, so `export * from './handler'` and
 * `export { ok } from 'ts-error-handling'` survive intact. Internal `./x`
 * imports resolve to the sibling `dist/x.js`; external packages resolve from
 * the consumer's node_modules at runtime. The `.d.ts` files still come from
 * the dtsx plugin via a throwaway `Bun.build` (its `.js` output is discarded).
 */
export async function transpilePackage(options: {
  dir: string
  pkgName?: string
  external?: string[]
}): Promise<void> {
  const { dts } = await import('bun-plugin-dtsx')
  const srcDir = p.resolve(options.dir, 'src')
  const distDir = p.resolve(options.dir, 'dist')

  const srcFiles = (await Array.fromAsync(new Bun.Glob('**/*.ts').scan({ cwd: srcDir })))
    .filter(f => !f.endsWith('.d.ts'))

  // 1. Emit .d.ts (the accompanying .js output is overwritten in step 2).
  await Bun.build({
    entrypoints: srcFiles.map(f => p.resolve(srcDir, f)),
    outdir: distDir,
    root: srcDir,
    target: 'bun',
    format: 'esm',
    splitting: false,
    external: options.external ?? frameworkExternal(),
    plugins: [dts({ root: srcDir, outdir: distDir })],
  })

  // 2. Clean 1:1 transpile of every src file — preserves re-exports verbatim.
  const transpiler = new Bun.Transpiler({ loader: 'ts', target: 'bun' })
  for (const f of srcFiles) {
    let js = transpiler.transformSync(await Bun.file(p.resolve(srcDir, f)).text())
    // The transpiler leaves import specifiers verbatim, so an explicit
    // `./x.ts` extension survives into the .js output and fails to resolve
    // against the sibling `./x.js`. Rewrite relative `.ts`/`.tsx` specifiers
    // to `.js`. This covers both real import specifiers AND string literals
    // that are later fed to `import()` (e.g. buddy's lazy-command map:
    // `{ path: './commands/deploy.ts' }` → `import(cmd.path)`), which is why
    // we match any `./`-or-`../`-rooted quoted string, not just import forms.
    js = js.replace(/(['"])(\.\.?\/[^'"]+?)\.tsx?\1/g, '$1$2.js$1')
    const out = p.resolve(distDir, f.replace(/\.ts$/, '.js'))
    await mkdir(p.dirname(out), { recursive: true })
    await Bun.write(out, js)
  }
}

export function frameworkExternal(extras: string[] = []): string[] {
  // A library resolves its declared dependencies from the CONSUMER's
  // node_modules — it must not bundle them in. Read the building package's own
  // deps (build runs with cwd = the package dir) and mark them external. Besides
  // keeping bundles small, this dodges a bun bundler bug that mangles a
  // re-exported named binding from a bundled dep into a non-top-level export
  // (`SyntaxError: Exported binding 'X' needs to refer to a top-level declared
  // variable`, e.g. `export { fromPromise } from 'ts-error-handling'`).
  let ownDeps: string[] = []
  try {
    // eslint-disable-next-line ts/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    const pkg = JSON.parse(fs.readFileSync(`${process.cwd()}/package.json`, 'utf8'))
    ownDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ]
  }
  catch {}
  return [
    // Every other framework package — they're peer-resolved at runtime via
    // node_modules. Leaving them external keeps bundles small and lets the
    // user's installed version win over the bundling package's snapshot.
    '@stacksjs/*',
    // The building package's own declared deps (see above).
    ...ownDeps,
    // Optional peers that aren't pulled into every project. Marking them
    // external makes the static-import-failure noise go away during build,
    // and the missing-module surfaces only when the dependent action runs.
    'bun-queue',
    'ioredis',
    'localtunnels',
    'localtunnels/*',
    '@craft-native/ts',
    'ts-md',
    // Search drivers (only one is active at a time)
    'meilisearch',
    'algoliasearch',
    '@opensearch-project/opensearch',
    // Project-local resources occasionally imported by generators.
    '*.yaml',
    '*.yml',
    ...extras,
  ]
}
