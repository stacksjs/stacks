import { NpmScript } from '@stacksjs/enums'
import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommands([NpmScript.TestTypes], { cwd: projectPath() })
