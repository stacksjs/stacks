import { cli } from '@stacksjs/cli'
import { dev } from '../../src/commands/dev'

const buddy = cli('buddy')
dev(buddy)
try {
  // Exercise real command dispatch without ever selecting a server or watcher.
  await buddy.parse(['bun', 'buddy', 'dev', 'fixture-unknown-server'])
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
