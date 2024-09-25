import type { HashAlgorithm } from '@stacksjs/types'
import validator from 'validator'

export function isEmail(email: string): boolean {
  return validator.isEmail(email)
}

export function isStrongPassword(password: string): boolean {
  return validator.isStrongPassword(password)
}

export function isAlphanumeric(username: string): boolean {
  return validator.isAlphanumeric(username)
}

export function validateUsername(username: string): boolean {
  return isAlphanumeric(username)
}

export function isURL(url: string): boolean {
  return validator.isURL(url)
}

export function isMobilePhone(phoneNumber: string): boolean {
  return validator.isMobilePhone(phoneNumber)
}

export function isAlpha(name: string): boolean {
  return validator.isAlpha(name)
}

export function isPostalCode(zipCode: string): boolean {
  return validator.isPostalCode(zipCode, 'any')
}

export function isNumeric(number: string): boolean {
  return validator.isNumeric(number)
}

export function isHexColor(color: string): boolean {
  return validator.isHexColor(color)
}

export function isHexadecimal(hex: string): boolean {
  return validator.isHexadecimal(hex)
}

export function isBase64(base64: string): boolean {
  return validator.isBase64(base64)
}

export function isUUID(uuid: string): boolean {
  return validator.isUUID(uuid)
}

export function isJSON(json: string): boolean {
  return validator.isJSON(json)
}

export function isCreditCard(creditCard: string): boolean {
  return validator.isCreditCard(creditCard)
}

export function isISBN(isbn: string): boolean {
  return validator.isISBN(isbn)
}

export function isIP(ip: string): boolean {
  return validator.isIP(ip)
}

export function isIPRange(ip: string): boolean {
  return validator.isIPRange(ip)
}

export function isMACAddress(macAddress: string): boolean {
  return validator.isMACAddress(macAddress)
}

export function isLatLong(latitude: string): boolean {
  return validator.isLatLong(latitude)
}

export function isLatitude(longitude: string): boolean {
  return validator.isLatLong(longitude)
}

export function isLongitude(longitude: string): boolean {
  return validator.isLatLong(longitude)
}

export function isCurrency(currency: string): boolean {
  return validator.isCurrency(currency)
}

export function isDataURI(dataURI: string): boolean {
  return validator.isDataURI(dataURI)
}

export function isMimeType(mimeType: string): boolean {
  return validator.isMimeType(mimeType)
}

export function isJWT(jwt: string): boolean {
  return validator.isJWT(jwt)
}

export function isAscii(ascii: string): boolean {
  return validator.isAscii(ascii)
}

export function isBase32(base32: string): boolean {
  return validator.isBase32(base32)
}

export function isByteLength(byteLength: string): boolean {
  return validator.isByteLength(byteLength)
}

export function isFQDN(fqdn: string): boolean {
  return validator.isFQDN(fqdn)
}

export function isFullWidth(fullWidth: string): boolean {
  return validator.isFullWidth(fullWidth)
}

export function isHalfWidth(halfWidth: string): boolean {
  return validator.isHalfWidth(halfWidth)
}

export function isHash(hash: string, algorithm: HashAlgorithm): boolean {
  return validator.isHash(hash, algorithm)
}

export function isHSL(hsl: string): boolean {
  return validator.isHSL(hsl)
}

export function isIBAN(iban: string): boolean {
  return validator.isIBAN(iban)
}

export function isIdentityCard(identityCard: string): boolean {
  return validator.isIdentityCard(identityCard)
}

export function isISIN(isin: string): boolean {
  return validator.isISIN(isin)
}

export function isISO8601(iso8601: string): boolean {
  return validator.isISO8601(iso8601)
}

export function isISRC(isrc: string): boolean {
  return validator.isISRC(isrc)
}

export function isISSN(issn: string): boolean {
  return validator.isISSN(issn)
}

export function isISO31661Alpha2(iso31661Alpha2: string): boolean {
  return validator.isISO31661Alpha2(iso31661Alpha2)
}

export function isISO31661Alpha3(iso31661Alpha3: string): boolean {
  return validator.isISO31661Alpha3(iso31661Alpha3)
}
