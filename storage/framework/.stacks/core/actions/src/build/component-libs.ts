import { frameworkPath } from 'stacks:path'
import { runCommand } from 'stacks:cli'
import { NpmScript } from 'stacks:enums'

await runCommand(NpmScript.BuildComponents, { cwd: frameworkPath(), verbose: true })
