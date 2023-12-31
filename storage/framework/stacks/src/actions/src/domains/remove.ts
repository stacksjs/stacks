import process from 'node:process'
import { handleError } from 'src/error-handling/src'
import { logger } from 'src/logging/src'
import { deleteHostedZoneRecords } from 'src/dns/src'
import { app } from 'src/config/src'
import { parseOptions } from 'src/cli/src'

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
  logger.log(`Removing domain: ${options.domain}`)

// const result = await deleteHostedZone(options.domain)
const result = await deleteHostedZoneRecords(options.domain)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}
