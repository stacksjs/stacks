import { runAction } from '@stacksjs/actions'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'

log.info('Linting your project.')
await runAction(Action.FixLintIssues, { debug: true, cwd: projectPath(), shouldShowSpinner: true })
log.success('Linted your project.')
