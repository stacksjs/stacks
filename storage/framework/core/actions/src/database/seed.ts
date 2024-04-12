import process from 'node:process'
import { log } from '@stacksjs/cli'
import { seed } from '@stacksjs/database'

log.info('Seeding database...')
await seed()

process.exit(0)
