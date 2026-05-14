import { $ } from 'bun'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import process from 'node:process'
import { dim, italic, log } from '@stacksjs/cli'
import { feature } from '@stacksjs/config'
import { corePath } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Building core packages')

// Feature-gated core packages. Each entry maps a core package directory
// name to the feature flag (in config/features.ts) that controls it.
// When the flag is off, the package is skipped — apps that never install
// `commerce` or `realtime` don't pay the build cost for them.
//
// Dashboard / marketing / monitoring don't ship as their own core packages
// (they're framework default routes + actions), so they don't appear here
// even though they're feature flags.
const FEATURE_GATED_PACKAGES: Record<string, string> = {
  cms: 'cms',
  commerce: 'commerce',
  queue: 'queue',
  realtime: 'realtime',
}

const allEntries = (await glob([corePath('*')], { onlyFiles: false })).sort()
const dirs = allEntries.filter((entry) => {
  if (!existsSync(entry) || !statSync(entry).isDirectory())
    return false
  // Only include directories that have a build script
  const pkgPath = `${entry}/package.json`
  if (!existsSync(pkgPath))
    return false

  // Skip feature-gated packages whose flag is off. `feature()` reads
  // config/features.ts (with env-aware overrides), so flipping the flag
  // via `./buddy <feature>:install` is enough to pull a package back
  // into the build.
  const name = basename(entry)
  const gate = FEATURE_GATED_PACKAGES[name]
  if (gate && !feature(gate)) {
    log.info(`Skipping ${italic(dim(entry))} — feature '${gate}' is disabled`)
    return false
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> }
    return typeof pkg.scripts?.build === 'string'
  }
  catch (error) {
    log.warn(`Skipping ${italic(dim(entry))}: package.json could not be read`)
    return false
  }
})

if (dirs.length === 0) {
  log.info('No core packages found')
  process.exit(ExitCode.FatalError)
}

const failed: string[] = []

for (const folder of dirs) {
  log.info(`🏗️  Building ${italic(dim(folder))}`)

  try {
    $.cwd(folder)
    await $`bun run build`
    log.success(`${italic(dim(folder))} built`)
  }
  catch (error) {
    log.warn(`Failed to build ${italic(dim(folder))}, skipping...`)
    failed.push(folder)
  }

  console.log(``)
}

if (failed.length > 0) {
  log.warn(`${failed.length} package(s) failed to build:`)
  for (const f of failed) {
    log.warn(`  - ${f}`)
  }
}
