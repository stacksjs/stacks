import { parseArgs, runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/types'

await runCommand(NpmScript.UpgradePackageManager, parseArgs())
