import process from 'node:process'
import { createHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { projectStoragePath } from '@stacksjs/path'
import { italic } from '@stacksjs/cli'
import { logger } from '@stacksjs/logging'

logger.log('Adding your domain...', app.url)

if (!app.url) {
  handleError('./config app.url is not defined')
  process.exit(1)
}

const result = await createHostedZone(app.url)

if (result.isErr()) {
  handleError('Failed to add domain', app.url)
  process.exit(1)
}

const nameservers = result.value

logger.log('')
logger.log('✅ Added your domain')
logger.log(`  Nameservers: ${nameservers.join(', ')}`)
logger.log(`  Cached in: ${projectStoragePath('framework/cache/nameservers.txt')}`)
logger.log('')
logger.log(italic('Please update your domain nameservers to the above values.'))
