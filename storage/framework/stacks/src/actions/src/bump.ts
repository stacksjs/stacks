import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand(
  'bunx bumpp ./package.json ./src/**/package.json ./ide/vscode/package.json --execute "buddy changelog --quiet" --all',
  { verbose: true, cwd: frameworkPath() },
)
