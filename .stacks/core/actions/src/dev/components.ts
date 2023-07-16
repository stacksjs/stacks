import { parseOptions, runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import type { DeployOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

const options: DeployOptions = parseOptions()
await runCommand(NpmScript.DevComponents, {
  cwd: frameworkPath(),
  verbose: true,
  // ...options,
})
