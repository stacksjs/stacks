import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand(
  'npx bumpp ./package.json ./buddy/package.json ./core/**/package.json ./vscode/package.json --execute "buddy changelog --quiet" --all',
  { verbose: true, cwd: frameworkPath(), shell: true },
)
