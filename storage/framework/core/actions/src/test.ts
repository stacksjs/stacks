import { runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'

console.log('Running Test...', NpmScript.Test)
await runCommand(NpmScript.Test, { verbose: true, cwd: projectPath() })
