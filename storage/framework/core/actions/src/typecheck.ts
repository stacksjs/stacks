import { runCommands } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'

await runCommands([NpmScript.TestTypes], { cwd: projectPath() })
