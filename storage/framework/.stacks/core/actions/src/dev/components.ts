import { frameworkPath, vitePath } from 'stacks:path'
import { parseOptions, runCommand } from 'stacks:cli'
import type { DeployOptions } from 'stacks:types'

const options: DeployOptions = parseOptions()

if (options.verbose)
  // eslint-disable-next-line no-console
  console.log('dev components options', options)

await runCommand(`bunx --bun vite --config ${vitePath('src/vue-components.ts')}`, {
  ...options,
  cwd: frameworkPath(),
})
