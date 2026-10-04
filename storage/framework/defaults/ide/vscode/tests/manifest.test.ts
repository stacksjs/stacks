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
import { libraryContributes, OWN_COMMAND_PREFIX, withStxContributes } from '../scripts/stx-contributes'

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

  it('declares no stx command the library no longer ships', () => {
    const shipped = new Set(libraryContributes(root).commands.map(command => command.command))
    const stale = manifest.contributes.commands
      .map((command: { command: string }) => command.command)
      .filter((id: string) => !id.startsWith(OWN_COMMAND_PREFIX) && !shipped.has(id))
    expect(stale).toEqual([])
  })

  it('drops a command stx renamed when syncing', () => {
    const stale = { ...manifest, contributes: { ...manifest.contributes, commands: [...manifest.contributes.commands, { command: 'css.reload', title: 'Css: Reload Configuration' }] } }
    expect(withStxContributes(stale, libraryContributes(root))).toEqual(manifest)
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

// tsserver loads a plugin only by package name, from the extension's
// node_modules, and VS Code only sends it documents of a language a plugin
// claims (stacksjs/stx#2028).
describe('stx type checking', () => {
  const plugins = manifest.contributes.typescriptServerPlugins as Array<{ name: string, languages?: string[], enableForWorkspaceTypeScriptVersions?: boolean }>

  it('contributes the stx TypeScript server plugin by package name', () => {
    expect(plugins.map(plugin => plugin.name)).toEqual(['@stacksjs/stx-typescript-plugin'])
    for (const plugin of plugins) {
      // The rule tsserver applies before loading anything (requestEnablePlugin).
      expect(plugin.name).not.toMatch(/^(?:\.\.?(?:\/|$)|\/|[a-z]:)/i)
      expect(plugin.name).not.toMatch(/[\\/]\.\.?(?:$|[\\/])/)
    }
  })

  it('claims the stx language, also with the workspace TypeScript the project settings select', () => {
    for (const plugin of plugins) {
      expect(plugin.languages).toEqual(['stx'])
      expect(plugin.enableForWorkspaceTypeScriptVersions).toBeTrue()
    }
    expect(manifest.contributes.configurationDefaults['typescript.tsdk']).toBe('node_modules/typescript/lib')
  })

  it('declares the setting that switches it off', () => {
    const settings = Object.assign({}, ...manifest.contributes.configuration.map((section: { properties: object }) => section.properties))
    expect(settings['stxTypescriptPlugin.enabled'].default).toBeTrue()
  })
})

describe('packaging', () => {
  it('adds the plugin to the VSIX, which vsce --no-dependencies leaves without node_modules', () => {
    expect(manifest.scripts.package).toBe('bun scripts/package.ts')
    expect(manifest.scripts.release).toBe('bun scripts/package.ts --publish')
    expect(readFileSync(join(root, 'scripts/package.ts'), 'utf8')).toContain(`'vsce', 'package', '--no-dependencies'`)
    // The release workflow publishes through the script, not a bare `vsce publish`.
    const workflow = readFileSync(join(root, '../../../../../.github/workflows/release.yml'), 'utf8')
    const step = workflow.slice(workflow.indexOf('- name: Publish VS Code Extension'))
    expect(step.slice(0, step.indexOf('- name:', 10))).toContain('bun run release')
    expect(workflow).not.toContain('vsce publish')
  })

  it('ships the files the extension loads at runtime', () => {
    for (const file of ['dist/extension.js', 'dist/pickier-worker.js', 'dist/pickier-worker.bunfig.toml'])
      expect(manifest.files).toContain(file)
    expect(manifest.main).toBe('./dist/extension.js')
  })
})
