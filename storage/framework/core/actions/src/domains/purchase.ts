import type { CountryCode } from '@aws-sdk/client-route-53-domains'
import type { PurchaseOptions } from '@stacksjs/cloud'
import process from 'node:process'
import { ContactType } from '@aws-sdk/client-route-53-domains'
import { log, parseOptions } from '@stacksjs/cli'
import { purchaseDomain } from '@stacksjs/cloud'
import { config } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'

const c = config.dns.contactInfo
if (!c) {
  handleError('You must provide contact info in your config file.')
  process.exit(ExitCode.FatalError)
}

const defaultOptions: PurchaseOptions = {
  domain: '',
  years: 1,
  privacy: true,
  autoRenew: true,
  registrantFirstName: c.firstName as string,
  registrantLastName: c.lastName as string,
  registrantOrganization: c.organizationName as string,
  registrantAddressLine1: c.addressLine1 as string,
  registrantAddressLine2: c.addressLine2 as string,
  registrantCity: c.city as string,
  registrantState: c.state as string,
  registrantCountry: c.countryCode as CountryCode,
  registrantZip: c.zip as string,
  registrantPhone: c.phoneNumber as string,
  registrantEmail: c.email as string,
  adminFirstName: c.admin?.firstName || (c.firstName as string),
  adminLastName: c.admin?.lastName || (c.lastName as string),
  adminOrganization: c.admin?.organizationName || (c.organizationName as string),
  adminAddressLine1: c.admin?.addressLine1 || (c.addressLine1 as string),
  adminAddressLine2: c.admin?.addressLine2 || (c.addressLine2 as string),
  adminCity: c.admin?.city || (c.city as string),
  adminState: c.admin?.state || (c.state as string),
  adminCountry: (c.admin?.countryCode as CountryCode) || (c.countryCode as string),
  adminZip: c.admin?.zip || (c.zip as string),
  adminPhone: (c.admin?.phoneNumber as string) || (c.phoneNumber as string),
  adminEmail: c.admin?.email || (c.email as string),
  techFirstName: c.tech?.firstName || (c.firstName as string),
  techLastName: c.tech?.lastName || (c.lastName as string),
  techOrganization: c.tech?.organizationName || (c.organizationName as string),
  techAddressLine1: c.tech?.addressLine1 || (c.addressLine1 as string),
  techAddressLine2: c.tech?.addressLine2 || (c.addressLine2 as string),
  techCity: c.tech?.city || (c.city as string),
  techState: c.tech?.state || (c.state as string),
  techCountry: (c.tech?.countryCode as CountryCode) || (c.countryCode as string),
  techZip: c.tech?.zip || (c.zip as string),
  techPhone: (c.tech?.phoneNumber as string) || (c.phoneNumber as string),
  techEmail: c.tech?.email || (c.email as string),
  privacyAdmin: c.privacyAdmin || c.privacy || true,
  privacyTech: c.privacyTech || c.privacy || true,
  privacyRegistrant: c.privacyRegistrant || c.privacy || true,
  contactType: ContactType.PERSON,
  verbose: false,
}

const options: PurchaseOptions = { ...defaultOptions, ...parseOptions() }

if (!options.domain) {
  handleError('You must provide a domain name to purchase.')
  process.exit(ExitCode.FatalError)
}

const result = purchaseDomain(options.domain, options)

if (result.isErr()) {
  handleError(result.error)
  process.exit(ExitCode.FatalError)
}

log.info('Domain purchased successfully.')

process.exit(ExitCode.Success)
