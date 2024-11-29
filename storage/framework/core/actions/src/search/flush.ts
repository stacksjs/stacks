import process from 'node:process'
import { log } from '@stacksjs/logging'
import { flushModelDocuments } from '@stacksjs/search-engine'

const result = await flushModelDocuments()

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
}

process.exit(0)
