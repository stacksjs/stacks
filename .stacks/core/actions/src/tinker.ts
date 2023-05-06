import { parseRawArgs } from '@stacksjs/cli'

const options = parseRawArgs()

console.log('options are:', options)

// await runCommands([
//   'npx tinker',
// ], { verbose: true })
