import { DOMParser } from '@xmldom/xmldom'
import { SignedXml } from 'xml-crypto'

const DS = 'http://www.w3.org/2000/09/xmldsig#'
const C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#'
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
type XmlElement = NonNullable<ReturnType<DOMParser['parseFromString']>['documentElement']>
export function parseEnterpriseSamlXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new TypeError('SAML entities are not allowed.')
  return new DOMParser({ onError() { throw new TypeError('Malformed SAML XML.') } }).parseFromString(xml, 'text/xml')
}
function children(parent: XmlElement, namespace: string, name: string) {
  return Array.from(parent.childNodes).filter((node): node is XmlElement => node.nodeType === 1 && (node as XmlElement).namespaceURI === namespace && (node as XmlElement).localName === name)
}
/** Verify one root-owned reference using the pinned certificate, never embedded KeyInfo. */
export function verifiedEnterpriseSamlResponse(xml: string, certificate: string): string {
  const document = parseEnterpriseSamlXml(xml), root = document.documentElement
  if (!root) throw new TypeError('SAML response is empty.')
  const ids = new Set<string>()
  for (const element of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.localName?.toLowerCase() !== 'id') continue
      if (!attribute.value || ids.has(attribute.value)) throw new TypeError('SAML IDs must be unique.')
      ids.add(attribute.value)
    }
  }
  const signatures = children(root, DS, 'Signature'), id = root.getAttribute('ID')
  if (!id || signatures.length !== 1) throw new TypeError('One signed root Response is required.')
  const signedInfo = children(signatures[0]!, DS, 'SignedInfo')
  if (signedInfo.length !== 1) throw new TypeError('Invalid SAML SignedInfo.')
  const references = children(signedInfo[0]!, DS, 'Reference')
  const canonical = children(signedInfo[0]!, DS, 'CanonicalizationMethod')
  const method = children(signedInfo[0]!, DS, 'SignatureMethod')
  if (references.length !== 1 || references[0]!.getAttribute('URI') !== '#' + id || canonical.length !== 1 || canonical[0]!.getAttribute('Algorithm') !== C14N || method.length !== 1 || method[0]!.getAttribute('Algorithm') !== 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') throw new TypeError('SAML root signature must reference exactly its own parent.')
  const transforms = references[0]!.getElementsByTagNameNS(DS, 'Transform')
  const digest = children(references[0]!, DS, 'DigestMethod')
  if (transforms.length !== 2 || transforms[0]!.getAttribute('Algorithm') !== ENVELOPED || transforms[1]!.getAttribute('Algorithm') !== C14N || digest.length !== 1 || digest[0]!.getAttribute('Algorithm') !== 'http://www.w3.org/2001/04/xmlenc#sha256') throw new TypeError('Unsupported SAML signature transforms or digest.')
  const verifier = new SignedXml({ publicCert: certificate, getCertFromKeyInfo: () => null })
  verifier.loadSignature(signatures[0]!.toString())
  if (!verifier.checkSignature(xml)) throw new TypeError('SAML root signature did not verify.')
  const verified = verifier.getSignedReferences()
  if (verified.length !== 1) throw new TypeError('One verified SAML reference is required.')
  const signedRoot = parseEnterpriseSamlXml(verified[0]!).documentElement
  if (!signedRoot || signedRoot.getAttribute('ID') !== id || signedRoot.localName !== root.localName || signedRoot.namespaceURI !== root.namespaceURI) throw new TypeError('Verified SAML root does not match.')
  return verified[0]!
}
