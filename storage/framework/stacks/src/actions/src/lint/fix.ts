import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/enums'

await runCommands([NpmScript.LintFix], { cwd: projectPath() })
