import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommands(
  [
    'bun build:cli', // command to build the Buddy CLI
    'bun build:core', // command to build the Stacks Core
  ],
  { verbose: true, cwd: frameworkPath() },
)
