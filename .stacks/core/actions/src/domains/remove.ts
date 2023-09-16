import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { deleteHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { logger } from '@stacksjs/logging'

logger.log(`Removing domain: ${app.url}`)

if (!app.url) {
  handleError('./config app.url is not defined')
  process.exit(1)
}

const result = await deleteHostedZone(app.url)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}

logger.log('')
logger.log('✅ Removed your domain')
