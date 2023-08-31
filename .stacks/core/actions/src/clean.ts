import { log } from '@stacksjs/logging'
import { clean } from '@stacksjs/utils'

log.info('Running clean command...')

await clean()
