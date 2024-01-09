import { runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

await runCommand(
  'bunx bumpp ./package.json ./src/**/package.json ../ide/vscode/package.json --execute "bud changelog --quiet" --all',
  { cwd: p.frameworkStoragePath('stacks'), stdin: 'inherit' },
)
