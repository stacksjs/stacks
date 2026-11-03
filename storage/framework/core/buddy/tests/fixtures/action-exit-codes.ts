// One buddy command, registered through the real CLI, run against actions
// that all fail (see failing-actions.ts).
import process from 'node:process'
import { cli } from '@stacksjs/cli'
import { build } from '../../src/commands/build'
import { prepublish } from '../../src/commands/prepublish'

const buddy = cli('buddy')
build(buddy)
prepublish(buddy)
await buddy.parse(['node', 'buddy', ...process.argv.slice(2)])
console.log('the command returned normally')
