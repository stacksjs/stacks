import { describe, expect, it } from 'bun:test'
import { makeModelRecords } from '../src/seeder'

/**
 * A unique value the factory produced distinct is kept exactly as produced.
 *
 * The seeder claims each record's unique values once to see whether to
 * regenerate it, then once more, with a suffix, for a record whose retries
 * were spent. The second claim also ran for a record that had been distinct
 * all along, found the value the first claim had just recorded, and suffixed
 * it. So every unique column on every seeded row was rewritten:
 * `julianruiz@alphatech.app-1`, a coupon `TVAML2PI-1`, a license key
 * `OX4E-NBGR-F98A-AKN4-HCL5-1` that its own model's pattern rejects, and the
 * dashboard's license key list answered 503 for all of them.
 */
describe('seeded unique values', () => {
  it('keeps an email the factory made distinct addressable', async () => {
    const users = await makeModelRecords('User', 5)
    for (const user of users)
      expect(String(user.email)).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i)
  })

  it('keeps a license key in the format its model declares', async () => {
    const keys = await makeModelRecords('LicenseKey', 5)
    for (const key of keys)
      expect(String(key.key)).toMatch(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/)
  })
})
