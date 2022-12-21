import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommand(
  'conventional-changelog -p angular -i CHANGELOG.md -s -r 0',
  { debug: true, cwd: projectPath(), shell: true },
)
