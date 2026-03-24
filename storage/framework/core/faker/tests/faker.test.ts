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

  it('faker.lorem.sentence() returns a non-empty string', () => {
    const sentence = faker.lorem.sentence()
    expect(typeof sentence).toBe('string')
    expect(sentence.length).toBeGreaterThan(0)
  })

  it('faker.string.uuid() matches UUID pattern', () => {
    const uuid = faker.string.uuid()
    expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i)
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
