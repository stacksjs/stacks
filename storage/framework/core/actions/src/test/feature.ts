import { runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { frameworkPath } from '@stacksjs/path'

await runCommand(NpmScript.TestFeature, {
  verbose: true,
  cwd: frameworkPath(),
})
