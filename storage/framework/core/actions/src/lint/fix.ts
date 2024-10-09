import process from 'node:process'
import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'

// TODO: this should be a loader
log.info('Ensuring Code Style...')

const options = parseOptions()

const result = await runCommand(NpmScript.LintFix, {
  cwd: projectPath(),
  ...options,
})

if (result.isErr()) {
  log.error('There was an error fixing your code style.')
  console.error(result.error)
  process.exit(1)
}

log.success('Linted')
