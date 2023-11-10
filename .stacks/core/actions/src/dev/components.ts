import { frameworkPath, vitePath } from '@stacksjs/path'
import { parseOptions, runCommand } from '@stacksjs/cli'
import type { DeployOptions } from '@stacksjs/types'


const options: DeployOptions = parseOptions()

if (options.verbose)
  console.log('dev components options', options)

await runCommand(`bunx --bun vite --config ${vitePath('src/vue-components.ts')}`, {
  ...options,
  cwd: frameworkPath(),
})
