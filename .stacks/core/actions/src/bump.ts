import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

runCommand(
  'bunx bumpp ./package.json ./core/**/package.json ./ide/vscode/package.json --execute "buddy changelog --quiet" --all',
  { verbose: true, cwd: frameworkPath() },
)
