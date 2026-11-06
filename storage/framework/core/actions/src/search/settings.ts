import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { updateIndexSettings } from '@stacksjs/search-engine'
import { prepareSearchModels } from './bootstrap'

await prepareSearchModels()

const result = await updateIndexSettings(parseOptions().model as string | undefined)

if (result?.isErr) {
  console.error(result.error)
  await log.error('Updating search settings failed', result.error)
  await log.flush()
  process.exit(1)
}

await log.flush()
process.exit(0)
