import { $ } from 'bun'
import { existsSync, statSync } from 'node:fs'
import process from 'node:process'
import { dim, italic, log } from '@stacksjs/cli'
import { corePath } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Building core packages')

const allEntries = (await glob([corePath('*')], { onlyFiles: false })).sort()
const dirs = allEntries.filter((entry) => {
  if (!existsSync(entry) || !statSync(entry).isDirectory())
    return false
  // Only include directories that have a build script
  const pkgPath = `${entry}/package.json`
  if (!existsSync(pkgPath))
    return false
  return true
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
