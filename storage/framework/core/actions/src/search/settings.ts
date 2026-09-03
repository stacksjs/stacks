import process from 'node:process'
import { log } from '@stacksjs/logging'
import { updateIndexSettings } from '@stacksjs/search-engine'

const result = await updateIndexSettings()

if (result?.isErr) {
  console.error(result.error)
  await log.error('generateMigrations failed', result.error)
}

process.exit(0)
