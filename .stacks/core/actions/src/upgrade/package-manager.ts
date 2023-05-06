import { parseRawArgs, runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/types'

await runCommand(NpmScript.UpgradePackageManager, parseRawArgs())
