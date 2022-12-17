import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommands([
  'pnpm run clean',
  'pnpm install',
], { cwd: frameworkPath(), debug: true })
