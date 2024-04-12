import type { HashAlgorithm } from '@stacksjs/types'
import validator from 'validator'

export function isEmail(email: string) {
  return validator.isEmail(email)
}

export function isStrongPassword(password: string) {
  return validator.isStrongPassword(password)
}

export function isAlphanumeric(username: string) {
  return validator.isAlphanumeric(username)
}

export function validateUsername(username: string) {
  return isAlphanumeric(username)
}

export function isURL(url: string) {
  return validator.isURL(url)
}

export function isMobilePhone(phoneNumber: string) {
  return validator.isMobilePhone(phoneNumber)
}

export function isAlpha(name: string) {
  return validator.isAlpha(name)
}

export function isPostalCode(zipCode: string) {
  return validator.isPostalCode(zipCode, 'any')
}

export function isNumeric(number: string) {
  return validator.isNumeric(number)
}

export function isHexColor(color: string) {
  return validator.isHexColor(color)
}

export function isHexadecimal(hex: string) {
  return validator.isHexadecimal(hex)
}

export function isBase64(base64: string) {
  return validator.isBase64(base64)
}

export function isUUID(uuid: string) {
  return validator.isUUID(uuid)
}

export function isJSON(json: string) {
  return validator.isJSON(json)
}

export function isCreditCard(creditCard: string) {
  return validator.isCreditCard(creditCard)
}

export function isISBN(isbn: string) {
  return validator.isISBN(isbn)
}

export function isIP(ip: string) {
  return validator.isIP(ip)
}

export function isIPRange(ip: string) {
  return validator.isIPRange(ip)
}

export function isMACAddress(macAddress: string) {
  return validator.isMACAddress(macAddress)
}

export function isLatLong(latitude: string) {
  return validator.isLatLong(latitude)
}

export function isLatitude(longitude: string) {
  return validator.isLatLong(longitude)
}

export function isLongitude(longitude: string) {
  return validator.isLatLong(longitude)
}

export function isCurrency(currency: string) {
  return validator.isCurrency(currency)
}

export function isDataURI(dataURI: string) {
  return validator.isDataURI(dataURI)
}

export function isMimeType(mimeType: string) {
  return validator.isMimeType(mimeType)
}

export function isJWT(jwt: string) {
  return validator.isJWT(jwt)
}

export function isAscii(ascii: string) {
  return validator.isAscii(ascii)
}

export function isBase32(base32: string) {
  return validator.isBase32(base32)
}

export function isByteLength(byteLength: string) {
  return validator.isByteLength(byteLength)
}

export function isFQDN(fqdn: string) {
  return validator.isFQDN(fqdn)
}

export function isFullWidth(fullWidth: string) {
  return validator.isFullWidth(fullWidth)
}

export function isHalfWidth(halfWidth: string) {
  return validator.isHalfWidth(halfWidth)
}

export function isHash(hash: string, algorithm: HashAlgorithm) {
  return validator.isHash(hash, algorithm)
}

export function isHSL(hsl: string) {
  return validator.isHSL(hsl)
}

export function isIBAN(iban: string) {
  return validator.isIBAN(iban)
}

export function isIdentityCard(identityCard: string) {
  return validator.isIdentityCard(identityCard)
}

export function isISIN(isin: string) {
  return validator.isISIN(isin)
}

export function isISO8601(iso8601: string) {
  return validator.isISO8601(iso8601)
}

export function isISRC(isrc: string) {
  return validator.isISRC(isrc)
}

export function isISSN(issn: string) {
  return validator.isISSN(issn)
}

export function isISO31661Alpha2(iso31661Alpha2: string) {
  return validator.isISO31661Alpha2(iso31661Alpha2)
}

export function isISO31661Alpha3(iso31661Alpha3: string) {
  return validator.isISO31661Alpha3(iso31661Alpha3)
}
