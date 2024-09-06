import { parseOptions, runCommand } from '@stacksjs/cli'
import { libsPath } from '@stacksjs/path'
import type { DeployOptions } from '@stacksjs/types'

const options: DeployOptions = parseOptions()

if (options.verbose) console.log('dev components options', options)

await runCommand(`bun run dev`, {
  ...options,
  cwd: libsPath('components/vue'),
})
