import { NpmScript } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand(NpmScript.TestUi, { debug: true, cwd: frameworkPath() })
