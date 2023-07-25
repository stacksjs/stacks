import { frameworkPath } from '@stacksjs/path'
import { runCommands } from '@stacksjs/cli'

await runCommands([
  'pnpm build:cli', // command to build the Buddy CLI
  'pnpm build:core', // command to build the Stacks Core
], { verbose: true, cwd: frameworkPath() })
