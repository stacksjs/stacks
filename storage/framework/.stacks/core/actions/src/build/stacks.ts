import { frameworkPath } from 'stacks:path'
import { runCommands } from 'stacks:cli'

await runCommands([
  'bun build:cli', // command to build the Buddy CLI
  'bun build:core', // command to build the Stacks Core
], { verbose: true, cwd: frameworkPath() })
