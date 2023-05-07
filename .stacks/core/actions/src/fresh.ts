import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommands([
  'buddy clean',
  'pnpm install',
], { cwd: frameworkPath(), verbose: true })
