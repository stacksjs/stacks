// import type { DeployOptions } from '@stacksjs/types'
import { cloudPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

await runCommand('bun run deploy', {
  cwd: cloudPath(),
})
