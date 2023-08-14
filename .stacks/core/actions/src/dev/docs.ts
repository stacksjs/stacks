import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

runCommand(NpmScript.DevDocs, { cwd: frameworkPath(), verbose: true })
