/**
 * The extension manifest.
 *
 * The Stacks extension is self-contained: stx support, pickier and env files
 * are built in, so it installs no extension pack and depends on no other
 * extension. stx support comes from `@stacksjs/stx-vscode`, the library build
 * of the stx extension (Stacks.vscode-stx); with both installed, the stx
 * extension stands down (stacksjs/stx#2020).
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { libraryContributes, withStxContributes } from '../scripts/stx-contributes'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const STX_EXTENSION_ID = 'Stacks.vscode-stx'
const projectSettings = Bun.JSONC.parse(readFileSync(join(root, '.vscode/settings.json'), 'utf8')) as Record<string, any>
const recommendations = (Bun.JSONC.parse(readFileSync(join(root, '.vscode/extensions.json'), 'utf8')) as { recommendations: string[] }).recommendations

describe('marketplace identity', () => {
  it('is Stacks.vscode-stacks, not the stx extension', () => {
    const id = `${manifest.publisher}.${manifest.name}`
    expect(id).toBe('Stacks.vscode-stacks')
    expect(id.toLowerCase()).not.toBe(STX_EXTENSION_ID.toLowerCase())
  })
})

describe('self-contained', () => {
  it('installs no extension pack and depends on no extension', () => {
    expect(manifest.extensionPack).toBeUndefined()
    expect(manifest.extensionDependencies).toBeUndefined()
  })

  it('has no runtime dependencies to ship', () => {
    expect(manifest.dependencies).toBeUndefined()
  })

  it('recommends only itself to new projects', () => {
    expect(recommendations.map(id => id.toLowerCase())).toEqual(['stacks.vscode-stacks'])
  })

  it('configures new projects for no other extension', () => {
    // Settings that only mean something to an extension the project no longer
    // asks for: ESLint, Prettier, Biome, markdownlint, shell-format, cSpell,
    // Grammarly, vscode-icons, Todo Tree.
    const foreign = Object.keys(projectSettings).filter(key =>
      /^(?:eslint|prettier|biome|markdownlint|cSpell|grammarly|vsicons|todo-tree)\./.test(key))
    expect(foreign).toEqual([])
    expect(JSON.stringify(projectSettings)).not.toMatch(/dbaeumer|foxundermoon|DavidAnson|esbenp/i)
  })

  it('formats and fixes with pickier through this extension', () => {
    expect(projectSettings['editor.defaultFormatter']).toBe('Stacks.vscode-stacks')
    expect(projectSettings['editor.codeActionsOnSave']['source.fixAll.pickier']).toBe('explicit')
  })
})

describe('stx language support', () => {
  it('declares what @stacksjs/stx-vscode ships (run `bun run sync:stx` after updating it)', () => {
    expect(withStxContributes(manifest, libraryContributes(root))).toEqual(manifest)
  })

  it('declares the stx language and its grammar from the bundled assets', () => {
    expect(manifest.contributes.languages.map((language: { id: string }) => language.id)).toContain('stx')
    expect(manifest.contributes.grammars[0].path).toStartWith('./dist/stx/')
    expect(manifest.files).toContain('dist/stx/**')
    expect(manifest.activationEvents).toContain('onLanguage:stx')
  })

  it('leaves snippets to runtime, so they never show twice next to the stx extension', () => {
    expect(manifest.contributes.snippets).toBeUndefined()
  })

  it('does not map .stx files to another language', () => {
    const extensionDefaults = manifest.contributes.configurationDefaults['files.associations'] ?? {}
    for (const associations of [extensionDefaults, projectSettings['files.associations'] ?? {}])
      expect(Object.keys(associations).filter(pattern => pattern.endsWith('.stx'))).toEqual([])
  })
})

describe('packaging', () => {
  it('ships the files the extension loads at runtime', () => {
    for (const file of ['dist/extension.js', 'dist/pickier-worker.js', 'dist/pickier-worker.bunfig.toml'])
      expect(manifest.files).toContain(file)
    expect(manifest.main).toBe('./dist/extension.js')
  })
})
