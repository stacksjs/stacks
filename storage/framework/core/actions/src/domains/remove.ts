import process from 'node:process'
import { parseOptions } from '@stacksjs/cli'
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

// No fallback to the app's own domain. This deletes every record in a hosted
// zone, and the fallback is how `buddy domains:remove other.com` - whose
// domain never reached here - deleted the app's DNS instead. A removal names
// its domain or does not happen.
if (!options.domain) {
  handleError('No domain was given to remove. Run `buddy domains:remove <domain>`.')
  process.exit(1)
}

if (options.verbose)
  log.info(`Removing domain: ${options.domain}`)

// const result = await deleteHostedZone(options.domain)
const result = await deleteHostedZoneRecords(options.domain)

if (result.isErr) {
  handleError(result.error)
  process.exit(1)
}
