import { describe, expect, test } from 'bun:test'
import * as validators from '../src/validators'

describe('Native Validators', () => {
  describe('Email validation', () => {
    test('valid emails', () => {
      expect(validators.isEmail('test@example.com')).toBe(true)
      expect(validators.isEmail('user+tag@domain.co.uk')).toBe(true)
      expect(validators.isEmail('firstname.lastname@example.com')).toBe(true)
    })

    test('invalid emails', () => {
      expect(validators.isEmail('notanemail')).toBe(false)
      expect(validators.isEmail('missing@domain')).toBe(false)
      expect(validators.isEmail('@example.com')).toBe(false)
    })
  })

  describe('Password validation', () => {
    test('strong passwords', () => {
      expect(validators.isStrongPassword('StrongP@ss1')).toBe(true)
      expect(validators.isStrongPassword('MyP@ssw0rd!')).toBe(true)
    })

    test('weak passwords', () => {
      expect(validators.isStrongPassword('weak')).toBe(false)
      expect(validators.isStrongPassword('nouppercas3!')).toBe(false)
      expect(validators.isStrongPassword('NOLOWERCASE1!')).toBe(false)
      expect(validators.isStrongPassword('NoNumber!')).toBe(false)
      expect(validators.isStrongPassword('NoSymbol123')).toBe(false)
    })
  })

  describe('Alphanumeric validation', () => {
    test('valid alphanumeric', () => {
      expect(validators.isAlphanumeric('abc123')).toBe(true)
      expect(validators.isAlphanumeric('ABC123')).toBe(true)
    })

    test('invalid alphanumeric', () => {
      expect(validators.isAlphanumeric('abc 123')).toBe(false)
      expect(validators.isAlphanumeric('abc-123')).toBe(false)
    })
  })

  describe('URL validation', () => {
    test('valid URLs', () => {
      expect(validators.isURL('https://example.com')).toBe(true)
      expect(validators.isURL('http://example.com')).toBe(true)
      expect(validators.isURL('https://example.com/path')).toBe(true)
    })

    test('invalid URLs', () => {
      expect(validators.isURL('not-a-url')).toBe(false)
      expect(validators.isURL('ftp://example.com')).toBe(false)
    })
  })

  describe('Mobile phone validation', () => {
    test('valid phone numbers', () => {
      expect(validators.isMobilePhone('+12345678900')).toBe(true)
      expect(validators.isMobilePhone('+1 234 567 8900')).toBe(true)
    })

    test('invalid phone numbers', () => {
      expect(validators.isMobilePhone('not-a-phone')).toBe(false)
      expect(validators.isMobilePhone('123')).toBe(false)
    })
  })

  describe('Alpha validation', () => {
    test('valid alpha strings', () => {
      expect(validators.isAlpha('abcdef')).toBe(true)
      expect(validators.isAlpha('ABCDEF')).toBe(true)
    })

    test('invalid alpha strings', () => {
      expect(validators.isAlpha('abc123')).toBe(false)
      expect(validators.isAlpha('abc-def')).toBe(false)
    })
  })

  describe('Postal code validation', () => {
    test('valid postal codes', () => {
      expect(validators.isPostalCode('12345')).toBe(true)
      expect(validators.isPostalCode('12345-6789')).toBe(true)
      expect(validators.isPostalCode('SW1A1AA')).toBe(true)
    })

    test('invalid postal codes', () => {
      expect(validators.isPostalCode('not-a-postal-code')).toBe(false)
      expect(validators.isPostalCode('12')).toBe(false)
    })
  })

  describe('Numeric validation', () => {
    test('valid numeric strings', () => {
      expect(validators.isNumeric('12345')).toBe(true)
      expect(validators.isNumeric('0')).toBe(true)
    })

    test('invalid numeric strings', () => {
      expect(validators.isNumeric('12a45')).toBe(false)
      expect(validators.isNumeric('12.45')).toBe(false)
    })
  })

  describe('Hex color validation', () => {
    test('valid hex colors', () => {
      expect(validators.isHexColor('#ff0000')).toBe(true)
      expect(validators.isHexColor('#F00')).toBe(true)
      expect(validators.isHexColor('#123abc')).toBe(true)
    })

    test('invalid hex colors', () => {
      expect(validators.isHexColor('red')).toBe(false)
      expect(validators.isHexColor('#gg0000')).toBe(false)
    })
  })

  describe('UUID validation', () => {
    test('valid UUIDs', () => {
      expect(validators.isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(validators.isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    test('invalid UUIDs', () => {
      expect(validators.isUUID('not-a-uuid')).toBe(false)
      expect(validators.isUUID('550e8400-e29b-41d4-a716')).toBe(false)
    })
  })

  describe('JSON validation', () => {
    test('valid JSON', () => {
      expect(validators.isJSON('{"key": "value"}')).toBe(true)
      expect(validators.isJSON('[]')).toBe(true)
      expect(validators.isJSON('null')).toBe(true)
    })

    test('invalid JSON', () => {
      expect(validators.isJSON('not-json')).toBe(false)
      expect(validators.isJSON('{key: value}')).toBe(false)
    })
  })

  describe('Credit card validation', () => {
    test('valid credit cards', () => {
      expect(validators.isCreditCard('4111111111111111')).toBe(true)
      expect(validators.isCreditCard('5500000000000004')).toBe(true)
    })

    test('invalid credit cards', () => {
      expect(validators.isCreditCard('not-a-credit-card')).toBe(false)
      expect(validators.isCreditCard('4111111111111112')).toBe(false)
    })
  })

  describe('ISBN validation', () => {
    test('valid ISBNs', () => {
      expect(validators.isISBN('978-3-16-148410-0')).toBe(true)
      expect(validators.isISBN('0-306-40615-2')).toBe(true)
    })

    test('invalid ISBNs', () => {
      expect(validators.isISBN('not-an-isbn')).toBe(false)
      expect(validators.isISBN('123')).toBe(false)
    })
  })

  describe('IP validation', () => {
    test('valid IPv4', () => {
      expect(validators.isIP('192.168.1.1')).toBe(true)
      expect(validators.isIP('8.8.8.8')).toBe(true)
    })

    test('valid IPv6', () => {
      expect(validators.isIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
    })

    test('invalid IPs', () => {
      expect(validators.isIP('not-an-ip')).toBe(false)
      expect(validators.isIP('256.256.256.256')).toBe(false)
    })
  })

  describe('IP range validation', () => {
    test('valid IP ranges', () => {
      expect(validators.isIPRange('192.168.1.1/24')).toBe(true)
      expect(validators.isIPRange('10.0.0.0/8')).toBe(true)
    })

    test('invalid IP ranges', () => {
      expect(validators.isIPRange('not-an-ip-range')).toBe(false)
      expect(validators.isIPRange('192.168.1.1')).toBe(false)
    })
  })

  describe('MAC address validation', () => {
    test('valid MAC addresses', () => {
      expect(validators.isMACAddress('00:14:22:01:23:45')).toBe(true)
      expect(validators.isMACAddress('00-14-22-01-23-45')).toBe(true)
    })

    test('invalid MAC addresses', () => {
      expect(validators.isMACAddress('not-a-mac-address')).toBe(false)
      expect(validators.isMACAddress('00:14:22:01:23')).toBe(false)
    })
  })

  describe('Lat/Long validation', () => {
    test('valid coordinates', () => {
      expect(validators.isLatLong('40.7128,-74.0060')).toBe(true)
      expect(validators.isLatLong('0,0')).toBe(true)
    })

    test('invalid coordinates', () => {
      expect(validators.isLatLong('not-lat-long')).toBe(false)
      expect(validators.isLatLong('91,0')).toBe(false)
      expect(validators.isLatLong('0,181')).toBe(false)
    })
  })

  describe('Currency validation', () => {
    test('valid currency', () => {
      expect(validators.isCurrency('$100.00')).toBe(true)
      expect(validators.isCurrency('1,000.00')).toBe(true)
    })

    test('invalid currency', () => {
      expect(validators.isCurrency('not-currency')).toBe(false)
    })
  })

  describe('JWT validation', () => {
    test('valid JWT', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      expect(validators.isJWT(jwt)).toBe(true)
    })

    test('invalid JWT', () => {
      expect(validators.isJWT('not-a-jwt')).toBe(false)
    })
  })

  describe('Hash validation', () => {
    test('valid MD5 hash', () => {
      expect(validators.isHash('5d41402abc4b2a76b9719d911017c592', 'md5')).toBe(true)
    })

    test('valid SHA256 hash', () => {
      expect(validators.isHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256')).toBe(true)
    })

    test('invalid hash', () => {
      expect(validators.isHash('not-a-hash', 'md5')).toBe(false)
      expect(validators.isHash('5d41402abc4b2a76b9719d911017c592', 'sha256')).toBe(false) // Wrong length
    })
  })

  describe('FQDN validation', () => {
    test('valid FQDNs', () => {
      expect(validators.isFQDN('example.com')).toBe(true)
      expect(validators.isFQDN('subdomain.example.com')).toBe(true)
    })

    test('invalid FQDNs', () => {
      expect(validators.isFQDN('not-a-fqdn')).toBe(false)
      expect(validators.isFQDN('-example.com')).toBe(false)
    })
  })

  describe('IBAN validation', () => {
    test('valid IBANs', () => {
      expect(validators.isIBAN('GB82 WEST 1234 5698 7654 32')).toBe(true)
      expect(validators.isIBAN('DE89370400440532013000')).toBe(true)
    })

    test('invalid IBANs', () => {
      expect(validators.isIBAN('not-an-iban')).toBe(false)
      expect(validators.isIBAN('GB82WEST12345698765433')).toBe(false) // Invalid checksum
    })
  })

  describe('ISO 8601 validation', () => {
    test('valid ISO 8601 dates', () => {
      expect(validators.isISO8601('2023-01-01')).toBe(true)
      expect(validators.isISO8601('2023-01-01T12:00:00Z')).toBe(true)
    })

    test('invalid ISO 8601 dates', () => {
      expect(validators.isISO8601('not-a-date')).toBe(false)
      expect(validators.isISO8601('2023-13-01')).toBe(false)
    })
  })

  describe('Utility validators', () => {
    test('isAscii', () => {
      expect(validators.isAscii('hello')).toBe(true)
      expect(validators.isAscii('hello 世界')).toBe(false)
    })

    test('isBase64', () => {
      expect(validators.isBase64('SGVsbG8gV29ybGQ=')).toBe(true)
      expect(validators.isBase64('not-base64')).toBe(false)
    })

    test('isHexadecimal', () => {
      expect(validators.isHexadecimal('deadbeef')).toBe(true)
      expect(validators.isHexadecimal('not-hex')).toBe(false)
    })

    test('isDataURI', () => {
      expect(validators.isDataURI('data:,Hello%2C%20World!')).toBe(true)
      expect(validators.isDataURI('not-a-data-uri')).toBe(false)
    })

    test('isMimeType', () => {
      expect(validators.isMimeType('application/json')).toBe(true)
      expect(validators.isMimeType('not-a-mime-type')).toBe(false)
    })

    test('isLatitude', () => {
      expect(validators.isLatitude('40.7128')).toBe(true)
      expect(validators.isLatitude('91')).toBe(false)
    })

    test('isLongitude', () => {
      expect(validators.isLongitude('-74.0060')).toBe(true)
      expect(validators.isLongitude('181')).toBe(false)
    })
  })
})
