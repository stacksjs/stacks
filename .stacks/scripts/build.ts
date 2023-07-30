import { glob, p } from '@stacksjs/utils'
import { corePath } from '@stacksjs/path'
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
  process.exit(ExitCode.Success)
}
catch (err) {
  log.error('One or more builds failed', err)
  process.exit(ExitCode.FatalError)
}
