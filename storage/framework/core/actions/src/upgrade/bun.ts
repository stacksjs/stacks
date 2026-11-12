import process from 'node:process'
import { parseOptions, print } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { upgradeToolPreview } from './tool-preview'

if (parseOptions().dryRun) {
  print(upgradeToolPreview(Action.UpgradeBun))
  process.exit(ExitCode.Success)
}
// import { parseArgs, runCommand } from '@stacksjs/cli'
// import { NpmScript } from '@stacksjs/enums'
//
// await runCommand(NpmScript.UpgradeBun, parseArgs())
