import { runCommand } from 'src/cli/src'
import { frameworkPath } from 'src/path/src'

await runCommand(
  'bunx bumpp ./package.json ./core/**/package.json ./ide/vscode/package.json --execute "buddy changelog --quiet" --all',
  { verbose: true, cwd: frameworkPath() },
)
