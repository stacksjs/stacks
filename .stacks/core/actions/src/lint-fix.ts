import { runAction } from '@stacksjs/actions'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'

await runAction(Action.FixLintIssues, { cwd: projectPath(), shouldShowSpinner: true, spinnerText: 'Linting...' })
