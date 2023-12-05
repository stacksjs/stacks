import process from 'node:process'
import { log } from 'stacks:logging'
import { runtimePath } from 'stacks:path'
import { runNpmScript } from 'stacks:utils'
import { NpmScript } from 'stacks:enums'

log.info('Running prepublish command...')

// right before we publish, we need to build Stacks
const result = await runNpmScript(NpmScript.BuildStacks, { verbose: true, cwd: runtimePath() })

if (result.isErr()) {
  log.error(new Error('There was an error while prepublishing your stack'), result.error)
  process.exit()
}

log.success('Prepublishing completed')
