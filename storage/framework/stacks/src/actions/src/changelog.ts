import { runCommand } from 'src/cli/src'
import { projectPath } from 'src/path/src'

await runCommand(
  'changelogen --output CHANGELOG.md --from $(git describe --abbrev=0 --tags HEAD^)  --to $(git describe)',
  { verbose: true, cwd: projectPath() },
)
