import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommand(
  'changelogen --output CHANGELOG.md --from $(git describe --abbrev=0 --tags HEAD^)  --to $(git describe)',
  { debug: true, cwd: projectPath(), shell: true },
)
