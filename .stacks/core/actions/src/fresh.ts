import { parseRawArgs, runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

const options = parseRawArgs()
// eslint-disable-next-line no-console
console.log('here is opt', options)

await runCommands([
  'pnpm buddy clean',
  'pnpm install',
], { cwd: frameworkPath(), verbose: true })
