import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { flushModelDocuments } from '@stacksjs/search-engine'

const options = parseOptions()

const modelOption = options.model as string

const result = await flushModelDocuments(modelOption)

if (result?.isErr()) {
  console.error(result.error)
  log.error('Flushing search engine failed', result.error)
}

process.exit(0)
