import { log } from '@stacksjs/cli'
import aws from 'aws-sdk'

export * from './drivers'

const route53domains = new aws.Route53Domains({ region: 'us-east-1' })

const params = {
  DomainName: 'example.com',
  DurationInYears: 1,
  AutoRenew: true,
  AdminContact: {
    FirstName: 'John',
    LastName: 'Doe',
    ContactType: 'PERSON',
    OrganizationName: 'Example Inc.',
    AddressLine1: '555 Any Street',
    City: 'Any City',
    State: 'NY',
    CountryCode: 'US',
    ZipCode: '11111',
    PhoneNumber: '+1.1111111111',
    Email: '',
  },
  RegistrantContact: {
    FirstName: 'John',
    LastName: 'Doe',
    ContactType: 'PERSON',
    OrganizationName: 'Example Inc.',
    AddressLine1: '555 Any Street',
    City: 'Any City',
    State: 'NY',
    CountryCode: 'US',
    ZipCode: '11111',
    PhoneNumber: '+1.1111111111',
    Email: '',
  },
  TechContact: {
    FirstName: 'John',
    LastName: 'Doe',
    ContactType: 'PERSON',
    OrganizationName: 'Example Inc.',
    AddressLine1: '555 Any Street',
    City: 'Any City',
    State: 'NY',
    CountryCode: 'US',
    ZipCode: '11111',
    PhoneNumber: '+1.1111111111',
    Email: '',
  },
  PrivacyProtectAdminContact: true,
  PrivacyProtectRegistrantContact: true,
  PrivacyProtectTechContact: true,
}

route53domains.registerDomain(params, (err, data) => {
  if (err)
    handleError(err, err.stack)
  else
    log.info(data)
})
