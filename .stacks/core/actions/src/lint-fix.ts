import { runAction } from '@stacksjs/actions'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'

log.info('Linting your project.')
await runAction(Action.FixLintIssues, { cwd: projectPath(), shouldShowSpinner: true, spinnerText: 'Linting...' })
log.success('Linted your project.')
