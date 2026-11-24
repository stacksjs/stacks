import { describe, expect, test } from 'bun:test'
import f7 from '@iconify-json/f7/icons.json'
import hugeicons from '@iconify-json/hugeicons/icons.json'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dashboardRoots = [
  join(process.cwd(), 'storage/framework/defaults/views/dashboard'),
  join(process.cwd(), 'storage/framework/defaults/resources/components/Dashboard'),
]

async function dashboardIconTokens(): Promise<string[]> {
  const tokens = new Set<string>()
  const glob = new Bun.Glob('**/*.{stx,ts}')

  for (const root of dashboardRoots) {
    for await (const file of glob.scan({ cwd: root, absolute: true })) {
      const source = await Bun.file(file).text()
      for (const match of source.matchAll(/\bi-[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g))
        tokens.add(match[0])
    }
  }

  return [...tokens].sort()
}

describe('dashboard icon contract', () => {
  // Hugeicons draws the dashboard; Framework7 draws the macOS-style native
  // settings. Both ship with @stacksjs/defaults, and nothing else does.
  test('every dashboard icon belongs to a bundled collection', async () => {
    const collections: Record<string, { icons: Record<string, unknown>, aliases?: Record<string, unknown> }> = {
      'i-hugeicons-': hugeicons,
      'i-f7-': f7,
    }
    const tokens = await dashboardIconTokens()
    const prefixOf = (token: string) => Object.keys(collections).find(prefix => token.startsWith(prefix))
    const unexpectedCollections = tokens.filter(token => !prefixOf(token))
    const missingNames = tokens.filter((token) => {
      const prefix = prefixOf(token)
      if (!prefix)
        return false
      const name = token.slice(prefix.length)
      const collection = collections[prefix]!
      return !(name in collection.icons) && !(name in (collection.aliases || {}))
    })

    expect(tokens.length).toBeGreaterThan(150)
    expect(unexpectedCollections).toEqual([])
    expect(missingNames).toEqual([])
  })

  test('the shared icon stylesheet scans component and composable sources', () => {
    const source = readFileSync(
      join(process.cwd(), 'storage/framework/core/actions/src/dashboard-assets.ts'),
      'utf8',
    )

    expect(source).toContain("new Bun.Glob('**/*.{stx,ts}')")
  })
})
