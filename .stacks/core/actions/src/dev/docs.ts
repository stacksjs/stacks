import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

await runCommand(NpmScript.DevComponents, { cwd: frameworkPath(), verbose: true })
