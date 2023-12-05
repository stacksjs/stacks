import { NpmScript } from 'stacks:enums'
import { runCommand } from 'stacks:cli'
import { frameworkPath } from 'stacks:path'

await runCommand(NpmScript.TestUnit, { verbose: true, cwd: frameworkPath() })
