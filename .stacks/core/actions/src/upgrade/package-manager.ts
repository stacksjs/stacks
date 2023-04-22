import { runCommand, parseArgs } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/types'

await runCommand(NpmScript.UpgradePackageManager, parseArgs())
