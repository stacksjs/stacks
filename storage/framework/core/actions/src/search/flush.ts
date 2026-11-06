import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { flushModelDocuments } from '@stacksjs/search-engine'
import { prepareSearchModels } from './bootstrap'

await prepareSearchModels()

const options = parseOptions()

const modelOption = options.model as string

const result = await flushModelDocuments(modelOption)

if (result?.isErr) {
  console.error(result.error)
  await log.error('Flushing search engine failed', result.error)
  await log.flush()
  process.exit(1)
}

await log.flush()
process.exit(0)
