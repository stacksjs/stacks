import { frameworkPath } from '@stacksjs/path'
import { runCommands } from '@stacksjs/cli'

await runCommands([
  'bunx mkdist -d', // command to build the dist folder
  'pnpm build:cli', // command to build the Buddy CLI
  'pnpm build:core', // command to build the Stacks Core
  'cp -a ./core/. ./', // copy the core stacks to the famework's root
], { verbose: true, cwd: frameworkPath() })
