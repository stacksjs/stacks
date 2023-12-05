import { NpmScript } from 'stacks:enums'
import { runCommand } from 'stacks:cli'
import { frameworkPath } from 'stacks:path'

await runCommand(NpmScript.TestFeature, { verbose: true, cwd: frameworkPath() })
