import type { PurchaseOptions } from '@stacksjs/cloud'
import process from 'node:process'
import { log, parseOptions } from '@stacksjs/cli'
import { applyPurchaseFlags, purchaseDomain, purchaseOptionsFromContactInfo } from '@stacksjs/cloud'
import { awaitConfig } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'

// Awaited: read synchronously at import, `config.dns` is still the framework
// default, which has no contact info, so this exited with "you must provide
// contact info" for every app that had.
const { dns } = await awaitConfig()
const contactInfo = dns?.contactInfo

if (!contactInfo || Object.keys(contactInfo).length === 0) {
  handleError('You must provide contact info in config/dns.ts (`contactInfo`) to register a domain.')
  process.exit(ExitCode.FatalError)
}

const options: PurchaseOptions = applyPurchaseFlags(purchaseOptionsFromContactInfo(contactInfo), parseOptions())

if (!options.domain) {
  handleError('You must provide a domain name to purchase.')
  process.exit(ExitCode.FatalError)
}

const result = await purchaseDomain(options.domain, options)

if (result.isErr) {
  handleError(result.error)
  process.exit(ExitCode.FatalError)
}

log.success(`Route 53 accepted the registration of ${options.domain} (operation ${result.value.OperationId}). It completes at AWS within minutes to hours; the registrant email receives a confirmation.`)

await log.flush()
process.exit(ExitCode.Success)
