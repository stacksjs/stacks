import { NpmScript } from '@stacksjs/enums'
import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand(NpmScript.Test, { verbose: true, cwd: frameworkPath() })
