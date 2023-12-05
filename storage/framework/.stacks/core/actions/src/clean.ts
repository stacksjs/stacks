import { log } from 'stacks:logging'
import { clean } from 'stacks:utils'

log.info('Running clean command...')

await clean()
