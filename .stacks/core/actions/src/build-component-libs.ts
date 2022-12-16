import { log } from '@stacksjs/logging'
import { frameworkPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

log.info('Building Component Libraries...')

// run the `npx mkdist -d` command to build the dist folder
const result = await runCommand('npx mkdist -d', { debug: true, cwd: frameworkPath() })

if (result.isErr()) {
  log.error('There was an error running `npx mkdist -d`.', result.error)
  process.exit()
}

log.success('Building Stacks was successful.')
