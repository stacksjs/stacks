import process from 'node:process'
import { log } from '@stacksjs/logging'
import { importModelDocuments } from '@stacksjs/search-engine'

const result = await importModelDocuments()

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
}

process.exit(0)