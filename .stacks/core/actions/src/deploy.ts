import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

// TODO: create this action
await runCommands([
  'pnpm buddy clean',
  'pnpm install',
], { cwd: frameworkPath(), verbose: true })
