import { expect, test } from 'bun:test'
import { signSamlXml as signXml } from './fixtures/enterprise-saml-signature'
import { inflateRawSync } from 'node:zlib'
import { verify } from 'node:crypto'
import { enterpriseSamlAuthorization, enterpriseSamlRequest, verifyEnterpriseSamlResponse } from '../src/enterprise-saml'

const key = await Bun.file(new URL('./fixtures/enterprise-saml-test-key.pem', import.meta.url)).text()
const cert = await Bun.file(new URL('./fixtures/enterprise-saml-test-cert.pem', import.meta.url)).text()
const config = { issuer: 'https://idp.example.test/entity', entityId: 'https://support.example.test/saml/entity', entryPoint: 'https://idp.example.test/sso', callbackUrl: 'https://support.example.test/saml/acs', idpCert: cert, privateKey: key, publicCert: cert }
export function signedSamlFixture(requestId: string, overrides: Record<string, string> = {}, mode = 'signed') {
  const v = { issuer: config.issuer, entityId: config.entityId, recipient: config.callbackUrl, requestId, expires: new Date(Date.now() + 120_000).toISOString(), subject: 'persistent-agent-123', ...overrides }
  const now = new Date().toISOString(), before = new Date(Date.now() - 1000).toISOString()
  const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_assertion-${crypto.randomUUID()}" Version="2.0" IssueInstant="${now}"><saml:Issuer>${v.issuer}</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">${v.subject}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData InResponseTo="${v.requestId}" Recipient="${v.recipient}" NotOnOrAfter="${v.expires}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="${before}" NotOnOrAfter="${v.expires}"><saml:AudienceRestriction><saml:Audience>${v.entityId}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="${now}" SessionIndex="fixture-session"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement><saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>agent@example.test</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>`
  const options = { privateKey: key, publicCert: cert, signatureAlgorithm: 'sha256' as const, digestAlgorithm: 'sha256' }
  const signed = mode === 'unsigned' ? assertion : signXml(assertion, "/*[local-name()='Assertion']", { reference: "/*[local-name()='Assertion']/*[local-name()='Issuer']", action: 'after' }, options)
  let xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_response-${crypto.randomUUID()}" Version="2.0" IssueInstant="${now}" Destination="${overrides.destination ?? config.callbackUrl}" InResponseTo="${v.requestId}"><saml:Issuer>${v.issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>${signed}${mode === 'duplicate' ? signed : ''}</samlp:Response>`
  if (mode !== 'unsigned') xml = signXml(xml, "/*[local-name()='Response']", { reference: "/*[local-name()='Response']/*[local-name()='Issuer']", action: 'after' }, options)
  if (mode === 'tampered') xml = xml.replace(v.subject, 'attacker-subject')
  return Buffer.from(xml).toString('base64')
}

test('enterprise SAML signs authorization and validates real signed response and assertion', async () => {
  const request = enterpriseSamlRequest()
  const url = new URL(await enterpriseSamlAuthorization(config, 'native-bound-relay-state', request))
  expect(inflateRawSync(Buffer.from(url.searchParams.get('SAMLRequest')!, 'base64')).toString()).toContain(request.requestId)
  const octets = url.search.slice(1).split('&Signature=')[0]!
  expect(verify('RSA-SHA256', Buffer.from(octets), cert, Buffer.from(url.searchParams.get('Signature')!, 'base64'))).toBe(true)
  expect(await verifyEnterpriseSamlResponse(config, signedSamlFixture(request.requestId), request)).toEqual({ issuer: config.issuer, subject: 'persistent-agent-123', email: 'agent@example.test', emailVerified: true })
})
for (const [name, overrides] of [['issuer', { issuer: 'https://attacker.example.test/entity' }], ['audience', { entityId: 'foreign-audience' }], ['recipient', { recipient: 'https://foreign.example.test/acs' }], ['destination', { destination: 'https://foreign.example.test/acs' }], ['request', { requestId: '_00000000-0000-0000-0000-000000000000' }], ['expiry', { expires: new Date(1).toISOString() }]] as const) {
  test(`enterprise SAML refuses wrong ${name} even with valid XML signatures`, async () => {
    const request = enterpriseSamlRequest()
    await expect(verifyEnterpriseSamlResponse(config, signedSamlFixture(request.requestId, overrides), request)).rejects.toThrow()
  })
}
for (const mode of ['unsigned', 'tampered', 'duplicate']) {
  test(`enterprise SAML refuses ${mode} assertions`, async () => {
    const request = enterpriseSamlRequest()
    await expect(verifyEnterpriseSamlResponse(config, signedSamlFixture(request.requestId, {}, mode), request)).rejects.toThrow()
  })
}
test('enterprise SAML rejects entity declarations and old native request state', async () => {
  const request = enterpriseSamlRequest()
  await expect(verifyEnterpriseSamlResponse(config, Buffer.from('<!DOCTYPE Response [<!ENTITY x "anything">]><Response/>').toString('base64'), request)).rejects.toThrow()
  await expect(verifyEnterpriseSamlResponse(config, signedSamlFixture(request.requestId), { ...request, createdAt: Date.now() - 300_001 })).rejects.toThrow()
})

test('enterprise SAML rejects wrapping references, duplicate IDs and untrusted embedded certificates', async () => {
  const { verifiedEnterpriseSamlResponse } = await import('../src/enterprise-saml-xml')
  const { generateKeyPairSync } = await import('node:crypto')
  const request = enterpriseSamlRequest()
  const xml = Buffer.from(signedSamlFixture(request.requestId), 'base64').toString()
  const rootId = /<samlp:Response[^>]+ ID="([^"]+)"/.exec(xml)![1]!
  const assertionId = /<saml:Assertion[^>]+ ID="([^"]+)"/.exec(xml)![1]!
  expect(() => verifiedEnterpriseSamlResponse(xml.replace(`URI="#${rootId}"`, `URI="#${assertionId}"`), cert)).toThrow()
  expect(() => verifiedEnterpriseSamlResponse(xml.replace(`ID="${assertionId}"`, `ID="${rootId}"`), cert)).toThrow()
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }).toString()
  expect(() => verifiedEnterpriseSamlResponse(xml, other)).toThrow()
})
