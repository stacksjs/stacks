// Prints what an action parses from its argv, for option-args.test.ts.
import { parseOptions } from '../../src/parse'

console.log(JSON.stringify({ options: parseOptions(), argv: process.argv.slice(2) }))
