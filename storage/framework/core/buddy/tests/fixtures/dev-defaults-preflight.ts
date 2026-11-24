import { cli } from '@stacksjs/cli'
import { dev } from '../../src/commands/dev'

const buddy = cli('buddy')
dev(buddy)
try {
  const args = process.argv.slice(2)
  await buddy.parse(['bun', 'buddy', ...(args.length ? args : ['dev', 'fixture-unknown-server'])])
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
