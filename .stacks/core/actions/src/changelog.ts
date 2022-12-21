import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommand(
  'changelogen --output CHANGELOG.md',
  { debug: true, cwd: projectPath(), shell: true },
)
