import { runCommand } from 'stacks:cli'
import { projectPath } from 'stacks:path'

await runCommand(
  'changelogen --output CHANGELOG.md --from $(git describe --abbrev=0 --tags HEAD^)  --to $(git describe)',
  { verbose: true, cwd: projectPath() },
)
