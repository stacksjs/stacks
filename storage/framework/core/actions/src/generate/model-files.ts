import { log } from '@stacksjs/logging'
import { generateModelFiles } from '@stacksjs/orm'

log.info('Generating Model files...')
await generateModelFiles()
log.success('Model files generated successfully')
