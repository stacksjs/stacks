import { parseArgs } from '@stacksjs/cli'

const options = parseArgs()

// eslint-disable-next-line no-console
console.log('options are:', options)

// await runCommands([
//   'bunx tinker',
// ], { verbose: true })