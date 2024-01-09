import { runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

await runCommand(
  'bunx bumpp ./stacks/package.json ./stacks/src/**/package.json ./ide/vscode/package.json --execute "buddy changelog --quiet" --all',
  { cwd: p.frameworkStoragePath(), stdin: 'inherit' },
)
