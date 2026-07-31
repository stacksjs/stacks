import { describe, expect, test } from 'bun:test'
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
  test('every dashboard icon belongs to the bundled Hugeicons collection', async () => {
    const tokens = await dashboardIconTokens()
    const unexpectedCollections = tokens.filter(token => !token.startsWith('i-hugeicons-'))
    const availableNames = new Set([
      ...Object.keys(hugeicons.icons),
      ...Object.keys(hugeicons.aliases || {}),
    ])
    const missingNames = tokens
      .map(token => token.slice('i-hugeicons-'.length))
      .filter(name => !availableNames.has(name))

    expect(tokens.length).toBeGreaterThan(150)
    expect(unexpectedCollections).toEqual([])
    expect(missingNames).toEqual([])
  })

  test('the shared icon stylesheet scans component and composable sources', () => {
    const source = readFileSync(
      join(process.cwd(), 'storage/framework/core/actions/src/dev/dashboard.ts'),
      'utf8',
    )

    expect(source).toContain("new Bun.Glob('**/*.{stx,ts}')")
  })
})
