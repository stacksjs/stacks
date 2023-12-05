import { NpmScript } from 'stacks:enums'
import { runCommands } from 'stacks:cli'
import { projectPath } from 'stacks:path'

await runCommands([NpmScript.TestTypes], { cwd: projectPath() })
