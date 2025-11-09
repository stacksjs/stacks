/**
 * Native validation utilities
 * Replaces validator package with native TypeScript implementations
 */

import type { HashAlgorithm } from '@stacksjs/types'

/**
 * Email validation
 */
export function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Strong password validation
 * Must contain: min 8 chars, uppercase, lowercase, number, symbol
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false

  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)

  return hasUpperCase && hasLowerCase && hasNumber && hasSymbol
}

/**
 * Alphanumeric validation (letters and numbers only)
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str)
}

/**
 * URL validation
 */
export function isURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Mobile phone validation (international format)
 */
export function isMobilePhone(phoneNumber: string): boolean {
  // Basic international phone number validation
  // Accepts formats like: +1234567890, +12 345 678 900, etc.
  // Minimum 7 digits required
  const phoneRegex = /^\+?[1-9]\d{6,14}$/
  const cleaned = phoneNumber.replace(/[\s()-]/g, '')
  return phoneRegex.test(cleaned)
}

/**
 * Alphabetic characters only
 */
export function isAlpha(str: string): boolean {
  return /^[a-zA-Z]+$/.test(str)
}

/**
 * Postal code validation (supports multiple formats)
 */
export function isPostalCode(zipCode: string): boolean {
  // US ZIP: 12345 or 12345-6789
  const usZip = /^\d{5}(-\d{4})?$/
  // UK postcode: SW1A 1AA
  const ukPostcode = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i
  // Canada: K1A 0B1
  const canadaPostcode = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i
  // Generic: any 3-10 alphanumeric
  const generic = /^[a-zA-Z0-9]{3,10}$/

  return usZip.test(zipCode) || ukPostcode.test(zipCode) || canadaPostcode.test(zipCode) || generic.test(zipCode)
}

/**
 * Numeric string validation
 */
export function isNumeric(str: string): boolean {
  return /^\d+$/.test(str)
}

/**
 * Hex color validation
 */
export function isHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Hexadecimal validation
 */
export function isHexadecimal(hex: string): boolean {
  return /^[A-Fa-f0-9]+$/.test(hex)
}

/**
 * Base64 validation
 */
export function isBase64(base64: string): boolean {
  try {
    return btoa(atob(base64)) === base64
  } catch {
    return false
  }
}

/**
 * UUID validation (v1-v5)
 */
export function isUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * JSON validation
 */
export function isJSON(json: string): boolean {
  try {
    JSON.parse(json)
    return true
  } catch {
    return false
  }
}

/**
 * Credit card validation (Luhn algorithm)
 */
export function isCreditCard(creditCard: string): boolean {
  const cleaned = creditCard.replace(/[\s-]/g, '')

  if (!/^\d{13,19}$/.test(cleaned)) return false

  // Luhn algorithm
  let sum = 0
  let isEven = false

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * ISBN validation (ISBN-10 and ISBN-13)
 */
export function isISBN(isbn: string): boolean {
  const cleaned = isbn.replace(/[\s-]/g, '')

  // ISBN-10
  if (cleaned.length === 10) {
    let sum = 0
    for (let i = 0; i < 9; i++) {
      const digit = parseInt(cleaned.charAt(i), 10)
      if (isNaN(digit)) return false
      sum += digit * (10 - i)
    }
    const checkChar = cleaned.charAt(9)
    const checkDigit = checkChar === 'X' ? 10 : parseInt(checkChar, 10)
    if (isNaN(checkDigit) && checkChar !== 'X') return false
    sum += checkDigit
    return sum % 11 === 0
  }

  // ISBN-13
  if (cleaned.length === 13) {
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(cleaned.charAt(i), 10)
      if (isNaN(digit)) return false
      sum += digit * (i % 2 === 0 ? 1 : 3)
    }
    const checkDigit = parseInt(cleaned.charAt(12), 10)
    if (isNaN(checkDigit)) return false
    return (10 - (sum % 10)) % 10 === checkDigit
  }

  return false
}

/**
 * IP address validation (IPv4 and IPv6)
 */
export function isIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Regex.test(ip)) return true

  // IPv6 (simplified)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
  return ipv6Regex.test(ip)
}

/**
 * IP range validation (CIDR notation)
 */
export function isIPRange(ip: string): boolean {
  const parts = ip.split('/')
  if (parts.length !== 2) return false

  const [address, cidr] = parts
  const cidrNum = parseInt(cidr, 10)

  if (!isIP(address)) return false

  // IPv4: 0-32, IPv6: 0-128
  if (address.includes(':')) {
    return cidrNum >= 0 && cidrNum <= 128
  } else {
    return cidrNum >= 0 && cidrNum <= 32
  }
}

/**
 * MAC address validation
 */
export function isMACAddress(macAddress: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
  return macRegex.test(macAddress)
}

/**
 * Latitude/Longitude validation
 */
export function isLatLong(latlong: string): boolean {
  const parts = latlong.split(',')
  if (parts.length !== 2) return false

  const lat = parseFloat(parts[0].trim())
  const long = parseFloat(parts[1].trim())

  return !isNaN(lat) && !isNaN(long) && lat >= -90 && lat <= 90 && long >= -180 && long <= 180
}

/**
 * Currency validation
 */
export function isCurrency(currency: string): boolean {
  const currencyRegex = /^[$£€¥]?\d{1,3}(,?\d{3})*(\.\d{2})?$/
  return currencyRegex.test(currency.trim())
}

/**
 * Data URI validation
 */
export function isDataURI(dataURI: string): boolean {
  const dataURIRegex = /^data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)*)?;base64,([a-z0-9+/]+=*)/i
  return dataURIRegex.test(dataURI) || /^data:,/.test(dataURI)
}

/**
 * MIME type validation
 */
export function isMimeType(mimeType: string): boolean {
  const mimeTypeRegex = /^[a-z]+\/[a-z0-9\-+.]+$/i
  return mimeTypeRegex.test(mimeType)
}

/**
 * JWT validation
 */
export function isJWT(jwt: string): boolean {
  const parts = jwt.split('.')
  if (parts.length !== 3) return false

  try {
    parts.forEach(part => {
      atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    })
    return true
  } catch {
    return false
  }
}

/**
 * ASCII validation
 */
export function isAscii(ascii: string): boolean {
  return /^[\x00-\x7F]*$/.test(ascii)
}

/**
 * Base32 validation
 */
export function isBase32(base32: string): boolean {
  return /^[A-Z2-7]+=*$/.test(base32.toUpperCase())
}

/**
 * Byte length validation
 */
export function isByteLength(str: string, options?: { min?: number, max?: number }): boolean {
  const min = options?.min ?? 0
  const max = options?.max ?? Infinity
  const byteLength = new TextEncoder().encode(str).length
  return byteLength >= min && byteLength <= max
}

/**
 * FQDN validation (Fully Qualified Domain Name)
 */
export function isFQDN(fqdn: string): boolean {
  const fqdnRegex = /^(?=.{1,253}$)((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/
  return fqdnRegex.test(fqdn)
}

/**
 * Full width character validation
 */
export function isFullWidth(fullWidth: string): boolean {
  return /^[\uFF00-\uFFEF]+$/.test(fullWidth)
}

/**
 * Half width character validation
 */
export function isHalfWidth(halfWidth: string): boolean {
  return /^[\u0020-\u007E\uFF61-\uFF9F]+$/.test(halfWidth)
}

/**
 * Hash validation for various algorithms
 */
export function isHash(hash: string, algorithm: HashAlgorithm): boolean {
  const hashLengths: Record<HashAlgorithm, number> = {
    'md5': 32,
    'sha1': 40,
    'sha256': 64,
    'sha384': 96,
    'sha512': 128,
  }

  const expectedLength = hashLengths[algorithm]
  if (!expectedLength) return false

  return hash.length === expectedLength && /^[a-f0-9]+$/i.test(hash)
}

/**
 * HSL color validation
 */
export function isHSL(hsl: string): boolean {
  const hslRegex = /^hsl\(\s*(\d+)\s*,\s*(\d+(?:\.\d+)?%)\s*,\s*(\d+(?:\.\d+)?%)\s*\)$/
  return hslRegex.test(hsl)
}

/**
 * IBAN validation
 */
export function isIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false
  if (cleaned.length < 15 || cleaned.length > 34) return false

  // Move first 4 chars to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)

  // Convert letters to numbers (A=10, B=11, etc.)
  const digits = rearranged.split('').map(char => {
    const code = char.charCodeAt(0)
    return code >= 65 && code <= 90 ? (code - 55).toString() : char
  }).join('')

  // Mod 97 check
  let remainder = digits.slice(0, 2)
  for (let i = 2; i < digits.length; i += 7) {
    remainder = (parseInt(remainder + digits.slice(i, i + 7), 10) % 97).toString()
  }

  return parseInt(remainder, 10) === 1
}

/**
 * Identity card validation
 */
export function isIdentityCard(identityCard: string): boolean {
  // Generic validation for common ID card formats
  const cleaned = identityCard.replace(/[\s-]/g, '')
  return /^[A-Z0-9]{5,20}$/i.test(cleaned)
}

/**
 * ISIN validation
 */
export function isISIN(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false

  // Convert to digits
  const digits = isin.split('').map(char => {
    const code = char.charCodeAt(0)
    return code >= 65 && code <= 90 ? (code - 55).toString() : char
  }).join('')

  // Luhn algorithm
  let sum = 0
  let isEven = true

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * ISO 8601 date validation
 */
export function isISO8601(iso8601: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/
  if (!iso8601Regex.test(iso8601)) return false

  try {
    const date = new Date(iso8601)
    return !isNaN(date.getTime())
  } catch {
    return false
  }
}

/**
 * ISRC validation
 */
export function isISRC(isrc: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(isrc.replace(/-/g, ''))
}

/**
 * ISSN validation
 */
export function isISSN(issn: string): boolean {
  const cleaned = issn.replace(/[\s-]/g, '')
  if (!/^\d{7}[\dX]$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 7; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (8 - i)
  }

  const checkChar = cleaned.charAt(7)
  const checkDigit = checkChar === 'X' ? 10 : parseInt(checkChar, 10)
  sum += checkDigit

  return sum % 11 === 0
}

/**
 * ISO 3166-1 alpha-2 country code validation
 */
export function isISO31661Alpha2(iso31661Alpha2: string): boolean {
  return /^[A-Z]{2}$/.test(iso31661Alpha2)
}

/**
 * ISO 3166-1 alpha-3 country code validation
 */
export function isISO31661Alpha3(iso31661Alpha3: string): boolean {
  return /^[A-Z]{3}$/.test(iso31661Alpha3)
}

/**
 * Username validation
 */
export function validateUsername(username: string): boolean {
  return isAlphanumeric(username)
}

/**
 * Latitude validation
 */
export function isLatitude(latitude: string): boolean {
  const lat = parseFloat(latitude)
  return !isNaN(lat) && lat >= -90 && lat <= 90
}

/**
 * Longitude validation
 */
export function isLongitude(longitude: string): boolean {
  const long = parseFloat(longitude)
  return !isNaN(long) && long >= -180 && long <= 180
}
