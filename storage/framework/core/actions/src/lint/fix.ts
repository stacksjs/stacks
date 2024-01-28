import { log, runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/enums'

log.info('Ensuring Code Style...')
await runCommands([NpmScript.LintFix], { cwd: projectPath() })
log.success('Linted')
