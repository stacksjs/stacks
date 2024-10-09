import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { deleteHostedZoneRecords } from '@stacksjs/dns'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'

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

if (options.verbose)
  log.info(`Removing domain: ${options.domain}`)

// const result = await deleteHostedZone(options.domain)
const result = await deleteHostedZoneRecords(options.domain)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}
