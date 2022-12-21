import { NpmScript } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'

await runCommand(NpmScript.Test, { debug: true })
