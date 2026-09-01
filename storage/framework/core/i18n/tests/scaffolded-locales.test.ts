/**
 * The scaffolded `locales/` files are what every new app starts from, and
 * `loadTranslationFile` returns a `.yml` file's parsed contents as the
 * translation object directly. So any disagreement in shape between two
 * locales - an extra root key, a different key style, a missing entry -
 * means one language silently misses on lookups the other resolves.
 *
 * Regression guard for stacksjs/stacks#2386, where `en.yml` nested every key
 * under a spurious `default:` root that `de.yml` lacked.
 */

import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadFile } from '../src/loader'

const localesDir = join(import.meta.dir, '../../../../../locales')

function flatten(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return [prefix]

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
}

const localeFiles = readdirSync(localesDir).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))

describe('scaffolded locales', () => {
  it('ships more than one locale to compare', () => {
    expect(localeFiles.length).toBeGreaterThan(1)
  })

  it('gives every locale the same key set', async () => {
    const keysByLocale = new Map<string, string[]>()

    for (const file of localeFiles)
      keysByLocale.set(file, flatten(await loadFile(join(localesDir, file))).sort())

    const [reference, ...rest] = [...keysByLocale.entries()]

    for (const [file, keys] of rest)
      expect({ file, keys }).toEqual({ file, keys: reference[1] })
  })

  it('does not wrap a locale in a root key the others lack', async () => {
    for (const file of localeFiles) {
      const roots = Object.keys(await loadFile(join(localesDir, file)) as object)
      expect(roots).not.toContain('default')
    }
  })
})
