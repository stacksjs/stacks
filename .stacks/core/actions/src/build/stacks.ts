import { frameworkPath } from '@stacksjs/path'
import { runCommands } from '@stacksjs/cli'

await runCommands([
  'bun build:cli', // command to build the Buddy CLI
  'bun build:core', // command to build the Stacks Core
], { verbose: true, cwd: frameworkPath() })
