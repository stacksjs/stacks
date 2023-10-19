import type { HashAlgorithm } from '@stacksjs/types'
import v from 'validator'

export function isEmail(email: string) {
  return v.isEmail(email)
}

export function isStrongPassword(password: string) {
  return v.isStrongPassword(password)
}

export function isAlphanumeric(username: string) {
  return v.isAlphanumeric(username)
}

export function validateUsername(username: string) {
  return isAlphanumeric(username)
}

export function isURL(url: string) {
  return v.isURL(url)
}

export function isMobilePhone(phoneNumber: string) {
  return v.isMobilePhone(phoneNumber)
}

export function isAlpha(name: string) {
  return v.isAlpha(name)
}

export function isPostalCode(zipCode: string) {
  return v.isPostalCode(zipCode, 'any')
}

export function isNumeric(number: string) {
  return v.isNumeric(number)
}

export function isHexColor(color: string) {
  return v.isHexColor(color)
}

export function isHexadecimal(hex: string) {
  return v.isHexadecimal(hex)
}

export function isBase64(base64: string) {
  return v.isBase64(base64)
}

export function isUUID(uuid: string) {
  return v.isUUID(uuid)
}

export function isJSON(json: string) {
  return v.isJSON(json)
}

export function isCreditCard(creditCard: string) {
  return v.isCreditCard(creditCard)
}

export function isISBN(isbn: string) {
  return v.isISBN(isbn)
}

export function isIP(ip: string) {
  return v.isIP(ip)
}

export function isIPRange(ip: string) {
  return v.isIPRange(ip)
}

export function isMACAddress(macAddress: string) {
  return v.isMACAddress(macAddress)
}

export function isLatLong(latitude: string) {
  return v.isLatLong(latitude)
}

export function isLatitude(longitude: string) {
  return v.isLatLong(longitude)
}

export function isLongitude(longitude: string) {
  return v.isLatLong(longitude)
}

export function isCurrency(currency: string) {
  return v.isCurrency(currency)
}

export function isDataURI(dataURI: string) {
  return v.isDataURI(dataURI)
}

export function isMimeType(mimeType: string) {
  return v.isMimeType(mimeType)
}

export function isJWT(jwt: string) {
  return v.isJWT(jwt)
}

export function isAscii(ascii: string) {
  return v.isAscii(ascii)
}

export function isBase32(base32: string) {
  return v.isBase32(base32)
}

export function isByteLength(byteLength: string) {
  return v.isByteLength(byteLength)
}

export function isFQDN(fqdn: string) {
  return v.isFQDN(fqdn)
}

export function isFullWidth(fullWidth: string) {
  return v.isFullWidth(fullWidth)
}

export function isHalfWidth(halfWidth: string) {
  return v.isHalfWidth(halfWidth)
}

export function isHash(hash: string, algorithm: HashAlgorithm) {
  return v.isHash(hash, algorithm)
}

export function isHSL(hsl: string) {
  return v.isHSL(hsl)
}

export function isIBAN(iban: string) {
  return v.isIBAN(iban)
}

export function isIdentityCard(identityCard: string) {
  return v.isIdentityCard(identityCard)
}

export function isISIN(isin: string) {
  return v.isISIN(isin)
}

export function isISO8601(iso8601: string) {
  return v.isISO8601(iso8601)
}

export function isISRC(isrc: string) {
  return v.isISRC(isrc)
}

export function isISSN(issn: string) {
  return v.isISSN(issn)
}

export function isISO31661Alpha2(iso31661Alpha2: string) {
  return v.isISO31661Alpha2(iso31661Alpha2)
}

export function isISO31661Alpha3(iso31661Alpha3: string) {
  return v.isISO31661Alpha3(iso31661Alpha3)
}
