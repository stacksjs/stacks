import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { logger } from '@stacksjs/logging'
import { deleteHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { parseOptions } from '@stacksjs/cli'

interface RemoveOptions {
  domain?: string
  verbose: boolean
}

const parsedOptions = parseOptions()
const options: RemoveOptions = {
  domain: parsedOptions.domain as string,
  verbose: parsedOptions.verbose as boolean,
}

if (!options.domain) {
  if (app.url) {
    options.domain = app.url
  }
  else {
    handleError('there was no domain provided when')
    process.exit(1)
  }
}

logger.log(`Removing domain: ${options.domain}`)

const result = await deleteHostedZone(options.domain)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}

logger.log('')
logger.log('✅ Removed your domain')
