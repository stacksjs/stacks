/**
 * The VSIX, as VS Code installs it. It is packaged with `--no-dependencies`,
 * which leaves node_modules out, so scripts/package.ts adds the stx TypeScript
 * plugin's entry there afterwards; without it tsserver finds no plugin and no
 * `.stx` file is type-checked.
 */
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packageExtension } from '../scripts/package'
import { TS_PLUGIN_DIST, tsPluginModuleDir, tsPluginName } from '../scripts/ts-plugin'
import { expectDeclarationsFound, loadLikeTsserver } from './ts-plugin-harness'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// vsce runs `vscode:prepublish` through npm, so this needs npm on PATH; the
// release workflow, which runs these tests before publishing, has it.
const canPackage = Boolean(Bun.which('npm') && Bun.which('zip') && Bun.which('unzip'))

describe('the VSIX', () => {
  it.skipIf(!canPackage)('carries the stx TypeScript plugin, and it loads from the installed layout', () => {
    // Real path: require() resolves symlinks, and macOS's tmpdir is one.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-vsix-test-')))
    try {
      const vsix = packageExtension(join(dir, 'stacks.vsix'))
      const listing = Bun.spawnSync(['unzip', '-Z1', vsix]).stdout.toString().split('\n')
      const name = tsPluginName(root)

      expect(listing).toContain(`extension/${tsPluginModuleDir(name)}/package.json`)
      expect(listing).toContain(`extension/${tsPluginModuleDir(name)}/index.js`)
      // Nothing else of node_modules: the bundle carries its dependencies.
      expect(listing.filter(file => file.startsWith('extension/node_modules/') && !file.startsWith(`extension/${tsPluginModuleDir(name)}/`))).toEqual([])
      expect(listing).toContain(`extension/${TS_PLUGIN_DIST}/types/stx-module.d.ts`)

      expect(Bun.spawnSync(['unzip', '-q', vsix, 'extension/*', '-d', dir]).exitCode).toBe(0)
      const installed = join(dir, 'extension')
      expect(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version).toBe(manifest.version)
      expect(typeof loadLikeTsserver(installed, name)).toBe('function')
      expectDeclarationsFound(installed, name, join(installed, TS_PLUGIN_DIST, 'types'))
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 180_000)
})
