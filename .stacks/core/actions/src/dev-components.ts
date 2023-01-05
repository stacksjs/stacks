import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import { NpmScript } from 'stacks'

await runCommand(NpmScript.DevComponents, { cwd: frameworkPath(), debug: true })
