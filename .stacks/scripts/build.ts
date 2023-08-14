import process from 'node:process'
import { glob } from '@stacksjs/storage'
import { corePath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { italic, log, runCommand } from '@stacksjs/cli'

log.info('Building core packages')

const dirs = (await glob([corePath('*')], { onlyDirectories: true }))

if (dirs.length === 0) {
  log.info('No core packages found')
  process.exit(ExitCode.FatalError)
}

// Create an array of all build processes
dirs.map(async (folder) => {
  const path = folder

  log.info(`Building ${italic(path)}`)

  const result = await runCommand('bun --bun run build', {
    cwd: path,
  })

  if (result.isErr()) {
    log.error(`Failed to build ${italic(path)}`)
    process.exit(ExitCode.FatalError)
  }

  log.success(`Built ${italic(path)}`)
})

// run the tsc command
// log.info('Generating type definitions...')

// const tscResult = await runCommand('bun --bun tsc', projectPath())

// if (tscResult.isErr()) {
//   log.error(tscResult.error)
//   process.exit(ExitCode.FatalError)
// }

// log.success('Generated type definitions')

// move type definitions to the dist folder
// log.info('Moving type definitions to dist folder...')
// const moveResult = await runCommand('bun --bun move-dts-files.ts', {
//   cwd: import.meta.dir
// })

// if (moveResult.isErr()) {
//   log.error(moveResult.error)
//   process.exit(ExitCode.FatalError)
// }

// log.success('Moved type definitions to dist folder')

// move core/*/dist/src/* to core/*/dist/*
// log.info('Moving built source files to dist folder...')
// const moveSrcResult = await runCommand('bun --bun move-built-src-files.ts', import.meta.dir)

// if (moveSrcResult.isErr()) {
//   log.error(moveSrcResult.error)
//   process.exit(ExitCode.FatalError)
// }

// log.success('Moved built source files in the dist folder')

log.success('Build complete')

// process.exit(ExitCode.Success)
