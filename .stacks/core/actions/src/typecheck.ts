import { NpmScript } from '@stacksjs/types'
import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommands([NpmScript.TestTypes], { cwd: projectPath() })
