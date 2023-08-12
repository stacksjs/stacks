import { frameworkPath } from '@stacksjs/path'
import { runCommands } from '@stacksjs/cli'

await runCommands([
  'pnpm -r --filter "./core/*" build',
], { verbose: true, cwd: frameworkPath() })
