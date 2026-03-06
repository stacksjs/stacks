import type { DeployOptions } from '@stacksjs/types'
import { parseOptions, runCommand } from '@stacksjs/cli'
import { libsPath } from '@stacksjs/path'

const options: DeployOptions = parseOptions()

// verbose logging handled by runCommand

await runCommand(`bun run dev`, {
  ...options,
  cwd: libsPath('components/vue'),
})
