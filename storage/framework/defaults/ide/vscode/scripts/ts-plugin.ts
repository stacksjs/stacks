/**
 * The stx TypeScript server plugin, as this extension ships it.
 *
 * It is what type-checks the TypeScript in `.stx` files (script blocks and
 * template expressions) in the editor. `@stacksjs/stx-vscode` publishes it as a
 * complete package, `dist/typescript-plugin/`, and its `contributes.json`
 * carries the `typescriptServerPlugins` entry that `bun run sync:stx` copies
 * into package.json.
 *
 * tsserver loads a plugin only by package name, resolved from
 * `<extension>/node_modules`, the probe location VS Code passes for every
 * extension that contributes one. This extension is packaged with
 * `vsce --no-dependencies`, which leaves node_modules out of the VSIX, so:
 *
 *   dist/stx-typescript-plugin/            the package itself, copied by build.ts
 *                                          (shipped through `files`, like the rest of dist/)
 *   node_modules/<name>/{package.json,index.js}
 *                                          a forwarder to it, written by build.ts for
 *                                          a development host and added to the VSIX
 *                                          by scripts/package.ts after vsce writes it
 *
 * The stx extension (Stacks.vscode-stx) contributes the same plugin under the
 * same name. With both installed tsserver loads it twice, and the plugin
 * decorates each project only the first time (stacksjs/stx#2028).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { libraryContributes } from './stx-contributes'

/** Where build.ts puts the plugin package, relative to the extension root. */
export const TS_PLUGIN_DIST = 'dist/stx-typescript-plugin'

/** The name the plugin is contributed and configured under. */
export function tsPluginName(root: string): string {
  const [plugin] = libraryContributes(root).typescriptServerPlugins
  if (!plugin)
    throw new Error('@stacksjs/stx-vscode contributes no TypeScript server plugin')
  return plugin.name
}

/** Where tsserver resolves the plugin from, relative to the extension root. */
export function tsPluginModuleDir(name: string): string {
  return `node_modules/${name}`
}

/** The forwarder's files, relative to its directory under node_modules. */
export function tsPluginForwarder(name: string, version: string): Record<string, string> {
  const up = '../'.repeat(1 + name.split('/').length)
  return {
    'package.json': `${JSON.stringify({ name, version, private: true, main: 'index.js' }, null, 2)}\n`,
    // tsserver calls `module.exports` as the factory, unwrapped.
    'index.js': `module.exports = require('${up}${TS_PLUGIN_DIST}/index.js')\n`,
  }
}

/** Write the forwarder under `<root>/node_modules`, returning its directory. */
export function writeTsPluginForwarder(root: string, name: string, version: string): string {
  const dir = join(root, tsPluginModuleDir(name))
  mkdirSync(dir, { recursive: true })
  for (const [file, content] of Object.entries(tsPluginForwarder(name, version)))
    writeFileSync(join(dir, file), content)
  return dir
}

/** Copy the plugin package from `@stacksjs/stx-vscode` into `<root>/dist`. */
export function copyTsPlugin(root: string): string {
  const source = dirname(Bun.resolveSync('@stacksjs/stx-vscode/typescript-plugin/package.json', root))
  const target = join(root, TS_PLUGIN_DIST)
  rmSync(target, { recursive: true, force: true })
  cpSync(source, target, { recursive: true })
  return target
}
