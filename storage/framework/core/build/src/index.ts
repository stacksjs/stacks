import { stat } from 'node:fs/promises'
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

export * from './utils'

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
export function frameworkExternal(extras: string[] = []): string[] {
  return [
    // Every other framework package — they're peer-resolved at runtime via
    // node_modules. Leaving them external keeps bundles small and lets the
    // user's installed version win over the bundling package's snapshot.
    '@stacksjs/*',
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
