import { describe, expect, it } from 'bun:test'
import { faker } from '../src/index'

describe('@stacksjs/faker', () => {
  it('faker is defined', () => {
    expect(faker).toBeDefined()
  })

  it('faker.person.fullName() returns a non-empty string', () => {
    const name = faker.person.fullName()
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThan(0)
  })

  it('faker.internet.email() returns an email-like string', () => {
    const email = faker.internet.email()
    expect(typeof email).toBe('string')
    expect(email).toContain('@')
    expect(email).toMatch(/^[^\s]+@[^\s]+\.[^\s]+$/)
  })

  it('faker.number.int() returns a number', () => {
    const num = faker.number.int({ min: 1, max: 100 })
    expect(typeof num).toBe('number')
    expect(num).toBeGreaterThanOrEqual(1)
    expect(num).toBeLessThanOrEqual(100)
  })

  it('supports the legacy numeric shorthand used by model factories', () => {
    const integer = faker.number.int(10)
    const decimal = faker.number.float({ min: 1, max: 2, fractionDigits: 3 })

    expect(integer).toBeGreaterThanOrEqual(0)
    expect(integer).toBeLessThanOrEqual(10)
    expect(decimal).toBeGreaterThanOrEqual(1)
    expect(decimal).toBeLessThanOrEqual(2)
    expect(decimal.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3)
  })

  it('faker.lorem.sentence() returns a non-empty string', () => {
    const sentence = faker.lorem.sentence()
    expect(typeof sentence).toBe('string')
    expect(sentence.length).toBeGreaterThan(0)
  })

  it('faker.lorem supports min and max count ranges used by model factories', () => {
    const sentence = faker.lorem.sentence({ min: 4, max: 4 })
    const paragraphs = faker.lorem.paragraphs({ min: 2, max: 2 }, '\n\n')

    expect(sentence).not.toBe('.')
    expect(sentence.split(/\s+/)).toHaveLength(4)
    expect(paragraphs.split('\n\n')).toHaveLength(2)
    expect(paragraphs.replaceAll('\n', '').length).toBeGreaterThan(0)
  })

  it('faker.string.uuid() matches UUID pattern', () => {
    const uuid = faker.string.uuid()
    expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i)
  })

  it('supports numeric string lengths and credit-card patterns', () => {
    expect(faker.string.alpha(10)).toHaveLength(10)
    expect(faker.string.alphanumeric(12)).toHaveLength(12)
    expect(faker.finance.creditCardNumber('####-####')).toMatch(/^\d{4}-\d{4}$/)
  })

  it('faker.helpers.arrayElement() picks from provided array', () => {
    const options = ['a', 'b', 'c']
    const picked = faker.helpers.arrayElement(options)
    expect(options).toContain(picked)
  })

  it('faker.datatype.boolean() returns a boolean', () => {
    const value = faker.datatype.boolean()
    expect(typeof value).toBe('boolean')
  })

  it('supports probability options and slug generation', () => {
    expect(faker.datatype.boolean({ probability: 1 })).toBe(true)
    expect(faker.datatype.boolean({ probability: 0 })).toBe(false)
    expect(faker.helpers.slugify('Already Typed!')).toBe('already-typed')
  })

  it('faker.datatype.uuid() returns a UUID string', () => {
    const uuid = faker.datatype.uuid()
    expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i)
  })

  it('faker.lorem.words() returns space-separated words', () => {
    const words = faker.lorem.words(3)
    expect(typeof words).toBe('string')
    expect(words.split(' ').length).toBeGreaterThanOrEqual(1)
  })

  it('faker.location.city() returns a non-empty string', () => {
    const city = faker.location.city()
    expect(typeof city).toBe('string')
    expect(city.length).toBeGreaterThan(0)
  })

  it('faker.image.url() returns a usable seeded preview URL', () => {
    const imageUrl = faker.image.url({ width: 800, height: 600 })

    expect(imageUrl).toMatch(/^https:\/\/picsum\.photos\/seed\/[a-z0-9]+\/800\/600$/)
    expect(imageUrl).not.toContain('placeholder.com')
  })

  it('faker.phone.number() returns a non-empty phone number', () => {
    const phone = faker.phone.number()
    expect(typeof phone).toBe('string')
    expect(phone.length).toBeGreaterThanOrEqual(10)
  })

  it('faker.helpers.shuffle() returns a shuffled copy of the array', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = faker.helpers.shuffle(arr)
    expect(shuffled).toHaveLength(arr.length)
    // Every element from original should be present
    for (const item of arr) {
      expect(shuffled).toContain(item)
    }
  })

  it('faker.vehicle.vin() returns a 17-character string', () => {
    const vin = faker.vehicle.vin()
    expect(typeof vin).toBe('string')
    expect(vin.length).toBe(17)
  })
})
