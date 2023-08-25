import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

await runCommands([NpmScript.LintFix], { cwd: projectPath() })
