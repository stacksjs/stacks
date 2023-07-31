import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommands([
  'bun buddy clean',
  'bun install',
], { cwd: frameworkPath(), verbose: true })
