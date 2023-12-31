import process from 'node:process'
import { log } from 'src/logging/src'
import { runtimePath } from 'src/path/src'
import { runNpmScript } from 'src/utils/src'
import { NpmScript } from 'src/enums/src'

log.info('Running prepublish command...')

// right before we publish, we need to build Stacks
const result = await runNpmScript(NpmScript.BuildStacks, { verbose: true, cwd: runtimePath() })

if (result.isErr()) {
  log.error(new Error('There was an error while prepublishing your stack'), result.error)
  process.exit()
}

log.success('Prepublishing completed')
