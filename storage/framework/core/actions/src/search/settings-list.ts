import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { listIndexSettings } from '@stacksjs/search-engine'

const options = parseOptions()

const modelOption = options.model as string

const result = await listIndexSettings(modelOption)

if (result?.isErr()) {
  console.error(result.error)
  log.error('Listing index settings failed', result.error)
}

process.exit(0)
