import { runCommand } from 'stacks:cli'
import { frameworkPath } from 'stacks:path'

await runCommand(
  'bunx bumpp ./package.json ./core/**/package.json ./ide/vscode/package.json --execute "buddy changelog --quiet" --all',
  { verbose: true, cwd: frameworkPath() },
)
