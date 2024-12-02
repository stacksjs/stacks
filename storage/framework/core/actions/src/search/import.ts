import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { importModelDocuments } from '@stacksjs/search-engine'

const options = parseOptions()

const modelOption = options.model as string

const result = await importModelDocuments(modelOption)

if (result?.isErr()) {
  console.error(result.error)
  log.error('Import to search engine failed', result.error)
}

process.exit(0)
