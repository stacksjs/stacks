/**
 * The extension manifest, and its split with the stx extension.
 *
 * `.stx` language support (language, grammar, snippets, language server) is
 * the stx extension, `Stacks.vscode-stx`, published from stacksjs/stx. This
 * extension installs it through `extensionPack` and must not register any of
 * it again: two extensions contributing the `stx` language conflict, and a
 * `*.stx` file association here would take `.stx` files away from it
 * (stacksjs/stx#2020).
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundledExtensions, missingFromMarketplace } from '../scripts/check-marketplace'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const STX_EXTENSION_ID = 'Stacks.vscode-stx'

describe('marketplace identity', () => {
  it('is Stacks.vscode-stacks, not the stx extension', () => {
    const id = `${manifest.publisher}.${manifest.name}`
    expect(id).toBe('Stacks.vscode-stacks')
    expect(id.toLowerCase()).not.toBe(STX_EXTENSION_ID.toLowerCase())
  })
})

describe('stx language support', () => {
  it('comes from the stx extension, through the pack', () => {
    // extensionPack, not extensionDependencies: none of the Stacks commands
    // need the stx language registered, so this extension must keep working
    // when someone disables or uninstalls stx.
    expect(manifest.extensionPack).toContain(STX_EXTENSION_ID)
    expect(manifest.extensionDependencies ?? []).not.toContain(STX_EXTENSION_ID)
  })

  it('is not contributed here as well', () => {
    const contributes = manifest.contributes ?? {}
    const forStx = (entries: Array<{ id?: string, language?: string }> = []) =>
      entries.filter(entry => entry.id === 'stx' || entry.language === 'stx')

    expect(forStx(contributes.languages)).toEqual([])
    expect(forStx(contributes.grammars)).toEqual([])
    expect(forStx(contributes.snippets)).toEqual([])
  })

  it('does not reassociate .stx files with another language', () => {
    const extensionDefaults = manifest.contributes.configurationDefaults['files.associations'] ?? {}
    const projectSettings = Bun.JSONC.parse(readFileSync(join(root, '.vscode/settings.json'), 'utf8')) as Record<string, any>

    for (const associations of [extensionDefaults, projectSettings['files.associations'] ?? {}])
      expect(Object.keys(associations).filter(pattern => pattern.endsWith('.stx'))).toEqual([])
  })
})

describe('check-marketplace', () => {
  it('checks every pack member and dependency once', () => {
    expect(bundledExtensions({ extensionPack: ['a.one', 'b.two'], extensionDependencies: ['b.two', 'c.three'] }))
      .toEqual(['a.one', 'b.two', 'c.three'])
    expect(bundledExtensions(manifest)).toContain(STX_EXTENSION_ID)
  })

  it('reports the extensions the marketplace does not have', async () => {
    const published = new Set(['dotenv.dotenvx-vscode', 'oven.bun-vscode'])
    const missing = await missingFromMarketplace(
      ['dotenv.dotenvx-vscode', STX_EXTENSION_ID, 'oven.bun-vscode'],
      async id => published.has(id),
    )

    expect(missing).toEqual([STX_EXTENSION_ID])
  })
})
