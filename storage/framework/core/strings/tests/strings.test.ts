import { describe, expect, test } from 'bun:test'
import * as caseUtils from '../src/case'
import * as helpers from '../src/helpers'
import * as strings from '../src/index'
import * as is from '../src/is'
import { Str } from '../src/macro'
import * as pluralize from '../src/pluralize'
import * as utils from '../src/utils'

describe('@stacksjs/strings', () => {
  describe('Case utilities', () => {
    test('capitalize', () => {
      expect(caseUtils.capitalize('hello world')).toBe('Hello world')
      expect(caseUtils.capitalize('')).toBe('')
    })

    test('lowercase', () => {
      expect(caseUtils.lowercase('HELLO WORLD')).toBe('hello world')
    })

    test('camelCase', () => {
      expect(caseUtils.camelCase('hello world')).toBe('helloWorld')
    })

    test('capitalCase', () => {
      expect(caseUtils.capitalCase('helloWorld')).toBe('Hello World')
    })

    test('constantCase', () => {
      expect(caseUtils.constantCase('helloWorld')).toBe('HELLO_WORLD')
    })

    test('dotCase', () => {
      expect(caseUtils.dotCase('helloWorld')).toBe('hello.world')
    })

    test('kebabCase', () => {
      expect(caseUtils.kebabCase('helloWorld')).toBe('hello-world')
    })

    test('pascalCase', () => {
      expect(caseUtils.pascalCase('hello world')).toBe('HelloWorld')
    })

    test('pathCase', () => {
      expect(caseUtils.pathCase('helloWorld')).toBe('hello/world')
    })

    test('sentenceCase', () => {
      expect(caseUtils.sentenceCase('helloWorld')).toBe('Hello world')
    })

    test('snakeCase', () => {
      expect(caseUtils.snakeCase('helloWorld')).toBe('hello_world')
    })

    test('titleCase', () => {
      expect(caseUtils.titleCase('hello world')).toBe('Hello World')
    })
  })

  describe('Helpers', () => {
    test('toString', () => {
      expect(helpers.toString({})).toBe('[object Object]')
      expect(helpers.toString([])).toBe('[object Array]')
      expect(helpers.toString(42)).toBe('[object Number]')
      expect(helpers.toString('hello')).toBe('[object String]')
    })
  })

  describe('Validation utilities', () => {
    test('isEmail', () => {
      expect(is.isEmail('test@example.com')).toBe(true)
      expect(is.isEmail('invalid-email')).toBe(false)
    })

    test('isStrongPassword', () => {
      expect(is.isStrongPassword('StrongP@ssw0rd')).toBe(true)
      expect(is.isStrongPassword('weak')).toBe(false)
    })

    test('isAlphanumeric', () => {
      expect(is.isAlphanumeric('abc123')).toBe(true)
      expect(is.isAlphanumeric('abc 123')).toBe(false)
    })

    test('validateUsername', () => {
      expect(is.validateUsername('johndoe123')).toBe(true)
      expect(is.validateUsername('john doe')).toBe(false)
    })

    test('isURL', () => {
      expect(is.isURL('https://example.com')).toBe(true)
      expect(is.isURL('not-a-url')).toBe(false)
    })

    test('isMobilePhone', () => {
      expect(is.isMobilePhone('+1234567890')).toBe(true)
      expect(is.isMobilePhone('not-a-phone')).toBe(false)
    })

    test('isAlpha', () => {
      expect(is.isAlpha('abcdef')).toBe(true)
      expect(is.isAlpha('abc123')).toBe(false)
    })

    test('isPostalCode', () => {
      expect(is.isPostalCode('12345')).toBe(true)
      expect(is.isPostalCode('not-a-postal-code')).toBe(false)
    })

    test('isNumeric', () => {
      expect(is.isNumeric('12345')).toBe(true)
      expect(is.isNumeric('12a45')).toBe(false)
    })

    test('isHexColor', () => {
      expect(is.isHexColor('#ff0000')).toBe(true)
      expect(is.isHexColor('red')).toBe(false)
    })

    test('isHexadecimal', () => {
      expect(is.isHexadecimal('deadbeef')).toBe(true)
      expect(is.isHexadecimal('not-hex')).toBe(false)
    })

    test('isBase64', () => {
      expect(is.isBase64('SGVsbG8gV29ybGQ=')).toBe(true)
      expect(is.isBase64('not-base64')).toBe(false)
    })

    test('isUUID', () => {
      expect(is.isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(is.isUUID('not-a-uuid')).toBe(false)
    })

    test('isJSON', () => {
      expect(is.isJSON('{"key": "value"}')).toBe(true)
      expect(is.isJSON('not-json')).toBe(false)
    })

    test('isCreditCard', () => {
      expect(is.isCreditCard('4111111111111111')).toBe(true)
      expect(is.isCreditCard('not-a-credit-card')).toBe(false)
    })

    test('isISBN', () => {
      expect(is.isISBN('978-3-16-148410-0')).toBe(true)
      expect(is.isISBN('not-an-isbn')).toBe(false)
    })

    test('isIP', () => {
      expect(is.isIP('192.168.1.1')).toBe(true)
      expect(is.isIP('not-an-ip')).toBe(false)
    })

    test('isIPRange', () => {
      expect(is.isIPRange('192.168.1.1/24')).toBe(true)
      expect(is.isIPRange('not-an-ip-range')).toBe(false)
    })

    test('isMACAddress', () => {
      expect(is.isMACAddress('00:14:22:01:23:45')).toBe(true)
      expect(is.isMACAddress('not-a-mac-address')).toBe(false)
    })

    test('isLatLong', () => {
      expect(is.isLatLong('40.7128,-74.0060')).toBe(true)
      expect(is.isLatLong('not-lat-long')).toBe(false)
    })

    test('isCurrency', () => {
      expect(is.isCurrency('$100.00')).toBe(true)
      expect(is.isCurrency('not-currency')).toBe(false)
    })

    test('isDataURI', () => {
      expect(is.isDataURI('data:,Hello%2C%20World!')).toBe(true)
      expect(is.isDataURI('not-a-data-uri')).toBe(false)
    })

    test('isMimeType', () => {
      expect(is.isMimeType('application/json')).toBe(true)
      expect(is.isMimeType('not-a-mime-type')).toBe(false)
    })

    test('isJWT', () => {
      expect(
        is.isJWT(
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        ),
      ).toBe(true)
      expect(is.isJWT('not-a-jwt')).toBe(false)
    })
  })

  describe('String macros', () => {
    test('slash', () => {
      expect(Str.slash('C:\\Users\\Chris')).toBe('C:/Users/Chris')
    })

    test('ensurePrefix', () => {
      expect(Str.ensurePrefix('https://', 'google.com')).toBe('https://google.com')
      expect(Str.ensurePrefix('https://', 'https://google.com')).toBe('https://google.com')
    })

    test('ensureSuffix', () => {
      expect(Str.ensureSuffix('.js', 'index')).toBe('index.js')
      expect(Str.ensureSuffix('.js', 'index.js')).toBe('index.js')
    })

    test('template', () => {
      expect(Str.template('Hello {0}! My name is {1}.', 'Buddy', 'Chris')).toBe('Hello Buddy! My name is Chris.')
    })

    test('truncate', () => {
      expect(Str.truncate('This is a long string', 10)).toBe('This is a...')
    })

    test('random', () => {
      const randomString = Str.random()
      expect(randomString).toHaveLength(16)
      expect(typeof randomString).toBe('string')
    })

    test('capitalize', () => {
      expect(Str.capitalize('hello world')).toBe('Hello world')
    })

    test('slug', () => {
      expect(Str.slug('Hello World')).toBe('hello-world')
    })

    test('camelCase', () => {
      expect(Str.camelCase('hello world')).toBe('helloWorld')
    })

    test('kebabCase', () => {
      expect(Str.kebabCase('helloWorld')).toBe('hello-world')
    })

    test('snakeCase', () => {
      expect(Str.snakeCase('helloWorld')).toBe('hello_world')
    })
  })

  describe('Pluralization utilities', () => {
    test('plural', () => {
      expect(pluralize.plural('cat')).toBe('cats')
      expect(pluralize.plural('person')).toBe('people')
    })

    test('singular', () => {
      expect(pluralize.singular('cats')).toBe('cat')
      expect(pluralize.singular('people')).toBe('person')
    })

    test('isPlural', () => {
      expect(pluralize.isPlural('cats')).toBe(true)
      expect(pluralize.isPlural('cat')).toBe(false)
    })

    test('isSingular', () => {
      expect(pluralize.isSingular('cat')).toBe(true)
      expect(pluralize.isSingular('cats')).toBe(false)
    })

    test('addPluralRule', () => {
      pluralize.addPluralRule('goose', 'geese')
      expect(pluralize.plural('goose')).toBe('geese')
    })

    test('addSingularRule', () => {
      pluralize.addSingularRule('geese', 'goose')
      expect(pluralize.singular('geese')).toBe('goose')
    })

    test('addIrregularRule', () => {
      pluralize.addIrregularRule('mouse', 'mice')
      expect(pluralize.plural('mouse')).toBe('mice')
      expect(pluralize.singular('mice')).toBe('mouse')
    })

    test('addUncountableRule', () => {
      pluralize.addUncountableRule('fish')
      expect(pluralize.plural('fish')).toBe('fish')
      expect(pluralize.singular('fish')).toBe('fish')
    })
  })

  describe('String utilities', () => {
    test('slash', () => {
      expect(utils.slash('C:\\Users\\Chris')).toBe('C:/Users/Chris')
    })

    test('ensurePrefix', () => {
      expect(utils.ensurePrefix('https://', 'google.com')).toBe('https://google.com')
      expect(utils.ensurePrefix('https://', 'https://google.com')).toBe('https://google.com')
    })

    test('ensureSuffix', () => {
      expect(utils.ensureSuffix('.js', 'index')).toBe('index.js')
      expect(utils.ensureSuffix('.js', 'index.js')).toBe('index.js')
    })

    test('template', () => {
      expect(utils.template('Hello {0}! My name is {1}.', 'Buddy', 'Chris')).toBe('Hello Buddy! My name is Chris.')
    })

    test('truncate', () => {
      expect(utils.truncate('This is a long string', 10)).toBe('This is a...')
    })

    test('random', () => {
      const randomString = utils.random()
      expect(randomString).toHaveLength(16)
      expect(typeof randomString).toBe('string')
    })

    test('slug', () => {
      expect(utils.slug('Hello World')).toBe('hello-world')
    })

    test('detectIndent', () => {
      expect(utils.detectIndent('  hello\n    world')).toBe('  ')
    })

    test('detectNewline', () => {
      expect(utils.detectNewline('hello\nworld')).toBe('\n')
      expect(utils.detectNewline('hello\r\nworld')).toBe('\r\n')
    })
  })

  test('main module exports', () => {
    expect(strings).toBeDefined()
    expect(strings.string).toBeDefined()
  })
})
