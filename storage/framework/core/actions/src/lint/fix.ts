import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/enums'

log.info('Ensuring Code Style...')
const options = parseOptions()
await runCommand(NpmScript.LintFix, { cwd: projectPath() }, options)
log.success('Linted')
