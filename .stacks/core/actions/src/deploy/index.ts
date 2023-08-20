// import type { DeployOptions } from '@stacksjs/types'
import { cloudPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

const options: DeployOptions = parseOptions()

runCommand('cdk deploy', {
  cwd: cloudPath(),
})

}

// TODO: create this action
