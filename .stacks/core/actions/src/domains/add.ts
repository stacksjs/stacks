import process from 'node:process'
import { createHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { projectStoragePath } from '@stacksjs/path'
import { italic, parseOptions, prompt } from '@stacksjs/cli'
import { logger } from '@stacksjs/logging'

interface AddOptions {
  domain?: string
  verbose: boolean
}

const parsedOptions = parseOptions()
const options: AddOptions = {
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

logger.log(`Adding your domain: ${options.domain}`)

const result = await createHostedZone(options.domain)

if (result.isErr()) {
  handleError('Failed to add domain', result.error)
  process.exit(1)
}

const nameservers = result.value

logger.log('')
logger.log('✅ Added your domain')
logger.log(`  Nameservers: ${nameservers.join(', ')}`)
logger.log(`  Cached in: ${projectStoragePath('framework/cache/nameservers.txt')}`)
