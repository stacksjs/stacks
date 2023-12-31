import { NpmScript } from 'src/enums/src'
import { runCommands } from 'src/cli/src'
import { projectPath } from 'src/path/src'

await runCommands([NpmScript.TestTypes], { cwd: projectPath() })
