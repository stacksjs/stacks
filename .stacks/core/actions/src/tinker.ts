import { parseArgs, runCommands } from '@stacksjs/cli'

const options = parseArgs()

console.log('options are:', options)

// await runCommands([
//   'npx tinker',
// ], { verbose: true })
