import { frameworkPath } from '@stacksjs/path'
import { runCommands } from '@stacksjs/cli'

await runCommands([
  'pnpm -r --filter "./core/*" --filter "!./core/x-ray" build', // build all packages except x-ray (which is a dev tool/app)
], { verbose: true, cwd: frameworkPath() })
