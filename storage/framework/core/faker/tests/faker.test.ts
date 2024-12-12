import { faker } from '../src'

describe('@stacksjs/faker', () => {
  it('faker is defined', () => {
    expect(faker).toBeDefined()
  })

  it('generates a random name', () => {
    const name = faker.person.fullName()
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThan(0)
  })

  it('generates a random email', () => {
    const email = faker.internet.email()
    expect(typeof email).toBe('string')
    expect(email).toContain('@')
  })

  it('generates a random number', () => {
    const number = faker.number.int({ min: 1, max: 100 })
    expect(typeof number).toBe('number')
    expect(number).toBeGreaterThanOrEqual(1)
    expect(number).toBeLessThanOrEqual(100)
  })

  it('generates a random date', () => {
    const date = faker.date.past()
    expect(date).toBeInstanceOf(Date)
    expect(date.getTime()).toBeLessThan(new Date().getTime())
  })
})
