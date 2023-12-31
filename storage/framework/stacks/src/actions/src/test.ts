import { NpmScript } from 'src/enums/src'
import { runCommand } from 'src/cli/src'
import { frameworkPath } from 'src/path/src'

await runCommand(NpmScript.Test, { verbose: true, cwd: frameworkPath() })
