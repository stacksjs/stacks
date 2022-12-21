import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

const result = await runCommand(
  'npx bumpp ./package.json ./buddy/package.json ./core/**/package.json ./vscode/package.json --execute \'pnpm run changelog\' --all',
  { debug: true, cwd: frameworkPath(), shell: true },
)

if (result.isErr())
  console.error(result.error)
