import { err, ok } from '@stacksjs/error-handling'
import { Route53Domains } from '@aws-sdk/client-route-53-domains'

export * from './drivers'

export interface PurchaseOptions {
  domain: string
  years: number
  privacy: boolean
  autoRenew: boolean
  adminFirstName: string
  adminLastName: string
  adminOrganization: string
  adminAddressLine1: string
  adminAddressLine2: string
  adminCity: string
  adminState: string
  adminCountry: string
  adminZip: string
  adminPhone: string
  adminEmail: string
  techFirstName: string
  techLastName: string
  techOrganization: string
  techAddressLine1: string
  techAddressLine2: string
  techCity: string
  techState: string
  techCountry: string
  techZip: string
  techPhone: string
  techEmail: string
  registrantFirstName: string
  registrantLastName: string
  registrantOrganization: string
  registrantAddressLine1: string
  registrantAddressLine2: string
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

export async function purchaseDomain(domain: string, options: PurchaseOptions) {
  const route53domains = new Route53Domains({ region: 'us-east-1' })
  const params = {
    DomainName: domain,
    DurationInYears: options.years || 1,
    AutoRenew: options.autoRenew || true,
    AdminContact: {
      FirstName: options.adminFirstName,
      LastName: options.adminLastName,
      ContactType: options.contactType.toUpperCase() || 'PERSON',
      OrganizationName: options.adminOrganization,
      AddressLine1: options.adminAddressLine1,
      AddressLine2: options.adminAddressLine2,
      City: options.adminCity,
      State: options.adminState,
      CountryCode: options.adminCountry,
      ZipCode: options.adminZip.toString(),
      PhoneNumber: options.adminPhone.toString().includes('+') ? options.adminPhone.toString() : `+${options.adminPhone.toString()}`,
      Email: options.adminEmail,
    },
    RegistrantContact: {
      FirstName: options.registrantFirstName,
      LastName: options.registrantLastName,
      ContactType: options.contactType.toUpperCase() || 'PERSON',
      OrganizationName: options.registrantOrganization,
      AddressLine1: options.registrantAddressLine1,
      AddressLine2: options.registrantAddressLine2,
      City: options.registrantCity,
      State: options.registrantState,
      CountryCode: options.registrantCountry,
      ZipCode: options.registrantZip.toString(),
      PhoneNumber: options.registrantPhone.toString().includes('+') ? options.registrantPhone.toString() : `+${options.registrantPhone.toString()}`,
      Email: options.registrantEmail,
    },
    TechContact: {
      FirstName: options.techFirstName,
      LastName: options.techLastName,
      ContactType: options.contactType.toUpperCase() || 'PERSON',
      OrganizationName: options.techOrganization,
      AddressLine1: options.techAddressLine1,
      AddressLine2: options.techAddressLine2,
      City: options.techCity,
      State: options.techState,
      CountryCode: options.techCountry,
      ZipCode: options.techZip.toString(),
      PhoneNumber: options.techPhone.toString().includes('+') ? options.techPhone.toString() : `+${options.techPhone.toString()}`,
      Email: options.techEmail,
    },
    PrivacyProtectAdminContact: options.privacyAdmin || options.privacy || true,
    PrivacyProtectRegistrantContact: options.privacyRegistrant || options.privacy || true,
    PrivacyProtectTechContact: options.privacyTech || options.privacy || true,
  }

  try {
    return ok(await route53domains.registerDomain(params))
  }
  catch (error: any) {
    return err(error)
  }
}
