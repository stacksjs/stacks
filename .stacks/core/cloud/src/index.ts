import { log } from '@stacksjs/cli'
import { err, ok } from '@stacksjs/error-handling'
import aws from 'aws-sdk'

export * from './drivers'

interface PurchaseOptions {
  domain: string
  years: number
  privacy?: boolean
  autoRenew?: boolean
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
  privacyAdmin?: boolean
  privacyTech?: boolean
  privacyRegistrant?: boolean
  verbose?: boolean
}

export function purchaseDomain(domain: string, options: PurchaseOptions) {
  const route53domains = new aws.Route53Domains({ region: 'us-east-1' })
  const params = {
    DomainName: domain,
    DurationInYears: options.years || 1,
    AutoRenew: options.autoRenew || true,
    AdminContact: {
      FirstName: options.adminFirstName,
      LastName: options.adminLastName,
      ContactType: 'PERSON',
      OrganizationName: options.adminOrganization,
      AddressLine1: options.adminAddress,
      City: options.adminCity,
      State: options.adminState,
      CountryCode: options.adminCountry,
      ZipCode: options.adminZip,
      PhoneNumber: options.adminPhone,
      Email: options.adminEmail,
    },
    RegistrantContact: {
      FirstName: options.registrantFirstName,
      LastName: options.registrantLastName,
      ContactType: 'PERSON',
      OrganizationName: options.registrantOrganization,
      AddressLine1: options.registrantAddress,
      City: options.registrantCity,
      State: options.registrantState,
      CountryCode: options.registrantCountry,
      ZipCode: options.registrantZip,
      PhoneNumber: options.registrantPhone,
      Email: options.registrantEmail,
    },
    TechContact: {
      FirstName: options.techFirstName,
      LastName: options.techLastName,
      ContactType: 'PERSON',
      OrganizationName: options.techOrganization,
      AddressLine1: options.techAddress,
      City: options.techCity,
      State: options.techState,
      CountryCode: options.techCountry,
      ZipCode: options.techZip,
      PhoneNumber: options.techPhone,
      Email: options.techEmail,
    },
    PrivacyProtectAdminContact: options.privacyAdmin || options.privacy || true,
    PrivacyProtectRegistrantContact: options.privacyRegistrant || options.privacy || true,
    PrivacyProtectTechContact: options.privacyTech || options.privacy || true,
  }

  const result = route53domains.registerDomain(params, (error, data) => {
    if (error)
      return error

    log.info(data)
    return data
  })

  if (result instanceof Error)
    return err(result)

  return ok(result)
}
