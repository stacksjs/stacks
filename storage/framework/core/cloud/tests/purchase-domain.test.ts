import { describe, expect, it } from 'bun:test'
import { purchaseDomain, purchaseOptionsFromContactInfo } from '../src/helpers'

/**
 * `buddy domains:purchase` printed "Domain purchased successfully." for every
 * domain, whatever AWS said: `purchaseDomain` returned `ok(<pending request>)`
 * and the action exited the process with the request still in flight. And
 * `privacy: false` / `autoRenew: false` were unexpressible, being written
 * `value || fallback || true`.
 */
const contact = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  organizationName: 'Analytical Engines',
  addressLine1: '12 St James Sq',
  city: 'London',
  state: 'London',
  countryCode: 'GB',
  zip: 'SW1Y 4JH',
  phoneNumber: '44.2079460000',
  email: 'ada@example.com',
} as const

function recordingRegistrar(response: { OperationId?: string } | Error = { OperationId: 'op-1' }) {
  const calls: any[] = []
  return {
    calls,
    registrar: {
      registerDomain: async (input: any) => {
        calls.push(input)
        if (response instanceof Error)
          throw response
        return response
      },
    },
  }
}

describe('purchaseDomain', () => {
  it('waits for Route 53 and returns its operation id', async () => {
    const { calls, registrar } = recordingRegistrar()
    const result = await purchaseDomain('example.com', { ...purchaseOptionsFromContactInfo(contact), domain: 'example.com' }, registrar)

    expect(result.isOk).toBe(true)
    expect(result.isOk && result.value.OperationId).toBe('op-1')
    expect(calls).toHaveLength(1)
    expect(calls[0].DomainName).toBe('example.com')
    expect(calls[0].RegistrantContact.PhoneNumber).toBe('+44.2079460000')
  })

  it('reports a rejection instead of success', async () => {
    const { registrar } = recordingRegistrar(new Error('Domain example.com is not available'))
    const result = await purchaseDomain('example.com', { ...purchaseOptionsFromContactInfo(contact), domain: 'example.com' }, registrar)

    expect(result.isErr).toBe(true)
    expect(result.isErr && result.error.message).toContain('not available')
  })

  it('treats a response without an operation id as unconfirmed', async () => {
    const { registrar } = recordingRegistrar({})
    const result = await purchaseDomain('example.com', { ...purchaseOptionsFromContactInfo(contact), domain: 'example.com' }, registrar)

    expect(result.isErr).toBe(true)
  })

  it('sends privacy and auto-renew as configured, including off', async () => {
    const { calls, registrar } = recordingRegistrar()
    const options = { ...purchaseOptionsFromContactInfo({ ...contact, privacy: false }), domain: 'example.es', autoRenew: false }
    await purchaseDomain('example.es', options, registrar)

    expect(calls[0].AutoRenew).toBe(false)
    expect(calls[0].PrivacyProtectAdminContact).toBe(false)
    expect(calls[0].PrivacyProtectRegistrantContact).toBe(false)
    expect(calls[0].PrivacyProtectTechContact).toBe(false)
  })

  it('defaults privacy and auto-renew to on when unset', async () => {
    const { calls, registrar } = recordingRegistrar()
    await purchaseDomain('example.com', { ...purchaseOptionsFromContactInfo(contact), domain: 'example.com' }, registrar)

    expect(calls[0].AutoRenew).toBe(true)
    expect(calls[0].PrivacyProtectRegistrantContact).toBe(true)
  })
})

describe('purchaseOptionsFromContactInfo', () => {
  it('fills the admin and tech contacts from the registrant, field by field', () => {
    const options = purchaseOptionsFromContactInfo({ ...contact, tech: { email: 'ops@example.com' } as any })

    expect(options.adminEmail).toBe('ada@example.com')
    expect(options.techEmail).toBe('ops@example.com')
    expect(options.techFirstName).toBe('Ada')
  })

  it('keeps one privacy override while the others follow the default', () => {
    const options = purchaseOptionsFromContactInfo({ ...contact, privacy: true, privacyTech: false })

    expect(options.privacyTech).toBe(false)
    expect(options.privacyAdmin).toBe(true)
  })

  it('uses the configured contact type instead of always PERSON', () => {
    expect(purchaseOptionsFromContactInfo({ ...contact, contactType: 'company' }).contactType).toBe('COMPANY')
    expect(purchaseOptionsFromContactInfo(contact).contactType).toBe('PERSON')
  })
})
