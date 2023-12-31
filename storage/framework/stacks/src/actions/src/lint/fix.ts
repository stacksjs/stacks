import { runCommands } from 'src/cli/src'
import { projectPath } from 'src/path/src'
import { NpmScript } from 'src/enums/src'

await runCommands([NpmScript.LintFix], { cwd: projectPath() })
