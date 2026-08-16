import { describe, expect, test } from 'bun:test'
import { basename } from 'node:path'

describe('default team API scope contract', () => {
  test('guards every team-owned generated API with active-team middleware', async () => {
    const models = new Bun.Glob('storage/framework/defaults/app/Models/**/*.ts')
    let checked = 0

    for await (const file of models.scan({ absolute: true, onlyFiles: true })) {
      const source = await Bun.file(file).text()
      const belongsToTeam = /belongsTo:\s*\[[^\]]*['"]Team['"]/s.test(source)
      const exposesApi = /useApi\s*:/.test(source)
      if (!belongsToTeam || !exposesApi)
        continue

      checked += 1
      expect(
        source,
        `${basename(file)} exposes a Team-owned API without the team middleware`,
      ).toMatch(/middleware\s*:\s*\[[^\]]*['"]team['"]/s)
    }

    expect(checked).toBeGreaterThanOrEqual(12)
  })
})
