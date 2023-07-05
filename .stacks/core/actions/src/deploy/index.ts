import type { DeployOptions } from '@stacksjs/types'
import { parseOptions } from '@stacksjs/cli'

const options: DeployOptions = parseOptions()

if (options.domains) {
  // deploy the config APP_URL to AWS

}

// TODO: create this action
