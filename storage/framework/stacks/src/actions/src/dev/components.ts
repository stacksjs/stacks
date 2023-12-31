import { frameworkPath, vitePath } from '@stacksjs/path'
import { parseOptions, runCommand } from '@stacksjs/cli'
import type { DeployOptions } from 'src/types/src'

const options: DeployOptions = parseOptions()

if (options.verbose)
  // eslint-disable-next-line no-console
  console.log('dev components options', options)

await runCommand(`bunx --bun vite --config ${vitePath('src/components.ts')}`, {
  ...options,
  cwd: frameworkPath(),
})
