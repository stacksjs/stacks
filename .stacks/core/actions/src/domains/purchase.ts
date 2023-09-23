import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { log, parseOptions } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { purchaseDomain } from '@stacksjs/cloud'

interface PurchaseOptions {
  domain: string
  years: number
  privacy: boolean
  autoRenew: boolean
  adminFirstName: string
  adminLastName: string
  adminOrganization: string
  adminAddress: string
  adminCity: string
  adminState: string
  adminCountry: string
  adminZip: string
  adminPhone: string
  adminEmail: string
  techFirstName: string
  techLastName: string
  techOrganization: string
  techAddress: string
  techCity: string
  techState: string
  techCountry: string
  techZip: string
  techPhone: string
  techEmail: string
  registrantFirstName: string
  registrantLastName: string
  registrantOrganization: string
  registrantAddress: string
  registrantCity: string
  registrantState: string
  registrantCountry: string
  registrantZip: string
  registrantPhone: string
  registrantEmail: string
  privacyAdmin: boolean
  privacyTech: boolean
  privacyRegistrant: boolean
  contactType: string
  verbose: boolean
}

const parsedOptions = parseOptions()
const options: PurchaseOptions = {
  domain: parsedOptions.domain as string,
  verbose: parsedOptions.verbose as boolean,
  years: parsedOptions.years as number,
  privacy: parsedOptions.privacy as boolean,
  autoRenew: parsedOptions.autoRenew as boolean,
  registrantFirstName: parsedOptions.registrantFirstName as string,
  registrantLastName: parsedOptions.registrantLastName as string,
  registrantOrganization: parsedOptions.registrantOrganization as string,
  registrantAddress: parsedOptions.registrantAddress as string,
  registrantCity: parsedOptions.registrantCity as string,
  registrantState: parsedOptions.registrantState as string,
  registrantCountry: parsedOptions.registrantCountry as string,
  registrantZip: parsedOptions.registrantZip as string,
  registrantPhone: parsedOptions.registrantPhone as string,
  registrantEmail: parsedOptions.registrantEmail as string,
  adminFirstName: parsedOptions.adminFirstName as string,
  adminLastName: parsedOptions.adminLastName as string,
  adminOrganization: parsedOptions.adminOrganization as string,
  adminAddress: parsedOptions.adminAddress as string,
  adminCity: parsedOptions.adminCity as string,
  adminState: parsedOptions.adminState as string,
  adminCountry: parsedOptions.adminCountry as string,
  adminZip: parsedOptions.adminZip as string,
  adminPhone: parsedOptions.adminPhone as string,
  adminEmail: parsedOptions.adminEmail as string,
  techFirstName: parsedOptions.techFirstName as string,
  techLastName: parsedOptions.techLastName as string,
  techOrganization: parsedOptions.techOrganization as string,
  techAddress: parsedOptions.techAddress as string,
  techCity: parsedOptions.techCity as string,
  techState: parsedOptions.techState as string,
  techCountry: parsedOptions.techCountry as string,
  techZip: parsedOptions.techZip as string,
  techPhone: parsedOptions.techPhone as string,
  techEmail: parsedOptions.techEmail as string,
  privacyAdmin: parsedOptions.privacyAdmin as boolean,
  privacyTech: parsedOptions.privacyTech as boolean,
  privacyRegistrant: parsedOptions.privacyRegistrant as boolean,
  contactType: parsedOptions.contactType as string,
}

if (!options.domain) {
  handleError('You must provide a domain name to purchase.')
  process.exit(ExitCode.FatalError)
}

const result = purchaseDomain(options.domain, options)

if (result.isErr()) {
  handleError(result.error)
  process.exit(ExitCode.FatalError)
}

log.info(result.value)
process.exit(ExitCode.Success)
