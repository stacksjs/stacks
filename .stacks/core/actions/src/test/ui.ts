import { NpmScript } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

runCommand(NpmScript.TestUi, { verbose: true, cwd: frameworkPath() })
