import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommands([
  'pnpm buddy clean',
  'pnpm install',
], { cwd: frameworkPath(), verbose: true })
