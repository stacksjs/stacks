import { frameworkPath } from 'src/path/src'
import { runCommand } from 'src/cli/src'
import { NpmScript } from 'src/enums/src'

await runCommand(NpmScript.BuildComponents, { cwd: frameworkPath(), verbose: true })
