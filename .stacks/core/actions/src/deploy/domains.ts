import { parseArgs, parseArgv, parseOptions } from '@stacksjs/cli'

const options = parseArgs()
const options2 = parseOptions()
const options3 = parseArgv()

// eslint-disable-next-line no-console
console.log('options', options)
// eslint-disable-next-line no-console
console.log('option2', options2)
// eslint-disable-next-line no-console
console.log('option3', options3)

// ...
