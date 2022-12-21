import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand(
  'npx bumpp ./package.json ./buddy/package.json ./core/**/package.json ./vscode/package.json --execute \'pnpm buddy changelog\' --all',
  { debug: true, cwd: frameworkPath(), shell: true },
)
