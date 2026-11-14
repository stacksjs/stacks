import { SAML, ValidateInResponseTo } from '@node-saml/node-saml'
import type { CacheProvider } from '@node-saml/node-saml'
import { getVerifiedXml, parseDomFromString, xpath } from '@node-saml/node-saml/lib/xml'

export interface EnterpriseSamlConfig {
  issuer: string
  entityId: string
  entryPoint: string
  callbackUrl: string
  idpCert: string
  privateKey: string
  publicCert: string
}
/** Keep this in a native one-use browser-bound flow, scoped to this provider. */
export interface EnterpriseSamlRequest { requestId: string, createdAt: number }
export interface EnterpriseSamlIdentity { issuer: string, subject: string, email: string | null, emailVerified: boolean }
const SAML_NS = 'urn:oasis:names:tc:SAML:2.0:assertion'
const PROTOCOL_NS = 'urn:oasis:names:tc:SAML:2.0:protocol'
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'
const PERSISTENT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
const AGE_MS = 300_000
function client(config: EnterpriseSamlConfig, request: EnterpriseSamlRequest) {
  for (const value of [config.entryPoint, config.callbackUrl]) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new TypeError('SAML requires approved HTTPS endpoints.')
  }
  if (!config.issuer || !config.entityId || !config.idpCert || !config.privateKey || !config.publicCert || !/^_[a-f0-9-]{36}$/i.test(request.requestId) || !Number.isSafeInteger(request.createdAt) || request.createdAt > Date.now() || Date.now() - request.createdAt >= AGE_MS) throw new TypeError('SAML configuration or request is invalid.')
  let consumed = false
  // Cross-worker replay protection belongs to the native durable flow consumed
  // by the application before verification. This pinned cache adds protocol
  // request correlation, and never accepts another request/provider's ID.
  const cache: CacheProvider = {
    async saveAsync(key, value) { return key === request.requestId ? { value, createdAt: request.createdAt } : null },
    async getAsync(key) { return !consumed && key === request.requestId ? new Date(request.createdAt).toISOString() : null },
    async removeAsync(key) { if (key !== request.requestId || consumed) return null; consumed = true; return key },
    async consumeAsync(key) { if (key !== request.requestId || consumed) return null; consumed = true; return new Date(request.createdAt).toISOString() },
  }
  return new SAML({
    callbackUrl: config.callbackUrl, issuer: config.entityId, audience: config.entityId, entryPoint: config.entryPoint,
    idpIssuer: config.issuer, idpCert: config.idpCert, privateKey: config.privateKey, publicCert: config.publicCert,
    wantAssertionsSigned: true, wantAuthnResponseSigned: true, validateInResponseTo: ValidateInResponseTo.always,
    acceptedClockSkewMs: 0, maxAssertionAgeMs: AGE_MS, requestIdExpirationPeriodMs: AGE_MS,
    signatureAlgorithm: 'sha256', digestAlgorithm: 'sha256', identifierFormat: PERSISTENT,
    generateUniqueId: () => request.requestId, cacheProvider: cache,
  })
}
export function enterpriseSamlRequest(): EnterpriseSamlRequest { return { requestId: `_${crypto.randomUUID()}`, createdAt: Date.now() } }
export async function enterpriseSamlAuthorization(config: EnterpriseSamlConfig, relayState: string, request: EnterpriseSamlRequest): Promise<string> {
  return await client(config, request).getAuthorizeUrlAsync(relayState, undefined)
}

/** Caller must consume its native browser-bound flow before invoking this. */
export async function verifyEnterpriseSamlResponse(config: EnterpriseSamlConfig, encoded: string, request: EnterpriseSamlRequest): Promise<EnterpriseSamlIdentity> {
  if (!encoded || encoded.length > 250_000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)) throw new TypeError('Invalid SAML response encoding.')
  const xml = Buffer.from(encoded, 'base64').toString('utf8')
  if (Buffer.byteLength(xml) > 128_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new TypeError('SAML entities and oversized XML are not allowed.')
  const { profile, loggedOut } = await client(config, request).validatePostResponseAsync({ SAMLResponse: encoded })
  if (!profile || loggedOut || profile.issuer !== config.issuer || profile.nameIDFormat !== PERSISTENT || !profile.nameID) throw new TypeError('SAML identity is missing or not persistent.')
  // Node-SAML currently warns about Destination/Recipient mismatch. This
  // adapter makes them hard failures and reads only verified signed bytes.
  const received = await parseDomFromString(xml)
  const verified = getVerifiedXml(xml, received.documentElement, [config.idpCert])
  if (!verified) throw new TypeError('A signed SAML Response is required.')
  const document = await parseDomFromString(verified), root = document.documentElement
  if (root.namespaceURI !== PROTOCOL_NS || root.localName !== 'Response' || root.getAttribute('Version') !== '2.0' || root.getAttribute('Destination') !== config.callbackUrl || root.getAttribute('InResponseTo') !== request.requestId) throw new TypeError('SAML response recipient or request does not match.')
  const assertions = xpath.selectElements(document, "/*[local-name()='Response']/*[local-name()='Assertion']")
  if (assertions.length !== 1 || assertions[0]!.namespaceURI !== SAML_NS || assertions[0]!.getAttribute('Version') !== '2.0') throw new TypeError('One SAML assertion is required.')
  const assertion = assertions[0]!
  const audience = assertion.getElementsByTagNameNS(SAML_NS, 'Audience')
  const confirmations = assertion.getElementsByTagNameNS(SAML_NS, 'SubjectConfirmation')
  const data = assertion.getElementsByTagNameNS(SAML_NS, 'SubjectConfirmationData')
  const conditions = assertion.getElementsByTagNameNS(SAML_NS, 'Conditions')
  const status = root.getElementsByTagNameNS(PROTOCOL_NS, 'StatusCode')
  if (audience.length !== 1 || audience[0]!.textContent !== config.entityId || confirmations.length !== 1 || confirmations[0]!.getAttribute('Method') !== 'urn:oasis:names:tc:SAML:2.0:cm:bearer' || data.length !== 1 || data[0]!.getAttribute('Recipient') !== config.callbackUrl || data[0]!.getAttribute('InResponseTo') !== request.requestId || conditions.length !== 1 || !conditions[0]!.getAttribute('NotOnOrAfter') || !data[0]!.getAttribute('NotOnOrAfter') || assertion.getElementsByTagNameNS(SAML_NS, 'AuthnStatement').length !== 1 || status.length !== 1 || status[0]!.getAttribute('Value') !== 'urn:oasis:names:tc:SAML:2.0:status:Success') throw new TypeError('SAML bearer confirmation, conditions, status or audience is invalid.')
  const methods = received.documentElement.getElementsByTagNameNS(DS_NS, 'SignatureMethod'), digests = received.documentElement.getElementsByTagNameNS(DS_NS, 'DigestMethod')
  if (methods.length !== 2 || Array.from(methods).some(node => node.getAttribute('Algorithm') !== 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') || Array.from(digests).some(node => node.getAttribute('Algorithm') !== 'http://www.w3.org/2001/04/xmlenc#sha256')) throw new TypeError('SAML requires RSA-SHA256 signatures and SHA256 digests.')
  return { issuer: profile.issuer, subject: profile.nameID, email: typeof profile.email === 'string' ? profile.email : null, emailVerified: true }
}
