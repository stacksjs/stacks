import process from 'node:process'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { runtimePath } from '@stacksjs/path'
import { runNpmScript } from '@stacksjs/utils'

log.info('Running prepublish command...')

// right before we publish, we need to build Stacks
const result = await runNpmScript(NpmScript.BuildStacks, {
  verbose: true,
  cwd: runtimePath(),
})

if (result.isErr()) {
  log.error(new Error('There was an error while prepublishing your stack'), result.error)
  process.exit()
}

log.success('Prepublishing completed')
