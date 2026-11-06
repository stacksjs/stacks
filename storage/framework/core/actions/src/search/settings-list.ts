import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { listIndexSettings } from '@stacksjs/search-engine'
import { prepareSearchModels } from './bootstrap'

await prepareSearchModels()

const options = parseOptions()

const modelOption = options.model as string

const result = await listIndexSettings(modelOption)

if (result?.isErr) {
  console.error(result.error)
  await log.error('Listing index settings failed', result.error)
  await log.flush()
  process.exit(1)
}

await log.flush()
process.exit(0)
