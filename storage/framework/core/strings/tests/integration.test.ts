import { describe, expect, test } from 'bun:test'
import {
  camelCase,
  capitalize,
  constantCase,
  dotCase,
  kebabCase,
  noCase,
  pascalCase,
  pathCase,
  sentenceCase,
  snakeCase,
  trainCase,
} from '../src/case'
import { pluralize, singular } from '../src/pluralize'
import { slug, random, slash, ensurePrefix, ensureSuffix, template, truncate } from '../src/utils'
import { slugify } from '../src/slug'
import { Str } from '../src/macro'
import {
  isEmail,
  isStrongPassword,
  isURL,
  isAlphanumeric,
  isUUID,
  isJSON,
  isIP,
  isHexColor,
  isCreditCard,
} from '../src/validators'

describe('Strings Integration', () => {
  describe('Case conversions', () => {
    test('camelCase converts various formats', () => {
      expect(camelCase('hello world')).toBe('helloWorld')
      expect(camelCase('foo-bar-baz')).toBe('fooBarBaz')
      expect(camelCase('FooBar')).toBe('fooBar')
      expect(camelCase('some_snake_case')).toBe('someSnakeCase')
    })

    test('snakeCase converts various formats', () => {
      expect(snakeCase('helloWorld')).toBe('hello_world')
      expect(snakeCase('foo-bar-baz')).toBe('foo_bar_baz')
      expect(snakeCase('FooBarBaz')).toBe('foo_bar_baz')
    })

    test('kebabCase converts various formats', () => {
      expect(kebabCase('helloWorld')).toBe('hello-world')
      expect(kebabCase('foo_bar_baz')).toBe('foo-bar-baz')
      expect(kebabCase('FooBarBaz')).toBe('foo-bar-baz')
    })

    test('pascalCase converts various formats', () => {
      expect(pascalCase('hello world')).toBe('HelloWorld')
      expect(pascalCase('foo-bar-baz')).toBe('FooBarBaz')
      expect(pascalCase('some_snake_case')).toBe('SomeSnakeCase')
    })

    test('capitalize first letter and lowercases rest', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('HELLO')).toBe('Hello')
      expect(capitalize('hELLO WORLD')).toBe('Hello world')
    })

    test('constantCase converts to UPPER_SNAKE', () => {
      expect(constantCase('helloWorld')).toBe('HELLO_WORLD')
      expect(constantCase('foo-bar')).toBe('FOO_BAR')
    })

    test('dotCase converts to dot.separated', () => {
      expect(dotCase('helloWorld')).toBe('hello.world')
      expect(dotCase('foo-bar')).toBe('foo.bar')
    })

    test('pathCase converts to path/separated', () => {
      expect(pathCase('helloWorld')).toBe('hello/world')
      expect(pathCase('foo-bar')).toBe('foo/bar')
    })

    test('noCase converts to space separated', () => {
      expect(noCase('helloWorld')).toBe('hello world')
      expect(noCase('foo-bar')).toBe('foo bar')
    })

    test('sentenceCase capitalizes first word only', () => {
      expect(sentenceCase('helloWorld')).toBe('Hello world')
      expect(sentenceCase('foo-bar-baz')).toBe('Foo bar baz')
    })

    test('trainCase converts to Header-Case', () => {
      expect(trainCase('helloWorld')).toBe('Hello-World')
      expect(trainCase('foo_bar')).toBe('Foo-Bar')
    })
  })

  describe('Pluralization', () => {
    test('pluralize common nouns', () => {
      expect(pluralize.plural('cat')).toBe('cats')
      expect(pluralize.plural('box')).toBe('boxes')
      expect(pluralize.plural('bus')).toBe('buses')
      expect(pluralize.plural('child')).toBe('children')
      expect(pluralize.plural('person')).toBe('people')
    })

    test('singularize common nouns', () => {
      expect(pluralize.singular('cats')).toBe('cat')
      expect(pluralize.singular('boxes')).toBe('box')
      expect(pluralize.singular('children')).toBe('child')
      expect(pluralize.singular('people')).toBe('person')
    })

    test('singular function works as standalone', () => {
      expect(singular('dogs')).toBe('dog')
      expect(singular('mice')).toBe('mouse')
    })

    test('isPlural and isSingular detect form', () => {
      expect(pluralize.isPlural('cats')).toBe(true)
      expect(pluralize.isSingular('cat')).toBe(true)
    })

    test('irregular plurals work correctly', () => {
      expect(pluralize.plural('goose')).toBe('geese')
      expect(pluralize.plural('foot')).toBe('feet')
      expect(pluralize.plural('tooth')).toBe('teeth')
      expect(pluralize.singular('geese')).toBe('goose')
    })

    test('uncountable words stay the same', () => {
      expect(pluralize.plural('sheep')).toBe('sheep')
      expect(pluralize.plural('fish')).toBe('fish')
      expect(pluralize.plural('software')).toBe('software')
    })
  })

  describe('Slug generation', () => {
    test('slug converts to lowercase hyphenated', () => {
      expect(slug('Hello World')).toBe('hello-world')
      expect(slug('My Blog Post Title')).toBe('my-blog-post-title')
    })

    test('slug strips special characters', () => {
      expect(slug('Hello & World!')).toBe('hello-and-world')
      expect(slug('foo@bar#baz')).toBe('foobarbaz')
    })

    test('slugify with custom options', () => {
      expect(slugify('Hello World', { replacement: '_', lower: true })).toBe('hello_world')
      expect(slugify('Hello World', { lower: false })).toBe('Hello-World')
    })

    test('slug handles accented characters', () => {
      expect(slug('cafe latte')).toBe('cafe-latte')
      expect(slug('uber cool')).toBe('uber-cool')
    })
  })

  describe('String utilities', () => {
    test('slash converts backslashes to forward slashes', () => {
      expect(slash('C:\\Users\\Chris')).toBe('C:/Users/Chris')
      expect(slash('path\\to\\file')).toBe('path/to/file')
    })

    test('ensurePrefix adds prefix only if missing', () => {
      expect(ensurePrefix('https://', 'google.com')).toBe('https://google.com')
      expect(ensurePrefix('https://', 'https://google.com')).toBe('https://google.com')
    })

    test('ensureSuffix adds suffix only if missing', () => {
      expect(ensureSuffix('.js', 'index')).toBe('index.js')
      expect(ensureSuffix('.js', 'index.js')).toBe('index.js')
    })

    test('template replaces positional placeholders', () => {
      expect(template('Hello {0}! My name is {1}.', 'Buddy', 'Chris')).toBe('Hello Buddy! My name is Chris.')
      expect(template('{0} + {1} = {0}{1}', 'a', 'b')).toBe('a + b = ab')
    })

    test('truncate shortens strings with ellipsis', () => {
      expect(truncate('Hello World', 5)).toBe('He...')
      expect(truncate('Hi', 10)).toBe('Hi') // no truncation needed
      expect(truncate('Hello World', 8, '---')).toBe('Hello---')
    })

    test('random generates string of correct length', () => {
      const r1 = random(16)
      expect(r1.length).toBe(16)
      const r2 = random(32)
      expect(r2.length).toBe(32)
      // two randoms should differ
      expect(r1).not.toBe(random(16))
    })
  })

  describe('Str macro class', () => {
    test('Str.camelCase delegates correctly', () => {
      expect(Str.camelCase('hello-world')).toBe('helloWorld')
    })

    test('Str.snakeCase delegates correctly', () => {
      expect(Str.snakeCase('helloWorld')).toBe('hello_world')
    })

    test('Str.kebabCase delegates correctly', () => {
      expect(Str.kebabCase('helloWorld')).toBe('hello-world')
    })

    test('Str.pascalCase delegates correctly', () => {
      expect(Str.pascalCase('hello-world')).toBe('HelloWorld')
    })

    test('Str.plural and Str.singular', () => {
      expect(Str.plural('dog')).toBe('dogs')
      expect(Str.singular('dogs')).toBe('dog')
    })

    test('Str.slug delegates correctly', () => {
      expect(Str.slug('Hello World')).toBe('hello-world')
    })

    test('Str.capitalize delegates correctly', () => {
      expect(Str.capitalize('hello')).toBe('Hello')
    })
  })

  describe('Validators', () => {
    test('isEmail validates email addresses', () => {
      expect(isEmail('user@example.com')).toBe(true)
      expect(isEmail('not-an-email')).toBe(false)
      expect(isEmail('a@b.c')).toBe(true)
    })

    test('isStrongPassword checks password strength', () => {
      expect(isStrongPassword('Abcdefg1!')).toBe(true)
      expect(isStrongPassword('weak')).toBe(false)
      expect(isStrongPassword('nouppercase1!')).toBe(false)
      expect(isStrongPassword('NOLOWERCASE1!')).toBe(false)
    })

    test('isURL validates URLs', () => {
      expect(isURL('https://example.com')).toBe(true)
      expect(isURL('http://localhost:3000')).toBe(true)
      expect(isURL('not-a-url')).toBe(false)
    })

    test('isAlphanumeric validates alphanumeric strings', () => {
      expect(isAlphanumeric('abc123')).toBe(true)
      expect(isAlphanumeric('abc 123')).toBe(false)
      expect(isAlphanumeric('abc-123')).toBe(false)
    })

    test('isUUID validates UUIDs', () => {
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isUUID('not-a-uuid')).toBe(false)
    })

    test('isJSON validates JSON strings', () => {
      expect(isJSON('{"key":"value"}')).toBe(true)
      expect(isJSON('[1,2,3]')).toBe(true)
      expect(isJSON('not json')).toBe(false)
    })

    test('isIP validates IP addresses', () => {
      expect(isIP('192.168.1.1')).toBe(true)
      expect(isIP('999.999.999.999')).toBe(false)
      expect(isIP('::1')).toBe(true)
    })

    test('isHexColor validates hex colors', () => {
      expect(isHexColor('#ff0000')).toBe(true)
      expect(isHexColor('#f00')).toBe(true)
      expect(isHexColor('red')).toBe(false)
    })

    test('isCreditCard validates card numbers with Luhn', () => {
      // Visa test number
      expect(isCreditCard('4111111111111111')).toBe(true)
      expect(isCreditCard('1234567890123456')).toBe(false)
    })
  })
})
