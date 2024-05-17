import { parseOptions, runCommand } from '@stacksjs/cli'
import { frameworkPath, viteConfigPath } from '@stacksjs/path'
import type { DeployOptions } from '@stacksjs/types'

const options: DeployOptions = parseOptions()

if (options.verbose) console.log('dev components options', options)

await runCommand(`bunx vite --config ${viteConfigPath('src/components.ts')}`, {
  ...options,
  cwd: frameworkPath(),
})
