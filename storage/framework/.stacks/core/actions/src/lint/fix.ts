import { runCommands } from 'stacks:cli'
import { projectPath } from 'stacks:path'
import { NpmScript } from 'stacks:enums'

await runCommands([NpmScript.LintFix], { cwd: projectPath() })
