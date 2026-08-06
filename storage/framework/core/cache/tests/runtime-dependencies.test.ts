import { describe, expect, test } from 'bun:test'

describe('@stacksjs/cache package contract', () => {
  test('ships the cache engine needed by its public runtime', async () => {
    const manifest = await Bun.file(new URL('../package.json', import.meta.url)).json() as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    expect(manifest.dependencies?.['@stacksjs/ts-cache']).toBeTruthy()
    expect(manifest.devDependencies?.['@stacksjs/ts-cache']).toBeUndefined()
  })
})
