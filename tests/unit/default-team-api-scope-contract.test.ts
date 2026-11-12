import { describe, expect, test } from 'bun:test'
import { basename } from 'node:path'

describe('default team API scope contract', () => {
  test('guards every team-owned generated API with active-team middleware', async () => {
    const models = new Bun.Glob('storage/framework/defaults/app/Models/**/*.ts')
    let checked = 0
    const ownerScoped: string[] = []

    for await (const file of models.scan({ absolute: true, onlyFiles: true })) {
      const source = await Bun.file(file).text()
      const belongsToTeam = /belongsTo:\s*\[[^\]]*['"]Team['"]/s.test(source)
      const exposesApi = /useApi\s*:/.test(source)
      if (!belongsToTeam || !exposesApi)
        continue

      checked += 1

      // A model that names its row owner is isolated by that owner, and fails
      // closed for a caller who owns nothing. A license is bought by a
      // customer and may also name the team its seats are for; its generated
      // API answers to the customer, so demanding an active team would lock
      // out everyone with a personal license. The owner must be authenticated.
      if (/ownership\s*:\s*customerOwnership\(/.test(source)) {
        ownerScoped.push(basename(file))
        expect(source, `${basename(file)} scopes rows to a customer but does not require a signed-in caller`)
          .toMatch(/middleware\s*:\s*\[[^\]]*['"]auth['"]/s)
        continue
      }

      expect(
        source,
        `${basename(file)} exposes a Team-owned API without the team middleware`,
      ).toMatch(/middleware\s*:\s*\[[^\]]*['"]team['"]/s)
    }

    expect(checked).toBeGreaterThanOrEqual(12)
    // Named, so a model cannot slip out of the team guard by quietly gaining an owner.
    expect(ownerScoped.sort()).toEqual(['LicenseKey.ts'])
  })
})
