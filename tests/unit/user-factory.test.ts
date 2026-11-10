import { describe, expect, test } from 'bun:test'
import { faker } from '@stacksjs/faker'
import User from '../../storage/framework/defaults/app/Models/User'

/**
 * A seeded user's email belongs to their name. They were generated apart, so
 * the dashboard's Users page listed "Alex Castillo" at kimberly.lee@..., row
 * after row, which reads as a data error to anyone looking at a demo.
 */
const attributes = (User as any).attributes as Record<string, { factory: (faker: any, attributes: Record<string, unknown>) => string }>

describe('the User factory', () => {
  test('builds each email from the name seeded before it', () => {
    for (let i = 0; i < 25; i++) {
      const name = attributes.name.factory(faker, {})
      const email = attributes.email.factory(faker, { name })
      const words = name.split(/\s+/).filter(word => !word.endsWith('.'))
      const local = email.split('@')[0]!
      expect(email, name).toBe(email.toLowerCase())
      expect(local, `${name} -> ${email}`).toContain(words[0]!.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3))
      expect(local, `${name} -> ${email}`).toContain(words.at(-1)!.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3))
    }
  })

  test('leaves titles and suffixes out of the address', () => {
    const email = attributes.email.factory(faker, { name: 'Dr. Jane Smith Jr.' })
    expect(email).toMatch(/^jane[._-]?smith\d*@/)
  })

  test('still produces an address without a name', () => {
    expect(attributes.email.factory(faker, {})).toContain('@')
  })
})
