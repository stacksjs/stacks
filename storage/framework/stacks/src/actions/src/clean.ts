import { log } from 'src/logging/src'
import { clean } from 'src/utils/src'

log.info('Running clean command...')

await clean()
