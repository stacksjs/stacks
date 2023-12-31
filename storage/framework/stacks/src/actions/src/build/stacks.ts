import { frameworkPath } from 'src/path/src'
import { runCommands } from 'src/cli/src'

await runCommands([
  'bun build:cli', // command to build the Buddy CLI
  'bun build:core', // command to build the Stacks Core
], { verbose: true, cwd: frameworkPath() })
