import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

await runCommand(NpmScript.DevDocs, {
  cwd: frameworkPath('docs'),
  verbose: true,
})
