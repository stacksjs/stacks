import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommand('npx eslint . --fix', { verbose: true, cwd: projectPath() })
