import { getTypeName, toString } from '@stacksjs/utils'
import validator from 'validator'
import type { HashAlgorithm } from '@stacksjs/types'

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

export function isDate(date: string) {
  return validator.isDate(date)
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

export function isMongoId(mongoId: string) {
  return validator.isMongoId(mongoId)
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

export function isDef<T = any>(val?: T): val is T {
  return typeof val !== 'undefined'
}
export function isBoolean(val: any): val is boolean {
  return typeof val === 'boolean'
}
export function isFunction<T extends Function>(val: any): val is T {
  return typeof val === 'function'
}
export function isNumber(val: any): val is number {
  return typeof val === 'number'
}
export function isString(val: unknown): val is string {
  return typeof val === 'string'
}
export function isObject(val: any): val is object {
  return toString(val) === '[object Object]'
}
export function isWindow(val: any): boolean {
  return typeof window !== 'undefined' && toString(val) === '[object Window]'
}
export const isBrowser = typeof window !== 'undefined'
export const isServer = typeof document === 'undefined' // https://remix.run/docs/en/v1/pages/gotchas#typeof-window-checks
export function isMap(val: any): val is Map<any, any> {
  return toString(val) === '[object Map]'
}
export function isSet(val: any): val is Set<any> {
  return toString(val) === '[object Set]'
}
export function isPromise<T = any>(val: any): val is Promise<T> {
  return toString(val) === '[object Promise]'
}
export function isUndefined(v: any) {
  return getTypeName(v) === 'undefined'
}
export function isNull(v: any) {
  return getTypeName(v) === 'null'
}
export function isSymbol(v: any) {
  return getTypeName(v) === 'symbol'
}
export function isDate(v: any) {
  return getTypeName(v) === 'date'
}
export function isRegExp(v: any) {
  return getTypeName(v) === 'regexp'
}
export function isArray(v: any) {
  return getTypeName(v) === 'array'
}
export function isPrimitive(v: any) {
  const type = getTypeName(v)
  return type === 'null' || type === 'undefined' || type === 'string' || type === 'number' || type === 'boolean' || type === 'symbol'
}
export function isInteger(v: any) {
  return isNumber(v) && Number.isInteger(v)
}
export function isFloat(v: any) {
  return isNumber(v) && !Number.isInteger(v)
}
export function isPositive(v: any) {
  return isNumber(v) && v > 0
}
export function isNegative(v: any) {
  return isNumber(v) && v < 0
}
export function isEven(v: any) {
  return isNumber(v) && v % 2 === 0
}
export function isOdd(v: any) {
  return isNumber(v) && v % 2 !== 0
}
export function isEvenOrOdd(v: any) {
  return isNumber(v) && (v % 2 === 0 ? 'even' : 'odd')
}
export function isPositiveOrNegative(v: any) {
  return isNumber(v) && (v > 0 ? 'positive' : 'negative')
}
export function isIntegerOrFloat(v: any) {
  return isNumber(v) && (Number.isInteger(v) ? 'integer' : 'float')
}
