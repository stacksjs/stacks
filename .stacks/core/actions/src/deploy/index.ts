// import type { DeployOptions } from '@stacksjs/types'
import { cloudPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

await runCommand('cdk deploy', {
  cwd: cloudPath(),
})
