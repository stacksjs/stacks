import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

// import { parseOptions, runCommand } from '@stacksjs/cli'
// import type { DeployOptions } from '@stacksjs/types'

// console.log('running dev components')

// const options: DeployOptions = parseOptions()

await runCommand(NpmScript.DevComponents, {
  cwd: frameworkPath(),
  // ...options,
})
