import { SignedXml } from 'xml-crypto'

/** Fixture signing uses the maintained library's public API and public test keys. */
export function signSamlXml(xml: string, xpath: string, location: { reference: string, action: 'after' }, options: { privateKey: string, publicCert: string }) {
  const signature = new SignedXml({ privateKey: options.privateKey, publicCert: options.publicCert, signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#' })
  signature.addReference({ xpath, transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' })
  signature.computeSignature(xml, { location })
  return signature.getSignedXml()
}
