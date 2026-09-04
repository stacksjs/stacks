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
// name to the feature flag (its top-level `enabled` field in
// `config/<name>.ts`) that controls it. When the flag is off, the package
// is skipped — apps that never install `commerce` or `realtime` don't pay
// the build cost for them.
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

  // Skip feature-gated packages whose flag is off. `feature()` reads the
  // top-level `enabled` field of `config/<name>.ts` (with env-aware
  // overrides), so flipping the flag via `./buddy <feature>:install` is
  // enough to pull a package back into the build.
  const name = basename(entry)
  const gate = FEATURE_GATED_PACKAGES[name]
  if (gate && !feature(gate)) {
    log.info(`Skipping ${italic(dim(entry))} - feature '${gate}' is disabled`)
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
  // Awaited, like the summary below: `log` writes asynchronously, so a bare
  await log.flush()
  // `log.x()` before `process.exit` exits with the line still in flight and
  // the user sees nothing but a non-zero status.
  await log.info('No core packages found')
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
    // Carry on through the remaining packages rather than stopping at the
    // first break: one run should report every package that is broken, not
    // make you rediscover them one build at a time. The exit code below is
    // what makes this a deferred failure rather than a tolerated one.
    log.warn(`Failed to build ${italic(dim(folder))}, continuing with the rest...`)
    failed.push(folder)
  }

  console.log(``)
}

// Exiting 0 here made every caller believe the framework had been built.
// `buddy build:core` checks this action's Result and `buddy build --stacks`
// runs it through `runBuildStep`, so both were reading an exit code that said
// success while packages sat unbuilt - the same false green as
// stacksjs/stacks#2391, one layer down.
if (failed.length > 0) {
  await log.error(`${failed.length} package(s) failed to build:`)
  for (const f of failed) {
    await log.error(`  - ${f}`)
  }
  process.exit(ExitCode.FatalError)
}
