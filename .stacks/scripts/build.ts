import { p } from '@stacksjs/utils'
import { glob } from '@stacksjs/storage'
import { corePath, projectPath } from '@stacksjs/path'
import { Arr } from '@stacksjs/arrays'
import { ExitCode } from '@stacksjs/types'
import { italic, log, runCommand } from '@stacksjs/cli'

log.info('Building core packages')

const dirsToIgnore = ['src', 'dist', 'snippets', 'scripts', 'tests', 'node_modules', 'art']
const dirs = (await glob([corePath('*'), corePath('*/*')], { onlyDirectories: true }))
  // filter out any directories that are not "core packages"
  .filter(dir => !Arr.contains(dir, dirsToIgnore))

if (dirs.length === 0) {
  log.info('No core packages found')
  process.exit(ExitCode.FatalError)
}

// Create an array of all build processes
const buildProcesses = dirs.map(async (folder) => {
  const path = folder

  log.info(`Building ${italic(path)}`)

  const result = await runCommand('bun --bun run build', path)

  if (result.isErr()) {
    log.error(`Failed to build ${italic(path)}`)
    return Promise.reject(result)
  }

  log.success(`Built ${italic(path)}`)
})

// Run all build processes in parallel
try {
  await p(buildProcesses, { concurrency: 4 })
}
catch (err) {
  log.error('One or more builds failed', err)
  process.exit(ExitCode.FatalError)
}

// run the tsc command
log.info('Generating type definitions...')

const tscResult = await runCommand('bun --bun tsc', projectPath())

if (tscResult.isErr()) {
  log.error(tscResult.error)
  process.exit(ExitCode.FatalError)
}

log.success('Generated type definitions')

// move type definitions to the dist folder
log.info('Moving type definitions to dist folder...')
const moveResult = await runCommand('bun --bun move-dts-files.ts', import.meta.dir)

if (moveResult.isErr()) {
  log.error(moveResult.error)
  process.exit(ExitCode.FatalError)
}

log.success('Moved type definitions to dist folder')

// move core/*/dist/src/* to core/*/dist/*
log.info('Moving built source files to dist folder...')
const moveSrcResult = await runCommand('bun --bun move-built-src-files.ts', import.meta.dir)

if (moveSrcResult.isErr()) {
  log.error(moveSrcResult.error)
  process.exit(ExitCode.FatalError)
}

log.success('Moved built source files in the dist folder')

log.success('Build complete')

process.exit(ExitCode.Success)
