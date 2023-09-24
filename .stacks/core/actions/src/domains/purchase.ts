import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { log, parseOptions } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import type { PurchaseOptions } from '@stacksjs/cloud'
import { purchaseDomain } from '@stacksjs/cloud'

const defaultOptions: PurchaseOptions = {
  domain: '',
  years: 1,
  privacy: true,
  autoRenew: true,
  registrantFirstName: config.dns.contactInfo.firstName,
  registrantLastName: config.dns.contactInfo?.lastName,
  registrantOrganizationName: config.dns.contactInfo?.organizationName,
  registrantAddressLine1: config.dns.contactInfo?.addressLine1,
  registrantAddressLine2: config.dns.contactInfo?.addressLine2,
  registrantCity: config.dns.contactInfo?.city,
  registrantState: config.dns.contactInfo?.state,
  registrantCountryCode: config.dns.contactInfo?.countryCode,
  registrantZip: config.dns.contactInfo?.zip,
  registrantPhoneNumber: config.dns.contactInfo?.phoneNumber,
  registrantEmail: config.dns.contactInfo?.email,
    admin: {
      firstName: config.dns.contactInfo?.admin?.firstName || config.dns.contactInfo?.firstName,
      lastName: config.dns.contactInfo?.admin?.lastName || config.dns.contactInfo?.lastName,
      organizationName: config.dns.contactInfo?.admin?.organizationName || config.dns.contactInfo?.organizationName,
      addressLine1: config.dns.contactInfo?.admin?.addressLine1 || config.dns.contactInfo?.addressLine1,
      addressLine2: config.dns.contactInfo?.admin?.addressLine2 || config.dns.contactInfo?.addressLine2,
      city: config.dns.contactInfo?.admin?.city || config.dns.contactInfo?.city,
      state: config.dns.contactInfo?.admin?.state || config.dns.contactInfo?.state,
      countryCode: config.dns.contactInfo?.admin?.countryCode || config.dns.contactInfo?.countryCode,
      zip: config.dns.contactInfo?.admin?.zip || config.dns.contactInfo?.zip,
      phoneNumber: config.dns.contactInfo?.admin?.phoneNumber || config.dns.contactInfo?.phoneNumber,
      email: config.dns.contactInfo?.admin?.email || config.dns.contactInfo?.email,
    },
    tech: {
      firstName: config.dns.contactInfo?.tech?.firstName || config.dns.contactInfo?.firstName,
      lastName: config.dns.contactInfo?.tech?.lastName || config.dns.contactInfo?.lastName,
      organizationName: config.dns.contactInfo?.tech?.organizationName || config.dns.contactInfo?.organizationName,
      addressLine1: config.dns.contactInfo?.tech?.addressLine1 || config.dns.contactInfo?.addressLine1,
      addressLine2: config.dns.contactInfo?.tech?.addressLine2 || config.dns.contactInfo?.addressLine2,
      city: config.dns.contactInfo?.tech?.city || config.dns.contactInfo?.city,
      state: config.dns.contactInfo?.tech?.state || config.dns.contactInfo?.state,
      countryCode: config.dns.contactInfo?.tech?.countryCode || config.dns.contactInfo?.countryCode,
      zip: config.dns.contactInfo?.tech?.zip || config.dns.contactInfo?.zip,
      phoneNumber: config.dns.contactInfo?.tech?.phoneNumber || config.dns.contactInfo?.phoneNumber,
      email: config.dns.contactInfo?.tech?.email || config.dns.contactInfo?.email,
    },
    privacyAdmin: config.dns.contactInfo?.privacyAdmin || config.dns.contactInfo?.privacy || true,
    privacyTech: config.dns.contactInfo?.privacyTech || config.dns.contactInfo?.privacy || true,
    privacyRegistrant: config.dns.contactInfo?.privacyRegistrant || config.dns.contactInfo?.privacy || true,
    contactType: 'person',
  },

]

  // ... add the rest of the 38 properties here with their default values
}

const options: PurchaseOptions = { ...defaultOptions, ...parseOptions() }

const options: PurchaseOptions = parseOptions()

log.info('options is', options)
log.dd('domain is', options.domain)

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
