import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

// eslint-disable-next-line no-console
console.log('verboshe')

await runCommand(NpmScript.Lint, { cwd: projectPath(), verbose: true })
