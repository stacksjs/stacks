import process from 'node:process'
import { parseOptions, print } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { upgradeToolPreview } from './tool-preview'

if (parseOptions().dryRun) {
  print(upgradeToolPreview(Action.UpgradeDeps))
  process.exit(ExitCode.Success)
}
