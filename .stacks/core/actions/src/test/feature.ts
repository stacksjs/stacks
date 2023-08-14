import { NpmScript } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

runCommand(NpmScript.TestFeature, { verbose: true, cwd: frameworkPath() })
